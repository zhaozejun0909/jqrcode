/** Popup-only generation with one config read and debounced text input. */
(() => {
  const input = document.getElementById('input');
  const container = document.getElementById('qrcode');
  const wrapper = document.getElementById('warp-view');
  const styleStorageKey = 'qrCodeStyle';
  // Official showcase samples 4, 7, 8, 9 and 10 (not the live editor).
  const styles = [
    { name: '基础款', attributes: { template: 'default', level: 'M', 'foreground-color': '#0e1413', 'background-color': '#ffffff' } },
    { name: '水滴', attributes: {
      template: 'water', level: 'H', logo: 'images/qr-earth.png',
      'foreground-color': '#6d327c,#485DA6,#00a1ba,#00BF98,#36C486',
      'background-color': '#f1f8ff', 'inner-color': '#845EC2'
    } },
    { name: '条纹', attributes: {
      template: 'bar', level: 'H', 'foreground-color': '#3b8686,#79bd9a,#f8ca00,#008c9e',
      'background-color': '#f0f5f9', 'inner-color': '#3B4E32'
    } },
    { name: '闪烁', attributes: {
      template: 'glitter', level: 'H', 'foreground-color': '#fe4365,#fc9d9a,#6d9d88,#490a3d',
      'background-color': '#f9f1f1', 'inner-color': '#881600', 'outer-color': '#343838'
    } },
    { name: '方块', attributes: {
      template: 'rect', level: 'H', 'foreground-color': '#4abdac,#fc4a1a,#f7b733',
      'background-color': '#f9f6f3', 'inner-color': '#d66c44', 'outer-color': '#037584'
    } },
    { name: '星星', attributes: {
      template: 'star', level: 'L', 'foreground-color': '#fc9000,#ffa935,#ffb756',
      'background-color': '#034690'
    } }
  ];
  // Match each preset's correction level, including the component's default H.
  const qrByteCapacity = {
    L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271,
      321, 367, 425, 458, 520, 586, 644, 718, 792, 858,
      929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732,
      1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809, 2953],
    M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213,
      251, 287, 331, 362, 412, 450, 504, 560, 624, 666,
      711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370,
      1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213, 2331],
    H: [7, 14, 24, 34, 44, 58, 64, 84, 98, 119,
      137, 155, 177, 194, 220, 250, 280, 310, 338, 382,
      403, 439, 461, 511, 535, 593, 625, 658, 698, 742,
      790, 842, 898, 958, 983, 1051, 1093, 1139, 1219, 1273]
  };
  let styleIndex = 0;
  let qrcode = null;
  let renderedSize = null;
  let renderedText = null;
  let renderedLevel = null;
  let renderedStyleIndex = null;
  let composing = false;
  let edited = false;
  let ready = false;
  let debounce;
  let errorTimer;
  let imageTimer;
  let imageVersion = 0;
  let imageDelay = 0;
  let imageElement = null;
  let imageUrl = null;

  async function restoreStyle() {
    try {
      const saved = await chrome.storage.local.get(styleStorageKey);
      // Store the template ID rather than its position in the preset list.
      const index = styles.findIndex(style => style.attributes.template === saved[styleStorageKey]);
      if (index !== -1) styleIndex = index;
    } catch (error) {
      // Keep the basic preset if the saved preference cannot be read.
      console.warn('JQRCode: 读取样式偏好失败', error);
    }
  }

  function saveStyle() {
    chrome.storage.local.set({
      [styleStorageKey]: styles[styleIndex].attributes.template
    }).catch(error => {
      console.warn('JQRCode: 保存样式偏好失败', error);
    });
  }

  function clearImage() {
    imageVersion++;
    clearTimeout(imageTimer);
    if (imageElement) {
      imageElement.onload = imageElement.onerror = null;
      imageElement.remove();
      imageElement.removeAttribute('src');
      imageElement = null;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null;
    container.classList.remove('has-image', 'image-pending');
  }

  function prepareCanvas(delay) {
    imageDelay = delay;
    clearImage();
    // Initial display/style changes wait for the image instead of flashing Canvas.
    if (!delay) container.classList.add('image-pending');
  }

  function isCurrentImage(element, version) {
    return element === qrcode && version === imageVersion && !composing;
  }

  function exportImage(element, version) {
    if (!isCurrentImage(element, version)) return;
    const canvas = element.shadowRoot?.querySelector('canvas');
    if (!canvas) return;
    const fail = () => {
      if (!isCurrentImage(element, version)) return;
      clearImage();
      showError('图片转换失败，仍可查看二维码');
    };
    try {
      canvas.toBlob(blob => {
        if (!isCurrentImage(element, version)) return;
        if (!blob) return fail();
        imageUrl = URL.createObjectURL(blob);
        const image = new Image();
        imageElement = image;
        image.className = 'qr-image';
        image.alt = '二维码';
        image.width = image.height = renderedSize;
        image.onload = () => {
          if (!isCurrentImage(element, version)) return;
          container.append(image);
          container.classList.remove('image-pending');
          container.classList.add('has-image');
        };
        image.onerror = fail;
        image.src = imageUrl;
      }, 'image/png');
    } catch (error) {
      fail();
    }
  }

  function scheduleImage(element, version) {
    if (!isCurrentImage(element, version)) return;
    clearTimeout(imageTimer);
    imageTimer = setTimeout(() => exportImage(element, version), imageDelay);
  }

  function qrByteLength(text) {
    // The bundled encoder adds a UTF-8 BOM for non-ASCII text.
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      bytes += code > 0x800 ? 3 : code > 0x80 ? 2 : 1;
    }
    const actualLength = bytes + (bytes !== text.length ? 3 : 0);
    const encoded = encodeURI(text).replace(/%[0-9a-fA-F]{2}/g, 'a');
    // Match the bundled library's version selection, including its BOM allowance.
    const estimatedLength = encoded.length + (encoded.length !== Number(text) ? 3 : 0);
    return Math.max(actualLength, estimatedLength);
  }

  function qrVersionForBytes(bytes, level) {
    const index = qrByteCapacity[level].findIndex(capacity => bytes <= capacity);
    if (index === -1) throw new Error('QR content is too long');
    return index + 1;
  }

  function updateStyleLabel() {
    const label = styles[styleIndex].name;
    container.setAttribute('aria-label', `当前样式：${label}，点击切换下一种样式`);
    container.title = `当前样式：${label}，点击切换`;
  }

  function applyStyle(element) {
    const attributes = styles[styleIndex].attributes;
    // Remove optional overrides when leaving a preset so colors/logo don't leak.
    for (const name of ['template', 'level', 'foreground-color', 'background-color', 'inner-color', 'outer-color', 'logo']) {
      if (attributes[name]) element.setAttribute(name, attributes[name]);
      else element.removeAttribute(name);
    }
  }

  function createQRCode(text, size) {
    const element = document.createElement('widget-qrcode');
    element.setAttribute('width', size);
    element.setAttribute('height', size);
    element.setAttribute('value', text);
    applyStyle(element);
    const drawQRCode = element.drawQRCode;
    let drawing = Promise.resolve();
    element.drawQRCode = function (...args) {
      // A replaced widget's ResizeObserver must not invalidate the current image.
      if (element !== qrcode || !element.isConnected) return;
      prepareCanvas(imageDelay);
      const version = imageVersion;
      // The vendored draw method returns its template's completion Promise.
      // Serialize draws so a late Logo load cannot paint over a newer preset.
      drawing = drawing.then(() => {
        if (element !== qrcode || version !== imageVersion || !element.isConnected) return;
        return drawQRCode.apply(element, args);
      }).then(() => scheduleImage(element, version), error => {
        if (!isCurrentImage(element, version)) return;
        clearImage();
        container.replaceChildren();
        qrcode = null;
        renderedText = null;
        showError('生成二维码失败，文本可能过长');
        console.error('JQRCode: 生成失败', error);
      });
      return drawing;
    };
    qrcode = element;
    container.replaceChildren(element);
    // The vendored component draws at 2×; its 24 canvas px margin is 12 CSS px.
    const canvas = element.shadowRoot?.querySelector('canvas');
    if (canvas) canvas.style.borderRadius = '7px';
  }

  function showError(text) {
    let error = document.getElementById('error-message');
    if (!error) {
      error = document.createElement('div');
      error.id = 'error-message';
      error.className = 'error-message';
      wrapper.after(error);
    }
    clearTimeout(errorTimer);
    error.textContent = text;
    error.style.display = 'block';
    errorTimer = setTimeout(() => { error.style.display = 'none'; }, 3000);
  }

  function render(force = false) {
    if (!ready || composing) return;
    try {
      const text = input.value;
      const attributes = styles[styleIndex].attributes;
      const level = attributes.logo ? 'H' : attributes.level;
      const capacities = qrByteCapacity[level];
      const defaults = JQRConfig.defaults.qrCode;
      const config = JQRConfig.get('qrCode');
      const minWidth = Number.isFinite(config.minWidth)
        ? Math.max(100, Math.min(600, config.minWidth)) : defaults.minWidth;
      const maxWidth = Number.isFinite(config.maxWidth)
        ? Math.max(minWidth, Math.min(600, config.maxWidth)) : Math.max(minWidth, defaults.maxWidth);
      const threshold = Number.isFinite(config.urlLengthThreshold) && config.urlLengthThreshold > 0
        ? config.urlLengthThreshold : defaults.urlLengthThreshold;
      const thresholdVersion = qrVersionForBytes(Math.min(
        threshold + 3, capacities[capacities.length - 1]
      ), level);
      const version = qrVersionForBytes(qrByteLength(text), level);
      // A QR version adds four modules per side; grow in those same steps.
      const size = Math.min(maxWidth, minWidth + Math.max(0, version - thresholdVersion) * 16);
      if (!force && size === renderedSize && text === renderedText && level === renderedLevel && styleIndex === renderedStyleIndex) {
        // Editing and reverting to the same text still needs an image timer.
        if (qrcode && !imageElement) qrcode.drawQRCode();
        return;
      }

      if (size !== renderedSize) {
        wrapper.style.width = wrapper.style.height = size + 'px';
        input.style.width = size + 'px';
      }
      if (!text) {
        clearImage();
        container.replaceChildren();
        qrcode = null;
      } else {
        if (!qrcode || size !== renderedSize) {
          createQRCode(text, size);
        } else {
          applyStyle(qrcode);
          qrcode.value = text;
        }
      }
      renderedSize = size;
      renderedText = text;
      renderedLevel = level;
      renderedStyleIndex = styleIndex;
      updateStyleLabel();
      const error = document.getElementById('error-message');
      if (error) error.style.display = 'none';
    } catch (error) {
      clearImage();
      container.replaceChildren();
      qrcode = null;
      renderedText = null;
      showError('生成二维码失败，文本可能过长');
      console.error('JQRCode: 生成失败', error);
    }
  }

  function scheduleRender() {
    clearTimeout(debounce);
    prepareCanvas(1000);
    if (ready && !composing) debounce = setTimeout(render, 120);
  }

  function cycleStyle() {
    if (!qrcode) return;
    clearTimeout(debounce);
    prepareCanvas(composing ? 1000 : 0);
    styleIndex = (styleIndex + 1) % styles.length;
    saveStyle();
    updateStyleLabel();
    // A style click must not leave a pending text edit unrendered.
    render(true);
  }

  container.addEventListener('click', cycleStyle);
  container.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    cycleStyle();
  });

  input.addEventListener('compositionstart', () => {
    composing = true;
    clearTimeout(debounce);
    prepareCanvas(1000);
  });
  input.addEventListener('compositionend', () => {
    composing = false;
    edited = true;
    scheduleRender();
  });
  input.addEventListener('input', event => {
    edited = true;
    if (event.isComposing) prepareCanvas(1000);
    else scheduleRender();
  });

  document.addEventListener('DOMContentLoaded', async () => {
    // Read alongside config/tab data, but always restore before the first draw.
    const styleReady = restoreStyle();
    let tabs;
    try {
      [, tabs] = await Promise.all([
        JQRConfig.load(),
        chrome.tabs.query({ active: true, currentWindow: true })
      ]);
    } catch (error) {
      // Generation remains usable with defaults if storage/tab access fails.
      showError('读取配置或当前页面失败，请输入文本生成二维码');
      console.error('JQRCode: 弹窗初始化失败', error);
    }
    await styleReady;
    if (!edited && tabs?.[0]?.url) {
      const { from, to } = JQRConfig.get('localhost');
      const url = tabs[0].url;
      input.value = from && typeof from === 'string' && typeof to === 'string' && url.startsWith(from)
        ? to + url.slice(from.length) : url;
    }
    ready = true;
    render();
  });
})();
