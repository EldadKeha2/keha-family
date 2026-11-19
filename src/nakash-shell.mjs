import {BRANCHES, createFamily} from '../public/nakash/family-data.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';
import {escapeHTML} from './http.mjs';

export const NAKASH_WRITE_TOKEN = 'nakash-public-v1';
const NAKASH_VIEWS = ['home', 'tree', 'directory', 'gallery', 'videos', 'person', 'search'];
const branchMap = new Map(BRANCHES.map(branch => [branch.id, branch]));
const mediaBranch = 'keha';
const familyName = 'משפחת נקאש';
const branchPaths = new Set(['', 'inside', ...branchMap.keys()]);
const standaloneScripts = new Set([
  'family-fallback.js', 'family-data.js', 'screensaver.js', 'family-ai.js',
  'living-family.js', 'memories.js', 'updates.js', 'archive.js', 'calendar.js',
  'family-timeline.js', 'memorial.js', 'nursery.js', 'games.js', 'founder-trees.js',
  'cloud.js', 'recycle-bin.js',
]);

function cameFromKeha(request) {
  try {
    const from = new URL(request.headers.get('Referer'));
    return from.origin === new URL(request.url).origin && ['/', '/index.html'].includes(from.pathname);
  } catch {
    return false;
  }
}

export function nakashHTML(original, section, isInternal = false) {
  const branch = branchMap.get(section);
  const homePath = branch ? '/nakash/' + branch.id + '/' : '/nakash/';
  const manifest = homePath + 'manifest.webmanifest';
  const name = escapeHTML(branch?.label || familyName);
  const logo = '/nakash/brand-' + (branch?.id || 'nakash');
  const navigation = BRANCHES.map(({id, label}) =>
    '<a class="branch-chip" href="/nakash/' + id + '/"'+
    (id === section ? ' aria-current="page"' : '') + '>' + escapeHTML(label) + '</a>'
  ).join('');
  const back = isInternal ? '<a class="nav-link" href="/#home" data-i18n-skip>חזרה לבית משפחת קהא</a>' : '';
  const config = [
    ['nakash-branch', branch?.id || mediaBranch],
    ['nakash-home', homePath],
    ['nakash-manifest', manifest],
    ['nakash-name', name],
    ['nakash-views', NAKASH_VIEWS.join(' ')],
    ...(section === 'inside' ? [['nakash-entry-view', 'tree']] : []),
    ...(branch ? [['nakash-search-branch', branch.id]] : []),
  ].map(([key, value]) => ' data-' + key + '="' + value + '"').join('');
  const scripts = [
    '/nakash/media-adapter.js',
    '/nakash/api/site-data.js',
  ].map(src => '  <script src="' + src + '" defer></script>').join('\n');
  return original
    .replace('<html ', '<html' + config + ' ')
    .replace(/<title>[^<]*<\/title>/, '<title>' + name + '</title>')
    .replace(/(name="(?:description|application-name|apple-mobile-web-app-title)" content=")[^"]+/g, '$1' + name)
    .replace(/(<link rel="manifest" href=")[^"]+/, '$1' + manifest)
    .replace(/(<link rel="apple-touch-icon"[^>]+href=")[^"]+/, '$1' + logo + '-192.png')
    .replace(/(href|src)="assets\/medallion\.svg"/g, '$1="' + logo + '.svg"')
    .replace(/((?:href|src)=")assets\//g, '$1/assets/')
    .replace(/  <script src="(?:\/assets\/)?([^"?]+)(?:\?[^"]*)?"[^>]*><\/script>\n/g,
      (tag, script) => standaloneScripts.has(script) ? '' : tag)
    .replace('<head>', '<head>\n  <meta name="robots" content="noindex,nofollow">\n' + scripts)
    .replace('<span>בית משפחת קהא</span>', '<span>' + name + '</span>')
    .replace('משורש משותף, שישה ענפים של אהבה', 'משורש משותף, ארבעה ענפים')
    .replaceAll('קהא · חריזי · בקר · נובל · פיש · בלום', 'נקאש · מדינה · קהא')
    .replace(/(<nav [^>]*id="mainNav"[^>]*>)(.*?)(<\/nav>)/s, (_, start, children, end) =>
      start + children.replace(/<button\b[^>]*data-view="([^"]+)"[^>]*>.*?<\/button>/gs,
        (button, view) => NAKASH_VIEWS.includes(view) ? button : '') + back + end)
    .replace('<footer class="site-footer">', '<footer class="site-footer"><nav class="branch-bar" aria-label="ענפי המשפחה">'+navigation+back+'</nav>');
}

export async function nakashShell(request, env, projection) {
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const url = new URL(request.url);
  if (url.pathname === '/nakash/api/site-data.js') {
    const data = toOriginalFamilyData(createFamily(await projection()));
    const script = 'window.FAMILY_DATA='+JSON.stringify(data)+';\nwindow.LOCAL_FAMILY_SERVER=true;\n'+
      'window.FAMILY_API_TOKEN='+JSON.stringify(NAKASH_WRITE_TOKEN)+';\nwindow.FAMILY_DATA_AVAILABLE=true;\n';
    return new Response(request.method === 'HEAD' ? null : script, {headers:{'Content-Type':'application/javascript; charset=utf-8'}});
  }
  const asset = /^\/nakash\/(?:([^/]+)\/)?(assets\/.+|sw\.js)$/.exec(url.pathname);
  if (asset && branchPaths.has(asset[1] || '')) {
    // Scripts can create relative image and icon URLs after the shell is parsed.
    const path = asset[2] === 'sw.js' ? '/nakash/sw.js' : '/' + asset[2];
    return env.ASSETS.fetch(new Request(new URL(path + url.search, url), request));
  }
  const policy = /^\/nakash\/(?:([^/]+)\/)?privacy\.html$/.exec(url.pathname);
  if (policy && branchPaths.has(policy[1] || '')) {
    const branch = branchMap.get(policy[1]);
    const back = branch ? '/nakash/' + branch.id + '/' : '/nakash/';
    const icon = '/nakash/brand-' + (branch?.id || 'nakash') + '.svg';
    const original = await env.ASSETS.fetch(new Request(new URL('/privacy.html', url)));
    if (!original.ok) return original;
    const html = (await original.text()).replaceAll('assets/app-icons/icon-192.png', icon).replace('href="/"', 'href="' + back + '"');
    return new Response(request.method === 'HEAD' ? null : html, {headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  const page = /^\/nakash(?:\/([^/]*))?\/?$/.exec(url.pathname);
  const section = page?.[1] || '';
  if (!page || (!branchPaths.has(section) && section !== 'index.html')) return null;
  if (!url.pathname.endsWith('/') || section === 'index.html') {
    url.pathname = section === 'index.html' ? '/nakash/' : url.pathname + '/';
    return Response.redirect(url, 308);
  }
  const original = await env.ASSETS.fetch(new Request(new URL('/', url)));
  if (!original.ok) return original;
  const html = nakashHTML(await original.text(), section, section === 'inside' && cameFromKeha(request));
  return new Response(request.method === 'HEAD' ? null : html, {headers:{'Content-Type':'text/html; charset=utf-8'}});
}
