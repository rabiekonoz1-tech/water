const xlsx = require('xlsx');

const csvData = `شركة مياه الشرب والصرف الصحى بالمنوفية,,,,,
قطاع المعامل ومراقبة الجودة,,,,,
الإدارة العامة للصرف الصناعى,,,,,
................,,,,,
,,,,,
خطة متابعة المنشآت الصناعية خلال شهر نوفمبر 2026,,,,,
بقطاع : المعامل,,,,,
,,,,,
التسلسل,مسمى المنشأة الصناعية,العنوان,كود المنشأة الصناعية,تاريخ الانجاز,ملاحظات
1,مغسلة مستر كار (مغسلة زدسا بقا),شبين الكوم - امام سولو بلاز,SH2,2026-11-01,
2,مطبخ كشرى الكروان,كفر المصيلحة - شبين الكوم,SH7,2026-11-01,`;

const wb = xlsx.read(csvData, { type: 'string' });
const sheet = wb.Sheets[wb.SheetNames[0]];

// Default sheet_to_json
const defaultRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
console.log('Default sheet_to_json row count:', defaultRows.length);
console.log('Default row 0 keys:', Object.keys(defaultRows[0] || {}));
console.log('Default row 7 (which should be facility 1):', defaultRows[7]);

// Array of arrays (header: 1)
const raw2D = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
console.log('Total 2D rows:', raw2D.length);
console.log('Row 8 (Table Header):', raw2D[8]);
console.log('Row 9 (First Facility):', raw2D[9]);
