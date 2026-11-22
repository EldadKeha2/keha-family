import {makeSegmentFile} from './video-segment-file.mjs';

self.onmessage = async ({data}) => {
  try {
    const file = await makeSegmentFile(data, progress => self.postMessage({progress}));
    self.postMessage({file});
  } catch (error) {
    self.postMessage({error:error.message, code:error.code});
  }
};
