const pdfParseModule = require('pdf-parse');
const Tesseract = require('tesseract.js');
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
 * Extracts page images from PDF for OCR (for scanned CamScanner PDFs)
 */
async function extractImagesFromPdf(buffer) {
  if (!pdfParseModule.PDFParse) return [];
  const images = [];

  try {
    const parser = new pdfParseModule.PDFParse({ data: buffer });

    // Method 1: Try getScreenshot (renders page view as PNG)
    try {
      const screenshots = await parser.getScreenshot({ scale: 1.5, imageDataUrl: true });
      if (screenshots && screenshots.pages && screenshots.pages.length > 0) {
        for (const p of screenshots.pages) {
          if (p.dataUrl) images.push(p.dataUrl);
        }
      }
    } catch (e) {
      console.warn('Screenshot rendering not available:', e.message);
    }

    // Method 2: If no screenshots, try embedded images
    if (images.length === 0) {
      try {
        const imgRes = await parser.getImage({ imageDataUrl: true });
        if (imgRes && imgRes.pages) {
          for (const p of imgRes.pages) {
            for (const img of p.images) {
              if (img.dataUrl && (img.width > 300 || img.height > 300)) {
                images.push(img.dataUrl);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Embedded image extraction failed:', e.message);
      }
    }

    await parser.destroy().catch(() => {});
  } catch (err) {
    console.warn('Failed to extract images from PDF:', err.message);
  }

  return images;
}

/**
 * Performs OCR on images using Tesseract (Arabic + English)
 */
async function performOcrOnImages(images) {
  let combinedText = '';
  console.log(`🔍 Running OCR on ${images.length} page(s)...`);

  for (let i = 0; i < images.length; i++) {
    try {
      console.log(`📄 OCR processing page ${i + 1}/${images.length}...`);
      const res = await Tesseract.recognize(images[i], 'ara+eng');
      combinedText += `\n--- PAGE ${i + 1} ---\n` + (res.data.text || '') + '\n';
    } catch (err) {
      console.error(`OCR error on page ${i + 1}:`, err.message);
    }
  }

  return combinedText;
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
 * Main parser entry point: attempts direct text parse first, then falls back to OCR if needed.
 */
async function parsePdfBuffer(buffer) {
  // Step 1: Try direct PDF text extraction
  console.log('📄 Attempting direct PDF text extraction...');
  const directText = await extractTextFromPdf(buffer);

  if (directText && directText.trim().length > 100) {
    const directParsed = parseTextLines(directText);
    if (directParsed.length > 0) {
      console.log(`✅ Direct PDF extraction successful: found ${directParsed.length} facilities.`);
      return directParsed;
    }
  }

  // Step 2: Fallback to OCR if direct text returned 0 facilities (e.g. Scanned PDF from CamScanner)
  console.log('📸 Direct text empty or insufficient. Extracting images for OCR...');
  const images = await extractImagesFromPdf(buffer);

  if (images.length === 0) {
    throw new Error('لم يتم العثور على نصوص أو صور قابلة للمسح الضوئي (OCR) في ملف الـ PDF.');
  }

  const ocrText = await performOcrOnImages(images);
  const ocrParsed = parseTextLines(ocrText);

  if (ocrParsed.length === 0) {
    throw new Error('تم تشغيل المسح الضوئي (OCR) ولكن لم يتم التعرّف على منشآت مطابقة للأعمدة. تأكد من وضوح الصفحات أو ارفع ملف الإكسيل الأصلي.');
  }

  console.log(`✅ OCR extraction successful: found ${ocrParsed.length} facilities.`);
  return ocrParsed;
}

module.exports = { parsePdfBuffer, parseTextLines };
