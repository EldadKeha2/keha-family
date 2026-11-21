(() => {
  'use strict';

  const branch = document.documentElement.dataset.nakashBranch;
  if (!['keha', 'haim', 'yehuda', 'medina'].includes(branch)) return;
  const home = document.documentElement.dataset.nakashHome;
  if (home && navigator.serviceWorker) {
    void navigator.serviceWorker.register('/nakash/sw.js', {scope:home}).catch(() => {});
  }

  const {origin, pathname} = location;
  const documentPath = pathname.endsWith('/') ? pathname : pathname + '/';
  const prefix = '/nakash/api/compat/' + branch;

  function scopedApi(input) {
    const value = input instanceof Request ? input.url : input;
    if (typeof value !== 'string' && !(value instanceof URL)) return null;

    let url;
    try {
      url = new URL(value, origin + '/');
    } catch {
      return null;
    }
    if (url.origin !== origin) return null;

    // The original app accepts both site-root and document-relative API URLs.
    const localApiPrefix = documentPath + 'api/';
    const apiPath = documentPath !== '/nakash/' && url.pathname.startsWith(localApiPrefix)
      ? url.pathname.slice(documentPath.length - 1)
      : url.pathname;
    if (!apiPath.startsWith('/api/')) return null;

    url.pathname = prefix + apiPath;
    if(document.documentElement.dataset.familyContentScope==='nakash'&&/^\/api\/(stories|documents)(?:\/|$)/.test(apiPath))url.searchParams.set('familyScope','nakash');
    return url.href;
  }

  const fetch = window.fetch;
  window.fetch = function (input, init) {
    const scoped = scopedApi(input);
    if (!scoped) return fetch.call(window, input, init);
    const request = input instanceof Request ? new Request(scoped, input) : scoped;
    return fetch.call(window, request, init);
  };

  // The upload queue uses XHR to display progress while sending the original body.
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...options) {
    return open.call(this, method, scopedApi(url) || url, ...options);
  };
})();
