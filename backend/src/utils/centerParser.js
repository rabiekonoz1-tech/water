const CODE_PREFIX_TO_CENTER = [
  { prefix: 'SH', center: 'شبين الكوم' },
  { prefix: 'QA', center: 'قويسنا' },
  { prefix: 'Q', center: 'قويسنا' },
  { prefix: 'A', center: 'أشمون' },
  { prefix: 'B', center: 'الباجور' },
  { prefix: 'T', center: 'تلا' },
  { prefix: 'H', center: 'الشهداء' },
  { prefix: 'L', center: 'سرس الليان' },
  { prefix: 'R', center: 'بركة السبع' },
  { prefix: 'M', center: 'منوف' },
  { prefix: 'S', center: 'السادات' },
];

const ADDRESS_KEYWORDS = [
  { keywords: ['شبين الكوم', 'شبين', 'ميت خاقان', 'كفر المصيلحة', 'البتانون', 'مليج', 'شنوان'], center: 'شبين الكوم' },
  { keywords: ['قويسنا'], center: 'قويسنا' },
  { keywords: ['اشمون', 'أشمون', 'سنتريس', 'سبك الاحد', 'شما'], center: 'أشمون' },
  { keywords: ['الباجور', 'باجور'], center: 'الباجور' },
  { keywords: ['تلا'], center: 'تلا' },
  { keywords: ['الشهداء', 'سرسنا', 'كفر عشما', 'سلامون', 'ساحل الجوابر'], center: 'الشهداء' },
  { keywords: ['سرس الليان', 'سرس'], center: 'سرس الليان' },
  { keywords: ['بركة السبع', 'بركة', 'جنزور'], center: 'بركة السبع' },
  { keywords: ['منوف', 'كمشوش'], center: 'منوف' },
  { keywords: ['السادات'], center: 'السادات' },
];

function detectCenter(facilityCode, address, explicitCenter) {
  if (explicitCenter && String(explicitCenter).trim()) {
    return String(explicitCenter).trim();
  }
  const code = String(facilityCode || '').trim().toUpperCase();
  for (const item of CODE_PREFIX_TO_CENTER) {
    if (code.startsWith(item.prefix)) {
      return item.center;
    }
  }
  const addr = String(address || '');
  for (const item of ADDRESS_KEYWORDS) {
    if (item.keywords.some((kw) => addr.includes(kw))) {
      return item.center;
    }
  }
  return 'أخرى';
}

function normalizeHeader(str) {
  return String(str || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function parseExcelRows(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return [];

  const parsed = [];
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const entries = Object.entries(row);
    const getVal = (candidates) => {
      for (const [k, v] of entries) {
        const nk = normalizeHeader(k);
        // Short keys (e.g. 'م') must match exactly, otherwise they match almost any Arabic header.
        const hit = candidates.some((c) => {
          const nc = normalizeHeader(c);
          return nc.length <= 2 ? nk === nc : nk.includes(nc);
        });
        if (hit) {
          return v !== undefined && v !== null ? String(v).trim() : '';
        }
      }
      return '';
    };

    const name = getVal(['مسمي المنشاه', 'اسم المكان', 'اسم المنشاه', 'المنشاه', 'name']);
    const address = getVal(['العنوان', 'address']);
    const facilityCode = getVal(['كود المنشاه', 'الكود', 'code']);
    const explicitCenter = getVal(['المدينه', 'المركز', 'المنطقه', 'center', 'city']);
    const targetDate = getVal(['تاريخ الانجاز', 'التاريخ', 'date']);
    const planNotes = getVal(['ملاحظات', 'notes']);
    const serialRaw = getVal(['التسلسل', 'م', 'serial']);

    if (!name) continue;

    parsed.push({
      serial_no: parseInt(serialRaw, 10) || parsed.length + 1,
      name,
      address: address || 'غير محدد',
      facility_code: facilityCode || `F-${parsed.length + 1}`,
      center: detectCenter(facilityCode, address, explicitCenter),
      activity_type: detectActivityType(name),
      target_date: targetDate || '',
      plan_notes: planNotes || '',
    });
  }
  return parsed;
}

const ACTIVITY_KEYWORDS = [
  { type: 'مطعم/مطبخ', keywords: ['مطعم', 'مطبخ', 'كشري', 'كشرى', 'كافيه', 'كافية', 'كافتريا', 'حلواني', 'مخبز', 'فطائر', 'شاورما', 'بيتزا'] },
  { type: 'مغسلة', keywords: ['مغسلة', 'غسيل', 'مغسله'] },
  { type: 'مصنع', keywords: ['مصنع', 'شركة', 'معمل', 'مسبك', 'ورشة'] },
  { type: 'محطة/خدمات', keywords: ['محطة', 'بنزين', 'جراج', 'تغيير زيوت', 'سنترال'] },
  { type: 'مزرعة/مجزر', keywords: ['مزرعة', 'مجزر', 'دواجن', 'ألبان', 'البان'] },
];

function detectActivityType(name) {
  const n = String(name || '');
  for (const item of ACTIVITY_KEYWORDS) {
    if (item.keywords.some((kw) => n.includes(kw))) return item.type;
  }
  return 'أخرى';
}

module.exports = { detectCenter, detectActivityType, parseExcelRows };
