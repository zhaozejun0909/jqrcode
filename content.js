/**
 * 内容脚本 - 二维码识别模块
 * 在页面中注入脚本来使用工具函数
 */

// 首先，将工具脚本注入到页面环境中
function injectUtilsScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('utils-injected.js');
  
  script.onload = () => {
    // 从 Chrome Storage 读取配置
    chrome.storage.sync.get(['localhostConfig', 'qrCodeConfig'], (result) => {
      const config = {
        localhost: result.localhostConfig || CONFIG.localhost,
        qrCode: result.qrCodeConfig ? { ...CONFIG.qrCode, ...result.qrCodeConfig } : CONFIG.qrCode,
        messages: CONFIG.messages
      };
      
      // 通过 postMessage 将配置传递给网页环境
      window.postMessage({
        type: 'QR_CONFIG_INJECT',
        config: config
      }, '*');
    });
    
    script.remove();
  };
  
  script.onerror = () => {
    console.error('加载 utils-injected.js 失败');
    script.remove();
  };
  
  (document.head || document.documentElement).appendChild(script);
}

// 注入工具脚本
injectUtilsScript();

// 初始化二维码解码器
BarcodeDecoder.init().then((success) => {
  if (success) {
    console.log(`✓ 二维码解码器初始化成功 (${BarcodeDecoder.getDecoderType()})`);
  } else {
    console.error('✗ 是否已更新到支持 Barcode Detection API 的浏览器版本？(Chrome 83+)');
  }
}).catch(error => {
  console.error('初始化二维码解码器异常:', error);
});

// 监听来自 background.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message) {
    QRCodeRecognizer.recognize(message);
  } else {
    QRCodeRecognizer.showError(getConfig('messages.qrNotDetected'));
  }
  sendResponse(true);
  return true;
});

/**
 * 二维码识别模块
 */
