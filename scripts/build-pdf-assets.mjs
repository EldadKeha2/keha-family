import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

// Serve the renderer and its fonts from the family site, including branch apps.
// Keep its worker at the exact same version as the public API.
export async function buildPdfAssets(){
  const source=new URL('../node_modules/pdfjs-dist/',import.meta.url);
  const {version}=JSON.parse(await readFile(new URL('package.json',source),'utf8'));
  const target=new URL('../public/assets/pdfjs/'+version+'/',import.meta.url);
  await mkdir(target,{recursive:true});
  for(const name of ['pdf','pdf.worker'])await cp(new URL('legacy/build/'+name+'.min.mjs',source),new URL(name+'.mjs',target));
  for(const name of ['cmaps','standard_fonts','wasm'])await cp(new URL(name,source),new URL(name,target),{recursive:true});
  await cp(new URL('LICENSE',source),new URL('LICENSE',target));
  await writeFile(new URL('VERSION',target),version+'\n');
  return fileURLToPath(target);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log('Prepared PDF viewer assets: '+await buildPdfAssets());
