import {BRANCHES, branchForPerson, createFamily, findPeople} from './family-data.mjs';
import {renderTree, renderDirectory, renderProfile} from './tree-view.mjs';

const $ = id => document.getElementById(id);
const pathFor = branch => '/nakash/' + (branch ? branch + '/' : '');
const branchById = id => BRANCHES.find(branch => branch.id === id);
const requestedBranch = location.pathname.split('/')[2];
const branch = branchById(requestedBranch);
const siteTitle = branch?.label || 'משפחת נקאש';
const sitePath = pathFor(branch?.id);
const publicPage = new URL(sitePath, location.origin);
const cameFromKeha = (() => {
  if (requestedBranch !== 'inside' || !document.referrer) return false;
  const referrer = new URL(document.referrer);
  return referrer.origin === location.origin && ['/', '/index.html'].includes(referrer.pathname);
})();
const ownPath = cameFromKeha ? pathFor('inside') : sitePath;
const linkPerson = id => ownPath + '#person/' + encodeURIComponent(id);
const linkTree = id => ownPath + '#tree' + (id ? '/' + id : '');
const views = new Set(['tree', 'people', 'person', 'photos', 'videos']);

let family = createFamily();
let currentRequest;
let uploadContext;
const taggedPeople = new Set();
let mediaItems = [];
let mediaIndex = 0;
let installPrompt;
let mediaPage = 1;

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}
function link(href, label, className) {
  const node = element('a', className, label);
  node.href = href;
  return node;
}
function message(label) {
  return element('p', 'nk-empty', label);
}
function readRoute() {
  const hash = location.hash.slice(1);
  const [view, ...rest] = hash.split('/');
  if (!views.has(view)) return {view: 'tree', item: null};
  try {
    return {view, item: rest.length ? decodeURIComponent(rest.join('/')) : null};
  } catch {
    return {view, item: null};
  }
}
function buildHeader() {
  document.title = siteTitle;
  document.querySelector('meta[name=description]').content = 'אילן היוחסין, התמונות והסרטונים של ' + siteTitle;
  const mark = '/nakash/brand-' + (branch?.id || 'nakash') + '.svg';
  $('brand-mark').src = mark;
  document.querySelector('link[rel=icon]').href = mark;
  $('brand-name').textContent = siteTitle;
  $('brand').href = ownPath;
  if (cameFromKeha) {
    const backLink = link('/#tree', 'חזרה לבית משפחת קהא', 'nk-tool');
    backLink.id = 'back-keha';
    $('install').after(backLink);
    const manageCodes = element('button', 'nk-tool', 'קודי העלאה');
    manageCodes.type = 'button';
    manageCodes.addEventListener('click', openAdmin);
    backLink.after(manageCodes);
  }
  if (branch) document.documentElement.style.setProperty('--nk-accent', branch.color);
  const touchIcon = element('link');
  touchIcon.rel = 'apple-touch-icon';
  touchIcon.href = mark.replace('.svg', '-192.png');
  document.head.append(touchIcon);
  const manifest = element('link');
  manifest.rel = 'manifest';
  manifest.href = sitePath + 'manifest.webmanifest';
  document.head.append(manifest);
  for (const navLink of $('main-nav').querySelectorAll('a')) {
    navLink.href = ownPath + '#' + navLink.dataset.view;
  }
  $('family-links').append(link(pathFor(), 'משפחת נקאש'), ...BRANCHES.map(item => link(pathFor(item.id), item.label)));
}
buildHeader();

async function getJSON(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Error(typeof result.error === 'string' ? result.error : 'הפעולה לא הושלמה. נסו שוב.');
    error.status = response.status;
    throw error;
  }
  return result;
}
async function loadFamily() {
  try {
    const data = await getJSON('/nakash/api/family');
    family = createFamily(data.keha || data);
    const route = readRoute();
    if (!['photos', 'videos'].includes(route.view)) render();
    if ($('search-input').value.trim()) updateSearch();
  } catch {
    const note = $('load-note');
    note.textContent = 'פרטי הענף המלא של קהא לא נטענו. אפשר לנסות שוב ברענון העמוד.';
    note.hidden = false;
  }
}

