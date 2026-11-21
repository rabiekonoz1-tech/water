const pdfParseModule = require('pdf-parse');
const { detectCenter, detectActivityType } = require('./centerParser');

/**
 * Converts Arabic-Indic digits (٠-٩) to standard digits (0-9)
 */
function normalizeDigits(str) {
  return String(str || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

/**
 * Normalizes Arabic letters for fuzzy matching
 */
function normalizeArabic(str) {
  return String(str || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

/**
 * Extracts raw text from a PDF buffer (supports v1 and v2 of pdf-parse)
 */
async function extractTextFromPdf(buffer) {
  try {
    if (typeof pdfParseModule === 'function') {
      const res = await pdfParseModule(buffer);
      return res.text || '';
    }
    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      const res = await parser.getText();
      await parser.destroy().catch(() => {});
      return res.text || '';
    }
  } catch (err) {
    console.warn('Direct PDF text extraction error:', err.message);
  }
  return '';
}

/**
 * Parses raw text (from PDF text or OCR) into structured facility objects
 */
function parseTextLines(rawText) {
  const normalized = normalizeDigits(rawText);
  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsed = [];

  // Regex to match facility codes: SH2, QA26, Q183, B2, H9, M8, R11, L2, T35, etc.
  const codeRegex = /\b(SH|QA|Q|A|B|T|H|L|R|M|S)\s*[-_]?\s*(\d{1,4})\b/i;
  // Regex to match dates: 01/11/2026 or 01-11-2026
  const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;
  // Regex for serial number at start of line
  const serialRegex = /^(\d{1,3})\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip table header lines
    if (line.includes('مسمى المنشأة') || line.includes('كود المنشأة') || line.includes('تاريخ الانجاز')) {
      continue;
    }
    if (line.includes('شركة مياه الشرب') || line.includes('خطة متابعة') || line.includes('قطاع المعامل')) {
      continue;
    }

    const codeMatch = line.match(codeRegex);
    const dateMatch = line.match(dateRegex);

    if (codeMatch) {
      const prefix = codeMatch[1].toUpperCase();
      const num = codeMatch[2];
      const facilityCode = `${prefix}${num}`;
      const targetDate = dateMatch ? dateMatch[1] : '';

      // Determine serial number
      let serialNo = parsed.length + 1;
      const serialMatch = line.match(serialRegex);
      if (serialMatch) {
        const sVal = parseInt(serialMatch[1], 10);
        if (sVal > 0 && sVal <= 1000) {
          serialNo = sVal;
        }
      }

      // Split line into segments by tabs or multiple spaces
      const parts = line.split(/\s{2,}|\t|\|/).map((p) => p.trim()).filter(Boolean);
      let name = '';
      let address = '';
      let notes = '';

      if (parts.length >= 3) {
        // Find which part contains the code
        const codeIdx = parts.findIndex((p) => codeRegex.test(p));
        const dateIdx = parts.findIndex((p) => dateRegex.test(p));

        const textParts = parts.filter((_, idx) => idx !== codeIdx && idx !== dateIdx && !/^\d{1,3}$/.test(parts[idx]));

        if (textParts.length >= 2) {
          name = textParts[0];
          address = textParts[1];
          if (textParts.length >= 3) {
            notes = textParts.slice(2).join(' ');
          }
        } else if (textParts.length === 1) {
          name = textParts[0];
          address = 'المنوفية';
        }
      }

      // Fallback if parts didn't cleanly split
      if (!name) {
        let cleaned = line
          .replace(codeMatch[0], ' ')
          .replace(dateMatch ? dateMatch[0] : '', ' ')
          .replace(/^\d{1,3}\s+/, '')
          .trim();

        // If there's a dash separating name and address
        if (cleaned.includes(' - ')) {
          const dashParts = cleaned.split(' - ');
          name = dashParts[0].trim();
          address = dashParts.slice(1).join(' - ').trim();
        } else {
          name = cleaned;
          address = 'المنوفية';
        }
      }

      if (name && name.length >= 2) {
        parsed.push({
          serial_no: serialNo,
          name: name.trim(),
          address: address.trim() || 'المنوفية',
          facility_code: facilityCode,
          center: detectCenter(facilityCode, address, ''),
          activity_type: detectActivityType(name),
          target_date: targetDate,
          plan_notes: notes.trim(),
        });
      }
    }
  }

  return parsed;
}

/**
 * Main parser entry point: attempts direct text parse from PDF.
 */
async function parsePdfBuffer(buffer) {
  console.log('📄 Attempting direct PDF text extraction...');
  const directText = await extractTextFromPdf(buffer);

  if (directText && directText.trim().length > 50) {
    const directParsed = parseTextLines(directText);
    if (directParsed.length > 0) {
      console.log(`✅ Direct PDF extraction successful: found ${directParsed.length} facilities.`);
      return directParsed;
    }
  }

  throw new Error('ملف الـ PDF لا يحتوي على نصوص قابلة للاستخراج (قد يكون صورة ممسوحة ضوئياً). يرجى رفع ملف Excel بدلاً منه.');
}

module.exports = { parsePdfBuffer, parseTextLines };
