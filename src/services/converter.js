import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import mammoth from 'mammoth';
import { readUriAsBase64 } from '../utils/fileReader';

// Helper to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Format timestamp for clean filenames
function getTimestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}_${h}${min}${s}`;
}

export const ConverterService = {
  /**
   * Convert an array of image URIs to a single multi-page PDF
   * @param {Array<{ uri: string, width?: number, height?: number }>} images
   * @param {string} customTitle
   */
  async convertImagesToPDF(images, customTitle = 'Image_Document') {
    if (!images || images.length === 0) {
      throw new Error('No images selected for conversion.');
    }

    // Convert each image to base64 data URL and measure dimensions
    const imageElements = [];
    let totalWidth = 0;
    let totalHeight = 0;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      let b64 = '';
      try {
        b64 = await readUriAsBase64(img.uri);
      } catch (e) {
        console.warn(`Could not read image as base64: ${img.uri}`, e);
      }

      const imgW = img.width || 800;
      const imgH = img.height || 1000;
      totalWidth += imgW;
      totalHeight += imgH;

      const src = b64 ? `data:image/jpeg;base64,${b64}` : img.uri;
      imageElements.push(`
        <div class="page-container">
          <img src="${src}" alt="Page ${i + 1}" />
        </div>
      `);
    }

    // Determine target PDF page dimensions matching image aspect ratio
    const avgW = Math.max(Math.round(totalWidth / images.length), 100);
    const avgH = Math.max(Math.round(totalHeight / images.length), 100);

    const pdfPageWidth = 612;
    const pdfPageHeight = Math.round(pdfPageWidth * (avgH / avgW));

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${customTitle}</title>
        <style>
          @page {
            margin: 0;
            size: ${pdfPageWidth}pt ${pdfPageHeight}pt;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: #ffffff;
          }
          .page-container {
            width: 100%;
            height: 100vh;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: #ffffff;
          }
          .page-container:last-child {
            page-break-after: auto;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }
        </style>
      </head>
      <body>
        ${imageElements.join('')}
      </body>
      </html>
    `;

    // Generate PDF using Expo Print with custom exact image dimensions
    const { uri: tempPdfUri } = await Print.printToFileAsync({
      html: htmlContent,
      width: pdfPageWidth,
      height: pdfPageHeight,
    });

    // Move to permanent document storage
    const sanitizedTitle = customTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${sanitizedTitle}_${getTimestamp()}.pdf`;
    const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.copyAsync({
      from: tempPdfUri,
      to: destinationUri,
    });

    const fileInfo = await FileSystem.getInfoAsync(destinationUri);

    return {
      name: fileName,
      uri: destinationUri,
      size: fileInfo.size || 0,
      lastPage: 1,
      totalPages: images.length,
      lastOpened: Date.now(),
    };
  },

  /**
   * Convert Word (.docx) or Text/Markdown document to PDF
   * @param {{ uri: string, name: string }} docFile
   */
  async convertDocToPDF(docFile) {
    if (!docFile || !docFile.uri) {
      throw new Error('No document file provided.');
    }

    const fileNameLower = (docFile.name || '').toLowerCase();
    let bodyHtml = '';

    if (fileNameLower.endsWith('.docx')) {
      // DOCX Conversion using Mammoth
      const b64 = await readUriAsBase64(docFile.uri);
      const arrayBuffer = base64ToArrayBuffer(b64);
      const conversionResult = await mammoth.convertToHtml({ arrayBuffer });
      bodyHtml = conversionResult.value || '<p>Empty Document</p>';
    } else {
      // Plain text, markdown, csv, or code files
      let textContent = '';
      try {
        const res = await fetch(docFile.uri);
        textContent = await res.text();
      } catch (e) {
        textContent = await FileSystem.readAsStringAsync(docFile.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      const escapedText = textContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      bodyHtml = `
        <h1 class="doc-title">${docFile.name}</h1>
        <pre class="code-box">${escapedText}</pre>
      `;
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${docFile.name}</title>
        <style>
          @page {
            margin: 20mm;
            size: A4;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.65;
            font-size: 14px;
            padding: 24px;
            margin: 0;
          }
          .doc-title {
            color: #0f172a;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
            margin-bottom: 20px;
            font-size: 22px;
          }
          h1, h2, h3, h4 {
            color: #0f172a;
            margin-top: 24px;
            margin-bottom: 12px;
          }
          p {
            margin-top: 0;
            margin-bottom: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            text-align: left;
          }
          th {
            background-color: #f8fafc;
            font-weight: 600;
          }
          .code-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
            white-space: pre-wrap;
            font-family: Consolas, Monaco, monospace;
            font-size: 12px;
            line-height: 1.5;
          }
          ul, ol {
            padding-left: 24px;
            margin-bottom: 14px;
          }
          li {
            margin-bottom: 6px;
          }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
      </html>
    `;

    const { uri: tempPdfUri } = await Print.printToFileAsync({
      html: fullHtml,
    });

    const baseName = docFile.name.replace(/\.[^/.]+$/, '');
    const sanitizedTitle = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const newPdfName = `${sanitizedTitle}_converted_${getTimestamp()}.pdf`;
    const destinationUri = `${FileSystem.documentDirectory}${newPdfName}`;

    await FileSystem.copyAsync({
      from: tempPdfUri,
      to: destinationUri,
    });

    const fileInfo = await FileSystem.getInfoAsync(destinationUri);

    return {
      name: newPdfName,
      uri: destinationUri,
      size: fileInfo.size || 0,
      lastPage: 1,
      totalPages: 1,
      lastOpened: Date.now(),
    };
  },
};
