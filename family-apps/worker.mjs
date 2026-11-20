// Each family has a separate origin so an installed Keha app cannot enclose it.
// All data and media still come from the existing family backend.
export const UPSTREAM = 'https://keha-family.eldadkeha.workers.dev';
const branches = new Set(['haim', 'yehuda', 'medina', 'keha']);
const readonly = new Set(['GET', 'HEAD', 'OPTIONS']);

export function familyApp(branch, upstreamFetch = fetch) {
  if (!branches.has(branch)) throw new Error('Unknown family branch');
  const home = '/nakash/' + branch + '/';
  return {
    async fetch(request) {
      const incoming = new URL(request.url);
      if (incoming.pathname === '/' || incoming.pathname === '/index.html') {
        incoming.pathname = home;
        if (!incoming.hash) incoming.hash = 'home';
        return Response.redirect(incoming.href, 302);
      }
      const origin = request.headers.get('Origin');
      if (!readonly.has(request.method) && origin && origin !== incoming.origin) {
        return new Response('לא ניתן לשמור שינוי ממקור חיצוני.', {status: 403});
      }
      const headers = new Headers(request.headers);
      // The upstream uses same-origin checks. Validate first, then translate
      // only this app's origin; never turn an unrelated origin into a trusted one.
      if (origin === incoming.origin) headers.set('Origin', UPSTREAM);
      const referer = headers.get('Referer');
      if (referer) {
        try {
          const value = new URL(referer);
          if (value.origin === incoming.origin) headers.set('Referer', UPSTREAM + value.pathname + value.search);
        } catch { headers.delete('Referer'); }
      }
      headers.delete('Host');
      const isManifest = incoming.pathname === '/manifest.webmanifest' || incoming.pathname === home + 'manifest.webmanifest';
      if (isManifest) {
        headers.delete('If-None-Match');
        headers.delete('If-Modified-Since');
      }
      const path = incoming.pathname === '/manifest.webmanifest' ? home + 'manifest.webmanifest' : incoming.pathname;
      const url = new URL(path + incoming.search, UPSTREAM);
      const response = await upstreamFetch(new Request(url, {
        method: request.method, headers, redirect: 'manual',
        ...(request.body ? {body: request.body, duplex: 'half'} : {}),
      }));
      const resultHeaders = new Headers(response.headers);
      const location = resultHeaders.get('Location');
      if (location) {
        const target = new URL(location, url);
        if (target.origin === UPSTREAM) resultHeaders.set('Location', incoming.origin + target.pathname + target.search + target.hash);
      }
      // These are self-related apps, not links to the original host's PWA.
      // Names, colors, icons, scope, and launch markers come from the shared site.
      if (request.method === 'GET' && response.ok && isManifest) {
        const manifest = await response.json();
        manifest.related_applications = [{platform: 'webapp', url: incoming.origin + home + 'manifest.webmanifest', id: incoming.origin + home}];
        resultHeaders.delete('Content-Length');
        resultHeaders.delete('Content-Encoding');
        resultHeaders.delete('ETag');
        resultHeaders.set('Content-Type', 'application/manifest+json; charset=utf-8');
        resultHeaders.set('Cache-Control', 'no-cache');
        return new Response(JSON.stringify(manifest), {status: response.status, headers: resultHeaders});
      }
      return new Response(response.body, {status: response.status, statusText: response.statusText, headers: resultHeaders});
    },
  };
}

export default {
  fetch(request, env) {
    const backend = env.FAMILY_SITE ? request => env.FAMILY_SITE.fetch(request) : fetch;
    return familyApp(env.FAMILY_BRANCH, backend).fetch(request);
  },
};
