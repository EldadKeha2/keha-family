import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile,unlink} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,resolve} from 'node:path';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const generatedName=/^site-styles-[a-f0-9]{16}\.css$/;
const stylesheetLink=/^[\t ]*<link\b[^>]*rel="stylesheet"[^>]*href="assets\/[^"?]+\.css(?:\?[^\"]*)?"[^>]*>[\t ]*(?:\r?\n|$)/gm;

// All source sheets and the bundle share /assets/, so relative image/font URLs
// and the cascade stay identical. Preserve every source byte and its order;
// the newline between sheets prevents adjacent tokens or comments joining.
export async function buildSiteStyles(root=projectRoot){
  const sources=JSON.parse(await readFile(join(root,'scripts/site-style-sources.json'),'utf8'));
  if(!Array.isArray(sources)||!sources.length||sources.some(name=>typeof name!=='string'||!/^[a-z0-9][a-z0-9.-]*\.css$/.test(name)))throw Error('Invalid site stylesheet source list');
  const assets=join(root,'public/assets');
  const parts=await Promise.all(sources.map(async name=>{
    const bytes=await readFile(join(assets,name));
    // Imports and charset declarations have placement rules which would need
    // a real CSS parser. Reject them rather than silently alter their meaning.
    if(/@(?:import|charset|namespace)\b/i.test(bytes.toString('utf8')))throw Error('Unsupported stylesheet directive in '+name);
    return Buffer.concat([bytes,Buffer.from('\n')]);
  }));
  const contents=Buffer.concat(parts),hash=createHash('sha256').update(contents).digest('hex').slice(0,16);
  const name='site-styles-'+hash+'.css',index=join(root,'public/index.html'),html=await readFile(index,'utf8');
  for(const link of html.matchAll(stylesheetLink)){
    const file=/href="assets\/([^"?]+)/.exec(link[0])[1];
    if(!generatedName.test(file)&&!sources.includes(file))throw Error('Add '+file+' to scripts/site-style-sources.json before bundling');
  }
  let links=0;
  const next=html.replace(stylesheetLink,()=>++links===1?'  <link rel="stylesheet" href="assets/'+name+'">\n':'');
  if(!links)throw Error('No site stylesheet link found');
  await writeFile(join(assets,name),contents);
  if(next!==html)await writeFile(index,next);
  // Only remove our own previous outputs. Authored sources remain editable.
  for(const file of await readdir(assets))if(file!==name&&generatedName.test(file))await unlink(join(assets,file));
  return {name,hash,bytes:contents.length,sources:sources.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const result=await buildSiteStyles();
  console.log('Bundled '+result.sources+' stylesheets into '+result.name+' ('+result.bytes+' bytes)');
}
