import "./style.css";
import { WaveFile } from "wavefile";
import DetectWorker from "./detectWorker.js?worker";

const fileInput = document.querySelector("#fileInput");
const soundList = document.querySelector("#sounds");
let buffer;

const addSound = (sound: HTMLMediaElement["src"], soundIdx: number) => {
  // console.log("sound", sound);
  const audio = document.createElement("audio");
  audio.src = sound;
  audio.controls = true;
  audio.onended = (_) => {
    audio.src = sound;
  };
  const li = document.createElement("li");
  li.innerText = String(soundIdx);
  li.appendChild(audio);
  //@ts-ignore
  soundList.appendChild(li);
};
let waveFile: WaveFile;
let waveBuffer: Uint8Array;
const detectWorker = new DetectWorker();
detectWorker.onmessage = (
  // @ts-ignore
  event
) => {
  // clip the sample out
  // TODO: normalize samples
  // @ts-ignore
  const numChannels: number = waveFile.fmt.numChannels;
  // @ts-ignore
  const sampleRate: number = waveFile.fmt.sampleRate;
  // const bitDepth: string = waveFile.bitDepth;
  const clipIdx = event.data.clipIdx;

  // @ts-ignore
  const bytesPerSampleFrame = numChannels * (waveFile.fmt.bitsPerSample / 8);
  const onset = (clipIdx * sampleRate + event.data.onset) * bytesPerSampleFrame;
  const offset =
    (clipIdx * sampleRate + event.data.offset) * bytesPerSampleFrame;

  // const sound = new WaveFile();
  // @ts-ignore
  // const bytesPerSampleFrame = (numChannels * waveFile.fmt.bitsPerSample) / 8;
  // @ts-ignore
  // const header = waveBuffer.slice(0, waveFile.head + 8);
  const soundBuffer = waveBuffer.slice(onset, offset);
  // console.log(soundBuffer);
  // @ts-ignore
  // sound.fromScratch(numChannels, sampleRate, bitDepth, soundBuffer);
  const sound = makeSample(buffer.slice(0, waveFile.head + 8), soundBuffer);
  // console.log("sound to buffer", sound.toBuffer());
  const soundWave = new WaveFile();
  soundWave.fromBuffer(sound);
  addSound(soundWave.toDataURI(), clipIdx);
};

fileInput?.addEventListener("change", async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file: File = (target.files as FileList)[0];
  console.log(file);
  console.log("file.type", file.type);
  buffer = new Uint8Array(await file.arrayBuffer());
  console.log("buffer", buffer);

  waveFile = new WaveFile(buffer);
  // @ts-ignore
  // waveBuffer = waveFile.getSamples(true, Float32Array);
  waveBuffer = waveFile.data.samples;

  // @ts-ignore
  // update samplerate of worker script
  detectWorker.postMessage({ params: { sampleRate: waveFile.fmt.sampleRate } });
  // @ts-ignore
  const header = buffer.slice(0, waveFile.head + 8);

  console.log(waveFile);
  const totalBytes = waveFile.chunkSize;
  // @ts-ignore
  const byteRate = waveFile.fmt.byteRate;
  // console.log(
  //   "og header data size",
  //   // new DataView(header.buffer).getBigInt64(4),
  //   new DataView(header.buffer).getUint32(header.length - 4, true)
  // );
  const newHeader = header.slice();
  // @ts-ignore
  // create 1 second clip header
  new DataView(newHeader.buffer).setUint32(4, waveFile.head + byteRate, true);
  // @ts-ignore
  new DataView(newHeader.buffer).setUint32(waveFile.head + 4, byteRate, true);

  // console.log(
  //   "header data size",
  //   new DataView(header.buffer).getUint32(header.length - 4, true)
  // );
  // console.log(
  //   "newHeader data size",
  //   new DataView(newHeader.buffer).getUint32(header.length - 4, true)
  // );

  // setting this to the clip length is probably unnecessary because we're just using decodeAudioData
  const offlineContext = new OfflineAudioContext(
    // @ts-ignore
    waveFile.fmt.numChannels,
    // @ts-ignore
    waveFile.data.chunkSize,
    // @ts-ignore
    waveFile.fmt.sampleRate
  );

  const clipGen = clipGenerator(buffer, newHeader, byteRate, totalBytes);
  let clip;
  let i = 0;
  do {
    clip = clipGen.next();
    if (!clip.done) {
      const audio = await offlineContext.decodeAudioData(clip.value.buffer);
      const audioClipBuffer = audio.getChannelData(0);
      detectWorker.postMessage({ clipIdx: i, buffer: audioClipBuffer }, [
        audioClipBuffer.buffer,
      ]);
    }
    i++;
  } while (!clip.done);
});

const clipGenerator = function* (
  buffer: Uint8Array,
  header: Uint8Array,
  byteRate: number,
  totalBytes: number
) {
  const start = Date.now();
  let i = header.length;
  while (i < totalBytes) {
    const clip = new Uint8Array(header.length + byteRate);
    clip.set(header, 0);
    clip.set(buffer.slice(i, i + byteRate), header.length);
    yield { idx: i, buffer: clip.buffer };
    i += byteRate;
  }
  const end = Date.now();
  return { time: end - start };
};

const makeSample = (header: Uint8Array, buffer: Uint8Array) => {
  const newHeader = amendHeader(header, buffer.length);
  const newSample = new Uint8Array(header.length + buffer.length);
  newSample.set(newHeader, 0);
  newSample.set(buffer, newHeader.length);
  return newSample;
};

const amendHeader = (header: Uint8Array, dataSize: number) => {
  const newHeader = header.slice();
  // set filesize
  new DataView(newHeader.buffer).setUint32(
    4,
    dataSize + newHeader.length - 4,
    true
  );
  // set datachunk size
  new DataView(newHeader.buffer).setUint32(
    newHeader.length - 4,
    dataSize,
    true
  );
  console.log(header, newHeader);
  return newHeader;
};
