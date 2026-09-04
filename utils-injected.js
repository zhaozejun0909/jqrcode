/**
 * 注入到页面的最小化脚本
 * 从 Chrome Storage 动态读取配置，避免代码重复
 */

// 从 Chrome Storage 读取配置（需要由 content.js 通过 postMessage 传递）
window.__qrConfig = null;

// 辅助函数：获取嵌套配置
function getConfig(path) {
  if (!window.__qrConfig) return null;
  const keys = path.split('.');
  let config = window.__qrConfig;
  for (let key of keys) {
    config = config[key];
    if (config === undefined) return null;
  }
  return config;
}

// 复制文本到剪贴板
function copyText(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (error) {
    console.error('复制失败:', error);
    return false;
  }
}

// 检查是否为 URL
function isUrl(text) {
  return /^https?:\/\/.+/.test(text);
}

// 导出到 window 供页面使用
window.QRUtils = {
  copyText,
  isUrl,
  getConfig
};

// 监听来自 content.js 的配置消息
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === 'QR_CONFIG_INJECT') {
    window.__qrConfig = event.data.config;
  }
});
