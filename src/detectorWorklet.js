// @ts-ignore
class Detector extends AudioWorkletProcessor {
  /**
   * Worklet that detects onsets or offsets in sounds
   * @constructor
   * @param {string} current
   * @param {number} threshold
   * @param {number} rootFrames
   * @param {number} currentFrames
   *
   */
  constructor(current, threshold, rootFrames, currentFrames) {
    super();
    this.current = current;
    this.threshold = threshold;
    this.rootFrames = rootFrames;
    this.currentFrames = currentFrames;
  }

  // process 128 sample-frames
  // but we send a message as soon as we detect
  // so we can treat this as a global loop for the buffer
  /**
   *
   * @param {AudioBuffer} inputs
   * @param {AudioBuffer} outputs
   * @param {*} parameters
   * @returns
   */
  // @ts-ignore
  process(inputs, outputs, parameters) {
    if (this.current === "silence") {
      // find onset
      // if found onset
      //  postMessage to parent of onsetTime
      //  toggle this.current
    } else if (this.current === "sound") {
      // find offset
      // if found offset
      //  postMessage to parent of offsetTime
      //  toggle this.current
    }

    // keep this processor alive
    return true;
  }
}
