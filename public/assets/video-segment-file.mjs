import {planMp4Clip} from './mp4-clip.mjs';

const codecs = () => import('./vendor/mediabunny-1.66.2/mediabunny.min.mjs');
const tooLarge = () => Object.assign(new Error('Segment exceeds the upload limit'), {code:'SEGMENT_SIZE'});

export async function segmentSourceDuration(file) {
  const {Input, BlobSource, MP4, QTFF, WEBM} = await codecs();
  const input = new Input({source:new BlobSource(file), formats:[MP4, QTFF, WEBM]});
  try { return await input.computeDuration(); }
  finally { input.dispose(); }
}

// Standard MP4/MOV recordings only need small reads of the sample tables.
// File slices point at the selected compressed audio and video on disk.
export async function makeSegmentFile({file, name, range, maxBytes}, onProgress) {
  const basename = name.trim().replace(/[\\/<>:"|?*\x00-\x1f]/g, '_') || 'clip';
  const read = async (start, end) => new Uint8Array(await file.slice(start, end + 1).arrayBuffer());
  try {
    const plan = await planMp4Clip(read, file.size, range);
    if (plan.size > maxBytes) throw tooLarge();
    const parts = plan.ranges.map(({start,end}) => file.slice(start, end + 1));
    return new File([plan.prefix, ...parts], basename + '.mp4', {type:'video/mp4'});
  } catch (error) {
    if (error.code !== 'VIDEO_CLIP_FORMAT') throw error;
  }

  // WebM and fragmented movies may need decoding at a non-keyframe boundary.
  const {Input, BlobSource, MP4, QTFF, WEBM, Output, WebMOutputFormat, Mp4OutputFormat, Conversion, StreamTarget} = await codecs();
  const input = new Input({source:new BlobSource(file), formats:[WEBM, MP4, QTFF]});
  try {
    const webm = await input.getFormat() === WEBM;
    const type = webm ? 'video/webm' : 'video/mp4';
    let outputBytes = new Blob();
    const target = new StreamTarget(new WritableStream({write({position,data}) {
      const end = position + data.byteLength;
      if (end > maxBytes) throw tooLarge();
      const gap = Math.max(0, position - outputBytes.size);
      outputBytes = new Blob([outputBytes.slice(0, position), new Uint8Array(gap), data, outputBytes.slice(end)]);
    }}), {chunked:true, chunkSize:2 * 1024 * 1024});
    const output = new Output({format:webm ? new WebMOutputFormat() : new Mp4OutputFormat({fastStart:false}), target});
    const conversion = await Conversion.init({input, output, trim:range, copy:{boundaryTolerance:0}, showWarnings:false});
    if (!conversion.isValid || !conversion.utilizedTracks.some(track => track.type === 'video') ||
        conversion.discardedTracks.some(({track}) => ['audio','video'].includes(track.type))) {
      throw new Error('Unsupported audio or video codec');
    }
    conversion.onProgress = onProgress;
    await conversion.execute();
    return new File([outputBytes], basename + (webm ? '.webm' : '.mp4'), {type});
  } finally {
    input.dispose();
  }
}
