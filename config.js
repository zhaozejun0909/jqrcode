/** Shared defaults; storage is read only when an extension page requests it. */
(() => {
  if (globalThis.JQRConfig) return;

  const defaults = {
    localhost: { from: 'http://localhost', to: 'http://10.55.2.25' },
    qrCode: { minWidth: 220, maxWidth: 320, urlLengthThreshold: 40 },
    features: { contextMenuEnabled: true },
    messages: {
      qrNotDetected: '二维码未识别出结果',
      qrRecognized: '识别结果',
      imageFailed: '图片加载失败，识别失败',
      copySuccess: '已复制到剪贴板',
      copyFailed: '复制失败'
    }
  };
  let config = structuredClone(defaults);
  let loading = null;

  function load() {
    if (!loading) {
      loading = chrome.storage.sync.get([
        'localhostConfig', 'qrCodeConfig', 'featuresConfig'
      ]).then(result => {
        config = {
          localhost: { ...defaults.localhost, ...result.localhostConfig },
          qrCode: { ...defaults.qrCode, ...result.qrCodeConfig },
          features: { ...defaults.features, ...result.featuresConfig },
          messages: defaults.messages
        };
        return config;
      }).catch(error => {
        loading = null;
        throw error;
      });
    }
    return loading;
  }

  globalThis.JQRConfig = {
    defaults,
    load,
    get: path => path.split('.').reduce((value, key) => value?.[key], config)
  };
})();
