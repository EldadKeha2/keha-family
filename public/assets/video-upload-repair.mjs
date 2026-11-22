import {mp4AvcSampleTables} from './mp4-clip.mjs?v=upload-repair-1';

const READ_AHEAD = 4 * 1024 * 1024;
const filler = Uint8Array.of(0x0c, 0x80); // AVC filler_data_rbsp, same length as the empty slice.
const damaged = () => Object.assign(new Error('Invalid AVC video sample'), {code:'VIDEO_DAMAGED'});

// Some capture devices pad a multi-slice picture with extra two-byte slices.
// The only payload bits encode first_mb_in_slice. There is no slice_type or
// picture data. Never remove a short but valid slice or the only picture.
function missingSliceType(byte) {
  const leadingZeros = Math.clz32(byte) - 24;
  const remaining = 8 - (2 * leadingZeros + 1);
  return remaining <= 0 || (byte & ((1 << remaining) - 1)) === 0;
}

export async function repairAvcRecording(file, {signal, progress = () => {}} = {}) {
  const readRange = async (start, end) => {
    signal?.throwIfAborted();
    return new Uint8Array(await file.slice(start, end + 1).arrayBuffer());
  };
  let tracks;
  try {
    tracks = await mp4AvcSampleTables(readRange, file.size);
  } catch (error) {
    // WebM, fragmented MP4 and other sample layouts use the native playback check.
    if (error.code === 'VIDEO_CLIP_FORMAT' || error instanceof RangeError) return {file, repaired:0};
    throw error;
  }
  const samples = tracks.reduce((count, track) => count + track.sizes.length, 0);
  const patches = [];
  let cache = new Uint8Array(), base = 0, seen = 0, lastPercent = -1;
  for (const {offsets, sizes, lengthBytes} of tracks) {
    for (let i = 0; i < sizes.length; i++) {
      let position = offsets[i];
      const end = position + sizes[i], patchStart = patches.length;
      if (position < 0 || end > file.size) throw damaged();
      let hasPictureStart = false;
      while (position < end) {
        if (end - position <= lengthBytes) throw damaged();
        const required = Math.min(end, position + lengthBytes + 2);
        if (position < base || required > base + cache.length) {
          base = position;
          cache = await readRange(base, Math.min(file.size, base + READ_AHEAD) - 1);
        }
        let cursor = position - base, length = 0;
        for (let n = 0; n < lengthBytes; n++) length = length * 256 + cache[cursor++];
        position += lengthBytes;
        if (!length || position + length > end) throw damaged();
        const header = cache[cursor], type = header & 31;
        if (!(header & 0x80) && (type === 1 || type === 5)) {
          if (length === 2 && missingSliceType(cache[cursor + 1])) {
            if (!hasPictureStart) throw damaged();
            patches.push(position);
          } else {
            // Only trailing empty slices qualify. A later real slice makes this ambiguous.
            if (patches.length !== patchStart) throw damaged();
            if (length > 2 && (cache[cursor + 1] & 0x80)) hasPictureStart = true;
          }
        }
        position += length;
      }
      const percent = Math.floor(++seen * 100 / samples);
      if (percent !== lastPercent) { lastPercent = percent; progress(percent); }
    }
  }
  signal?.throwIfAborted();
  if (!patches.length) return {file, repaired:0};

  // Keep the media on disk. Only the replacement bytes are held in memory.
  // Equal-sized replacements preserve chunk offsets, edit lists and audio.
  patches.sort((a,b) => a - b);
  const parts = [];
  let from = 0;
  for (const offset of patches) {
    if (offset < from) throw damaged();
    parts.push(file.slice(from, offset), filler);
    from = offset + filler.length;
  }
  parts.push(file.slice(from));
  return {file:new File(parts, file.name, {type:file.type, lastModified:file.lastModified}), repaired:patches.length};
}
