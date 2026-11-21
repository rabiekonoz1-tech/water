const pdf = require('pdf-parse');
const { detectCenter, detectActivityType } = require('./centerParser');

/**
 * Parses text-based PDF containing the Menoufia Inspections table.
 * Columns:
 * 1. التسلسل (Serial: 1..261)
 * 2. مسمى المنشأة الصناعية (Name)
 * 3. العنوان (Address)
 * 4. كود المنشأة الصناعية (Code: SH\d+, QA\d+, Q\d+, A\d+, B\d+, T\d+, H\d+, L\d+, R\d+, M\d+, S\d+)
 * 5. تاريخ الانجاز (Date: DD/MM/YYYY)
 * 6. ملاحظات (Notes)
 */
async function parsePdfBuffer(buffer) {
  const data = await pdf(buffer);
  const text = data.text || '';
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const parsed = [];
  const codeRegex = /\b(SH|QA|Q|A|B|T|H|L|R|M|S)\d+\b/i;
  const dateRegex = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line contains a facility code and a date
    const codeMatch = line.match(codeRegex);
    const dateMatch = line.match(dateRegex);

    if (codeMatch && dateMatch) {
      const code = codeMatch[0].toUpperCase();
      const date = dateMatch[0];

      // Extract parts around code and date
      const parts = line.split(/\s{2,}|\t/).filter(Boolean);

      let name = '';
      let address = '';
      let serialNo = parsed.length + 1;
      let notes = '';

      if (parts.length >= 4) {
        // Structured tab/multi-space layout
        const serialCandidate = parseInt(parts[0], 10);
        if (!isNaN(serialCandidate) && serialCandidate < 1000) {
          serialNo = serialCandidate;
          name = parts[1] || '';
          address = parts[2] || '';
        } else {
          name = parts[0] || '';
          address = parts[1] || '';
        }
      } else {
        // Fallback: line regex parsing
        const cleaned = line.replace(code, ' ').replace(date, ' ').trim();
        const segments = cleaned.split(/\s{2,}/);
        if (segments.length >= 2) {
          name = segments[0];
          address = segments[1];
        } else {
          name = cleaned;
          address = 'المنوفية';
        }
      }

      parsed.push({
        serial_no: serialNo,
        name: name.trim() || `منشأة ${code}`,
        address: address.trim() || 'غير محدد',
        facility_code: code,
        center: detectCenter(code, address, ''),
        activity_type: detectActivityType(name),
        target_date: date,
        plan_notes: notes,
      });
    }
  }

  return parsed;
}

module.exports = { parsePdfBuffer };
