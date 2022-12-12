chrome.runtime.onInstalled.addListener(() => {
	// console.log('background js exculde');

	// 添加右键菜单：解析二维码
	const options = {
	    type: 'normal',
	    contexts: ['image'],
	    id: '1',
	    title: '识别二维码',
	    visible: true
	}
	chrome.contextMenus.create(options)
});

chrome.contextMenus.onClicked.addListener(
    (iknfo) => {
        // 接收图片并调用jsQR.js解析; jsQR.js: https://www.npmjs.com/package/jsqr
        // console.log(iknfo)
        const url = iknfo.srcUrl;
        if (url.indexOf('file') == 0) {
        	downloadAndPush(url)
	    } else {
	    	sendMessageToContentJS(url || '')
	    }
    }
)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request) {
    	downloadAndPush(request)
    }
});

// 下载图片并通知content.js显示结果
// 跨域或者是本地图片可以使用此方法
function downloadAndPush(url) {
	fetch(url).then((response) => {
		return response.blob()
	}).then(bobData => {
		// console.log(bobData)
		var reader  = new FileReader();
		reader.addEventListener("load", function () {
			sendMessageToContentJS(reader.result)
		}, false);
		reader.readAsDataURL(bobData);
	})
}

function sendMessageToContentJS(resultText) {
    let queryOptions = { active: true };
    chrome.tabs.query(queryOptions).then(tabs => {
        // console.log(tabs)
        let activeTab = tabs && tabs.length>0 && tabs[tabs.length-1]
        chrome.tabs.sendMessage(activeTab.id, resultText).then((response) => {
            // console.log("Received response: ", response);
        });
    })
}

