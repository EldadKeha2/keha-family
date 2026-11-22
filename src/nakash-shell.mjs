import {BRANCHES, createFamily} from '../public/nakash/family-data.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';
import {escapeHTML} from './http.mjs';
import {familyAppOrigins} from './family-app-origins.mjs';
import {appleLaunchImages, launchAssets, themedFamilies} from './nakash-launch.mjs';
import {restrictedOriginalPerson} from './family-content.mjs';
import {withStoryFormLink} from './story-submissions.mjs';

export const NAKASH_WRITE_TOKEN = 'nakash-public-v1';
const NAKASH_VIEWS = ['home', 'tree', 'directory', 'gallery', 'videos', 'stories', 'documents', 'games', 'person', 'search'];
const branchMap = new Map(BRANCHES.map(branch => [branch.id, branch]));
const mediaBranch = 'keha';
const familyName = 'משפחת נקאש';
const branchPaths = new Set(['', 'inside', ...branchMap.keys()]);
const relationshipStyles = `<style>
  .tree-unit .tree-partnerships{position:absolute;inset-inline-start:0;top:calc(70px * var(--a11y-tree-scale,1));width:100%;height:calc(12px * var(--a11y-tree-scale,1));pointer-events:none}
  .tree-partnerships path{fill:none;stroke:#c3b18f;stroke-width:1;vector-effect:non-scaling-stroke}
  .tree-partnerships .former{stroke-dasharray:4 4}
  .person-card .person-partnership{display:block;margin-top:5px;font-size:calc(14px * var(--a11y-text-scale,1));line-height:1.35;color:#536641}
  .person-partnership[data-partnership="former"]{color:#786d69}
  @media(max-width:700px){.tree-unit .tree-partnerships{top:calc(31px * var(--a11y-tree-scale,1))}}
</style>`;
const nakashTreeSelector = 'html[data-nakash-home]:not([data-extended-keha],[data-shlomo-keha],[data-branch-portal])';
const layoutStyles = `<style>
  ${nakashTreeSelector} .tree-header-mode{display:none}
  ${nakashTreeSelector} body[data-active-view=tree] .tree-header-mode{display:flex;flex:0 0 auto}
  ${nakashTreeSelector} body[data-active-view=tree] #workspaceSubtitle{display:none}
  html[data-nakash-home] :is(#homeTiles,#mobileMenuTiles){grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:1fr}
  html[data-nakash-home] :is(#homeTiles,#mobileMenuTiles)>.home-tile{grid-column:auto}
  html[data-nakash-home] :is(#homeTiles,#mobileMenuTiles) .home-tile-tree .home-tile-arrow{display:none}
  @media(max-width:700px){
    ${nakashTreeSelector} body[data-active-view=tree] .workspace-header{flex-wrap:nowrap;align-items:center;gap:6px;padding:12px 10px}
    ${nakashTreeSelector} body[data-active-view=tree] .workspace-title{min-width:0;gap:5px}
    ${nakashTreeSelector} body[data-active-view=tree] .workspace-title h2{font-size:calc(clamp(16px,4.4vw,20px) * var(--a11y-text-scale,1));white-space:nowrap}
    ${nakashTreeSelector} body[data-active-view=tree] .workspace-title .section-diamond{font-size:20px}
    ${nakashTreeSelector} .tree-header-mode{gap:1px;padding:2px;align-self:center}
    ${nakashTreeSelector} .tree-header-mode button{min-height:36px;padding:5px 6px;font-size:calc(14px * var(--a11y-text-scale,1));white-space:nowrap}
    html[data-nakash-home] body[data-active-view=home] .page-shell>.site-header{grid-template-columns:28px 88px minmax(0,1fr) clamp(70px,21vw,88px);grid-template-areas:"menu preferences shortcuts brand";grid-template-rows:auto;row-gap:0}
    html[data-nakash-home] body[data-active-view=home] .site-header #homeLink{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;width:100%;max-width:100%;min-height:44px;gap:3px}
    html[data-nakash-home] body[data-active-view=home] .site-header #homeLink>span{display:block;min-width:0;width:100%;max-width:100%;text-align:center;white-space:normal}
    html[data-nakash-home] body[data-active-view=home] .site-header #homeLink .brand-family-label{display:block}
    html[data-nakash-home] body[data-active-view=home] .site-header #homeLink .brand-home-label{display:none}
    html[data-nakash-home] body[data-active-view=home] .site-header #homeLink .brand-title-line{display:block;max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:normal}
    html[data-nakash-home][data-a11y-text] body[data-active-view=home] .page-shell>.site-header{grid-template-columns:28px minmax(78px,1fr) minmax(88px,1fr) minmax(70px,1fr)}
    html[data-nakash-home] :is(#homeTiles,#mobileMenuTiles) .home-tile-tree strong{font-size:calc(clamp(16px,4.4vw,20px) * var(--a11y-text-scale,1))}
    html[data-nakash-home] :is(#homeTiles,#mobileMenuTiles) .home-tile-tree .home-tile-icon{width:42px;height:48px;flex-basis:42px}
    html[data-nakash-home] :is(#homeTiles,#mobileMenuTiles) .home-tile-tree .home-tile-icon svg{width:35px;height:35px}
  }
  @media(max-width:370px){${nakashTreeSelector} body[data-active-view=tree] .workspace-title .section-diamond{display:none}${nakashTreeSelector} .tree-header-mode button{padding-inline:4px}}
  ${nakashTreeSelector}[data-a11y-text] body[data-active-view=tree] .workspace-header{flex-wrap:wrap}
</style>`;
const standaloneScripts = new Set([
  'family-fallback.js', 'family-data.js', 'screensaver.js', 'family-ai.js',
  'living-family.js', 'updates.js', 'archive.js', 'calendar.js',
  'family-timeline.js', 'memorial.js', 'nursery.js', 'founder-trees.js',
  'cloud.js', 'recycle-bin.js', 'home-scroll.js',
]);

