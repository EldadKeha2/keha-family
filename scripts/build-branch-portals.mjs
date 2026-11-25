import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,basename} from 'node:path';
import sharp from 'sharp';
import {BRANCH_PORTALS} from '../public/keha-extended/branch-portals.mjs';
import {appleLaunchImages,launchAssets} from '../src/nakash-launch.mjs';
import {EXTENDED_HOME,EXTENDED_COLOR} from '../public/keha-extended/family-data.mjs';
import {SHLOMO_HOME,SHLOMO_COLOR} from '../public/keha-extended/shlomo-data.mjs';

const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
const medallion=await readFile(join(publicRoot,'keha-extended/shlomo/brand.svg'),'utf8');
const appIcon=await readFile(join(publicRoot,'assets/app-icons/icon.svg'),'utf8');
// The original app uses the checked-in icons from its initial installation.
// Keep their artwork, padding and URLs intact instead of regenerating them.
const existingApps=[
  {id:'extended',home:EXTENDED_HOME,color:EXTENDED_COLOR,icons:EXTENDED_HOME},
  {id:'shlomo',home:SHLOMO_HOME,color:SHLOMO_COLOR,icons:SHLOMO_HOME},
];
for(const portal of [...Object.values(BRANCH_PORTALS),...existingApps]){
  const existing=existingApps.includes(portal),iconHome=portal.icons||portal.home,backgroundColor=portal.backgroundColor||portal.color,iconVersion=portal.iconVersion||'family-launch-v2';
  const output=join(publicRoot,iconHome),launch=join(publicRoot,launchAssets(portal.id));
  await mkdir(output,{recursive:true});await mkdir(launch,{recursive:true});
  if(portal.home.startsWith(EXTENDED_HOME) && portal.home !== EXTENDED_HOME){
    const article=join(output,'name-origin');
    await mkdir(article,{recursive:true});
    await copyFile(join(publicRoot,EXTENDED_HOME,'name-origin/index.html'),join(article,'index.html'));
  }
  if(!existing)await writeFile(join(output,'brand.svg'),medallion.replaceAll('#536641',portal.color).replaceAll('#79806c',portal.color));
  const emblem=Buffer.from(appIcon.replaceAll('#f7f3e9',portal.color).replaceAll('#eef0e2','#fbf8ef').replaceAll('#87632f',portal.color).replaceAll('#52684c',portal.color).replaceAll('#c4b17f',portal.color));
  const icon=size=>sharp(emblem,{density:144}).resize(size,size).png();
  const canvas=(width,height)=>sharp({create:{width,height,channels:3,background:backgroundColor}});
  const paddedIcon=async size=>canvas(size,size).composite([{input:await icon(Math.round(size*400/512)).toBuffer(),gravity:'centre'}]).png();
  for(const size of [180,192,512])await icon(size).toFile(join(output,'icon-'+size+'.png'));
  await (await paddedIcon(512)).toFile(join(output,'maskable-512.png'));
  const badges=new Map();
  for(const {width,height,scale,href} of existing?[]:appleLaunchImages(portal.id)){
    if(!badges.has(scale))badges.set(scale,await icon(112*scale).toBuffer());
    await canvas(width,height).composite([{input:badges.get(scale),gravity:'centre'}]).png().toFile(join(launch,basename(href)));
  }
  const manifest=existing?JSON.parse(await readFile(join(publicRoot,portal.home,'manifest.webmanifest'),'utf8')):{id:portal.home,name:portal.name,short_name:portal.shortName,description:portal.tagline,lang:'he',dir:'rtl',
    start_url:portal.home+'?source=homescreen&familyApp='+portal.id+'#home',scope:portal.home,display:'standalone',
    background_color:portal.color,theme_color:portal.color,icons:[192,512].map(size=>({src:portal.home+'icon-'+size+'.png',sizes:size+'x'+size,type:'image/png',purpose:'any'})),prefer_related_applications:false};
  manifest.background_color=backgroundColor;
  manifest.icons=[192,512].map(size=>({src:iconHome+'icon-'+size+'.png?v='+iconVersion,sizes:size+'x'+size,type:'image/png',purpose:'any'}));
  manifest.icons.push({src:iconHome+'maskable-512.png?v='+iconVersion,sizes:'512x512',type:'image/png',purpose:'maskable'});
  await writeFile(join(publicRoot,portal.home,'manifest.webmanifest'),JSON.stringify(manifest,null,2)+'\n');
}