const QRCodeRecognizer = (() => {
  let isLoading = false;
  let alertBackgroundElement = null;

  // 显示加载状态
  function showLoading() {
    if (isLoading) return;
    isLoading = true;

    const loadingDiv = createLoadingElement();
    document.body.appendChild(loadingDiv);
  }

  // 隐藏加载状态
  function hideLoading() {
    isLoading = false;
    const loader = document.querySelector('.qr-loader');
    if (loader) {
      loader.remove();
    }
  }

  // 创建加载元素
  function createLoadingElement() {
    const div = document.createElement('div');
    div.className = 'qr-loader';
    div.innerHTML = `
      <div class="loader-spinner"></div>
      <p>正在识别二维码...</p>
    `;
    return div;
  }

  // 将图片转换为 Base64
  function convertImgToBase64(url, callback) {
    try {
      const canvas = document.createElement('CANVAS');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        try {
          canvas.height = img.height;
          canvas.width = img.width;
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
          callback.call(this, imgData);
          canvas.remove();
        } catch (error) {
          console.error('图片处理失败:', error);
          handleImageError(url);
        }
      };

      img.onerror = () => {
        handleImageError(url);
      };

      if (typeof url === 'string') {
        img.src = url;
      } else {
        img.src = window.URL.createObjectURL(url);
      }
    } catch (error) {
      console.error('转换失败:', error);
      showError(getConfig('messages.imageFailed'));
    }
  }

  // 处理图片加载错误
  function handleImageError(url) {
    if (typeof url === 'string') {
      // 通知 background.js 下载图片
      chrome.runtime.sendMessage(url).catch(() => {
        console.error('无法联系 background.js');
        showError(getConfig('messages.imageFailed'));
      });
    } else {
      showError(getConfig('messages.imageFailed'));
    }
  }

  // 识别二维码
  function recognize(url) {
    try {
      showLoading();
      convertImgToBase64(url, async (imageData) => {
        try {
          // 使用原生Barcode Detection API或jsQR备选方案
          const result = await BarcodeDecoder.decode(imageData);
          hideLoading();
          
          if (result && result.data) {
            console.log(`✓ 二维码解析成功 (${result.source}): ${result.data}`);
            showResult(result.data);
          } else {
            showError(getConfig('messages.qrNotDetected'));
          }
        } catch (error) {
          hideLoading();
          console.error('二维码解析失败:', error);
          showError('二维码解析出错，可能不是有效的二维码');
        }
      });
    } catch (error) {
      hideLoading();
      console.error('识别流程出错:', error);
      showError('识别流程出错');
    }
  }

  // 显示识别结果
  function showResult(resultText) {
    try {
      if (!resultText) {
        showError(getConfig('messages.qrNotDetected'));
        return;
      }

      const isUrlType = isUrl(resultText);
      showAlert(resultText, isUrlType);
    } catch (error) {
      console.error('显示结果失败:', error);
      showError('显示结果失败');
    }
  }

  // 显示结果弹窗
  function showAlert(text, isUrl) {
    try {
      // 清理旧弹窗
      const oldAlert = document.querySelector('.qr-alert-background');
      if (oldAlert) {
        cleanupAlert(oldAlert);
        oldAlert.remove();
      }

      // 创建新弹窗
      const background = document.createElement('div');
      background.className = 'qr-alert-background';

      const alertView = document.createElement('div');
      alertView.className = 'qr-alert-view';

      const title = document.createElement('div');
      title.className = 'qr-alert-title';
      title.textContent = getConfig('messages.qrRecognized');

      const textDiv = document.createElement('div');
      textDiv.className = 'qr-alert-text';
      textDiv.textContent = text;

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'qr-alert-buttons';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'qr-alert-button qr-alert-button-copy';
      copyBtn.textContent = '📋 复制内容';

      const openBtn = document.createElement('button');
      openBtn.className = 'qr-alert-button qr-alert-button-open';
      openBtn.textContent = isUrl ? '🔗 打开链接' : '✓ 知道了';

      buttonContainer.appendChild(copyBtn);
      buttonContainer.appendChild(openBtn);

      alertView.appendChild(title);
      alertView.appendChild(textDiv);
      alertView.appendChild(buttonContainer);
      background.appendChild(alertView);

      document.body.appendChild(background);
      alertBackgroundElement = background;

      // 绑定事件
      bindAlertEvents(background, text, isUrl);
    } catch (error) {
      console.error('显示弹窗失败:', error);
      showError('显示弹窗失败');
    }
  }

  // 绑定弹窗事件
  function bindAlertEvents(background, text, isUrl) {
    const copyBtn = background.querySelector('.qr-alert-button-copy');
    const openBtn = background.querySelector('.qr-alert-button-open');

    const handleClose = () => {
      cleanupAlert(background);
      background.remove();
      alertBackgroundElement = null;
    };

    // 背景点击关闭
    const backgroundClickHandler = (e) => {
      if (e.target === background) {
        handleClose();
      }
    };
    background.addEventListener('click', backgroundClickHandler);

    // 阻止弹窗内部点击关闭
    background.querySelector('.qr-alert-view').addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // 复制按钮
    if (copyBtn) {
      const copyClickHandler = () => {
        const success = copyText(text);
        if (success) {
          showNotification(getConfig('messages.copySuccess'));
        } else {
          showNotification(getConfig('messages.copyFailed'), 'error');
        }
        handleClose();
      };
      copyBtn.addEventListener('click', copyClickHandler, { once: true });
    }

    // 打开/关闭按钮
    if (openBtn) {
      const openClickHandler = () => {
        if (isUrl) {
          try {
            window.location.assign(text);
          } catch (error) {
            console.error('打开链接失败:', error);
            showError('打开链接失败');
          }
        }
        handleClose();
      };
      openBtn.addEventListener('click', openClickHandler, { once: true });
    }
  }

  // 清理事件监听
  function cleanupAlert(element) {
    if (!element) return;
    const buttons = element.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.replaceWith(btn.cloneNode(true));
    });
  }

  // 显示错误信息
  function showError(message) {
    hideLoading();
    showNotification(message, 'error');
  }

  // 显示通知
  function showNotification(message, type = 'info') {
    try {
      const notification = document.createElement('div');
      notification.className = `qr-notification qr-notification-${type}`;
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#f56c6c' : '#67c23a'};
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 10001;
        animation: slideIn 0.3s ease-in-out;
      `;

      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in-out';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    } catch (error) {
      console.error('显示通知失败:', error);
    }
  }

  return {
    recognize,
    showError,
    showLoading,
    hideLoading
  };
})();

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

