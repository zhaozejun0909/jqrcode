var qrcode = null

var theVVV = 200 // 二维码宽高

function initQRCode() {
    // qrcode.js文档：https://davidshimjs.github.io/qrcodejs/
    qrcode = new QRCode(document.getElementById("qrcode"), {
        text: "",
        width: theVVV - 20,
        height: theVVV - 20,
        colorDark : "#333333",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });
}

function makeCode (text) {
    qrcode.makeCode(text);
}

function logTabs(tabs) {
    var activeTab = tabs && tabs.length>0 && tabs[tabs.length-1]
    var url = activeTab.url
    if (url.indexOf("http://localhost") === 0) {
        // localhost自动替换成ip，此ip写死
        url = url.replace("http://localhost", "http://10.53.2.31")
    }
    if (url.length > 40) {
        // 根据url长度 自动缩放二维码大小
        var ww = 200 + (url.length - 40)*1.2
        if (ww > 320) ww=320
        theVVV = ww
        document.getElementById("warp-view").style.width = ww + "px";
        document.getElementById("warp-view").style.height = ww + "px";
        document.getElementById("input").style.width = ww - 20 + "px";
    }
    initQRCode()
    makeCode(url)
    document.getElementById("input").value = url
}

function onError(error) {
  // console.log(`Error: ${error}`);
}

let querying = chrome.tabs.query({active: true});
querying.then(logTabs, onError);

function textChange(obj) {
    var theurl = obj.target.value
    if (theurl) {
        makeCode(theurl)
    }
}

document.getElementById("input").oninput = textChange

