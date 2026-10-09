/** Loaded only after a user requests image recognition. */
(() => {
  const VERSION = '1.3.0';
  if (globalThis.__JQRCodeContent?.version === VERSION) return;
  globalThis.__JQRCodeContent = { version: VERSION };

  const message = key => JQRConfig.get(`messages.${key}`);
  let activeRequest = null;
  let alertElement = null;

  function notify(text, error = false) {
    const notification = document.createElement('div');
    notification.className = `qr-notification qr-notification-${error ? 'error' : 'info'}`;
    notification.textContent = text;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  function loadImage(url, signal) {
    if (signal.aborted) return Promise.reject(new Error('识别已取消'));
    // Reuse decoded page images when possible; native detection will still
    // enforce origin restrictions and fall back to the extension worker.
    const existing = Array.from(document.images).find(image =>
      (image.currentSrc === url || image.src === url) &&
      image.complete && image.naturalWidth
    );
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      const timer = setTimeout(() => finish(new Error('图片加载超时')), 7000);
      function cleanup() {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        image.onload = null;
        image.onerror = null;
      }
      function finish(error) {
        cleanup();
        if (error) {
          image.src = '';
          reject(error);
        } else {
          resolve(image);
        }
      }
      function onAbort() { finish(new Error('识别已取消')); }
      signal.addEventListener('abort', onAbort, { once: true });
      image.onload = () => finish();
      image.onerror = () => finish(new Error('页面无法读取图片'));
      image.src = url;
    });
  }

  async function decodeImage(request, job) {
    try {
      const image = await loadImage(request.url, job.controller.signal);
      return await JQRBarcodeDecoder.decode(image);
    } catch (error) {
      if (job.controller.signal.aborted) throw error;
      // At most one download; the worker knows the original URL and returns
      // only decoded text, rather than sending image bytes back to the page.
      const response = await chrome.runtime.sendMessage({
        type: 'jqrcode:download', requestId: request.requestId
      });
      if (!response?.success) {
        throw new Error(response?.error || '无法读取图片，请重试');
      }
      return response.result;
    }
  }

  async function recognize(request) {
    if (activeRequest) return { success: false, error: '正在识别，请稍候' };
    const job = { controller: new AbortController() };
    activeRequest = job;
    const loading = document.createElement('div');
    loading.className = 'qr-loader';
    loading.innerHTML = '<div class="qr-loader-spinner"></div><p>正在识别二维码...</p>';
    document.body.appendChild(loading);

    let timer;
    try {
      const result = await Promise.race([
        decodeImage(request, job),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            job.controller.abort();
            reject(new Error('识别超时，请重试'));
          }, 28_000);
        })
      ]);
      if (result?.data) showResult(result.data);
      else notify(message('qrNotDetected'), true);
      return { success: true };
    } catch (error) {
      notify(error.message || message('imageFailed'), true);
      return { success: false, error: error.message };
    } finally {
      clearTimeout(timer);
      job.controller.abort();
      loading.remove();
      if (activeRequest === job) activeRequest = null;
    }
  }

  function showResult(text) {
    alertElement?.remove();
    const background = document.createElement('div');
    background.className = 'qr-alert-background';
    const view = document.createElement('div');
    view.className = 'qr-alert-view';
    const title = document.createElement('div');
    title.className = 'qr-alert-title';
    title.textContent = message('qrRecognized');
    const content = document.createElement('div');
    content.className = 'qr-alert-text';
    content.textContent = text;
    const buttons = document.createElement('div');
    buttons.className = 'qr-alert-buttons';
    const copy = document.createElement('button');
    copy.className = 'qr-alert-button qr-alert-button-copy';
    copy.textContent = '📋 复制内容';
    const open = document.createElement('button');
    open.className = 'qr-alert-button qr-alert-button-open';
    const isUrl = JQRUtils.isUrl(text);
    open.textContent = isUrl ? '🔗 打开链接' : '✓ 知道了';

    function close() {
      background.remove();
      if (alertElement === background) alertElement = null;
    }
    background.addEventListener('click', event => {
      if (event.target === background) close();
    });
    copy.addEventListener('click', async () => {
      copy.disabled = true;
      const success = await JQRUtils.copyText(text);
      notify(message(success ? 'copySuccess' : 'copyFailed'), !success);
      close();
    }, { once: true });
    open.addEventListener('click', () => {
      if (isUrl) window.location.assign(text);
      close();
    }, { once: true });

    buttons.append(copy, open);
    view.append(title, content, buttons);
    background.appendChild(view);
    document.body.appendChild(background);
    alertElement = background;
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || request?.type !== 'jqrcode:recognize') return;
    recognize(request).then(sendResponse, error =>
      sendResponse({ success: false, error: error.message })
    );
    return true;
  });
})();
