(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const requestedLanguage = params.get('lang');
  const language = ['he', 'en-US', 'en-GB'].includes(requestedLanguage) ? requestedLanguage : 'he';
  const english = language !== 'he';
  const home = new URL('/', location.origin);
  home.searchParams.set('lang', language);
  home.hash = 'home';
  const launchPage = new URL('/install/safari', location.origin);
  launchPage.searchParams.set('lang', language);
  // Keep the site origin and path intact; only change the URL scheme.
  const safariURL = 'x-safari-https://' + launchPage.host + launchPage.pathname + launchPage.search;
  const ua = navigator.userAgent || '';
  const iphone = /iPhone/i.test(ua) && !/iPad|iPod/i.test(ua);
  const ios = iphone || /iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|DuckDuckGo|FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua);
  const safariLike = ios && !otherBrowser && /Version\/[\d.]+.*Safari\//i.test(ua);
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const byId = id => document.getElementById(id);
  byId('browse').href = home.href;
  byId('browse').hidden = ios;
  byId('openSafari').href = safariURL;
  byId('fallbackSafari').href = safariURL;
  if (english) {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
    document.title = 'Keha Family Home';
    document.querySelector('meta[name="apple-mobile-web-app-title"]').content = 'Keha Family';
    document.querySelector('.logo').alt = 'Keha Family';
    byId('heading').textContent = 'Your family, on your Home Screen';
    byId('intro').textContent = 'Open in Safari, then add once:';
    byId('openSafari').textContent = 'Open in Safari';
    byId('stepShareLead').textContent = 'Tap ';
    byId('stepShare').textContent = 'Share';
    byId('stepHomeLead').textContent = 'Then scroll down and tap ';
    byId('stepHome').textContent = 'Add to Home Screen';
    byId('steps').setAttribute('aria-label', 'Add to Home Screen');
    byId('menuHint').textContent = 'If Share is hidden, open Safari’s page menu to find it.';
    byId('fallbackText').textContent = 'Opened inside another app?';
    byId('fallbackSafari').textContent = 'Open in Safari';
    byId('browse').textContent = 'Visit the website';
  }
  if (iphone) {
    byId('stepShareLead').textContent = english ? 'Tap the ' : 'לחצו על ';
    byId('stepShare').textContent = english ? 'Share button' : 'כפתור השיתוף';
    byId('stepSharePosition').textContent = english ? ' at the bottom of the screen' : ' בתחתית המסך';
    byId('stepSharePosition').hidden = false;
  }
  if (standalone) {
    location.replace(home.href);
    return;
  }
  if (safariLike) {
    // In-app Safari views can share Safari’s user agent, so retain a manual escape link.
    byId('openSafari').hidden = true;
    byId('safariFallback').hidden = false;
    byId('intro').textContent = english ? 'Add once, then open with one tap:' : 'מוסיפים פעם אחת, ואז נכנסים בנגיעה:';
  } else if (!ios) {
    byId('openSafari').hidden = true;
    byId('steps').hidden = true;
    byId('menuHint').hidden = true;
    byId('intro').textContent = english ? 'Open this link on an iPhone to add the website to its Home Screen.' : 'פתחו את הקישור הזה באייפון כדי להוסיף את האתר למסך הבית.';
  }
})();
