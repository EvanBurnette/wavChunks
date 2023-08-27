// detectWorker.js
// take in 1 second clips of audio and determine if there's an onset or offset
// send a postMessage back to the main script that has the start time and stop time of a sound
// TODO: collect the peak volume of the clip so we can more easily normalize in the main script
const params = { momentOfSilence: 0.05, samplesPerSecond: 96000, threshold: 0.03, margin: 0.010 };
let silentCount = 0;

/**
 * @type undefined | number
 */
let onset;
let offset;
let peakVolume = 0;

onmessage = (event) => {
  if (event.data.params !== undefined) {
    const newParams = event.data.params;
    for (const key in newParams) {
      params[key] = newParams[key];
    }
    return;
  }
  // if there is an ongoing sound from the previous clip, we don't want to drop it, so we subtract the clip length
  if (onset !== undefined) onset -= params.samplesPerSecond * 1; //seconds
  for (let i = 0; i < event.data.buffer.length; i++) {
    const num = event.data.buffer[i];
    const absNum = Math.abs(num);
    if (absNum > params.threshold) {
      peakVolume = Math.max(peakVolume, num);
      silentCount = 0;
      if (onset === undefined) onset = i;
    } else {
      silentCount++;
      if (silentCount >= params.momentOfSilence * params.samplesPerSecond) {
        offset = i - silentCount + params.margin * params.samplesPerSecond;
        if (
          onset !== undefined &&
          (offset !== undefined || i === event.data.buffer.length - 1)
        ) {
          postMessage({
            onset: onset,
            offset: offset,
            clipIdx: event.data.clipIdx,
            peakVolume: peakVolume,
          });
          onset = undefined;
          offset = undefined;
          peakVolume = 0;
        }
      }
    }
  }
};
