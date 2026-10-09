/** Lazy native decoding, shared by the content script and service worker. */
(() => {
  if (globalThis.JQRBarcodeDecoder) return;

  let initialization = null;

  async function init() {
    if (!initialization) {
      initialization = (async () => {
        if (typeof BarcodeDetector === 'undefined') {
          throw new Error('当前环境不支持原生二维码识别');
        }
        const formats = await BarcodeDetector.getSupportedFormats();
        if (!formats.includes('qr_code')) {
          throw new Error('当前浏览器不支持 QR Code 格式');
        }
        return new BarcodeDetector({ formats: ['qr_code'] });
      })();
    }
    return initialization;
  }

  async function decode(source) {
    const detector = await init();
    let bitmap = null;
    let resized = null;
    try {
      // Blob decoding happens in the extension worker; page images can be
      // detected directly, without canvas drawing or pixel readback.
      const image = source instanceof Blob
        ? (bitmap = await createImageBitmap(source)) : source;
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) throw new Error('图片尺寸无效');
      if (width * height > 32_000_000) {
        throw new Error('图片过大，请裁剪二维码区域后重试');
      }

      let barcodes;
      if (Math.max(width, height) > 2048) {
        const scale = 2048 / Math.max(width, height);
        resized = await createImageBitmap(image, {
          resizeWidth: Math.max(1, Math.round(width * scale)),
          resizeHeight: Math.max(1, Math.round(height * scale)),
          resizeQuality: 'high'
        });
        barcodes = await detector.detect(resized);
      }
      // Preserve small/dense QR codes by retrying at the original resolution.
      if (!barcodes?.length) barcodes = await detector.detect(image);
      return barcodes.length ? { data: barcodes[0].rawValue } : null;
    } finally {
      resized?.close();
      bitmap?.close();
    }
  }

  globalThis.JQRBarcodeDecoder = { decode };
})();
