/**
 * 实用工具函数
 */

// 复制文本到剪贴板
function copyText(text) {
  try {
    // 创建临时文本区域
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    // 选中并复制
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    const successful = document.execCommand('copy');
    
    // 清理
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

// 导出所有函数
window.QRUtils = {
  copyText,
  isUrl,
  getConfig
};