function closeSearch() {
  $('search-results').hidden = true;
}
function updateSearch() {
  const query = $('search-input').value.trim();
  if (!query) {
    closeSearch();
    return;
  }
  const matches = findPeople(family, query, branch?.id).slice(0, 10);
  const menu = $('search-results');
  menu.replaceChildren();
  for (const person of matches) {
    const item = element('li');
    item.append(link(linkPerson(person.id), person.name));
    menu.append(item);
  }
  if (!matches.length) menu.append(element('li', 'nk-no-results', 'לא נמצאו בני משפחה'));
  menu.hidden = false;
}
$('search-input').addEventListener('input', updateSearch);
$('search-input').addEventListener('focus', updateSearch);
$('search').addEventListener('submit', event => {
  event.preventDefault();
  const result = $('search-results').querySelector('a');
  if (result) location.hash = result.hash;
  closeSearch();
});
$('search').addEventListener('keydown', event => {
  if (event.key === 'Escape') closeSearch();
});
document.addEventListener('click', event => {
  if (!$('search').contains(event.target)) closeSearch();
});

function render() {
  currentRequest?.abort();
  if ($('media-dialog').open) $('media-dialog').close();
  const {view, item} = readRoute();
  for (const navLink of $('main-nav').querySelectorAll('a')) {
    if (navLink.dataset.view === (view === 'person' ? 'people' : view)) navLink.setAttribute('aria-current', 'page');
    else navLink.removeAttribute('aria-current');
  }
  const viewHost = $('view');
  const options = {family, linkPerson, linkTree};
  if (view === 'tree') renderTree(viewHost, {...options, branch: branchById(item)?.id});
  else if (view === 'people') renderDirectory(viewHost, options);
  else if (view === 'person') {
    if (!renderProfile(viewHost, {...options, id: item})) viewHost.replaceChildren(message('בן המשפחה המבוקש אינו מופיע באילן.'));
  } else {
    renderMedia(viewHost, view === 'photos' ? 'photo' : 'video', branch || (cameFromKeha ? branchById(item) : null));
  }
}
window.addEventListener('hashchange', () => {
  closeSearch();
  mediaPage = 1;
  render();
});

function mediaNav(kind, mediaBranch) {
  const nav = element('nav', 'nk-media-branches');
  nav.setAttribute('aria-label', 'גלריות הענפים');
  for (const item of BRANCHES) {
    const route = kind === 'photo' ? '#photos' : '#videos';
    const href = cameFromKeha ? ownPath + route + '/' + item.id : pathFor(item.id) + route;
    const tab = link(href, item.label);
    if (item.id === mediaBranch?.id) tab.setAttribute('aria-current', 'page');
    nav.append(tab);
  }
  return nav;
}

function renderMedia(host, kind, mediaBranch) {
  const prefix = kind === 'photo' ? 'גלריית תמונות' : 'סרטונים';
  const head = element('div', 'nk-section-head');
  const title = mediaBranch ? prefix + ' · ' + mediaBranch.label : prefix;
  head.append(element('h1', 'nk-view-title', title));
  const selection = mediaNav(kind, mediaBranch);
  host.replaceChildren(head, selection);
  if (!mediaBranch) {
    host.append(message('בחרו ענף כדי לפתוח את הגלריה שלו.'));
    return;
  }
  const upload = element('button', 'nk-primary', kind === 'photo' ? 'העלאת תמונה' : 'העלאת סרטון');
  upload.type = 'button';
  upload.addEventListener('click', () => openUpload(kind, mediaBranch));
  head.append(upload);
  const media = element('div');
  media.setAttribute('aria-busy', 'true');
  media.append(message('טוען את הגלריה…'));
  host.append(media);
  const request = new AbortController();
  currentRequest = request;
  loadMedia(media, kind, mediaBranch, request);
}

