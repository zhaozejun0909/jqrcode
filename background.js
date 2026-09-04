/**
 * 后台脚本 - 消息转发、菜单管理
 */

// 默认的功能配置
const DEFAULT_FEATURES = {
  contextMenuEnabled: true
};

// 扩展安装或更新时初始化
chrome.runtime.onInstalled.addListener(() => {
  try {
    // 检查 chrome.storage 是否可用
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
      console.warn('chrome.storage 不可用，使用默认配置');
      createContextMenu();
      return;
    }

    // 加载用户配置
    chrome.storage.sync.get(['featuresConfig'], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('读取配置失败:', chrome.runtime.lastError.message);
        createContextMenu();
        return;
      }
      
      const featuresConfig = result.featuresConfig || DEFAULT_FEATURES;
      if (featuresConfig.contextMenuEnabled) {
        createContextMenu();
      }
    });
  } catch (error) {
    console.error('初始化失败:', error);
    // 初始化失败时仍然创建菜单
    createContextMenu();
  }
});

// 创建右键菜单
function createContextMenu() {
  try {
    // 先删除可能存在的菜单
    chrome.contextMenus.removeAll(() => {
      const options = {
        type: 'normal',
        contexts: ['image'],
        id: '1',
        title: '🔍 识别二维码',
        visible: true
      };
      chrome.contextMenus.create(options, () => {
        if (chrome.runtime.lastError) {
          console.warn('右键菜单创建失败:', chrome.runtime.lastError.message);
        } else {
          console.log('右键菜单创建成功');
        }
      });
    });
  } catch (error) {
    console.error('创建右键菜单失败:', error);
  }
}

// 删除右键菜单
function removeContextMenu() {
  try {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        console.warn('删除右键菜单失败:', chrome.runtime.lastError.message);
      } else {
        console.log('右键菜单已删除');
      }
    });
  } catch (error) {
    console.error('删除右键菜单失败:', error);
  }
}

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener((info) => {
  try {
    if (info.menuItemId === '1') {
      handleQRCodeRecognition(info.srcUrl);
    }
  } catch (error) {
    console.error('处理右键菜单点击失败:', error);
  }
});

// 处理来自 content.js 和 options.js 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    // 来自 options.js 的菜单控制消息
    if (request.action === 'updateContextMenu') {
      if (request.enabled) {
        createContextMenu();
      } else {
        removeContextMenu();
      }
      sendResponse({ success: true });
      return true;
    }

    // 来自 content.js 的图片 URL 消息
    if (request && typeof request === 'string') {
      downloadAndPush(request);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: '无效的请求' });
    }
  } catch (error) {
    console.error('处理消息失败:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true;
});

/**
 * 处理二维码识别请求
 */
function handleQRCodeRecognition(url) {
  try {
    if (!url) {
      console.warn('二维码识别：URL 为空');
      return;
    }

    // 判断是否为本地文件
    if (url.indexOf('file') === 0) {
      downloadAndPush(url);
    } else {
      sendMessageToContentJS(url);
    }
  } catch (error) {
    console.error('二维码识别处理失败:', error);
  }
}

/**
 * 下载图片并转为 Base64，然后通知 content.js
 * 处理跨域或本地图片
 */
function downloadAndPush(url) {
  try {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`图片下载失败: ${response.status}`);
        }
        return response.blob();
      })
      .then((blobData) => {
        const reader = new FileReader();
        reader.addEventListener(
          'load',
          function () {
            sendMessageToContentJS(reader.result);
          },
          false
        );
        reader.addEventListener(
          'error',
          function () {
            console.error('FileReader 读取失败:', reader.error);
          },
          false
        );
        reader.readAsDataURL(blobData);
      })
      .catch((error) => {
        console.error('图片下载失败:', error);
      });
  } catch (error) {
    console.error('下载并转换失败:', error);
  }
}

/**
 * 向当前活跃标签页的 content.js 发送消息
 */
function sendMessageToContentJS(data) {
  try {
    let queryOptions = { active: true, currentWindow: true };
    chrome.tabs.query(queryOptions, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('查询标签页失败:', chrome.runtime.lastError.message);
        return;
      }

      if (tabs && tabs.length > 0) {
        const activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, data, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('发送消息失败:', chrome.runtime.lastError.message);
          } else {
            console.log('消息发送成功');
          }
        });
      } else {
        console.warn('未找到活跃标签页');
      }
    });
  } catch (error) {
    console.error('发送消息失败:', error);
  }
}


