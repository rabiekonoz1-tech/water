const xlsx = require('xlsx');
const path = require('path');
const { detectCenter, detectActivityType } = require('./src/utils/centerParser');

function formatExcelDate(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    try {
      const d = xlsx.SSF.parse_date_code(val);
      if (d && d.y) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch (e) {}
  }
  if (val instanceof Date && !isNaN(val)) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
  // Check DD/MM/YYYY
  const parts = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (parts) {
    let year = parts[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  return str;
}

function normalizeHeader(str) {
  return String(str || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function parseSpreadsheet(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
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

  let detectedMonthLabel = '';

  // 1. Scan top 25 rows for table headers and plan title
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r];
    const rowText = row.map((c) => String(c || '').trim()).join(' ');

    if (!detectedMonthLabel) {
      const monthMatch = rowText.match(/(نوفمبر|ديسمبر|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر)(\s*\d{4})?/);
      if (monthMatch) {
        detectedMonthLabel = `خطة ${monthMatch[0]}`;
      }
    }

    let matchCount = 0;
    let tempMap = { serial: -1, name: -1, address: -1, code: -1, date: -1, notes: -1 };

    for (let c = 0; c < row.length; c++) {
      const val = normalizeHeader(row[c]);
      if (!val) continue;

      if (val.includes('تسلسل') || val === 'م') {
        tempMap.serial = c;
        matchCount++;
      } else if (val.includes('مسمي') || val.includes('اسم المنشاه') || val.includes('المكان')) {
        tempMap.name = c;
        matchCount++;
      } else if (val.includes('عنوان') || val.includes('الموقع')) {
        tempMap.address = c;
        matchCount++;
      } else if (val.includes('كود')) {
        tempMap.code = c;
        matchCount++;
      } else if (val.includes('تاريخ') || val.includes('انجاز')) {
        tempMap.date = c;
        matchCount++;
      } else if (val.includes('ملاحظات')) {
        tempMap.notes = c;
      }
    }

    if (matchCount >= 2) {
      headerIdx = r;
      colMap = tempMap;
      break;
    }
  }

  // Fallback defaults if header search was partial
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
    if (!row || row.length === 0) continue;

    const rawName = String(row[colMap.name] || '').trim();
    const rawCode = String(row[colMap.code] || '').trim();
    const rawAddress = String(row[colMap.address] || '').trim();
    const rawDate = row[colMap.date];
    const rawNotes = String(row[colMap.notes] || '').trim();
    const rawSerial = row[colMap.serial];

    // Filter out footer rows (signatures, approvals)
    const combinedRowStr = row.join(' ');
    if (
      combinedRowStr.includes('اعداد:') ||
      combinedRowStr.includes('إعداد:') ||
      combinedRowStr.includes('مراجعة:') ||
      combinedRowStr.includes('رئيس قطاع') ||
      combinedRowStr.includes('مدير الإدارة') ||
      combinedRowStr.includes('مدير الادارة')
    ) {
      continue;
    }

    // Must have at least a name or a code to be a facility row
    if (!rawName && !rawCode) continue;
    if (rawName.length < 2) continue;

    const formattedDate = formatExcelDate(rawDate);
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

  return { parsed, detectedMonthLabel };
}

// Test with user's uploaded Excel file
const fs = require('fs');
const buf = fs.readFileSync('C:/Users/FAGR/.gemini/antigravity/brain/307d9f81-8f89-43f5-80a6-24485d4f814a/.user_uploaded/media_1795266832600_90c16477.xlsx');
const result = parseSpreadsheet(buf);
console.log('Detected Month:', result.detectedMonthLabel);
console.log('Parsed count:', result.parsed.length);
console.log('First facility:', result.parsed[0]);
console.log('Last facility:', result.parsed[result.parsed.length - 1]);

// Center breakdown
const byCenter = {};
result.parsed.forEach(f => byCenter[f.center] = (byCenter[f.center] || 0) + 1);
console.log('By Center:', byCenter);
