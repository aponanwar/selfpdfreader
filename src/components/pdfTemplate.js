export function generatePDFViewerHTML(pdfBase64, initialPage = 1, theme = 'light') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>Self PDF Reader</title>
  <!-- Mozilla PDF.js -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * {
      box-sizing: border-box;
      -webkit-touch-callout: none;
      -webkit-user-select: text;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100%;
      overflow-x: auto;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      background-color: ${theme === 'dark' ? '#0B0F19' : theme === 'sepia' ? '#F4ECD8' : '#E2E8F0'};
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
      justify-content: flex-start;
      width: 100%;
      min-height: 100%;
      padding: 10px 0 80px 0;
      box-sizing: border-box;
    }
    .page-wrapper {
      position: relative;
      margin: 8px auto;
      box-shadow: 0 4px 18px rgba(0,0,0,0.22);
      border-radius: 4px;
      background: #FFFFFF;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: filter 0.3s ease;
      overflow: visible;
    }
    canvas {
      display: block;
      border-radius: 4px;
    }
    /* Theme color inversions */
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
      font-size: 15px;
      font-weight: 600;
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
      padding: 6px 14px;
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
      max-width: 85%;
      font-size: 14px;
    }
  </style>
</head>
<body class="theme-${theme}">
  <div id="loading">
    <div class="spinner"></div>
    <div id="loading-text">Rendering Document...</div>
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
    let userZoom = 1.0;
    let fitMode = 'fitWidth'; // 'fitWidth' | 'fitPage'
    let currentTheme = '${theme}';
    let base64Data = '${pdfBase64 || ''}';
    
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const pageWrapper = document.getElementById('page-container');
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

    // Dynamic screen-adaptive scale calculation (Fit-to-Width & Fit-to-Page)
    function calculateViewport(page) {
      // 1. Get raw unscaled dimensions of the PDF page (e.g., A4 is 595 x 842 pt)
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // 2. Measure actual viewport size of device screen
      const screenWidth = window.innerWidth || document.documentElement.clientWidth || 360;
      const screenHeight = window.innerHeight || document.documentElement.clientHeight || 640;

      // 3. Provide clean margin (16px total) so page edges fit cleanly inside screen
      const availableWidth = Math.max(screenWidth - 16, 260);
      const availableHeight = Math.max(screenHeight - 110, 320);

      const scaleWidth = availableWidth / unscaledViewport.width;
      const scaleHeight = availableHeight / unscaledViewport.height;

      let baseScale = scaleWidth;
      if (fitMode === 'fitPage') {
        baseScale = Math.min(scaleWidth, scaleHeight);
      }

      // Multiply by user zoom factor (default 1.0)
      const finalScale = baseScale * userZoom;
      return page.getViewport({ scale: finalScale });
    }

    function renderPage(num) {
      pageRendering = true;
      pdfDoc.getPage(num).then(function(page) {
        const viewport = calculateViewport(page);

        // Sharp high-DPI scaling for Retina and AMOLED mobile displays
        const dpr = Math.min(window.devicePixelRatio || 2, 2.5);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);

        const cssWidth = Math.floor(viewport.width);
        const cssHeight = Math.floor(viewport.height);

        canvas.style.width = cssWidth + "px";
        canvas.style.height = cssHeight + "px";
        pageWrapper.style.width = cssWidth + "px";
        pageWrapper.style.height = cssHeight + "px";

        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;

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

    // Auto re-render on screen orientation change (Portrait <-> Landscape)
    window.addEventListener('resize', function() {
      if (pdfDoc && !pageRendering) {
        renderPage(pageNum);
      }
    });

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

    // Global navigation functions for direct JavaScript injection
    window.goToNextPage = function() {
      if (pdfDoc && pageNum < pdfDoc.numPages) {
        pageNum++;
        queueRenderPage(pageNum);
      }
    };

    window.goToPrevPage = function() {
      if (pdfDoc && pageNum > 1) {
        pageNum--;
        queueRenderPage(pageNum);
      }
    };

    window.goToPage = function(target) {
      const p = parseInt(target, 10);
      if (pdfDoc && !isNaN(p) && p >= 1 && p <= pdfDoc.numPages) {
        pageNum = p;
        queueRenderPage(pageNum);
      }
    };

    window.zoomIn = function() {
      userZoom = Math.min(userZoom + 0.25, 4.0);
      queueRenderPage(pageNum);
    };

    window.zoomOut = function() {
      userZoom = Math.max(userZoom - 0.25, 0.4);
      queueRenderPage(pageNum);
    };

    window.resetZoom = function() {
      userZoom = 1.0;
      fitMode = 'fitWidth';
      queueRenderPage(pageNum);
    };

    // Touch Swipe Gesture Detection (Swipe Left for Next Page, Swipe Right for Prev Page)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    function onTouchStart(e) {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    }

    function onTouchEnd(e) {
      if (e.changedTouches && e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const deltaTime = Date.now() - touchStartTime;

        // If swipe took less than 600ms, moved at least 50px horizontally, and horizontal > 1.4 * vertical
        if (deltaTime < 600 && Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
          if (deltaX < 0) {
            // Swiped Left -> Next Page
            window.goToNextPage();
          } else {
            // Swiped Right -> Previous Page
            window.goToPrevPage();
          }
        }
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    // Message handler from React Native (Supports both window and document on Android)
    function onRNMessage(event) {
      try {
        const raw = event.data;
        const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!msg || !msg.action) return;

        switch (msg.action) {
          case 'nextPage':
            window.goToNextPage();
            break;
          case 'prevPage':
            window.goToPrevPage();
            break;
          case 'goToPage':
            window.goToPage(msg.page);
            break;
          case 'zoomIn':
            window.zoomIn();
            break;
          case 'zoomOut':
            window.zoomOut();
            break;
          case 'resetZoom':
            window.resetZoom();
            break;
          case 'toggleFitMode':
            fitMode = fitMode === 'fitWidth' ? 'fitPage' : 'fitWidth';
            userZoom = 1.0;
            queueRenderPage(pageNum);
            break;
          case 'setTheme':
            currentTheme = msg.theme;
            document.body.className = 'theme-' + msg.theme;
            document.body.style.backgroundColor = 
              msg.theme === 'dark' ? '#0B0F19' : 
              msg.theme === 'sepia' ? '#F4ECD8' : '#E2E8F0';
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
    }

    window.addEventListener('message', onRNMessage);
    document.addEventListener('message', onRNMessage);

    window.onload = function() {
      if (base64Data) {
        loadDocument(base64Data);
      }
    };
  </script>
</body>
</html>`;
}
