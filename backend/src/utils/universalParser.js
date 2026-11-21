const xlsx = require('xlsx');
const { detectCenter, detectActivityType } = require('./centerParser');
const { parsePdfBuffer } = require('./pdfParser');

/**
 * Normalizes digits: Arabic-Indic (٠-٩) -> English (0-9)
 */
function normalizeDigits(str) {
  return String(str || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

/**
 * Normalizes Arabic letters for flexible header matching
 */
function normalizeArabic(str) {
  return String(str || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

/**
 * Formats dates from Excel serial number, Date object, or date string into YYYY-MM-DD
 */
function formatTargetDate(val) {
  if (val === undefined || val === null || val === '') return '';

  // 1. Excel serial number (e.g. 46327 or 46327.08)
  if (typeof val === 'number') {
    try {
      const d = xlsx.SSF.parse_date_code(val);
      if (d && d.y && d.m && d.d) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch (e) {}
  }

  // 2. JavaScript Date object
  if (val instanceof Date && !isNaN(val)) {
    return val.toISOString().split('T')[0];
  }

  // 3. String representation
  const str = normalizeDigits(String(val)).trim();

  // If numeric string like "46327"
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    try {
      const d = xlsx.SSF.parse_date_code(parseFloat(str));
      if (d && d.y && d.m && d.d) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch (e) {}
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    let year = dmyMatch[3];
    if (year.length === 2) year = '20' + year;
    const month = dmyMatch[2].padStart(2, '0');
    const day = dmyMatch[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  return str;
}

/**
 * Parses spreadsheet data (Excel / CSV) with dynamic header location
 */
function parseSpreadsheet(data, readType = 'buffer') {
  let wb;
  try {
    wb = xlsx.read(data, { type: readType });
  } catch (err) {
    // If buffer failed as string or vice versa
    if (readType === 'buffer' && typeof data === 'string') {
      wb = xlsx.read(data, { type: 'string' });
    } else {
      throw new Error('فشل قراءة ملف الجدول: ' + err.message);
    }
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('الملف لا يحتوي على أي صفحات عمل (Sheets).');
  }

  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Use 2D array parsing to bypass title banners (rows 0-7) cleanly
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let headerIdx = -1;
  let colMap = {
    serial: -1,
    name: -1,
    address: -1,
    code: -1,
    date: -1,
    notes: -1,
  };

  let detectedMonth = '';

  // Scan the top 30 rows for title and table headers
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    const rowText = row.map((c) => String(c || '').trim()).join(' ');

    if (!detectedMonth) {
      const monthMatch = rowText.match(/(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)(\s*\d{4})?/);
      if (monthMatch) {
        detectedMonth = `خطة ${monthMatch[0]}`;
      }
    }

    let matchCount = 0;
    const tempMap = { serial: -1, name: -1, address: -1, code: -1, date: -1, notes: -1 };

    for (let c = 0; c < row.length; c++) {
      const val = normalizeArabic(row[c]);
      if (!val) continue;

      if (val.includes('تسلسل') || val === 'م' || val === 'serial') {
        tempMap.serial = c;
        matchCount++;
      } else if (
        val.includes('مسمي المنشاه') ||
        val.includes('اسم المنشاه') ||
        val.includes('مسمي') ||
        val.includes('اسم المكان') ||
        val.includes('المنشاه')
      ) {
        tempMap.name = c;
        matchCount++;
      } else if (val.includes('عنوان') || val.includes('الموقع') || val.includes('address')) {
        tempMap.address = c;
        matchCount++;
      } else if (val.includes('كود المنشاه') || val.includes('كود') || val.includes('code')) {
        tempMap.code = c;
        matchCount++;
      } else if (val.includes('تاريخ الانجاز') || val.includes('تاريخ') || val.includes('date')) {
        tempMap.date = c;
        matchCount++;
      } else if (val.includes('ملاحظات') || val.includes('notes')) {
        tempMap.notes = c;
      }
    }

    if (matchCount >= 2) {
      headerIdx = r;
      colMap = tempMap;
      break;
    }
  }

  // Fallbacks if some headers were implicit based on the standard Menoufia format
  if (colMap.name === -1) colMap.name = 1;
  if (colMap.address === -1) colMap.address = 2;
  if (colMap.code === -1) colMap.code = 3;
  if (colMap.date === -1) colMap.date = 4;
  if (colMap.notes === -1) colMap.notes = 5;
  if (colMap.serial === -1) colMap.serial = 0;

  const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
  const parsed = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    const rawName = String(row[colMap.name] || '').trim();
    const rawCode = String(row[colMap.code] || '').trim();
    const rawAddress = String(row[colMap.address] || '').trim();
    const rawDate = row[colMap.date];
    const rawNotes = String(row[colMap.notes] || '').trim();
    const rawSerial = row[colMap.serial];

    // Check for footer / signature rows to skip
    const combinedRowStr = row.map((cell) => String(cell || '')).join(' ');
    if (
      combinedRowStr.includes('اعداد:') ||
      combinedRowStr.includes('إعداد:') ||
      combinedRowStr.includes('مراجعة:') ||
      combinedRowStr.includes('رئيس قطاع') ||
      combinedRowStr.includes('مدير الإدارة') ||
      combinedRowStr.includes('مدير الادارة') ||
      combinedRowStr.includes('ك /') ||
      combinedRowStr.includes('د /')
    ) {
      continue;
    }

    // Must have at least a name or a code, and name should be at least 2 characters
    if (!rawName && !rawCode) continue;
    if (rawName.length < 2) continue;

    const formattedDate = formatTargetDate(rawDate);
    const facilityCode = rawCode || `F-${parsed.length + 1}`;
    const address = rawAddress || 'المنوفية';

    parsed.push({
      serial_no: parseInt(rawSerial, 10) || parsed.length + 1,
      name: rawName,
      address,
      facility_code: facilityCode,
      center: detectCenter(facilityCode, address, ''),
      activity_type: detectActivityType(rawName),
      target_date: formattedDate,
      plan_notes: rawNotes,
    });
  }

  return { parsed, detectedMonth };
}

/**
 * Universal Plan Parser
 * Accepts any uploaded plan buffer (.xlsx, .xls, .csv, .pdf)
 */
async function parsePlanFile(buffer, filename = '', mimetype = '') {
  const lowerName = String(filename || '').toLowerCase();
  const isPdf = lowerName.endsWith('.pdf') || mimetype === 'application/pdf';
  const isCsv = lowerName.endsWith('.csv') || mimetype === 'text/csv';

  if (isPdf) {
    const parsed = await parsePdfBuffer(buffer);
    return {
      parsed,
      detectedMonth: '',
    };
  }

  if (isCsv) {
    // Decode UTF-8 string first to avoid encoding issues with Arabic
    const utf8Str = buffer.toString('utf8');
    return parseSpreadsheet(utf8Str, 'string');
  }

  // Default: Excel workbook (xlsx / xls / ods)
  return parseSpreadsheet(buffer, 'buffer');
}

module.exports = {
  parsePlanFile,
  parseSpreadsheet,
  formatTargetDate,
};