async function loadMedia(host, kind, mediaBranch, request) {
  try {
    const data = await getJSON('/nakash/api/media?' + new URLSearchParams({branch: mediaBranch.id, kind, page: mediaPage}), {signal: request.signal});
    if (request.signal.aborted) return;
    mediaItems = (data.items || []).filter(item => safeMediaSource(item.src));
    host.replaceChildren();
    if (!mediaItems.length) {
      host.append(message(kind === 'photo' ? 'עדיין אין תמונות בגלריה הזו.' : 'עדיין אין סרטונים בגלריה הזו.'));
      return;
    }
    const grid = element('div', 'nk-media-grid');
    for (const [index, item] of mediaItems.entries()) {
      const card = element('button', 'nk-media-card');
      card.type = 'button';
      const preview = element(item.kind === 'video' ? 'video' : 'img');
      preview.src = safeMediaSource(item.src);
      if (preview.tagName === 'IMG') {
        preview.loading = 'lazy';
        preview.alt = '';
      } else {
        preview.preload = 'none';
        preview.muted = true;
        preview.playsInline = true;
      }
      const label = item.caption || (item.kind === 'video' ? 'סרטון משפחתי' : 'תמונה משפחתית');
      card.append(preview, element('span', '', label));
      card.addEventListener('click', () => openMedia(index));
      grid.append(card);
    }
    host.append(grid);
    if (mediaPage > 1 || data.hasMore) {
      const controls = element('div', 'nk-media-controls');
      for (const [text, direction, disabled] of [['לעמוד הקודם', -1, mediaPage <= 1], ['לעמוד הבא', 1, !data.hasMore]]) {
        const button = element('button', 'nk-tool', text);
        button.type = 'button';
        button.disabled = disabled;
        button.addEventListener('click', () => {
          mediaPage += direction;
          render();
        });
        controls.append(button);
      }
      host.append(controls);
    }
  } catch (error) {
    if (!request.signal.aborted) host.replaceChildren(message(error.message));
  } finally {
    if (!request.signal.aborted) host.removeAttribute('aria-busy');
  }
}
function safeMediaSource(src) {
  if (typeof src !== 'string') return '';
  try {
    const url = new URL(src, location.origin);
    return url.origin === location.origin && url.pathname.startsWith('/nakash/api/') ? url.href : '';
  } catch {
    return '';
  }
}
function openMedia(index) {
  if (!mediaItems.length) return;
  mediaIndex = (index + mediaItems.length) % mediaItems.length;
  const item = mediaItems[mediaIndex];
  const video = item.kind === 'video';
  const content = element(video ? 'video' : 'img');
  if (video) {
    content.controls = true;
    content.playsInline = true;
  } else content.alt = item.caption || 'תמונה משפחתית';
  content.src = safeMediaSource(item.src);
  const display = $('media-display');
  display.replaceChildren(content);
  const people = (item.people || []).map(id => family.people[id]).filter(Boolean);
  if (people.length) {
    const names = element('ul', 'nk-tag-list');
    names.setAttribute('aria-label', 'בני המשפחה המתויגים');
    for (const person of people) {
      const li = element('li');
      const profile = link(linkPerson(person.id), person.name, 'nk-tool');
      profile.addEventListener('click', () => $('media-dialog').close());
      li.append(profile);
      names.append(li);
    }
    display.append(names);
  }
  $('media-title').textContent = item.caption || (video ? 'סרטון משפחתי' : 'תמונה משפחתית');
  $('media-counter').textContent = (mediaIndex + 1) + ' / ' + mediaItems.length;
  $('media-previous').disabled = $('media-next').disabled = mediaItems.length < 2;
  if (!$('media-dialog').open) $('media-dialog').showModal();
}
$('media-previous').addEventListener('click', () => openMedia(mediaIndex - 1));
$('media-next').addEventListener('click', () => openMedia(mediaIndex + 1));
$('media-dialog').addEventListener('close', () => $('media-display').replaceChildren());

function openUpload(kind, mediaBranch) {
  uploadContext = {kind, branch: mediaBranch};
  $('upload-form').reset();
  taggedPeople.clear();
  $('upload-tagged').replaceChildren();
  $('upload-people').replaceChildren(...findPeople(family).map(person => {
    const option = element('option');
    option.value = person.name;
    return option;
  }));
  $('upload-status').textContent = '';
  $('upload-title').textContent = (kind === 'photo' ? 'העלאת תמונה' : 'העלאת סרטון') + ' · ' + mediaBranch.label;
  $('upload-file').accept = kind === 'photo' ? 'image/jpeg,image/png,image/webp,image/avif,image/gif' : 'video/mp4,video/webm,video/quicktime';
  const fields = $('upload-branches');
  while (fields.children.length > 1) fields.lastElementChild.remove();
  for (const item of BRANCHES) {
    const label = element('label');
    const check = element('input');
    check.name = 'sharedBranch';
    check.type = 'checkbox';
    check.value = item.id;
    label.append(check, ' ' + item.label);
    fields.append(label);
  }
  $('upload-dialog').showModal();
}
$('upload-add-person').addEventListener('click', () => {
  const input = $('upload-person');
  const name = input.value.trim();
  const matches = findPeople(family, name).filter(person => person.name === name);
  if (matches.length !== 1 || taggedPeople.size >= 40) {
    $('upload-status').textContent = taggedPeople.size >= 40 ? 'ניתן לתייג עד 40 בני משפחה.' : 'בחרו שם מדויק מרשימת בני המשפחה.';
    return;
  }
  const [person] = matches;
  if (taggedPeople.has(person.id)) return;
  taggedPeople.add(person.id);
  const item = element('li');
  const remove = element('button', 'nk-tool', person.name + ' ×');
  remove.type = 'button';
  remove.setAttribute('aria-label', 'הסרת התיוג של ' + person.name);
  remove.addEventListener('click', () => {
    taggedPeople.delete(person.id);
    item.remove();
  });
  item.append(remove);
  $('upload-tagged').append(item);
  input.value = '';
  const mediaBranch = branchById(branchForPerson(family, person.id));
  $('upload-status').textContent = mediaBranch && mediaBranch.id !== uploadContext.branch.id
    ? 'התיוג משייך את הקובץ לגלריה של ' + mediaBranch.label : '';
});
$('upload-person').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    $('upload-add-person').click();
  }
});
$('upload-close').addEventListener('click', () => {
  if (!$('upload-submit').disabled) $('upload-dialog').close();
});
$('upload-dialog').addEventListener('cancel', event => {
  if ($('upload-submit').disabled) event.preventDefault();
});
$('upload-dialog').addEventListener('close', () => { $('upload-code').value = ''; });
$('upload-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = $('upload-form');
  const data = new FormData(form);
  const upload = new URLSearchParams({kind: uploadContext.kind, branch: uploadContext.branch.id});
  const metadata = encodeURIComponent(JSON.stringify({
    caption: data.get('caption'),
    sharedBranches: data.getAll('sharedBranch'),
    people: [...taggedPeople],
  }));
  const uploadCode = $('upload-code').value.trim();
  $('upload-code').value = '';
  $('upload-submit').disabled = true;
  $('upload-status').textContent = 'הקובץ עולה…';
  try {
    await getJSON('/nakash/api/media?' + upload, {
      method: 'POST',
      body: $('upload-file').files[0],
      headers: {'X-Nakash-Upload-Code': uploadCode, 'X-Nakash-Metadata': metadata},
    });
    $('upload-dialog').close();
    mediaPage = 1;
    render();
  } catch (error) {
    $('upload-status').textContent = error.message;
  } finally {
    $('upload-submit').disabled = false;
  }
});

