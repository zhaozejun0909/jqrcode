/**
 * 项目配置文件
 * 支持从 Chrome Storage 读取用户自定义配置
 */

// 默认配置
const DEFAULT_CONFIG = {
  // localhost 转换配置
  localhost: {
    from: 'http://localhost',
    to: 'http://10.55.2.25'
  },
  
  // 二维码生成配置
  qrCode: {
    minWidth: 220,
    maxWidth: 320,
    defaultWidth: 220,
    urlLengthThreshold: 40
  },
  
  // 消息配置
  messages: {
    qrNotDetected: '二维码未识别出结果',
    qrRecognized: '识别结果',
    imageFailed: '图片加载失败，识别失败',
    copySuccess: '已复制到剪贴板',
    copyFailed: '复制失败'
  }
};

// 运行时配置（将被用户配置覆盖）
let CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

// 初始化配置（从 Chrome Storage 加载）
function initializeConfig() {
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
    });
  }
}

// 在脚本加载时初始化配置
initializeConfig();

// 获取配置项的辅助函数
function getConfig(path) {
  const keys = path.split('.');
  let config = CONFIG;
  for (let key of keys) {
    config = config[key];
    if (config === undefined) return null;
  }
  return config;
}
