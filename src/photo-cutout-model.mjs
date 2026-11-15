import {HttpError,boundedBody,sha256} from './http.mjs';
export const CUTOUT_MODEL_PATH='/api/photo-cutout/model-v1';
export const CUTOUT_MODEL_SOURCE='https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx';
export const CUTOUT_MODEL_SHA256='309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8';
// Public model bytes only. No visitor input, cookies, tokens or media are
// forwarded. Pin and verify the upstream model before caching it at the edge.
export async function cutoutModelResponse(request,{cache=globalThis.caches?.default,fetcher=fetch}={}){
  const key=new Request(new URL(CUTOUT_MODEL_PATH,request.url),{method:'GET'});let cached;
  try{cached=await cache?.match(key);}catch{}
  if(cached)return request.method==='HEAD'?new Response(null,{headers:cached.headers}):cached;
  const upstream=await fetcher(CUTOUT_MODEL_SOURCE,{method:'GET',redirect:'follow',headers:{Accept:'application/octet-stream'}});
  if(!upstream.ok)throw new HttpError(503,'המודל להפרדת הרקע אינו זמין כרגע. אפשר להשתמש במברשת.');
  const bytes=await boundedBody(upstream,6_000_000);
  if(bytes.byteLength!==4_574_861||await sha256(bytes)!==CUTOUT_MODEL_SHA256)throw new HttpError(503,'קובץ המודל להפרדת הרקע לא אומת. אפשר להשתמש במברשת.');
  const response=new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes.byteLength),'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
  try{await cache?.put(key,response.clone());}catch{}
  return request.method==='HEAD'?new Response(null,{headers:response.headers}):response;
}
