import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,basename} from 'node:path';
import sharp from 'sharp';
import {BRANCH_PORTALS} from '../public/keha-extended/branch-portals.mjs';
import {appleLaunchImages,launchAssets} from '../src/nakash-launch.mjs';

const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
const medallion=await readFile(join(publicRoot,'keha-extended/shlomo/brand.svg'),'utf8');
const appIcon=await readFile(join(publicRoot,'assets/app-icons/icon.svg'),'utf8');
for(const portal of Object.values(BRANCH_PORTALS)){
  const output=join(publicRoot,portal.home),launch=join(publicRoot,launchAssets(portal.id));
  await mkdir(output,{recursive:true});await mkdir(launch,{recursive:true});
  await writeFile(join(output,'brand.svg'),medallion.replaceAll('#536641',portal.color).replaceAll('#79806c',portal.color));
  const emblem=Buffer.from(appIcon.replaceAll('#f7f3e9',portal.color).replaceAll('#eef0e2','#fbf8ef').replaceAll('#87632f',portal.color).replaceAll('#52684c',portal.color).replaceAll('#c4b17f',portal.color));
  const icon=size=>sharp(emblem,{density:144}).resize(size,size).png();
  const canvas=(width,height)=>sharp({create:{width,height,channels:3,background:portal.color}});
  for(const size of [180,192,512])await icon(size).toFile(join(output,'icon-'+size+'.png'));
  await canvas(512,512).composite([{input:await icon(400).toBuffer(),gravity:'centre'}]).png().toFile(join(output,'maskable-512.png'));
  const badges=new Map();
  for(const {width,height,scale,href} of appleLaunchImages(portal.id)){
    if(!badges.has(scale))badges.set(scale,await icon(112*scale).toBuffer());
    await canvas(width,height).composite([{input:badges.get(scale),gravity:'centre'}]).png().toFile(join(launch,basename(href)));
  }
  const manifest={id:portal.home,name:portal.name,short_name:portal.shortName,description:portal.tagline,lang:'he',dir:'rtl',
    start_url:portal.home+'?source=homescreen&familyApp='+portal.id+'#home',scope:portal.home,display:'standalone',
    background_color:portal.color,theme_color:portal.color,icons:[192,512].map(size=>({src:portal.home+'icon-'+size+'.png',sizes:size+'x'+size,type:'image/png',purpose:'any'})),prefer_related_applications:false};
  manifest.icons.push({src:portal.home+'maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'});
  await writeFile(join(output,'manifest.webmanifest'),JSON.stringify(manifest,null,2)+'\n');
}
