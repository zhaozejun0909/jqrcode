/**
 * 弹窗模块 - 二维码生成器
 */
const QRCodeGenerator = (() => {
  let qrcode = null;
  let currentSize = getConfig('qrCode.defaultWidth');
  let configLoaded = false;

  // 从 Chrome Storage 加载配置
  function loadConfig() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['localhostConfig', 'qrCodeConfig'], (result) => {
          if (result.localhostConfig) {
            CONFIG.localhost = result.localhostConfig;
          }
          if (result.qrCodeConfig) {
            CONFIG.qrCode = {
              ...CONFIG.qrCode,
              ...result.qrCodeConfig
            };
          }
          currentSize = getConfig('qrCode.defaultWidth');
          configLoaded = true;
          resolve();
        });
      } else {
        configLoaded = true;
        resolve();
      }
    });
  }

  // 初始化二维码
  function init() {
    try {
      if (qrcode) {
        document.getElementById("qrcode").innerHTML = '';
      }
      
      qrcode = new QRCode(document.getElementById("qrcode"), {
        text: "",
        width: currentSize - 20,
        height: currentSize - 20,
        colorDark: "#0e1413",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (error) {
      console.error('初始化二维码失败:', error);
      showError('二维码初始化失败');
    }
  }

  // 生成二维码
  function generate(text) {
    try {
      if (!qrcode) {
        init();
      }
      if (!text) {
        console.warn('生成二维码：文本为空');
        return;
      }
      qrcode.makeCode(text);
    } catch (error) {
      console.error('生成二维码失败:', error);
      showError('生成二维码失败');
    }
  }

  // 调整大小
  function resize(text) {
    try {
      const minWidth = getConfig('qrCode.minWidth');
      const maxWidth = getConfig('qrCode.maxWidth');
      const threshold = getConfig('qrCode.urlLengthThreshold');
      
      if (text.length > threshold) {
        let newSize = minWidth + (text.length - threshold) * 1.2;
        currentSize = Math.min(newSize, maxWidth);
      } else {
        currentSize = minWidth;
      }

      // 更新 UI 大小（同步二维码和输入框宽度）
      const wrapView = document.getElementById("warp-view");
      const input = document.getElementById("input");
      if (wrapView) {
        wrapView.style.width = currentSize + "px";
        wrapView.style.height = currentSize + "px";
      }
      if (input) {
        input.style.width = currentSize + "px";
      }
    } catch (error) {
      console.error('调整大小失败:', error);
    }
  }

  // 处理 URL
  function processUrl(url) {
    try {
      const localhostConfig = getConfig('localhost');
      if (url.indexOf(localhostConfig.from) === 0) {
        return url.replace(localhostConfig.from, localhostConfig.to);
      }
      return url;
    } catch (error) {
      console.error('处理 URL 失败:', error);
      return url;
    }
  }

  // 显示错误
  function showError(message) {
    const errorDiv = document.getElementById("error-message") || createErrorElement();
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 3000);
  }

  // 创建错误元素
  function createErrorElement() {
    const div = document.createElement('div');
    div.id = 'error-message';
    div.className = 'error-message';
    const wrapView = document.getElementById("warp-view");
    if (wrapView) {
      wrapView.parentNode.insertBefore(div, wrapView.nextSibling);
    }
    return div;
  }

  // 加载当前标签页 URL
  function loadCurrentTab() {
    try {
      chrome.tabs.query({ active: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const url = processUrl(tabs[0].url);
          resize(url);
          init();
          generate(url);
          document.getElementById("input").value = url;
        }
      });
    } catch (error) {
      console.error('加载标签页失败:', error);
      showError('获取当前标签页失败');
    }
  }

  // 处理文本输入
  function handleTextInput(event) {
    try {
      const text = event.target.value;
      resize(text);
      init();
      if (text) {
        generate(text);
      }
    } catch (error) {
      console.error('处理文本输入失败:', error);
    }
  }

  // 初始化事件监听
  function bindEvents() {
    const input = document.getElementById("input");
    if (input) {
      input.addEventListener('input', handleTextInput);
    }
  }

  return {
    init,
    generate,
    loadCurrentTab,
    bindEvents,
    loadConfig
  };
})();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
  await QRCodeGenerator.loadConfig();
  QRCodeGenerator.bindEvents();
  QRCodeGenerator.loadCurrentTab();
});

