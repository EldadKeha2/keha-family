import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {nakashHTML, nakashShell} from '../src/nakash-shell.mjs';
import {nakashProjection} from '../src/nakash.mjs';
import family from '../src/family.mjs';
import {familyAppOrigins} from '../src/family-app-origins.mjs';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../public/assets/app.js', import.meta.url), 'utf8');
const origin = 'https://family.example';
const projection = () => nakashProjection(family, new Map());

test('only deployed, valid family origins are supplied to installation and branch navigation',async()=>{
  assert.deepEqual(familyAppOrigins({FAMILY_APP_ORIGINS:{}}),{});
  assert.deepEqual(familyAppOrigins({FAMILY_APP_ORIGINS:'invalid'}),{});
  const env={FAMILY_APP_ORIGINS:JSON.stringify({yehuda:'https://yehuda.example',haim:'https://haim.example/',medina:'https://medina.example/unverified',keha:'https://name:password@keha.example',other:'https://unrelated.example'})};
  const origins=familyAppOrigins(env);
  assert.deepEqual(origins,{yehuda:'https://yehuda.example',haim:'https://haim.example'});
  const {document}=parseHTML(nakashHTML(html,'yehuda',false,origins));
  assert.equal(document.documentElement.dataset.nakashOrigin,'https://yehuda.example');
  assert.equal(document.querySelector('.branch-chip[aria-current="page"]').getAttribute('href'),'https://yehuda.example/nakash/yehuda/');
  assert.ok(document.querySelector('a[href="/nakash/medina/"]'));
  const response=await nakashShell(new Request(origin+'/nakash/yehuda/'),{...env,ASSETS:{fetch:async()=>new Response(html)}},projection);
  assert.equal(parseHTML(await response.text()).document.documentElement.dataset.nakashOrigin,'https://yehuda.example');
});

test('live family origins persist across builds and family switching opens the limited Shlomo family app', async () => {
  const origins = familyAppOrigins();
  for (const family of ['medina', 'yehuda', 'haim']) {
    assert.equal(origins[family], 'https://family-' + family + '.eldadkeha.workers.dev');
    const response = await nakashShell(new Request(origin + '/nakash/' + family + '/'), {ASSETS:{fetch:() => new Response(html)}}, projection);
    const {document} = parseHTML(await response.text());
    assert.equal(document.documentElement.dataset.nakashOrigin, origins[family]);
    assert.ok(document.querySelector('a.branch-chip[href="https://family-shlomo.eldadkeha.workers.dev/keha-extended/shlomo/#home"]'));
  }
});

test('Nakash branch pages retain the original components and limit top-level navigation', () => {
  const original = parseHTML(html).document;
  for (const branch of ['haim', 'yehuda', 'medina', 'keha']) {
    const {document} = parseHTML(nakashHTML(html, branch));
    assert.equal(document.documentElement.dataset.nakashSearchBranch, branch);
    assert.equal(document.querySelector('link[rel="manifest"]').getAttribute('href'), '/nakash/' + branch + '/manifest.webmanifest');
    assert.equal(document.querySelector('#homeLink img').getAttribute('src'), '/nakash/brand-' + branch + '.svg');
    assert.deepEqual([...document.querySelectorAll('#mainNav button')].map(button => button.dataset.view),
      ['tree', 'directory', 'videos', 'gallery', 'stories', 'documents']);
    assert.equal(document.querySelector('link[rel="stylesheet"]').getAttribute('href'),
      '/' + original.querySelector('link[rel="stylesheet"]').getAttribute('href'));
    for (const id of ['treeViewport', 'directoryGrid', 'galleryHeaderUpload', 'videoHeaderUpload', 'personView', 'mediaViewer']) {
      assert.equal(document.getElementById(id).tagName, original.getElementById(id).tagName, id);
    }
    const scripts = [...document.querySelectorAll('script[src]')].map(script => script.getAttribute('src'));
    assert.ok(scripts.indexOf('/nakash/media-adapter.js') < scripts.findIndex(src => src.startsWith('/assets/app.js')));
    assert.ok(scripts.includes('/nakash/api/site-data.js'));
    assert.ok(!scripts.some(src => /^\/(?:family-data\.js|assets\/family-fallback\.js)/.test(src)));
    assert.equal(document.querySelector('a[href="/#home"]'), null);
  }
});

test('The Nakash tree has no return link to the full original site, including from an internal entry', async () => {
  const env = {ASSETS:{fetch:async request => {
    assert.equal(new URL(request.url).pathname, '/');
    return new Response(html);
  }}};
  for (const referrer of [undefined, origin + '/nakash/haim/', 'https://elsewhere.example/']) {
    const response = await nakashShell(new Request(origin + '/nakash/inside/', {headers:referrer ? {Referer:referrer} : {}}), env, projection);
    assert.equal(parseHTML(await response.text()).document.querySelector('a[href="/#home"]'), null);
  }
  const response = await nakashShell(new Request(origin + '/nakash/inside/', {headers:{Referer:origin + '/'}}), env, projection);
  const {document} = parseHTML(await response.text());
  assert.equal(document.querySelector('a[href="/#home"]'),null);
  assert.equal(document.documentElement.dataset.nakashHome, '/nakash/');
});

