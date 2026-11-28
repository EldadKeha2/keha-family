// A checkpoint stores editing values and stable clip IDs. File handles, upload tokens
// and the undo stack only belong to the browser session that created them.
export function captureSegmentWork(owner,time) {
  const duration=owner.original.duration;
  const position=Math.min(duration,Math.max(0,Math.round(time*100)/100));
  const segments=owner.segments.map(d=>{
    const {number,start,end,startText,endText,followsPrevious,pinned}=d.segment;
    return {uploadId:d.uploadId,metadata:structuredClone(d.metadata),eventChosen:Boolean(d.eventChosen),
      segment:{number,start,end,startText:startText??null,endText:endText??null,followsPrevious:Boolean(followsPrevious),pinned:Boolean(pinned)},
      ...(d.savedDetails?{savedDetails:structuredClone(d.savedDetails)}:{})};
  });
  return {position,index:owner.index,nextNumber:owner.nextNumber,duration,segments,
    original:{uploadId:owner.original.uploadId,metadata:structuredClone(owner.original.metadata)}};
}

export function restoreSegmentWork(work,source) {
  const {snapshot,published}=work,{file}=source;
  const check={file,phase:'ready',verified:true};
  const base={file,check,duration:snapshot.duration,uploaded:null,frozen:null,saved:false};
  const saved=new Map(published.map(item=>[item.id,item]));
  const segments=snapshot.segments.map(entry=>{
    const {savedDetails:before,...values}=entry;
    const d={...base,...values},item=saved.get(entry.uploadId);
    if(item){
      d.saved=true;d.mediaId=item.id;
      const current={name:item.name,caption:item.caption,date:item.date};
      // Keep pending text edits. Unedited fields should follow a clip edited elsewhere.
      d.savedDetails={...current};
      for(const key of ['name','caption','date']){
        const unchanged=key==='date'?['day','month','year'].every(p=>(d.metadata.date[p]??null)===(before?.date?.[p]??null)):d.metadata[key]===before?.[key];
        if(!before||unchanged)d.metadata[key]=structuredClone(current[key]);
        else d.savedDetails[key]=before[key];
      }
    }
    return d;
  });
  return {original:{...base,...snapshot.original},segments,drafts:segments,split:true,index:snapshot.index,
    nextNumber:snapshot.nextNumber,workRevision:work.workRevision,workSource:source,sources:new Map([[file,source]])};
}
