(() => {
  'use strict';

  const menu = document.querySelector('.article-share');
  const address = menu.querySelector('.share-address');
  const status = menu.querySelector('[role="status"]');
  const native = menu.querySelector('[data-share-native]');
  const link = address.value;
  const title = document.querySelector('meta[property="og:title"]').content;

  address.hidden = true;
  native.hidden = typeof navigator.share !== 'function';

  function showAddress(message) {
    status.textContent = message;
    address.hidden = false;
    address.focus();
    address.select();
  }

  async function copy(message) {
    try {
      await navigator.clipboard.writeText(link);
      status.textContent = message;
      address.hidden = true;
    } catch {
      showAddress('אפשר להעתיק את הקישור מהשדה ולהדביק אותו בהודעה.');
    }
  }

  menu.querySelector('[data-share-copy]').addEventListener('click', () => copy('הקישור לעמוד הועתק.'));
  for (const channel of ['messenger', 'instagram']) {
    const inbox = menu.querySelector('[data-channel="' + channel + '"]');
    inbox.addEventListener('click', () => {
      // Keep the inbox link's native activation, including on mobile browsers.
      void copy('הקישור הועתק. אפשר להדביק אותו בשיחה ב־' + inbox.textContent.trim() + '.');
    });
  }

  native.addEventListener('click', async () => {
    try {
      await navigator.share({title, url: link});
    } catch (error) {
      if (error.name !== 'AbortError') showAddress('אפשר להעתיק את הקישור או לבחור באחת מאפשרויות השיתוף.');
    }
  });

  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
})();
