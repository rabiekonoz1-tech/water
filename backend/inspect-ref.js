const xlsx = require('xlsx');
const path = require('path');

const filePath = "C:/Users/FAGR/.gemini/antigravity/brain/307d9f81-8f89-43f5-80a6-24485d4f814a/.user_uploaded/media_1795266832600_90c16477.xlsx";

const wb = xlsx.readFile(filePath);
console.log("Sheet names:", wb.SheetNames);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log("Total rows:", data.length);
console.log("--- First 15 rows ---");
for (let i = 0; i < Math.min(15, data.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(data[i]));
}
console.log("--- Rows 15 to 30 ---");
for (let i = 15; i < Math.min(30, data.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(data[i]));
}
console.log("--- Last 10 rows ---");
for (let i = Math.max(0, data.length - 10); i < data.length; i++) {
  console.log(`Row ${i}:`, JSON.stringify(data[i]));
}
