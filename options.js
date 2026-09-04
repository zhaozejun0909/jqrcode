/**
 * 选项页面脚本
 * 处理用户配置的保存和读取
 */

// 默认配置
const DEFAULT_CONFIG = {
  localhost: {
    from: 'http://localhost',
    to: 'http://10.55.2.25'
  },
  qrCode: {
    minWidth: 220,
    maxWidth: 320,
    urlLengthThreshold: 40
  },
  features: {
    contextMenuEnabled: true
  }
};

// 页面加载时读取配置
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  bindEvents();
});

/**
 * 加载已保存的配置
 */
function loadSettings() {
  chrome.storage.sync.get(['localhostConfig', 'qrCodeConfig', 'featuresConfig'], (result) => {
    const localhostConfig = result.localhostConfig || DEFAULT_CONFIG.localhost;
    const qrCodeConfig = result.qrCodeConfig || DEFAULT_CONFIG.qrCode;
    const featuresConfig = result.featuresConfig || DEFAULT_CONFIG.features;

    document.getElementById('localhost-from').value = localhostConfig.from;
    document.getElementById('localhost-to').value = localhostConfig.to;
    document.getElementById('qr-min-width').value = qrCodeConfig.minWidth;
    document.getElementById('qr-max-width').value = qrCodeConfig.maxWidth;
    document.getElementById('qr-threshold').value = qrCodeConfig.urlLengthThreshold;
    document.getElementById('context-menu-toggle').checked = featuresConfig.contextMenuEnabled;
  });
}

/**
 * 绑定事件监听
 */
function bindEvents() {
  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');

  if (!saveBtn || !resetBtn) {
    console.error('找不到保存或重置按钮元素');
    return;
  }

  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetToDefault);
}

/**
 * 保存配置
 */
function saveSettings() {
  try {
    // 验证输入
    const localhostFrom = document.getElementById('localhost-from').value.trim();
    const localhostTo = document.getElementById('localhost-to').value.trim();
    const minWidth = parseInt(document.getElementById('qr-min-width').value);
    const maxWidth = parseInt(document.getElementById('qr-max-width').value);
    const threshold = parseInt(document.getElementById('qr-threshold').value);
    const contextMenuEnabled = document.getElementById('context-menu-toggle').checked;

    // 基本验证
    if (!localhostFrom || !localhostTo) {
      showStatus('请填写完整的 localhost 配置', 'error');
      return;
    }

    if (isNaN(minWidth) || isNaN(maxWidth) || isNaN(threshold)) {
      showStatus('二维码配置必须为数字', 'error');
      return;
    }

    if (minWidth <= 0 || maxWidth <= 0 || threshold <= 0) {
      showStatus('所有数值必须大于 0', 'error');
      return;
    }

    if (minWidth > maxWidth) {
      showStatus('最小宽度不能大于最大宽度', 'error');
      return;
    }

    // 保存到 Chrome Storage
    const localhostConfig = {
      from: localhostFrom,
      to: localhostTo
    };

    const qrCodeConfig = {
      minWidth: minWidth,
      maxWidth: maxWidth,
      urlLengthThreshold: threshold
    };

    const featuresConfig = {
      contextMenuEnabled: contextMenuEnabled
    };

    chrome.storage.sync.set({
      localhostConfig: localhostConfig,
      qrCodeConfig: qrCodeConfig,
      featuresConfig: featuresConfig
    }, () => {
      if (chrome.runtime.lastError) {
        showStatus('保存失败: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      showStatus('✓ 设置已保存，重新加载页面后生效', 'success');
      
      // 通知 background.js 更新右键菜单
      chrome.runtime.sendMessage({ 
        action: 'updateContextMenu',
        enabled: contextMenuEnabled
      }).catch(err => {
        console.warn('通知 background.js 失败:', err);
      });
    });
  } catch (error) {
    console.error('保存配置异常:', error);
    showStatus('保存异常: ' + error.message, 'error');
  }
}

/**
 * 恢复默认设置
 */
function resetToDefault() {
  if (!confirm('确定要恢复默认设置吗？')) {
    return;
  }

  document.getElementById('localhost-from').value = DEFAULT_CONFIG.localhost.from;
  document.getElementById('localhost-to').value = DEFAULT_CONFIG.localhost.to;
  document.getElementById('qr-min-width').value = DEFAULT_CONFIG.qrCode.minWidth;
  document.getElementById('qr-max-width').value = DEFAULT_CONFIG.qrCode.maxWidth;
  document.getElementById('qr-threshold').value = DEFAULT_CONFIG.qrCode.urlLengthThreshold;

  saveSettings();
}

/**
 * 显示状态消息
 */
function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status-message status-${type}`;

  setTimeout(() => {
    statusEl.className = 'status-message';
  }, 3000);
}
