/**
 * 选项页面脚本
 * 处理用户配置的保存和读取
 */

// 与弹窗、后台共享同一份默认配置。
const DEFAULT_CONFIG = JQRConfig.defaults;

// 页面加载时读取配置
document.addEventListener('DOMContentLoaded', () => {
  loadSettings().catch(error => showStatus('读取设置失败: ' + error.message, 'error'));
  bindEvents();
});

/**
 * 加载已保存的配置
 */
async function loadSettings() {
  const config = await JQRConfig.load();
  const localhostConfig = config.localhost;
  const qrCodeConfig = config.qrCode;
  const featuresConfig = config.features;

  document.getElementById('localhost-from').value = localhostConfig.from;
  document.getElementById('localhost-to').value = localhostConfig.to;
  document.getElementById('qr-min-width').value = qrCodeConfig.minWidth;
  document.getElementById('qr-max-width').value = qrCodeConfig.maxWidth;
  document.getElementById('qr-threshold').value = qrCodeConfig.urlLengthThreshold;
  document.getElementById('context-menu-toggle').checked = featuresConfig.contextMenuEnabled;
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
    const minWidth = Number(document.getElementById('qr-min-width').value);
    const maxWidth = Number(document.getElementById('qr-max-width').value);
    const threshold = Number(document.getElementById('qr-threshold').value);
    const contextMenuEnabled = document.getElementById('context-menu-toggle').checked;

    // 基本验证
    if (!localhostFrom || !localhostTo) {
      showStatus('请填写完整的 localhost 配置', 'error');
      return;
    }

    if (![minWidth, maxWidth, threshold].every(Number.isInteger)) {
      showStatus('二维码配置必须为整数', 'error');
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

    if (minWidth < 100 || maxWidth > 600) {
      showStatus('二维码宽度须在 100～600 px 之间', 'error');
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
      showStatus('✓ 设置已保存，下次打开弹窗时生效', 'success');
      // 后台直接监听 storage.onChanged 更新右键菜单。
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
  document.getElementById('context-menu-toggle').checked = DEFAULT_CONFIG.features.contextMenuEnabled;

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