function cameFromKeha(request) {
  try {
    const from = new URL(request.headers.get('Referer'));
    return from.origin === new URL(request.url).origin && ['/', '/index.html'].includes(from.pathname);
  } catch {
    return false;
  }
}

function withFamilyTabIcons(html, section) {
  if (!themedFamilies.has(section)) return html;
  const icon = launchAssets(section) + '/tab-medallion';
  return html.replace(/<link rel="icon"[^>]*>/,
    `<link rel="icon" type="image/png" sizes="32x32" href="${icon}-32.png">\n  <link rel="icon" type="image/svg+xml" sizes="any" href="${icon}.svg">`);
}

export function nakashHTML(original, section, isInternal = false, appOrigins = {}) {
  const branch = branchMap.get(section);
  const homePath = branch ? '/nakash/' + branch.id + '/' : '/nakash/';
  const manifest = homePath + 'manifest.webmanifest';
  const name = escapeHTML(branch?.label || familyName);
  const logo = '/nakash/brand-' + (branch?.id || 'nakash');
  const themed = themedFamilies.has(section);
  const appleIcon = themed ? launchAssets(section) + '/icon-180.png' : logo + '-192.png';
  const navigation = BRANCHES.map(({id, label}) =>
    '<a class="branch-chip" href="' + escapeHTML(id === 'keha'
      ? 'https://family-shlomo.eldadkeha.workers.dev/keha-extended/shlomo/#home'
      : (appOrigins[id] || '') + '/nakash/' + id + '/') + '"'+
    (id === section ? ' aria-current="page"' : '') + '>' + escapeHTML(label) + '</a>'
  ).join('');
  const back = '';
  const config = [
    ['nakash-branch', branch?.id || mediaBranch],
    ['nakash-home', homePath],
    ['nakash-manifest', manifest],
    ['nakash-name', name],
    ['nakash-views', NAKASH_VIEWS.join(' ')],
    ...(!branch?[['family-content-scope','nakash']]:[]),
    ...(branch && appOrigins[branch.id] ? [['nakash-origin', escapeHTML(appOrigins[branch.id])]] : []),
    ...(section === 'inside' ? [['nakash-entry-view', 'tree']] : []),
    ...(branch ? [['nakash-search-branch', branch.id]] : []),
  ].map(([key, value]) => ' data-' + key + '="' + value + '"').join('');
  const scripts = [
    '/nakash/media-adapter.js',
    '/nakash/api/site-data.js',
  ].map(src => '  <script src="' + src + '" defer></script>').join('\n');
  const html = withStoryFormLink(original,section)
    .replace('<html ', '<html' + config + ' ')
    .replace(/<title>[^<]*<\/title>/, '<title>' + name + '</title>')
    .replace(/(name="(?:description|application-name|apple-mobile-web-app-title)" content=")[^"]+/g, '$1' + name)
    .replace(/(<link rel="manifest" href=")[^"]+/, '$1' + manifest)
    .replace(/(<link rel="apple-touch-icon"[^>]+href=")[^"]+/, '$1' + appleIcon)
    .replace(/(href|src)="assets\/medallion\.svg"/g, '$1="' + logo + '.svg"')
    .replace(/((?:href|src)=")assets\//g, '$1/assets/')
    .replace(/(src="\/assets\/app\.js)(?:\?[^\"]*)?"/, '$1?v=nakash-tree-header-v2"')
    .replace(/(src="\/assets\/tree-fullscreen\.js)(?:\?[^\"]*)?"/, '$1?v=2"')
    .replace(/  <script src="(?:\/assets\/)?([^"?]+)(?:\?[^"]*)?"[^>]*><\/script>\n/g,
      (tag, script) => standaloneScripts.has(script) ? '' : tag)
    .replace(/<button\b[^>]*id="homeMoreHint"[^>]*>.*?<\/button>\s*/s, '')
    .replace('<head>', '<head>\n  <meta name="robots" content="noindex,nofollow">\n' + scripts + '\n' + relationshipStyles + '\n' + layoutStyles)
    .replace('<span>בית משפחת קהא</span>', '<span>' + name + '</span>')
    .replace('משורש משותף, שישה ענפים של אהבה', 'משורש משותף, ארבעה ענפים')
    .replaceAll('קהא · חריזי · בקר · נובל · פיש · בלום', 'נקאש · מדינה · קהא')
    .replace(/(<nav [^>]*id="mainNav"[^>]*>)(.*?)(<\/nav>)/s, (_, start, children, end) =>
      start + children.replace(/<button\b[^>]*data-view="([^"]+)"[^>]*>.*?<\/button>/gs,
        (button, view) => NAKASH_VIEWS.includes(view) ? button : '') + back + end)
    .replace(/<a[^>]*class="[^"]*original-family-tab[^"]*"[^>]*>.*?<\/a>/gs,'')
    .replaceAll('משחקי משפחה', 'משחקים תימנים ונהנים')
    .replace('תעודות מסמכים ותיעודים נדירים','מסמכים ותיעודים')
    .replace('<footer class="site-footer">', '<footer class="site-footer"><nav class="branch-bar" aria-label="ענפי המשפחה">'+navigation+back+'</nav>');
  if (!themed) return html;
  const startupLinks = appleLaunchImages(section).map(({href, media}) =>
    `  <link rel="apple-touch-startup-image" href="${href}" media="${media}">`).join('\n');
  return withFamilyTabIcons(html, section)
    .replace(/(<meta name="theme-color" content=")[^"]+/, '$1' + branch.color)
    .replace(/(<style id="familyStartupBackground">)[^<]*/, '$1html,body{background:' + branch.color + '}:root{--family-accent:' + branch.color + '}')
    .replace('</head>', '  <link rel="stylesheet" href="/assets/nakash-theme.css?v=1">\n' + startupLinks + '\n</head>');
}

export async function nakashShell(request, env, projection) {
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const url = new URL(request.url);
  if (url.pathname === '/nakash/api/site-data.js') {
    const data = toOriginalFamilyData(createFamily(await projection()));
    for(const p of Object.values(data.people))if(restrictedOriginalPerson(p.id))Object.assign(p,{photoCount:0,videoCount:0,documentCount:0,mediaCount:0});
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
    return new Response(request.method === 'HEAD' ? null : withFamilyTabIcons(html, policy[1]), {headers:{'Content-Type':'text/html; charset=utf-8'}});
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
  const html = nakashHTML(await original.text(), section, section === 'inside' && cameFromKeha(request), familyAppOrigins(env));
  return new Response(request.method === 'HEAD' ? null : html, {headers:{'Content-Type':'text/html; charset=utf-8'}});
}
