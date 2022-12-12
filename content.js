// browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
//     console.log("Received response: ", response);
// });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // console.log("Received request: ", message, sender);
    if (message) {
    	convertImgToBase64(message, imageData => {
            const code = jsQR(imageData.data, imageData.width, imageData.height)
            // console.log("Found QR code", code);
            // 得到结果，传到主window显示
            showQRResult(code ? code.data : '')
        })
    } else {
    	alert('二维码未识别出结果')
    }
    sendResponse(true)
    return true
});

// console.log('chrome extersion: content 执行了------')
// console.log('vierson:::::' + $.fn.jquery)

// 获取jsQR.js所需要的识别数据
function convertImgToBase64(url, callback) {
    let canvas = document.createElement('CANVAS'),
        ctx = canvas.getContext('2d'),
        img = new Image;
    img.crossOrigin = 'Anonymous';
    img.onload = function () {
        canvas.height = img.height;
        canvas.width = img.width;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height)
        callback.call(this, imgData);
        canvas = null;
    };
    img.onerror = function () {
        // 
        if (typeof url == 'string') { // 解决有些跨域请求问题，通知background.js下载图片
        	chrome.runtime.sendMessage('', url).then((response) => {
			});
        } else {
        	alert('图片加载失败，识别失败')
        }
    };
    if (typeof url == 'string') {
    	img.src = url;
	} else {
		img.src = window.URL.createObjectURL(url);
	}
}

function showQRResult(resultText) {
	// 显示识别的二维码内容
	if (resultText) {
		const isUrlType = isUrl(resultText)
		addAlertView(resultText)
	} else {
		alert('二维码未识别出结果')
	}
}

function addAlertView(text) {
	// 显示二维码识别结果的UI：alert 框
	// console.log('show qr alert')
	var txt1="<div class='qr-alert-background'>";
		var txt2="<div class='qr-alert-view'>";
			var txt3="<div class='qr-alert-title'>识别结果</div>"
			var txt4="<div class='qr-alert-text'></div>"
			var txt5="<div class='qr-alert-button-copy'>复制内容</div>"
			var txt6="<div class='qr-alert-button-open'>打开链接</div>"
		var txt7="</div>";
	var txt8="</div>";
    $("body").append(txt1+txt2+txt3+txt4+txt5+txt6+txt7+txt8);
    $(".qr-alert-text").text(text)
    $(".qr-alert-background").click(function(){
    	$(".qr-alert-background").remove()
	});
    $(".qr-alert-view").click(function(event){
        event.stopPropagation()
    });
	$(".qr-alert-button-copy").click(function(){
		copyText(text)
    	$(".qr-alert-background").remove()
	});
	$(".qr-alert-button-open").click(function(){
		window.location.assign(text)
    	$(".qr-alert-background").remove()
	});
}

function isUrl (url) {
   return /^https?:\/\/.+/.test(url)
}

/**
 * @param {String} text 需要复制的内容
 * @return {Boolean} 复制成功:true或者复制失败:false  执行完函数后，按ctrl + v试试
*/
function copyText(text){
    var textareaC = document.createElement('textarea');
    textareaC.setAttribute('readonly', 'readonly'); //设置只读属性防止手机上弹出软键盘
    textareaC.value = text;
    document.body.appendChild(textareaC); //将textarea添加为body子元素
    textareaC.select();
    var res = document.execCommand('copy');
    document.body.removeChild(textareaC);//移除DOM元素
    // console.log("复制成功");
    return res;
}

