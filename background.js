/** Event-driven menu routing and bounded image-download fallback. */
importScripts('config.js', 'barcode-decoder.js');

const CONTENT_VERSION = '1.3.0';
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const jobs = new Map();
let menuUpdate = Promise.resolve();

function queueMenuUpdate() {
  menuUpdate = menuUpdate.catch(() => {}).then(updateContextMenu);
  menuUpdate.catch(error => console.error('JQRCode: 菜单更新失败', error));
}

async function updateContextMenu() {
  const { featuresConfig } = await chrome.storage.sync.get('featuresConfig');
  await chrome.contextMenus.removeAll();
  if (featuresConfig?.contextMenuEnabled ?? JQRConfig.defaults.features.contextMenuEnabled) {
    await new Promise((resolve, reject) => {
      chrome.contextMenus.create({
        id: '1', title: '识别二维码', contexts: ['image'],
        documentUrlPatterns: ['http://*/*', 'https://*/*', 'file:///*']
      }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve();
      });
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  queueMenuUpdate();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.featuresConfig) {
    queueMenuUpdate();
  }
});

function permissionOrigins(info, tab) {
  const origins = new Set();
  const page = new URL(tab.url || info.pageUrl);
  for (const value of [info.srcUrl, info.frameUrl]) {
    if (!value) continue;
    const url = new URL(value);
    if (url.protocol === 'file:') {
      origins.add('file:///*');
    } else if (['http:', 'https:'].includes(url.protocol) && url.origin !== page.origin) {
      // Match patterns don't include a port; scope access to this host/scheme.
      origins.add(`${url.protocol}//${url.hostname}/*`);
    }
  }
  return [...origins];
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== '1' || tab?.id == null || !info.srcUrl || jobs.has(tab.id)) return;
  const job = {
    id: crypto.randomUUID(), tabId: tab.id, frameId: info.frameId || 0,
    url: info.srcUrl, downloaded: false, controller: new AbortController()
  };
  jobs.set(tab.id, job);
  try {
    const origins = permissionOrigins(info, tab);
    // Start this directly in the menu gesture, before any asynchronous work.
    // Denial still allows the page-readable/CORS image path to be tried.
    const permission = origins.length
      ? chrome.permissions.request({ origins }).catch(() => false)
      : Promise.resolve(true);
    runRecognition(job, permission).catch(error => reportFailure(job, error));
  } catch (error) {
    jobs.delete(tab.id);
    reportFailure(job, error);
  }
});

async function prepareContent(job) {
  const [frame] = await chrome.scripting.executeScript({
    target: { tabId: job.tabId, frameIds: [job.frameId] },
    func: () => globalThis.__JQRCodeContent?.version
  });
  if (!frame?.documentId) throw new Error('无法访问当前页面，请重新加载后重试');
  job.documentId = frame.documentId;
  if (frame.result !== CONTENT_VERSION) {
    const target = { tabId: job.tabId, documentIds: [job.documentId] };
    await chrome.scripting.insertCSS({ target, files: ['qr-extension.css'] });
    await chrome.scripting.executeScript({
      target, files: ['config.js', 'utils.js', 'barcode-decoder.js', 'content.js']
    });
  }
}

async function runRecognition(job, permission) {
  try {
    await permission;
    await prepareContent(job);
    await chrome.action.setBadgeText({ tabId: job.tabId, text: '' });
    await chrome.action.setTitle({ tabId: job.tabId, title: '生成二维码' });
    await Promise.race([
      chrome.tabs.sendMessage(job.tabId, {
        type: 'jqrcode:recognize', requestId: job.id, url: job.url
      }, { documentId: job.documentId }),
      new Promise((_, reject) => {
        job.timer = setTimeout(() => {
          job.controller.abort();
          reject(new Error('识别超时，请重试'));
        }, 30_000);
      })
    ]);
  } finally {
    clearTimeout(job.timer);
    job.controller.abort();
    if (jobs.get(job.tabId) === job) jobs.delete(job.tabId);
  }
}

async function reportFailure(job, error) {
  console.error('JQRCode: 识别请求失败', error);
  // Restricted pages/file access may prevent content injection altogether.
  await Promise.allSettled([
    chrome.action.setBadgeText({ tabId: job.tabId, text: '!' }),
    chrome.action.setTitle({
      tabId: job.tabId,
      title: '无法识别：请检查网站权限；本地文件需开启“允许访问文件网址”，然后重试'
    })
  ]);
}

async function downloadAndDecode(job) {
  if (job.downloaded) throw new Error('图片读取失败，请重试');
  job.downloaded = true;
  const url = new URL(job.url);
  if (!['http:', 'https:', 'file:', 'data:'].includes(url.protocol)) {
    throw new Error('无法读取这张图片，请另存图片后重试');
  }
  const response = await fetch(job.url, {
    signal: job.controller.signal, credentials: 'include'
  });
  if (!response.ok) throw new Error(`图片下载失败（${response.status}）`);
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
    throw new Error('图片文件过大，请裁剪后重试');
  }

  // Also bound actual streamed bytes when Content-Length is absent/inaccurate.
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) throw new Error('图片文件过大，请裁剪后重试');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (job.controller.signal.aborted) throw new Error('识别超时，请重试');
  const blob = new Blob(chunks, { type: response.headers.get('content-type') || '' });
  return JQRBarcodeDecoder.decode(blob);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type !== 'jqrcode:download') return;
  const job = jobs.get(sender.tab?.id);
  if (!job || job.id !== request.requestId || job.documentId !== sender.documentId) {
    sendResponse({ success: false, error: '识别请求已结束，请重试' });
    return;
  }
  // Only download the image captured by the user's menu click, never an
  // arbitrary URL supplied by a message from the content script.
  downloadAndDecode(job).then(
    result => sendResponse({ success: true, result }),
    error => sendResponse({
      success: false,
      error: job.controller.signal.aborted
        ? '识别超时，请重试'
        : `无法读取图片：${error.message}。跨域图片请允许图片域名的访问权限。`
    })
  );
  return true;
});

chrome.tabs.onRemoved.addListener(tabId => {
  const job = jobs.get(tabId);
  if (job) {
    clearTimeout(job.timer);
    job.controller.abort();
    jobs.delete(tabId);
  }
});
