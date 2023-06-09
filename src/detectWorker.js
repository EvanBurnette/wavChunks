const params = { momentOfSilence: 0.05, sampleRate: 96000, threshold: 0.01 };
let silentCount = 0;

/**
 * @type undefined | number
 */
let onset;
let offset;
// TODO: for multiple files being processed make sure offset is reset to undefined at the end of whole wave files, so send a done signal to worker to close file

onmessage = (event) => {
  if (event.data.params !== undefined) {
    const newParams = event.data.params;
    for (const key in newParams) {
      params[key] = newParams[key];
    }
    return;
  }
  // if there is an ongoing sound from the previous clip, we don't want to drop it, so we subtract the clip length
  if (onset !== undefined) onset -= params.sampleRate * 1; //seconds
  for (let i = 0; i < event.data.buffer.length; i++) {
    const num = event.data.buffer[i];
    if (Math.abs(num) > params.threshold) {
      silentCount = 0;
      if (onset === undefined) onset = i;
    } else {
      silentCount++;
      if (silentCount >= params.momentOfSilence * params.sampleRate) {
        offset = i;
        if (
          onset !== undefined &&
          (offset !== undefined || i === event.data.buffer.length - 1)
        ) {
          postMessage({
            onset: onset,
            offset: offset,
            clipIdx: event.data.clipIdx,
          });
          onset = undefined;
          offset = undefined;
        }
      }
    }
  }
};
