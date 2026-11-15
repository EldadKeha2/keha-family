import {cutoutInput,cutoutOutput} from './photo-cutout-cpu-core.mjs?v=1';
// Pure WASM fallback for browsers without OffscreenCanvas WebGL. Its entire
// network surface is same-origin runtime files and a verified public model.
const localFetch=self.fetch.bind(self);self.fetch=(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,self.location.href);return url.origin===self.location.origin?localFetch(input,options):Promise.reject(new TypeError('External cutout requests are disabled'));};
self.onmessage=async event=>{
  const {id,pixels,width,height}=event.data;let session,tensor,outputs;
  try{
    const ort=await import('./vendor/onnxruntime/ort.wasm.min.mjs');ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=new URL('./vendor/onnxruntime/',import.meta.url).href;
    const response=await fetch(new URL('/api/photo-cutout/model-v1',self.location.href),{cache:'force-cache'});if(!response.ok)throw Error('CPU cutout model unavailable');
    session=await ort.InferenceSession.create(new Uint8Array(await response.arrayBuffer()),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    tensor=new ort.Tensor('float32',cutoutInput(pixels,width,height),[1,3,height,width]);const name=session.outputNames[0];outputs=await session.run({[session.inputNames[0]]:tensor},[name]);const mask=cutoutOutput(outputs[name].data,width,height);self.postMessage({id,mask},[mask.data.buffer]);
  }catch(error){self.postMessage({id,error:'CPU person separation unavailable: '+(error?.message||'unknown error')});}
  finally{tensor?.dispose?.();if(outputs)for(const value of Object.values(outputs))value.dispose?.();await session?.release?.();}
};