const codeEndpoint = '/nakash/api/admin/upload-codes';
function resetAdminOutput() {
  $('admin-result').hidden = true;
  $('admin-code').value = '';
  $('admin-status').textContent = '';
}
function postJSON(url, value) {
  return getJSON(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(value),
  });
}
async function loadAdmin() {
  $('admin-login').hidden = true;
  $('admin-codes').hidden = true;
  try {
    await getJSON(codeEndpoint);
    $('admin-codes').hidden = false;
  } catch (error) {
    if (error.status === 401 || error.status === 403) $('admin-login').hidden = false;
    else $('admin-status').textContent = error.message;
  }
}
function openAdmin() {
  resetAdminOutput();
  const select = $('admin-branch');
  select.replaceChildren(...BRANCHES.map(item => {
    const option = element('option', '', item.label);
    option.value = item.id;
    return option;
  }));
  loadAdmin();
  $('admin-dialog').showModal();
}
$('admin-dialog').addEventListener('close', resetAdminOutput);
$('admin-login').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button');
  submit.disabled = true;
  resetAdminOutput();
  const password = $('admin-password').value;
  $('admin-password').value = '';
  try {
    await postJSON('/nakash/api/admin/login', {password});
    await loadAdmin();
  } catch (error) {
    $('admin-status').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
$('admin-codes').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button');
  submit.disabled = true;
  resetAdminOutput();
  try {
    const result = await postJSON(codeEndpoint, {branch: $('admin-branch').value});
    if (!$('admin-dialog').open) return;
    $('admin-code').value = result.code;
    $('admin-result').hidden = false;
  } catch (error) {
    if (error.status === 401 || error.status === 403) await loadAdmin();
    $('admin-status').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
$('admin-copy').addEventListener('click', async () => {
  const field = $('admin-code');
  try {
    await navigator.clipboard.writeText(field.value);
    $('admin-status').textContent = 'הקוד הועתק';
  } catch {
    field.select();
  }
});

$('share').addEventListener('click', async () => {
  const {view, item} = readRoute();
  const gallery = ['photos', 'videos'].includes(view) && branchById(item);
  const url = gallery && cameFromKeha ? new URL(pathFor(item), location.origin) : new URL(publicPage);
  if (location.hash !== '#content') url.hash = gallery && cameFromKeha ? '#' + view : location.hash;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({title: siteTitle, url: url.href});
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  $('share-url').value = url.href;
  $('share-status').textContent = '';
  $('share-dialog').showModal();
});
$('copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('share-url').value);
    $('share-status').textContent = 'הקישור הועתק';
  } catch {
    $('share-url').select();
  }
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});
$('install').addEventListener('click', async () => {
  if (cameFromKeha) {
    location.assign(publicPage);
    return;
  }
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt().catch(() => $('install-dialog').showModal());
  } else $('install-dialog').showModal();
});
if (!cameFromKeha && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/nakash/sw.js', {scope: sitePath}).catch(() => {});
}
render();
loadFamily();
