import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {BRANCHES} from '../public/nakash/family-data.mjs';

const families = BRANCHES.filter(branch => ['haim', 'yehuda', 'medina'].includes(branch.id));
const generated = new URL('../src/family-app-origins.generated.mjs', import.meta.url);

// Use the existing Cloudflare build connection. Credentials stay in the build
// environment and go only to Cloudflare's API; none are copied into the apps.
export async function prepareFamilyApps({env = process.env, apiFetch = fetch, verifyFetch = fetch,
  read = readFile, write = writeFile, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log} = {}) {
  if (env.WORKERS_CI !== '1' || env.WORKERS_CI_BRANCH !== 'main' || env.WRANGLER_COMMAND !== 'deploy') return {};
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw Error('The production build is missing its existing Cloudflare deployment connection.');
  const apiBase = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(account) + '/workers';
  async function api(path, init = {}, allowMissing = false) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Bearer ' + token);
    const response = await apiFetch(apiBase + path, {...init, headers, signal:AbortSignal.timeout(30000)});
    if (allowMissing && response.status === 404) return null;
    const data = await response.json();
    if (allowMissing && !data.success && data.errors?.some(error => error.code === 10007)) return null;
    if (!response.ok || !data.success) {
      const codes = (data.errors || []).map(error => error.code).join(',');
      throw Error('Cloudflare family-app deployment failed (HTTP ' + response.status + ', codes ' + codes + ').');
    }
    return data.result;
  }
  const domain = (await api('/subdomain')).subdomain;
  if (!/^[a-z0-9-]+$/.test(domain)) throw Error('Cloudflare did not return a valid existing workers.dev subdomain.');
  const source = await read(new URL('../family-apps/worker.mjs', import.meta.url), 'utf8');
  const origins = {};
  for (const family of families) {
    const config = JSON.parse(await read(new URL('../family-apps/' + family.id + '/wrangler.jsonc', import.meta.url), 'utf8'));
    const name = 'family-' + family.id;
    if (config.name !== name || config.vars.FAMILY_BRANCH !== family.id) throw Error('Invalid family-app deployment target.');
    const path = '/scripts/' + name;
    const current = await api(path + '/settings', {}, true);
    if (current && !current.bindings?.some(binding => binding.name === 'FAMILY_BRANCH' && binding.type === 'plain_text' && binding.text === family.id)) {
      throw Error('An unrelated Worker already uses ' + name + '; it was left unchanged.');
    }
    const body = new FormData();
    body.set('metadata', new Blob([JSON.stringify({
      main_module:'worker.mjs', compatibility_date:config.compatibility_date,
      bindings:[{type:'plain_text', name:'FAMILY_BRANCH', text:family.id}, {type:'service', name:'FAMILY_SITE', service:'keha-family'}],
    })], {type:'application/json'}));
    body.set('worker.mjs', new Blob([source], {type:'application/javascript+module'}), 'worker.mjs');
    await api(path, {method:'PUT', body});
    await api(path + '/subdomain', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({enabled:true, previews_enabled:false})});
    const origin = 'https://' + name + '.' + domain + '.workers.dev';
    const home = '/nakash/' + family.id + '/';
    let verified = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const [pageResponse, manifestResponse] = await Promise.all([
          verifyFetch(origin + home, {signal:AbortSignal.timeout(15000)}),
          verifyFetch(origin + home + 'manifest.webmanifest', {signal:AbortSignal.timeout(15000)}),
        ]);
        if (!pageResponse.ok || !manifestResponse.ok) throw Error('Family app is not ready.');
        const page = await pageResponse.text(), manifest = await manifestResponse.json();
        if (!page.includes('<title>' + family.label + '</title>') || manifest.name !== family.label || manifest.id !== home || manifest.related_applications?.[0]?.id !== origin + home) throw Error('Family app identity does not match.');
        const icon = manifest.icons?.find(icon => icon.sizes === '192x192');
        const iconURL = new URL(icon?.src, origin);
        if (iconURL.origin !== origin) throw Error('Family icon must use its own origin.');
        const iconResponse = await verifyFetch(iconURL.href, {signal:AbortSignal.timeout(15000)});
        if (!iconResponse.ok || !iconResponse.headers.get('Content-Type')?.includes('image/png')) throw Error('Family icon is not ready.');
        await iconResponse.body?.cancel();
        verified = true;
        break;
      } catch {
        if (attempt < 9) await pause(2000);
      }
    }
    if (!verified) throw Error('The new ' + name + ' app did not pass live checks; existing installation links were left unchanged.');
    origins[family.id] = origin;
    log('Verified independent family app: ' + origin + home);
  }
  await write(generated, '// Verified by the production build before activating installation links.\nexport default ' + JSON.stringify(origins, null, 2) + ';\n');
  return origins;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareFamilyApps();
