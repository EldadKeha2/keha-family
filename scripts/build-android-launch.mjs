import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {ANDROID_LAUNCH_HOME} from '../src/android-launch.mjs';

const root=fileURLToPath(new URL('../public/',import.meta.url));
const base=JSON.parse(await readFile(join(root,'manifest.webmanifest'),'utf8'));
const output=join(root,ANDROID_LAUNCH_HOME);
await mkdir(output,{recursive:true});
const origin=new URL(base.related_applications.find(item=>item.platform==='webapp').url).origin;

for(let quarter=4;quarter<=24;quarter++){
  // Chrome's Android S splash wraps maskable artwork in
  // Icon.createWithAdaptiveBitmap(). The density/66:108 compensation did not
  // produce a stable native launch on the reported Chrome 158 installation.
  // Use standard PNGs to avoid that adaptive rendering branch entirely.
  // Preserve each manifest URL, app identity and native installation fields.
  const manifest={...base,icons:base.icons.filter(icon=>icon.purpose==='any'),related_applications:base.related_applications.map(item=>item.platform==='webapp'
    ?{...item,url:origin+ANDROID_LAUNCH_HOME+'density-'+quarter+'.webmanifest'}:item)};
  await writeFile(join(output,'density-'+quarter+'.webmanifest'),JSON.stringify(manifest,null,2)+'\n');
}
