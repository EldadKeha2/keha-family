import {ALL_FORMATS, BlobSource, Input, Output, Conversion, Quality, StreamTarget, WebMOutputFormat, Mp4OutputFormat, canEncodeVideo, canEncodeAudio} from './vendor/mediabunny-1.66.2/mediabunny.min.mjs';

async function makePreview(file, formats) {
  const input = new Input({source: new BlobSource(file), formats: ALL_FORMATS});
  try {
    const [video, audio] = await Promise.all([input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()]);
    if (!video || !await video.canDecode()) throw Error('Cannot decode video');
    const [w, h] = await Promise.all([video.getDisplayWidth(), video.getDisplayHeight()]);
    const scale = Math.min(1, 640 / Math.max(w, h), 360 / Math.min(w, h));
    const even = value => Math.max(2, 2 * Math.round(value * scale / 2));
    const picture = {width: even(w), height: even(h), frameRate: 15, quality: new Quality({bitrate: 420000})};
    const sound = {sampleRate: 48000, numberOfChannels: 1, quality: new Quality({bitrate: 48000})};
    const sourceAudio = await audio?.getCodec();

    for (const profile of formats) {
      const webm = profile === 'webm';
      const format = webm ? 'webm' : 'mp4';
      const videoCodec = webm ? 'vp8' : profile === 'mp4-vp9' ? 'vp9' : 'avc';
      const audioCodec = webm ? 'opus' : 'aac';
      if (!await canEncodeVideo(videoCodec, picture)) continue;
      const convertAudio = audio && await canEncodeAudio(audioCodec, sound) && await audio.canDecode();
      if (audio && !convertAudio && sourceAudio !== audioCodec) continue;

      // The muxer can patch the header after writing the last frame. Keep the
      // output in blob slices so a long tape never requires one giant buffer.
      let bytes = new Blob();
      const target = new StreamTarget(new WritableStream({write({position, data}) {
        const padding = new Uint8Array(Math.max(0, position - bytes.size));
        bytes = new Blob([bytes.slice(0, position), padding, data, bytes.slice(position + data.byteLength)]);
      }}), {chunked: true, chunkSize: 1024 * 1024});
      const output = new Output({format: webm ? new WebMOutputFormat() : new Mp4OutputFormat({fastStart: false}), target});
      const conversion = await Conversion.init({
        input, output, tracks: 'primary', trim: {start: 0}, showWarnings: false,
        video: {...picture, codec: videoCodec, fit: 'contain', allowTransformationMetadata: false, keyFrameInterval: 1, forceTranscode: true},
        audio: convertAudio ? {...sound, codec: audioCodec, forceTranscode: true} : {}
      });
      if (!conversion.isValid || !conversion.utilizedTracks.includes(video) || (audio && !conversion.utilizedTracks.includes(audio))) continue;
      let lastPercent = -1;
      conversion.onProgress = fraction => {
        const percent = Math.min(99, Math.floor(fraction * 100));
        if (percent !== lastPercent) { lastPercent = percent; self.postMessage({percent}); }
      };
      await conversion.execute();
      return new File([bytes], 'preview.' + format, {type: webm ? 'video/webm' : 'video/mp4'});
    }
    throw Error('No compatible preview encoder');
  } finally {
    input.dispose();
  }
}

self.onmessage = async ({data}) => {
  try { self.postMessage({file: await makePreview(data.file, data.formats)}); }
  catch { self.postMessage({error: true}); }
};
