(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const film = document.body.dataset.film;
  const translations = [...document.querySelectorAll('[data-en]')].map(
    (node) => ({ node, he: node.textContent, en: node.dataset.en }),
  );
  let ui = 'he';
  function translate(language) {
    ui = language;
    document.documentElement.lang = ui;
    document.documentElement.dir = ui === 'he' ? 'rtl' : 'ltr';
    translations.forEach((item) => {
      item.node.textContent = item[ui];
    });
    document.title = `${$('h1').textContent} · ${ui === 'he' ? 'ארכיון משפחת קהא' : 'Keha Family Archive'}`;
    for (const a of document.querySelectorAll('[data-page]')) {
      const url = new URL(a.href);
      url.search = ui === 'en' ? '?lang=en' : '';
      a.href = url;
    }
    $('[data-root]').href =
      (ui === 'en' ? '/?lang=en-US' : '/') + '#stories/roots';
    for (const b of document.querySelectorAll('[data-ui]'))
      b.setAttribute('aria-pressed', String(b.dataset.ui === ui));
  }
  let preferred = params.get('lang');
  if (!preferred) {
    try {
      preferred = localStorage.getItem('keha-family-language');
    } catch {}
  }
  translate(preferred?.startsWith('en') ? 'en' : 'he');
  if (!film) {
    for (const b of document.querySelectorAll('[data-ui]'))
      b.addEventListener('click', () => translate(b.dataset.ui));
    return;
  }
  const video = $('#player'),
    caption = $('#caption'),
    stage = $('#stage');
  const tracks = Array.from(video.querySelectorAll('track'));
  let lang = ui,
    cues = [],
    iosFull = false;
  const nativeFull = () =>
    iosFull ||
    document.fullscreenElement === video ||
    document.webkitFullscreenElement === video;
  function showCaption() {
    caption.hidden = lang === 'off' || nativeFull();
    if (caption.hidden) return;
    const time = video.currentTime;
    const cue = cues.find((c) => c[0] <= time && time < c[1]);
    const line = cue ? cue[lang === 'he' ? 2 : 3] : '';
    if (caption.textContent !== line) caption.textContent = line;
    caption.lang = lang;
    caption.dir = lang === 'he' ? 'rtl' : 'ltr';
  }
  function modes() {
    const chosen = tracks.find((t) => t.srclang === lang)?.track;
    for (const track of Array.from(video.textTracks)) {
      if (!['captions', 'subtitles'].includes(track.kind)) continue;
      // In native iOS fullscreen, or when the caption shelf cannot load, show WebVTT on the picture.
      const mode =
        track === chosen && (nativeFull() || !cues.length)
          ? 'showing'
          : 'disabled';
      if (track.mode !== mode) track.mode = mode;
    }
    showCaption();
    $('#full').textContent =
      document.fullscreenElement || document.webkitFullscreenElement
        ? ui === 'he'
          ? 'יציאה ממסך מלא'
          : 'Exit full screen'
        : ui === 'he'
          ? 'מסך מלא'
          : 'Full screen';
  }
  function subtitles(code) {
    lang = code;
    if (code !== 'off') translate(code);
    for (const b of document.querySelectorAll('[data-lang]'))
      b.setAttribute('aria-pressed', String(b.dataset.lang === code));
    modes();
  }
  for (const b of document.querySelectorAll('[data-lang]'))
    b.addEventListener('click', () => subtitles(b.dataset.lang));
  for (const event of [
    'timeupdate',
    'seeking',
    'seeked',
    'ended',
    'loadeddata',
  ])
    video.addEventListener(event, showCaption);
  video.addEventListener('loadedmetadata', modes);
  video.textTracks.addEventListener('addtrack', modes);
  video.addEventListener('webkitbeginfullscreen', () => {
    iosFull = true;
    modes();
  });
  video.addEventListener('webkitendfullscreen', () => {
    iosFull = false;
    modes();
  });
  for (const event of ['fullscreenchange', 'webkitfullscreenchange'])
    document.addEventListener(event, modes);
  $('#full').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.webkitFullscreenElement)
        document.webkitExitFullscreen();
      else if (stage.requestFullscreen) await stage.requestFullscreen();
      else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
      else video.webkitEnterFullscreen?.();
    } catch {
      video.webkitEnterFullscreen?.();
    }
  });
  video.addEventListener('error', () => {
    $('#playError').hidden = false;
  });
  video.addEventListener('loadeddata', () => {
    $('#playError').hidden = true;
  });
  $('#retry').addEventListener('click', () => video.load());
  subtitles(lang);
  fetch(`/aliyah/${film}-cues.json`)
    .then((response) => {
      if (!response.ok) throw Error();
      return response.json();
    })
    .then((rows) => {
      cues = rows;
      modes();
    })
    .catch(modes);

  // Only the exact approved export can be provisioned. Normal playback never loads the editing form.
  if (params.get('edition') !== 'upload') return;
  const form = $('#editionUpload'),
    status = $('#uploadStatus');
  const family = document.createElement('script');
  family.src = '/assets/family-fallback.js?v=yona-nakash-keha-v3';
  family.addEventListener('load', () => {
    form.hidden = false;
  });
  document.head.append(family);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#editionFile'),
      button = form.querySelector('button'),
      file = input.files[0];
    if (!file || button.disabled) return;
    button.disabled = true;
    input.disabled = true;
    status.textContent = ui === 'he' ? 'שומר את עותק הסרט…' : 'Saving film…';
    try {
      const response = await fetch(video.getAttribute('src'), {
        method: 'POST',
        headers: {
          'X-Family-Token': window.FAMILY_API_TOKEN,
          'Content-Type': 'video/mp4',
        },
        body: file,
      });
      const data = await response.json();
      if (!response.ok || !data.ready)
        throw Error(data.error || `HTTP ${response.status}`);
      status.textContent =
        ui === 'he'
          ? 'הסרט נשמר ומוכן להקרנה.'
          : 'The film is saved and ready to play.';
      video.load();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
      input.disabled = false;
    }
  });
})();
