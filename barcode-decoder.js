/**
 * 二维码解码器 - 使用原生Barcode Detection API
 * 仅支持现代浏览器 (Chrome 83+, Edge 83+, 等)
 */

const BarcodeDecoder = (() => {
  let barcodeDetector = null;
  let initialized = false;

  // 初始化检测器
  async function init() {
    if (initialized) return true;
    
    try {
      // 检查浏览器是否支持 Barcode Detection API
      if (typeof BarcodeDetector !== 'undefined') {
        barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        initialized = true;
        console.log('✓ 使用原生 Barcode Detection API (Chrome 83+)');
        return true;
      }
    } catch (error) {
      console.error('✗ 此浏览器不支持 Barcode Detection API');
      console.error('本扩展需要 Chrome 83+ 或其他支持该API的现代浏览器');
      return false;
    }

    console.error('✗ Barcode Detection API 不可用');
    return false;
  }

  // 将ImageData转换为ImageBitmap（用于原生API）
  async function imageDataToImageBitmap(imageData) {
    try {
      return await createImageBitmap(imageData);
    } catch (error) {
      console.error('ImageBitmap 转换失败:', error);
      return null;
    }
  }

  // 使用原生 Barcode Detection API 解码
  async function decodeWithNativeAPI(imageData) {
    try {
      const imageBitmap = await imageDataToImageBitmap(imageData);
      if (!imageBitmap) {
        return null;
      }

      const barcodes = await barcodeDetector.detect(imageBitmap);
      
      if (barcodes && barcodes.length > 0) {
        // 返回第一个识别到的二维码
        return {
          data: barcodes[0].rawValue,
          source: 'BarcodeDetector'
        };
      }
      return null;
    } catch (error) {
      console.error('原生API解码failed:', error);
      return null;
    }
  }



  // 主解码函数
  async function decode(imageData) {
    // 如果还未初始化，先初始化
    if (!initialized) {
      const success = await init();
      if (!success) {
        return null;
      }
    }

    // 使用原生API解码
    if (barcodeDetector) {
      return await decodeWithNativeAPI(imageData);
    }

    console.error('✗ BarcodeDetector 未初始化');
    return null;
  }

  // 获取当前使用的解码方式
  function getDecoderType() {
    return initialized ? 'BarcodeDetector (Native)' : 'Not Initialized';
  }

  return {
    init,
    decode,
    getDecoderType
  };
})();
