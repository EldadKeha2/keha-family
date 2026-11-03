(() => {
  'use strict';
  // No public route, query parameter or navigation control can activate this screen.
  let active = false, recoveryTimer = null;
  const unavailable = status => status === 429 || status === 1027;
  const apiPath = input => {
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      return url.origin === location.origin && (url.pathname.startsWith('/api/') || url.pathname === '/family-data.js');
    } catch { return false; }
  };
  function mount() {
    let screen = document.getElementById('familyMaintenanceScreen');
    if (screen) return screen;
    screen = document.createElement('div');
    screen.id = 'familyMaintenanceScreen';
    screen.className = 'family-maintenance';
    screen.setAttribute('role','alert');
    screen.setAttribute('aria-live','assertive');
    screen.setAttribute('data-i18n-skip','');
    screen.innerHTML = `
      <div class="family-maintenance-card">
        <div class="family-maintenance-ornament" aria-hidden="true">✦ ◆ ✦ ◆ ✦ ◆ ✦</div>
        <div class="family-maintenance-brand">בית משפחת קהא <span>·</span> KEHA FAMILY</div>
        <div class="family-maintenance-columns">
          <section dir="rtl" lang="he"><h1>האתר תחת שיפוצים כעת</h1><p>אנחנו מתנצלים על אי הנוחות</p><small>סבתא יונה עובדת על זה באהבה. נשוב בקרוב!</small></section>
          <section dir="ltr" lang="en"><h1>The website is currently under maintenance</h1><p>We apologize for the inconvenience</p><small>GRANDMA is working on it with love. We'll be back soon!</small></section>
        </div>
        <svg class="family-maintenance-art" viewBox="0 0 820 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="סבתא יונה בונה קיר לבנים ליד תמרור עבודות תימני">
          <defs><pattern id="kehaBrick" width="112" height="42" patternUnits="userSpaceOnUse"><rect width="110" height="40" x="1" y="1" rx="5" fill="#bb6540" stroke="#7e372d" stroke-width="2"/><path d="M12 9h38M65 28h30" stroke="#e7a17d" stroke-width="3" opacity=".65"/></pattern></defs>
          <path d="M0 323q140-15 260 0t290-2t270 2v38H0Z" fill="#e7d1ab"/>
          <g transform="translate(46 90)"><path d="M110 0 220 205H0Z" fill="#f8b723" stroke="#872d27" stroke-width="13" stroke-linejoin="round"/><path d="M110 29 192 183H28Z" fill="#ffd86e" stroke="#fff1bd" stroke-width="3"/><g transform="translate(54 75)" fill="#262329"><circle cx="63" cy="9" r="15"/><path d="m48 6 17-22 26 2-2 13H51Z" fill="#812a33"/><path d="M53 24h25l19 35-15 12-22-21-5 41H37l2-42-29 30-12-13 43-42Z"/><path d="m50 88-24 51h20l28-43 25 47h20L82 81Z"/></g><rect x="18" y="201" width="10" height="38" rx="3" fill="#6c442a"/><rect x="190" y="201" width="10" height="38" rx="3" fill="#6c442a"/></g>
          <g transform="translate(310 19)">
            <ellipse cx="225" cy="298" rx="227" ry="17" fill="#c6ae8c" opacity=".75"/>
            <g class="grandma-hammer" transform="translate(145 92)"><path d="M0 4 87 77" stroke="#7e462a" stroke-width="14" stroke-linecap="round"/><path d="m-25-18 44 7-5 30-48-6Z" fill="#676364" stroke="#363436" stroke-width="3"/></g>
            <path d="M115 195q-25-97 55-115l57-4q73 14 89 121Z" fill="#29252c" stroke="#923b32" stroke-width="12"/>
            <path d="M147 116q55 19 106 0l26 77H126Z" fill="#962f32"/><path d="M150 137h118" stroke="#f7b949" stroke-width="7" stroke-dasharray="7 8"/>
            <ellipse cx="201" cy="89" rx="63" ry="68" fill="#e9b78b" stroke="#b57861" stroke-width="4"/>
            <path d="M141 69q-8-72 57-76 68-2 67 72-55-26-124 4Z" fill="#f4ecdc" stroke="#aa9a87" stroke-width="4"/>
            <path d="M127 48q-8-78 71-78 79 0 85 83-78-49-156-5Z" fill="#28252c" stroke="#e5a43e" stroke-width="9"/><path d="M130 21q72-40 147 10" fill="none" stroke="#9c3735" stroke-width="11"/>
            <circle cx="171" cy="91" r="23" fill="none" stroke="#60483b" stroke-width="4"/><circle cx="229" cy="91" r="23" fill="none" stroke="#60483b" stroke-width="4"/><path d="M194 92h12" stroke="#60483b" stroke-width="4"/><path d="M160 89q11 12 22 0m36 0q11 12 22 0" stroke="#5a3c33" stroke-width="3" fill="none"/><path d="M184 122q19 22 41 0" stroke="#963d37" stroke-width="4" stroke-linecap="round" fill="none"/>
            <path d="M116 174 66 236l35 20 55-56M287 174l44 62-34 18-54-54" fill="#e9b78b" stroke="#b57861" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
            <g class="grandma-brick" transform="translate(65 214)"><rect width="78" height="38" rx="5" fill="#bb6540" stroke="#85372e" stroke-width="4"/><path d="M12 11h44" stroke="#df9874" stroke-width="4"/></g>
            <path d="M44 244h398v66H44Z" fill="url(#kehaBrick)" stroke="#883d2e" stroke-width="4"/>
            <path d="M53 242h372" stroke="#e8ddc8" stroke-width="8" stroke-linecap="round"/>
          </g>
          <g class="family-maintenance-sparkles" fill="#d49528"><path d="m751 83 7 20 20 7-20 7-7 20-7-20-20-7 20-7Z"/><path d="m685 25 4 12 12 4-12 4-4 12-4-12-12-4 12-4Z"/></g>
        </svg>
        <div class="family-maintenance-ornament bottom" aria-hidden="true">✦ ◆ ✦ ◆ ✦ ◆ ✦</div>
      </div>`;
    document.body.append(screen);
    return screen;
  }
  function activate() {
    if (active) return;
    active = true;
    const screen = mount(); screen.style.display = 'grid';
    document.documentElement.classList.add('family-maintenance-active');
    if (!recoveryTimer) recoveryTimer = setInterval(checkRecovery, 120000);
  }
  async function checkRecovery() {
    if (!active || document.visibilityState === 'hidden') return;
    try {
      const response = await nativeFetch('/api/health', {cache:'no-store'});
      if (response.ok) location.reload();
    } catch {}
  }
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    if (apiPath(args[0]) && (unavailable(response.status) || response.headers.get('X-Family-Storage-Limit') === 'daily')) activate();
    return response;
  };
  // A failed dynamic bootstrap is also a reliable signal that the application cannot start.
  window.addEventListener('error', event => {
    const src = event.target?.src || '';
    if (event.target?.tagName === 'SCRIPT' && /\/family-data\.js(?:[?#]|$)/.test(src)) activate();
  }, true);
  // Some edge failures return an HTML error page with HTTP 200 to script requests.
  window.addEventListener('error', event => {
    if (/FAMILY_DATA|FAMILY_API_TOKEN|family-data\.js/.test(String(event.message || ''))) activate();
  });
  window.FamilyMaintenance = {isActive: () => active};
})();
