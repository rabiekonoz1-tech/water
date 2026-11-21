const {
  VISIT_OUTCOMES, VIOLATION_LEVELS, COMPLIANCE_ANSWERS, COMPLIANCE_KEYS,
} = require('../constants');

function cleanText(v, max = 500) {
  return String(v ?? '').trim().slice(0, max);
}

function cleanNumberOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Validates + normalizes an inspection payload coming from the app (online or from the sync queue).
// Returns { ok: true, value } or { ok: false, error }.
function normalizePayload(body, facility) {
  const outcome = VISIT_OUTCOMES.includes(body.visit_outcome) ? body.visit_outcome : 'inspected';
  const notes = cleanText(body.notes, 2000);

  const rawSamples = Array.isArray(body.samples) ? body.samples : [];
  const samples = rawSamples
    .map((s, i) => ({
      id: cleanText(s.id, 60) || `s${i + 1}`,
      code: cleanText(s.code, 40) || `${facility.facility_code}-S${i + 1}`,
      name: cleanText(s.name, 120),
      type: cleanText(s.type, 120),
      count: Math.max(0, parseInt(s.count, 10) || 0),
      ph: cleanNumberOrNull(s.ph),
      temperature: cleanNumberOrNull(s.temperature),
    }))
    .filter((s) => s.name && s.type && s.count > 0);

  if (outcome === 'inspected' && samples.length === 0) {
    return { ok: false, error: 'أضف عينة واحدة على الأقل قبل تأكيد المعاينة' };
  }
  if (outcome !== 'inspected' && !notes) {
    return { ok: false, error: 'اكتب سبب عدم إتمام المعاينة في الملاحظات' };
  }
  for (const s of samples) {
    if (s.ph !== null && (s.ph < 0 || s.ph > 14)) {
      return { ok: false, error: `قيمة pH غير منطقية في عينة ${s.name} (يجب أن تكون بين 0 و 14)` };
    }
  }

  const compliance = {};
  const rawCompliance = body.compliance && typeof body.compliance === 'object' ? body.compliance : {};
  for (const key of COMPLIANCE_KEYS) {
    const a = rawCompliance[key];
    if (COMPLIANCE_ANSWERS.includes(a)) compliance[key] = a;
  }

  const violationLevel = VIOLATION_LEVELS.includes(body.violation_level) ? body.violation_level : 'none';
  const followupRequired = body.followup_required ? 1 : 0;

  return {
    ok: true,
    value: {
      client_id: cleanText(body.client_id, 80),
      visit_outcome: outcome,
      samples,
      notes,
      compliance,
      violation_level: violationLevel,
      representative_name: cleanText(body.representative_name, 120),
      representative_phone: cleanText(body.representative_phone, 30),
      followup_required: followupRequired,
      followup_date: followupRequired ? cleanText(body.followup_date, 20) : '',
      gps_lat: cleanNumberOrNull(body.gps_lat),
      gps_lng: cleanNumberOrNull(body.gps_lng),
      gps_accuracy: cleanNumberOrNull(body.gps_accuracy),
      signature_base64: typeof body.signature_base64 === 'string' ? body.signature_base64 : '',
    },
  };
}

function hydrateInspection(row) {
  if (!row) return null;
  return {
    ...row,
    samples: JSON.parse(row.samples_json || '[]'),
    compliance: JSON.parse(row.compliance_json || '{}'),
    followup_required: !!row.followup_required,
  };
}

module.exports = { normalizePayload, hydrateInspection };
