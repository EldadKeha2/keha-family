import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import sharp from 'sharp';
import {ANDROID_LAUNCH_HOME,ANDROID_SPLASH_ARTWORK_SCALE,androidLaunchProfile} from '../src/android-launch.mjs';

const root=fileURLToPath(new URL('../public/',import.meta.url));
const original=await readFile(join(root,'assets/app-icons/icon-512.png'));
const base=JSON.parse(await readFile(join(root,'manifest.webmanifest'),'utf8'));
const output=join(root,ANDROID_LAUNCH_HOME);
await mkdir(output,{recursive:true});
const origin=new URL(base.related_applications.find(item=>item.platform==='webapp').url).origin;

for(let quarter=4;quarter<=24;quarter++){
  const {primarySize,splashSize}=androidLaunchProfile(quarter/4);
  const primaryName='launcher-'+primarySize+'.png',splashName='splash-'+splashSize+'.png';
  await sharp(original).resize(primarySize,primarySize).png().toFile(join(output,primaryName));
  const artwork=await sharp(original).resize(Math.round(splashSize*ANDROID_SPLASH_ARTWORK_SCALE)).png().toBuffer();
  await sharp({create:{width:splashSize,height:splashSize,channels:3,background:base.background_color}})
    .composite([{input:artwork,gravity:'centre'}]).png().toFile(join(output,splashName));
  const manifest={...base,icons:[
    ...base.icons.filter(icon=>icon.purpose==='any'),
    {src:ANDROID_LAUNCH_HOME+primaryName,sizes:primarySize+'x'+primarySize,type:'image/png',purpose:'maskable'},
    {src:ANDROID_LAUNCH_HOME+splashName,sizes:splashSize+'x'+splashSize,type:'image/png',purpose:'maskable'},
  ],related_applications:base.related_applications.map(item=>item.platform==='webapp'
    ?{...item,url:origin+ANDROID_LAUNCH_HOME+'density-'+quarter+'.webmanifest'}:item)};
  await writeFile(join(output,'density-'+quarter+'.webmanifest'),JSON.stringify(manifest,null,2)+'\n');
}
