import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('static assets are served without Worker quota consumption',()=>{
  const config=JSON.parse(read('../wrangler.jsonc'));
  assert.deepEqual(config.assets.run_worker_first,['/api/*','/media/*','/family-data.js']);
  assert.equal(config.assets.directory,'./public');
});
test('maintenance overlay has no manually navigable page or trigger',()=>{
  const html=read('../public/index.html');
  const js=read('../public/assets/maintenance.js');
  const css=read('../public/assets/maintenance.css');
  assert.match(html,/assets\/maintenance\.js/);
  assert.match(html,/assets\/maintenance\.css/);
  assert.doesNotMatch(html,/href="[^"]*maintenance/i);
  assert.match(js,/response\.status/);
  assert.match(js,/family-data/);
  assert.match(js,/120000/);
  assert.doesNotMatch(js,/URLSearchParams|location\.hash|query\.get\(/);
  assert.match(js,/GRANDMA is working/);
  assert.match(js,/אנחנו מתנצלים/);
  assert.match(css,/prefers-reduced-motion/);
});