test('family browser tabs use the same transparent medallion in the branch color', async () => {
  const privacy = await readFile(new URL('../public/privacy.html', import.meta.url), 'utf8');
  const shapes = new Set();
  for (const family of ['haim', 'yehuda', 'medina']) {
    const page = nakashHTML(html, family);
    const home = parseHTML(page).document;
    const logo = home.querySelector('#homeLink img').getAttribute('src');
    const svg = await readFile(new URL('../public' + logo, import.meta.url), 'utf8');
    assert.doesNotMatch(svg, /<rect\b/);
    shapes.add(svg.replaceAll(home.querySelector('meta[name="theme-color"]').content, 'currentColor'));

    const response = await nakashShell(new Request(origin + '/nakash/' + family + '/privacy.html'),
      {ASSETS:{fetch:() => new Response(privacy)}}, projection);
    const base = '/assets/nakash-launch-v1/' + family + '/tab-medallion';
    for (const document of [home, parseHTML(await response.text()).document]) {
      const icons = [...document.querySelectorAll('link[rel="icon"]')];
      assert.deepEqual(icons.map(link => ['type', 'sizes', 'href'].map(key => link.getAttribute(key))), [
        ['image/png', '32x32', base + '-32.png'],
        ['image/svg+xml', 'any', base + '.svg'],
      ]);
    }
  }
  assert.equal(shapes.size, 1);
});

test('the three themed shortcuts share their palette with the page and expose family-specific native launch art', async () => {
  const colors = new Set();
  for (const family of ['haim', 'yehuda', 'medina']) {
    const manifest = JSON.parse(await readFile(new URL('../public/nakash/' + family + '/manifest.webmanifest', import.meta.url)));
    const start = new URL(manifest.start_url, origin);
    const response = await nakashShell(new Request(start), {ASSETS:{fetch:() => new Response(html)}}, projection);
    const {document} = parseHTML(await response.text());
    assert.equal(document.documentElement.dataset.nakashSearchBranch, family);
    assert.equal(document.querySelector('meta[name="theme-color"]').content, manifest.theme_color);
    assert.equal(manifest.background_color, manifest.theme_color);
    assert.equal(manifest.launch_handler.client_mode, 'navigate-existing');
    colors.add(manifest.background_color);
    assert.ok(document.getElementById('familyStartupBackground').textContent.includes(manifest.theme_color));
    assert.ok(document.querySelector('link[href^="/assets/nakash-theme.css"]'));
    const folder = '/assets/nakash-launch-v1/' + family + '/';
    assert.ok(manifest.icons.every(icon => icon.src.startsWith(folder)));
    assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable' && icon.sizes === '512x512'));
    assert.equal(document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'), folder + 'icon-180.png');
    const screens = [...document.querySelectorAll('link[rel="apple-touch-startup-image"]')];
    for (const [orientation, file] of [['portrait','1179x2556.png'], ['landscape','2556x1179.png']]) {
      const link = screens.find(link => link.getAttribute('href') === folder + file);
      assert.ok(link.getAttribute('media').includes('orientation: ' + orientation));
    }
    assert.ok(screens.every(link => link.getAttribute('href').startsWith(folder)));
  }
  assert.equal(colors.size, 3);
  for (const page of [html, ...['keha', '', 'inside'].map(id => nakashHTML(html, id))]) {
    assert.doesNotMatch(page, /nakash-theme\.css|nakash-launch-v1|--family-accent/);
  }
});

test('Scoped tree data supplies the original tree renderer with the four Nakash branches', async () => {
  const response = await nakashShell(new Request(origin + '/nakash/api/site-data.js'), {}, projection);
  const script = await response.text();
  const data = JSON.parse(script.split('\n')[0].slice('window.FAMILY_DATA='.length, -1));
  assert.equal(data.branches.length, 4);
  assert.deepEqual(data.units[data.root].people, ['margalit-nakash', 'zecharia-nakash']);
  for (const id of ['roni-medina', 'naomi-malkhi', 'avner-nakash', 'yona', 'shlomo']) assert.ok(data.people[id]);
  assert.ok(data.units[data.root].children.includes(data.people.yona.unit));
});

test('The original desktop and phone tree renderer opens each sample branch', async () => {
  const script = await (await nakashShell(new Request(origin + '/nakash/api/site-data.js'), {}, projection)).text();
  for (const phone of [false, true]) {
    const {document, window:dom} = parseHTML(nakashHTML(html, 'haim'));
    const window = {addEventListener(){}, dispatchEvent(){}, scrollTo(){}};
    window.FamilyI18n = {t:value=>value, html:(parts,...values)=>parts.reduce((output,part,index)=>output+part+(values[index]??''),''),
      personName:person=>person.name, branchName:branch=>branch?.title, searchNames:person=>person.name, date:value=>value};
    window.FamilyDates = {age:()=>null, parse:()=>null};
    const location = {hash:'#tree'};
    const vmContext = vm.createContext({document, window, location, history:{pushState(){}}, matchMedia:query=>({matches:phone&&query.includes('700px')}),
      requestAnimationFrame(){}, cancelAnimationFrame(){}, setInterval(){}, innerWidth:phone?390:1280, innerHeight:900, CustomEvent:dom.CustomEvent});
    vm.runInContext(script, vmContext);
    window.LOCAL_FAMILY_SERVER = false;
    vm.runInContext(appSource, vmContext);
    assert.equal(document.querySelectorAll('#treeNodes [data-open-branch]').length, 4);
    assert.ok(document.querySelector('#treeNodes [data-person="margalit-nakash"]'));
    for (const [branch, id] of [['haim','avner-nakash'],['yehuda','naomi-malkhi'],['medina','roni-medina'],['keha','ruti']]) {
      document.querySelector('#branchBar [data-branch="'+branch+'"]').click();
      assert.ok(document.querySelector('#treeNodes [data-person="'+id+'"]'), branch);
    }
  }
});
