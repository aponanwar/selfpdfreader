export function generatePDFViewerHTML(pdfBase64, initialPage = 1, theme = 'light') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>Self PDF Reader</title>
  <!-- PDF.js from reliable CDN with fallback -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * {
      box-sizing: border-box;
      -webkit-touch-callout: none;
      -webkit-user-select: text;
    }
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow-x: auto;
      overflow-y: auto;
      background-color: ${theme === 'dark' ? '#0B0F19' : theme === 'sepia' ? '#F4ECD8' : '#F1F5F9'};
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: background-color 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #viewer-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      min-height: 100%;
      padding: 12px 0 60px 0;
    }
    .page-wrapper {
      position: relative;
      margin: 10px auto;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      border-radius: 4px;
      overflow: hidden;
      background: #FFFFFF;
      transition: filter 0.3s ease;
    }
    canvas {
      display: block;
      width: 100%;
      height: auto;
    }
    /* Theme modes */
    .theme-dark canvas {
      filter: invert(0.92) hue-rotate(180deg) contrast(1.1) brightness(0.95);
    }
    .theme-sepia canvas {
      filter: sepia(0.35) contrast(0.95) brightness(0.98);
    }
    .theme-light canvas {
      filter: none;
    }
    #loading {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${theme === 'dark' ? '#0B0F19' : '#FFFFFF'};
      color: ${theme === 'dark' ? '#94A3B8' : '#475569'};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      font-size: 16px;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 4px solid #CBD5E1;
      border-top-color: #2563EB;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    #search-highlight-bar {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(37, 99, 235, 0.95);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      display: none;
      z-index: 99;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    }
    #error-box {
      display: none;
      color: #EF4444;
      padding: 20px;
      text-align: center;
      max-width: 80%;
    }
  </style>
</head>
<body class="theme-${theme}">
  <div id="loading">
    <div class="spinner"></div>
    <div id="loading-text">Loading PDF Document...</div>
    <div id="error-box"></div>
  </div>

  <div id="search-highlight-bar"></div>
  <div id="viewer-container">
    <div id="page-container" class="page-wrapper">
      <canvas id="pdf-canvas"></canvas>
    </div>
  </div>

  <script>
    let pdfDoc = null;
    let pageNum = ${initialPage};
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 1.3;
    let currentTheme = '${theme}';
    let base64Data = '${pdfBase64 || ''}';
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const loadingElem = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    const errorBox = document.getElementById('error-box');

    function notifyRN(type, data = {}) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }

    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    function renderPage(num) {
      pageRendering = true;
      pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: scale });
        
        // Match device pixel ratio for super-crisp rendering
        const outputScale = window.devicePixelRatio || 1.5;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";

        const transform = outputScale !== 1 
          ? [outputScale, 0, 0, outputScale, 0, 0] 
          : null;

        const renderContext = {
          canvasContext: ctx,
          transform: transform,
          viewport: viewport
        };

        const renderTask = page.render(renderContext);
        renderTask.promise.then(function() {
          pageRendering = false;
          if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
          }
          notifyRN('pageChanged', { 
            currentPage: num, 
            totalPages: pdfDoc.numPages 
          });
        }).catch(function(err) {
          console.error('Render error:', err);
          pageRendering = false;
        });
      });
    }

    function queueRenderPage(num) {
      if (pageRendering) {
        pageNumPending = num;
      } else {
        renderPage(num);
      }
    }

    function loadDocument(b64) {
      try {
        if (!b64) {
          throw new Error('No PDF data provided');
        }
        loadingText.innerText = 'Preparing document pages...';
        
        const rawData = atob(b64);
        const uint8Array = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
          uint8Array[i] = rawData.charCodeAt(i);
        }

        pdfjsLib.getDocument({ data: uint8Array }).promise.then(function(doc) {
          pdfDoc = doc;
          loadingElem.style.display = 'none';
          
          if (pageNum > pdfDoc.numPages || pageNum < 1) {
            pageNum = 1;
          }
          
          notifyRN('docLoaded', { 
            totalPages: pdfDoc.numPages, 
            currentPage: pageNum 
          });

          renderPage(pageNum);
        }).catch(function(err) {
          console.error('PDF load error:', err);
          loadingText.style.display = 'none';
          errorBox.style.display = 'block';
          errorBox.innerText = 'Could not load PDF: ' + (err.message || 'Unknown error');
          notifyRN('error', { message: err.message });
        });
      } catch (e) {
        console.error('Fatal load error:', e);
        loadingText.style.display = 'none';
        errorBox.style.display = 'block';
        errorBox.innerText = 'Error processing file: ' + e.message;
        notifyRN('error', { message: e.message });
      }
    }

    // Extract text from current page for Text-To-Speech
    async function extractCurrentText() {
      if (!pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map(item => item.str).join(' ');
        notifyRN('extractedText', { text: textItems, page: pageNum });
      } catch (err) {
        notifyRN('extractedText', { text: '', error: err.message, page: pageNum });
      }
    }

    // Search across PDF pages
    async function searchInPDF(query) {
      if (!pdfDoc || !query || query.trim() === '') return;
      const q = query.trim().toLowerCase();
      let matchCount = 0;
      let matchedPages = [];

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        try {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ').toLowerCase();
          if (pageText.includes(q)) {
            matchCount++;
            matchedPages.push(i);
          }
        } catch (e) {}
      }

      notifyRN('searchResults', {
        query,
        count: matchCount,
        pages: matchedPages
      });
    }

    // Message handler from React Native
    window.addEventListener('message', function(event) {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.action) {
          case 'nextPage':
            if (pdfDoc && pageNum < pdfDoc.numPages) {
              pageNum++;
              queueRenderPage(pageNum);
            }
            break;
          case 'prevPage':
            if (pdfDoc && pageNum > 1) {
              pageNum--;
              queueRenderPage(pageNum);
            }
            break;
          case 'goToPage':
            if (pdfDoc && msg.page >= 1 && msg.page <= pdfDoc.numPages) {
              pageNum = msg.page;
              queueRenderPage(pageNum);
            }
            break;
          case 'zoomIn':
            scale = Math.min(scale + 0.25, 3.5);
            queueRenderPage(pageNum);
            break;
          case 'zoomOut':
            scale = Math.max(scale - 0.25, 0.6);
            queueRenderPage(pageNum);
            break;
          case 'resetZoom':
            scale = 1.3;
            queueRenderPage(pageNum);
            break;
          case 'setTheme':
            currentTheme = msg.theme;
            document.body.className = 'theme-' + msg.theme;
            document.body.style.backgroundColor = 
              msg.theme === 'dark' ? '#0B0F19' : 
              msg.theme === 'sepia' ? '#F4ECD8' : '#F1F5F9';
            break;
          case 'extractText':
            extractCurrentText();
            break;
          case 'search':
            searchInPDF(msg.query);
            break;
          case 'loadData':
            if (msg.base64) {
              loadDocument(msg.base64);
            }
            break;
        }
      } catch (err) {
        console.error('Error handling RN message:', err);
      }
    });

    // Start loading on load
    window.onload = function() {
      if (base64Data) {
        loadDocument(base64Data);
      }
    };
  </script>
</body>
</html>`;
}
