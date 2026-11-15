import {ImageSegmenter} from './vendor/mediapipe/vision_bundle.mjs';
// No images leave the device. Only this pinned, integrity-checked runtime may
// be downloaded externally; the person model is a bundled static asset.
const RUNTIME='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_module_internal.wasm',localFetch=self.fetch.bind(self);
self.fetch=(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,self.location.href);if(url.origin===self.location.origin)return localFetch(input,options);if(url.href===RUNTIME&&(!options?.method||options.method==='GET'))return localFetch(RUNTIME,{method:'GET',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',integrity:'sha256-YXuOAkjb0n6dfs5CGABOrkzvtJkZbRu0+g4/7yFwh1Y=',cache:'force-cache'});return Promise.reject(new TypeError('External photo processing is disabled'));};
let segmenter;
self.onmessage=async event=>{
  const {id,bitmap}=event.data;
  try{
    if(!segmenter){const root=new URL('./vendor/mediapipe/',import.meta.url);segmenter=await ImageSegmenter.createFromOptions({wasmLoaderPath:new URL('vision_wasm_module_internal.js',root).href,wasmBinaryPath:RUNTIME},{canvas:new OffscreenCanvas(1,1),baseOptions:{modelAssetPath:new URL('selfie_segmenter.tflite',root).href,delegate:'CPU'},runningMode:'IMAGE',outputCategoryMask:false,outputConfidenceMasks:true});}
    segmenter.segment(bitmap,result=>{
      const masks=result.confidenceMasks;if(!masks?.length)throw Error('No person mask');
      const labels=segmenter.getLabels(),index=Math.max(0,labels.findIndex(label=>/selfie|person|human/i.test(label))),mask=masks[index]||masks.at(-1),values=mask.getAsFloat32Array(),data=new Uint8Array(values.length);
      for(let i=0;i<values.length;i++)data[i]=Math.round(Math.max(0,Math.min(1,(values[i]-.1)/.8))*255);
      self.postMessage({id,mask:{width:mask.width,height:mask.height,data}},[data.buffer]);
    });
  }catch(error){self.postMessage({id,error:'Person separation unavailable: '+(error?.message||'unknown error')});}finally{bitmap?.close?.();}
};
