/** Utilities used in the extension's isolated world. */
(() => {
  if (globalThis.JQRUtils) return;

  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall back for pages without clipboard access.
    }
    const focused = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(textarea);
    try {
      textarea.select();
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      textarea.remove();
      focused?.focus({ preventScroll: true });
    }
  }

  globalThis.JQRUtils = {
    copyText,
    isUrl: text => /^https?:\/\/.+/i.test(text)
  };
})();
