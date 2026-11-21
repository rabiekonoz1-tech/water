require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { initDb, queryAll, queryOne, run, transaction } = require('./db');
const { parseExcelRows } = require('./utils/centerParser');
const { normalizePayload, hydrateInspection } = require('./utils/inspectionPayload');
const C = require('./constants');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ─── Auth Middleware ──────────────────────────────────────────────────────────

async function authMiddleware(req, res, next) {
  const code = (req.headers['x-user-code'] || '').toString().trim().toUpperCase();
  if (!code) return res.status(401).json({ error: 'يرجى تسجيل الدخول بالكود أولاً' });
  try {
    const user = await queryOne('SELECT * FROM users WHERE UPPER(code) = ? AND active = 1', [code]);
    if (!user) return res.status(401).json({ error: 'كود المستخدم غير صحيح أو غير مفعل' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin')
    return res.status(403).json({ error: 'هذا الإجراء متاح للأدمن فقط' });
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logActivity({ plan_id, facility_id = null, facility_name, center = '', worker_id, worker_name, action, summary }) {
  await run(
    `INSERT INTO activity_feed (id, plan_id, facility_id, facility_name, center, worker_id, worker_name, action, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), plan_id, facility_id, facility_name, center, worker_id, worker_name, action, summary, new Date().toISOString()]
  );
}

async function expireStaleReservations(planId) {
  const cutoff = new Date(Date.now() - C.RESERVATION_TTL_HOURS * 3600 * 1000).toISOString();
  const stale = planId
    ? await queryAll("SELECT * FROM facilities WHERE plan_id = ? AND status = 'reserved' AND reserved_at < ?", [planId, cutoff])
    : await queryAll("SELECT * FROM facilities WHERE status = 'reserved' AND reserved_at < ?", [cutoff]);

  for (const f of stale) {
    const now = new Date().toISOString();
    await run(
      `UPDATE facilities SET status = 'available', reserved_by_id = NULL, reserved_by_name = NULL, reserved_at = NULL, updated_at = ? WHERE id = ?`,
      [now, f.id]
    );
    await logActivity({
      plan_id: f.plan_id, facility_id: f.id, facility_name: f.name, center: f.center,
      worker_id: f.reserved_by_id || 'system', worker_name: f.reserved_by_name || 'النظام',
      action: 'expired',
      summary: `انتهت مدة الحجز المؤقت (${C.RESERVATION_TTL_HOURS} ساعات) وعاد ${f.name} متاحاً`,
    });
  }
  return stale.length;
}

async function recordInspection(facility, user, payload, createdAt, { viaSync = false } = {}) {
  if (payload.client_id) {
    const dup = await queryOne('SELECT * FROM inspections WHERE client_id = ?', [payload.client_id]);
    if (dup) {
      return {
        result: 'duplicate',
        inspection: hydrateInspection(dup),
        facility: await queryOne('SELECT * FROM facilities WHERE id = ?', [facility.id]),
      };
    }
  }

  const now = new Date().toISOString();
  const inspId = uuidv4();
  const isConflict = facility.status === 'completed';
  const outcomeLabel = C.OUTCOME_LABELS[payload.visit_outcome];
  const totalCount = payload.samples.reduce((acc, s) => acc + s.count, 0);

  await transaction(async ({ run: tRun }) => {
    await tRun(
      `INSERT INTO inspections
       (id, facility_id, plan_id, worker_id, worker_name, samples_json, notes, gps_lat, gps_lng, gps_accuracy, signature_base64,
        created_at, synced_at, visit_outcome, compliance_json, violation_level, representative_name, representative_phone,
        followup_required, followup_date, client_id, record_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inspId, facility.id, facility.plan_id, user.id, user.name, JSON.stringify(payload.samples), payload.notes,
        payload.gps_lat, payload.gps_lng, payload.gps_accuracy, payload.signature_base64,
        createdAt || now, now,
        payload.visit_outcome, JSON.stringify(payload.compliance), payload.violation_level,
        payload.representative_name, payload.representative_phone,
        payload.followup_required, payload.followup_date, payload.client_id || '',
        isConflict ? 'conflict' : 'valid',
      ]
    );
    if (!isConflict) {
      await tRun(
        `UPDATE facilities
         SET status = 'completed', completed_by_id = ?, completed_by_name = ?, completed_at = ?,
             visit_outcome = ?,
             reserved_by_id = COALESCE(reserved_by_id, ?),
             reserved_by_name = COALESCE(reserved_by_name, ?),
             updated_at = ? WHERE id = ?`,
        [user.id, user.name, createdAt || now, payload.visit_outcome, user.id, user.name, now, facility.id]
      );
    }
  });

  const summary = payload.visit_outcome === 'inspected'
    ? `أتم المعاينة${viaSync ? ' (متزامن)' : ''} في ${facility.name} (${payload.samples.length} نوع / ${totalCount} عينة)` +
      (payload.violation_level !== 'none' ? ` — مخالفة ${C.LEVEL_LABELS[payload.violation_level]}` : '')
    : `زيارة ${facility.name}: ${outcomeLabel}`;

  await logActivity({
    plan_id: facility.plan_id, facility_id: facility.id, facility_name: facility.name, center: facility.center,
    worker_id: user.id, worker_name: user.name, action: 'completed',
    summary: isConflict ? `⚠️ معاينة مكررة محفوظة للمراجعة — ${summary}` : summary,
  });

  return {
    result: isConflict ? 'conflict' : 'applied',
    inspection: hydrateInspection(await queryOne('SELECT * FROM inspections WHERE id = ?', [inspId])),
    facility: await queryOne('SELECT * FROM facilities WHERE id = ?', [facility.id]),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Root
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html><html dir="rtl" lang="ar">
    <head><meta charset="UTF-8"><title>Menoufia Inspections API</title>
    <style>body{font-family:sans-serif;max-width:600px;margin:60px auto;padding:20px;background:#f9fafb}
    h1{color:#1d4ed8}code{background:#e5e7eb;padding:2px 6px;border-radius:4px}
    .ok{color:#16a34a;font-weight:bold}ul{line-height:2}</style></head>
    <body>
      <h1>🏭 Menoufia Inspections Backend</h1>
      <p class="ok">✅ السيرفر يعمل بنجاح — قاعدة البيانات: PostgreSQL (Neon)</p>
      <h3>Endpoints الرئيسية:</h3>
      <ul>
        <li><code>POST /api/auth/login</code> — تسجيل الدخول</li>
        <li><code>GET  /api/plans</code> — الخطط الشهرية</li>
        <li><code>GET  /api/plans/:id/facilities</code> — المنشآت</li>
        <li><code>GET  /api/health</code> — فحص الحالة</li>
      </ul>
      <p style="color:#6b7280;font-size:14px">الوقت: ${new Date().toLocaleString('ar-EG')}</p>
    </body></html>
  `);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'menoufia-inspections-backend', time: new Date().toISOString() });
});

// Login by code
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'أدخل كود الدخول' });
    const user = await queryOne('SELECT id, name, code, role, active FROM users WHERE UPPER(code) = ? AND active = 1', [code]);
    if (!user) return res.status(401).json({ error: 'الكود غير مسجل. تواصل مع الأدمن للحصول على كودك.' });
    res.json({ user });
  } catch (err) { next(err); }
});

// Admin: list workers
app.get('/api/workers', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const workers = await queryAll("SELECT id, name, code, role, active, created_at FROM users WHERE role = 'worker' ORDER BY created_at DESC");
    res.json({ workers });
  } catch (err) { next(err); }
});

// Admin: create worker
app.post('/api/workers', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!name || !code) return res.status(400).json({ error: 'الاسم والكود مطلوبان' });
    const exists = await queryOne('SELECT id FROM users WHERE UPPER(code) = ?', [code]);
    if (exists) return res.status(409).json({ error: 'هذا الكود مستخدم بالفعل' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await run('INSERT INTO users (id, name, code, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)', [id, name, code, 'worker', now]);
    res.status(201).json({ worker: { id, name, code, role: 'worker', active: 1, created_at: now } });
  } catch (err) { next(err); }
});

// Admin: toggle worker active/inactive
app.patch('/api/workers/:id/toggle', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const worker = await queryOne("SELECT * FROM users WHERE id = ? AND role = 'worker'", [req.params.id]);
    if (!worker) return res.status(404).json({ error: 'الموظف غير موجود' });
    const nextActive = worker.active ? 0 : 1;
    await run('UPDATE users SET active = ? WHERE id = ?', [nextActive, worker.id]);
    res.json({ id: worker.id, active: nextActive });
  } catch (err) { next(err); }
});

// Domain constants
app.get('/api/meta', authMiddleware, (req, res) => {
  res.json({
    visit_outcomes: C.OUTCOME_LABELS,
    violation_levels: C.LEVEL_LABELS,
    compliance: C.COMPLIANCE_LABELS,
    reservation_ttl_hours: C.RESERVATION_TTL_HOURS,
  });
});

// List plans
app.get('/api/plans', authMiddleware, async (req, res, next) => {
  try {
    const plans = await queryAll('SELECT * FROM plans ORDER BY created_at DESC');
    res.json({ plans });
  } catch (err) { next(err); }
});

// Upload plan (Excel)
app.post('/api/plans/upload', authMiddleware, adminOnly, upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'يرجى اختيار ملف Excel (.xlsx أو .xls)' });
  const monthLabel = String(req.body.month_label || '').trim() ||
    `خطة ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`;
  try {
    if (await queryOne('SELECT id FROM plans WHERE month_label = ?', [monthLabel]))
      return res.status(409).json({ error: `توجد خطة بنفس الاسم "${monthLabel}" بالفعل. غيّر اسم الشهر لتجنب تكرار الخطة.` });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const parsed = parseExcelRows(rawRows);
    if (parsed.length === 0)
      return res.status(400).json({ error: 'لم يتم العثور على منشآت في ملف Excel. تأكد من أسماء الأعمدة.' });

    const planId = uuidv4();
    const now = new Date().toISOString();

    await transaction(async ({ run: tRun }) => {
      await tRun(
        'INSERT INTO plans (id, month_label, filename, uploaded_by, total_facilities, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [planId, monthLabel, req.file.originalname || 'plan.xlsx', req.user.name, parsed.length, now]
      );
      for (const item of parsed) {
        await tRun(
          `INSERT INTO facilities (id, plan_id, serial_no, name, address, center, facility_code, target_date, plan_notes, activity_type, status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)`,
          [uuidv4(), planId, item.serial_no, item.name, item.address, item.center, item.facility_code, item.target_date, item.plan_notes, item.activity_type, now]
        );
      }
    });

    const byCenter = {};
    parsed.forEach((p) => { byCenter[p.center] = (byCenter[p.center] || 0) + 1; });

    const repeatedRows = await queryAll(
      `SELECT DISTINCT f.facility_code FROM facilities f
       JOIN inspections i ON i.facility_id = f.id AND i.record_status = 'valid' AND i.violation_level IN ('major','critical')
       WHERE f.plan_id <> ? AND f.facility_code IN (${parsed.map(() => '?').join(',')})`,
      [planId, ...parsed.map((p) => p.facility_code)]
    );
    const repeated = repeatedRows.length;

    await logActivity({
      plan_id: planId, facility_name: monthLabel, worker_id: req.user.id, worker_name: req.user.name,
      action: 'plan_uploaded', summary: `تم رفع خطة ${monthLabel} (${parsed.length} منشأة)`,
    });

    res.status(201).json({
      plan: await queryOne('SELECT * FROM plans WHERE id = ?', [planId]),
      inserted: parsed.length,
      by_center: byCenter,
      with_prior_major_violations: repeated,
    });
  } catch (err) { next(err); }
});

// Facilities for a plan
app.get('/api/plans/:planId/facilities', authMiddleware, async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { search = '', center = '', status = '' } = req.query;
    await expireStaleReservations(planId);

    let sql = 'SELECT * FROM facilities WHERE plan_id = ?';
    const params = [planId];
    if (center && center !== 'الكل') { sql += ' AND center = ?'; params.push(center); }
    if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
    if (search.trim()) {
      sql += ' AND (name LIKE ? OR address LIKE ? OR facility_code LIKE ?)';
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }
    sql += ' ORDER BY serial_no ASC';
    const facilities = await queryAll(sql, params);

    const inspections = await queryAll(
      "SELECT * FROM inspections WHERE plan_id = ? AND record_status = 'valid' ORDER BY created_at DESC", [planId]
    );
    const inspByFacility = {};
    for (const insp of inspections) {
      if (!inspByFacility[insp.facility_id]) inspByFacility[insp.facility_id] = hydrateInspection(insp);
    }

    const priorRows = await queryAll(
      `SELECT f.facility_code AS code, i.violation_level AS level, i.created_at AS at
       FROM inspections i JOIN facilities f ON f.id = i.facility_id
       WHERE i.record_status = 'valid' AND i.plan_id <> ? ORDER BY i.created_at DESC`,
      [planId]
    );
    const prior = {};
    for (const r of priorRows) {
      if (!prior[r.code]) prior[r.code] = { visits: 0, worst: 'none', last_at: r.at };
      prior[r.code].visits += 1;
      if (C.VIOLATION_LEVELS.indexOf(r.level) > C.VIOLATION_LEVELS.indexOf(prior[r.code].worst))
        prior[r.code].worst = r.level;
    }

    const followupRows = await queryAll("SELECT facility_id FROM inspections WHERE followup_required = 1 AND record_status = 'valid'");
    const openFollowups = new Set(followupRows.map((r) => r.facility_id));

    res.json({
      facilities: facilities.map((f) => ({
        ...f,
        inspection: inspByFacility[f.id] || null,
        history: prior[f.facility_code] || null,
        has_followup: openFollowups.has(f.id),
      })),
    });
  } catch (err) { next(err); }
});

// Reserve facility
app.post('/api/facilities/:id/reserve', authMiddleware, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT plan_id FROM facilities WHERE id = ?', [req.params.id]);
    if (existing) await expireStaleReservations(existing.plan_id);
    const facility = await queryOne('SELECT * FROM facilities WHERE id = ?', [req.params.id]);
    if (!facility) return res.status(404).json({ error: 'المنشأة غير موجودة' });
    if (facility.status !== 'available') {
      return res.status(409).json({
        error: facility.status === 'completed'
          ? `تمت معاينة المكان بالفعل بواسطة ${facility.completed_by_name}`
          : `المكان محجوز مؤقتاً حالياً بواسطة ${facility.reserved_by_name}`,
        facility,
      });
    }
    const now = new Date().toISOString();
    await run(
      `UPDATE facilities SET status = 'reserved', reserved_by_id = ?, reserved_by_name = ?, reserved_at = ?, updated_at = ? WHERE id = ?`,
      [req.user.id, req.user.name, now, now, facility.id]
    );
    await logActivity({
      plan_id: facility.plan_id, facility_id: facility.id, facility_name: facility.name, center: facility.center,
      worker_id: req.user.id, worker_name: req.user.name, action: 'reserved',
      summary: `حجز مؤقت (في الطريق) إلى ${facility.name}`,
    });
    res.json({ facility: await queryOne('SELECT * FROM facilities WHERE id = ?', [facility.id]) });
  } catch (err) { next(err); }
});

// Release reservation
app.post('/api/facilities/:id/release', authMiddleware, async (req, res, next) => {
  try {
    const facility = await queryOne('SELECT * FROM facilities WHERE id = ?', [req.params.id]);
    if (!facility) return res.status(404).json({ error: 'المنشأة غير موجودة' });
    if (facility.status !== 'reserved')
      return res.status(409).json({ error: 'المكان ليس في حالة حجز مؤقت', facility });
    if (facility.reserved_by_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: `الحجز خاص بـ ${facility.reserved_by_name} ولا يمكنك إلغاؤه` });
    const now = new Date().toISOString();
    await run(
      `UPDATE facilities SET status = 'available', reserved_by_id = NULL, reserved_by_name = NULL, reserved_at = NULL, updated_at = ? WHERE id = ?`,
      [now, facility.id]
    );
    await logActivity({
      plan_id: facility.plan_id, facility_id: facility.id, facility_name: facility.name, center: facility.center,
      worker_id: req.user.id, worker_name: req.user.name, action: 'released',
      summary: `ألغى الحجز المؤقت وأصبح ${facility.name} متاحاً`,
    });
    res.json({ facility: await queryOne('SELECT * FROM facilities WHERE id = ?', [facility.id]) });
  } catch (err) { next(err); }
});

// Complete inspection
app.post('/api/facilities/:id/complete', authMiddleware, async (req, res, next) => {
  try {
    const facility = await queryOne('SELECT * FROM facilities WHERE id = ?', [req.params.id]);
    if (!facility) return res.status(404).json({ error: 'المنشأة غير موجودة' });
    if (facility.status === 'completed')
      return res.status(409).json({ error: `تم إقفال هذه المنشأة مسبقاً بواسطة ${facility.completed_by_name}`, facility });
    if (facility.status === 'reserved' && facility.reserved_by_id !== req.user.id && req.user.role !== 'admin')
      return res.status(409).json({ error: `المكان محجوز مؤقتاً بواسطة ${facility.reserved_by_name}`, facility });
    const checked = normalizePayload(req.body, facility);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    const out = await recordInspection(facility, req.user, checked.value, new Date().toISOString());
    res.status(out.result === 'duplicate' ? 200 : 201).json({ facility: out.facility, inspection: out.inspection });
  } catch (err) { next(err); }
});

// Admin: unlock a facility
app.post('/api/facilities/:id/unlock', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const facility = await queryOne('SELECT * FROM facilities WHERE id = ?', [req.params.id]);
    if (!facility) return res.status(404).json({ error: 'المنشأة غير موجودة' });
    const now = new Date().toISOString();
    await transaction(async ({ run: tRun }) => {
      await tRun("UPDATE inspections SET record_status = 'superseded' WHERE facility_id = ? AND record_status = 'valid'", [facility.id]);
      await tRun(
        `UPDATE facilities
         SET status = 'available', reserved_by_id = NULL, reserved_by_name = NULL, reserved_at = NULL,
             completed_by_id = NULL, completed_by_name = NULL, completed_at = NULL, visit_outcome = '', updated_at = ?
         WHERE id = ?`,
        [now, facility.id]
      );
    });
    await logActivity({
      plan_id: facility.plan_id, facility_id: facility.id, facility_name: facility.name, center: facility.center,
      worker_id: req.user.id, worker_name: req.user.name, action: 'unlocked',
      summary: `أعاد الأدمن فتح ${facility.name} للمعاينة`,
    });
    res.json({ facility: await queryOne('SELECT * FROM facilities WHERE id = ?', [facility.id]) });
  } catch (err) { next(err); }
});

// Activity feed
app.get('/api/plans/:planId/feed', authMiddleware, async (req, res, next) => {
  try {
    const feed = await queryAll('SELECT * FROM activity_feed WHERE plan_id = ? ORDER BY created_at DESC LIMIT 150', [req.params.planId]);
    res.json({ feed });
  } catch (err) { next(err); }
});

// Follow-ups
app.get('/api/followups', authMiddleware, async (req, res, next) => {
  try {
    const rows = await queryAll(
      `SELECT i.id, i.facility_id, i.worker_name, i.violation_level, i.followup_date, i.created_at, i.notes,
              f.name AS facility_name, f.center, f.facility_code, f.address
       FROM inspections i JOIN facilities f ON f.id = i.facility_id
       WHERE i.followup_required = 1 AND i.record_status = 'valid'
       ORDER BY CASE WHEN i.followup_date = '' THEN 1 ELSE 0 END, i.followup_date ASC`
    );
    res.json({ followups: rows });
  } catch (err) { next(err); }
});

app.post('/api/inspections/:id/followup-done', authMiddleware, async (req, res, next) => {
  try {
    const insp = await queryOne('SELECT * FROM inspections WHERE id = ?', [req.params.id]);
    if (!insp) return res.status(404).json({ error: 'المعاينة غير موجودة' });
    await run('UPDATE inspections SET followup_required = 0 WHERE id = ?', [insp.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Conflicts
app.get('/api/conflicts', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const rows = await queryAll(
      `SELECT i.id, i.worker_name, i.created_at, i.samples_json, i.notes, i.violation_level, i.visit_outcome,
              f.name AS facility_name, f.completed_by_name, f.center
       FROM inspections i JOIN facilities f ON f.id = i.facility_id
       WHERE i.record_status = 'conflict' ORDER BY i.created_at DESC`
    );
    res.json({ conflicts: rows.map((r) => ({ ...r, samples: JSON.parse(r.samples_json || '[]') })) });
  } catch (err) { next(err); }
});

app.post('/api/conflicts/:id/resolve', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const insp = await queryOne("SELECT * FROM inspections WHERE id = ? AND record_status = 'conflict'", [req.params.id]);
    if (!insp) return res.status(404).json({ error: 'لا توجد معاينة مكررة بهذا المعرف' });
    const decision = req.body.decision === 'replace' ? 'replace' : 'discard';
    await transaction(async ({ run: tRun }) => {
      if (decision === 'replace') {
        await tRun("UPDATE inspections SET record_status = 'superseded' WHERE facility_id = ? AND record_status = 'valid'", [insp.facility_id]);
        await tRun("UPDATE inspections SET record_status = 'valid' WHERE id = ?", [insp.id]);
        await tRun(
          `UPDATE facilities SET completed_by_id = ?, completed_by_name = ?, completed_at = ?, visit_outcome = ?, updated_at = ? WHERE id = ?`,
          [insp.worker_id, insp.worker_name, insp.created_at, insp.visit_outcome, new Date().toISOString(), insp.facility_id]
        );
      } else {
        await tRun("UPDATE inspections SET record_status = 'discarded' WHERE id = ?", [insp.id]);
      }
    });
    res.json({ ok: true, decision });
  } catch (err) { next(err); }
});

// Statistics
app.get('/api/plans/:planId/stats', authMiddleware, async (req, res, next) => {
  try {
    const { planId } = req.params;
    await expireStaleReservations(planId);
    const plan = await queryOne('SELECT * FROM plans WHERE id = ?', [planId]);
    if (!plan) return res.status(404).json({ error: 'الخطة غير موجودة' });

    const totals = await queryOne(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status = 'reserved'  THEN 1 ELSE 0 END) AS reserved,
              SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available
       FROM facilities WHERE plan_id = ?`, [planId]
    );
    const byCenter = await queryAll(
      `SELECT center,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status = 'reserved'  THEN 1 ELSE 0 END) AS reserved
       FROM facilities WHERE plan_id = ? GROUP BY center ORDER BY total DESC`, [planId]
    );
    const byActivity = await queryAll(
      `SELECT COALESCE(NULLIF(activity_type, ''), 'أخرى') AS activity_type,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
       FROM facilities WHERE plan_id = ? GROUP BY 1 ORDER BY total DESC`, [planId]
    );

    const insp = (await queryAll("SELECT * FROM inspections WHERE plan_id = ? AND record_status = 'valid'", [planId])).map(hydrateInspection);
    const byWorkerMap = {};
    const outcomes = {};
    const levels = { none: 0, minor: 0, major: 0, critical: 0 };
    const sampleTypes = {};
    let totalSamples = 0;
    let followups = 0;
    const complianceFails = {};
    for (const i of insp) {
      const w = (byWorkerMap[i.worker_name] = byWorkerMap[i.worker_name] || { worker_name: i.worker_name, visits: 0, samples: 0 });
      w.visits += 1;
      outcomes[i.visit_outcome] = (outcomes[i.visit_outcome] || 0) + 1;
      if (i.visit_outcome === 'inspected') levels[i.violation_level] = (levels[i.violation_level] || 0) + 1;
      if (i.followup_required) followups += 1;
      for (const s of i.samples) {
        w.samples += s.count;
        totalSamples += s.count;
        sampleTypes[s.type] = (sampleTypes[s.type] || 0) + s.count;
      }
      for (const [k, v] of Object.entries(i.compliance)) {
        const bad = k === 'illegal_connection' ? v === 'yes' : v === 'no';
        if (bad) complianceFails[k] = (complianceFails[k] || 0) + 1;
      }
    }

    const completed = Number(totals.completed) || 0;
    const total = Number(totals.total) || 0;
    res.json({
      plan,
      totals: { total, completed, reserved: Number(totals.reserved) || 0, available: Number(totals.available) || 0,
                completion_rate: total ? Math.round((completed / total) * 100) : 0 },
      by_center: byCenter.map((c) => ({ ...c, completed: Number(c.completed) || 0, reserved: Number(c.reserved) || 0 })),
      by_activity: byActivity.map((a) => ({ ...a, completed: Number(a.completed) || 0 })),
      by_worker: Object.values(byWorkerMap).sort((a, b) => b.visits - a.visits),
      outcomes,
      violation_levels: levels,
      total_samples: totalSamples,
      sample_types: Object.entries(sampleTypes).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      open_followups: followups,
      compliance_failures: Object.entries(complianceFails)
        .map(([key, count]) => ({ key, label: C.COMPLIANCE_LABELS[key], count }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (err) { next(err); }
});

// Excel export (admin)
function authFromQuery(req, res, next) {
  if (!req.headers['x-user-code'] && req.query.code) req.headers['x-user-code'] = String(req.query.code);
  next();
}

app.get('/api/plans/:planId/export.xlsx', authFromQuery, authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const plan = await queryOne('SELECT * FROM plans WHERE id = ?', [req.params.planId]);
    if (!plan) return res.status(404).json({ error: 'الخطة غير موجودة' });

    const facilities = await queryAll('SELECT * FROM facilities WHERE plan_id = ? ORDER BY serial_no ASC', [plan.id]);
    const inspections = (await queryAll("SELECT * FROM inspections WHERE plan_id = ? AND record_status = 'valid'", [plan.id])).map(hydrateInspection);
    const inspByFacility = Object.fromEntries(inspections.map((i) => [i.facility_id, i]));
    const statusLabel = { available: 'متاح', reserved: 'في الطريق', completed: 'تم' };
    const yn = { yes: 'نعم', no: 'لا', na: 'لا ينطبق' };

    const facilityRows = facilities.map((f) => {
      const i = inspByFacility[f.id];
      const row = {
        'التسلسل': f.serial_no, 'اسم المنشأة': f.name, 'العنوان': f.address, 'المركز': f.center,
        'الكود': f.facility_code, 'النشاط': f.activity_type || '', 'تاريخ الخطة': f.target_date,
        'الحالة': statusLabel[f.status], 'نتيجة الزيارة': i ? C.OUTCOME_LABELS[i.visit_outcome] : '',
        'المعاين': i ? i.worker_name : '', 'تاريخ التنفيذ': i ? i.created_at.slice(0, 16).replace('T', ' ') : '',
        'عدد أنواع العينات': i ? i.samples.length : '', 'إجمالي العينات': i ? i.samples.reduce((a, s) => a + s.count, 0) : '',
        'مستوى المخالفة': i ? C.LEVEL_LABELS[i.violation_level] : '',
        'ممثل المنشأة': i ? i.representative_name : '', 'هاتف الممثل': i ? i.representative_phone : '',
        'يحتاج متابعة': i ? (i.followup_required ? `نعم ${i.followup_date || ''}`.trim() : 'لا') : '',
        'GPS': i && i.gps_lat ? `${i.gps_lat}, ${i.gps_lng}` : '', 'ملاحظات': i ? i.notes : '',
      };
      for (const [k, label] of Object.entries(C.COMPLIANCE_LABELS)) row[label] = i && i.compliance[k] ? yn[i.compliance[k]] : '';
      return row;
    });

    const sampleRows = [];
    for (const f of facilities) {
      const i = inspByFacility[f.id];
      if (!i) continue;
      i.samples.forEach((s) => sampleRows.push({
        'المنشأة': f.name, 'المركز': f.center, 'كود المنشأة': f.facility_code, 'كود العينة': s.code || '',
        'اسم العينة': s.name, 'النوع': s.type, 'العدد': s.count,
        'pH': s.ph ?? '', 'الحرارة °م': s.temperature ?? '', 'المعاين': i.worker_name,
      }));
    }

    const centerRows = await queryAll(
      `SELECT center AS "المركز", COUNT(*) AS "الإجمالي",
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS "تم",
              SUM(CASE WHEN status = 'reserved'  THEN 1 ELSE 0 END) AS "في الطريق"
       FROM facilities WHERE plan_id = ? GROUP BY center`, [plan.id]
    );

    const wb = xlsx.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(facilityRows), 'المعاينات');
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(sampleRows), 'العينات');
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(centerRows), 'ملخص المراكز');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report-${plan.id.slice(0, 8)}.xlsx"`);
    res.send(buf);
  } catch (err) { next(err); }
});

// Offline-First Batch Sync
app.post('/api/sync/batch', authMiddleware, async (req, res, next) => {
  try {
    const operations = Array.isArray(req.body.operations) ? req.body.operations : [];
    const results = [];
    await expireStaleReservations();

    for (const op of operations) {
      const facility = await queryOne('SELECT * FROM facilities WHERE id = ?', [op.facility_id]);
      if (!facility) {
        results.push({ queue_id: op.queue_id, status: 'skipped', reason: 'المنشأة غير موجودة' });
        continue;
      }
      const now = new Date().toISOString();

      if (op.action === 'reserve') {
        if (facility.status === 'available') {
          await run(
            `UPDATE facilities SET status = 'reserved', reserved_by_id = ?, reserved_by_name = ?, reserved_at = ?, updated_at = ? WHERE id = ?`,
            [req.user.id, req.user.name, op.created_at || now, now, facility.id]
          );
          await logActivity({
            plan_id: facility.plan_id, facility_id: facility.id, facility_name: facility.name, center: facility.center,
            worker_id: req.user.id, worker_name: req.user.name, action: 'reserved',
            summary: `حجز مؤقت (متزامن) إلى ${facility.name}`,
          });
          results.push({ queue_id: op.queue_id, facility_name: facility.name, status: 'applied' });
        } else if (facility.status === 'reserved' && facility.reserved_by_id === req.user.id) {
          results.push({ queue_id: op.queue_id, facility_name: facility.name, status: 'applied' });
        } else {
          results.push({ queue_id: op.queue_id, facility_name: facility.name, status: 'conflict', reason: `محجوز أو منتهي بالفعل (${facility.status})` });
        }
      } else if (op.action === 'release') {
        if (facility.status === 'reserved' && facility.reserved_by_id === req.user.id) {
          await run(
            `UPDATE facilities SET status = 'available', reserved_by_id = NULL, reserved_by_name = NULL, reserved_at = NULL, updated_at = ? WHERE id = ?`,
            [now, facility.id]
          );
          await logActivity({
            plan_id: facility.plan_id, facility_id: facility.id, facility_name: facility.name, center: facility.center,
            worker_id: req.user.id, worker_name: req.user.name, action: 'released',
            summary: `ألغى الحجز المؤقت (متزامن) وأصبح ${facility.name} متاحاً`,
          });
        }
        results.push({ queue_id: op.queue_id, facility_name: facility.name, status: 'applied' });
      } else if (op.action === 'complete') {
        const checked = normalizePayload({ ...(op.payload || {}), client_id: op.payload?.client_id || op.queue_id }, facility);
        if (!checked.ok) {
          results.push({ queue_id: op.queue_id, facility_name: facility.name, status: 'rejected', reason: checked.error });
          continue;
        }
        const out = await recordInspection(facility, req.user, checked.value, op.created_at || now, { viaSync: true });
        if (out.result === 'conflict') {
          results.push({
            queue_id: op.queue_id, facility_name: facility.name, status: 'conflict',
            reason: `تم إقفالها مسبقاً بواسطة ${facility.completed_by_name} — حُفظت معاينتك للمراجعة عند الأدمن`,
          });
        } else {
          results.push({ queue_id: op.queue_id, facility_name: facility.name, status: 'applied' });
        }
      } else {
        results.push({ queue_id: op.queue_id, status: 'skipped', reason: 'عملية غير معروفة' });
      }
    }
    res.json({ results });
  } catch (err) { next(err); }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({ error: 'خطأ داخلي في السيرفر: ' + err.message });
});

// Boot
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Menoufia Inspections Backend running on http://0.0.0.0:${PORT}`);
    console.log(`📦 Database: PostgreSQL (Neon)`);
  });
}).catch((err) => {
  console.error('❌ Failed to initialize database:', err.message);
  process.exit(1);
});
