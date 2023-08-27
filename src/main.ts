import "./style.css";
import { WaveFile } from "wavefile";
import DetectWorker from "./detectWorker.js?worker";
import {zip} from 'lodash';

const fileInput = document.querySelector("#fileInput");
const soundList = document.querySelector("#sounds");
let buffer:Uint8Array | undefined = undefined;
let soundsCreated = 0;

const addSound = (sound: HTMLMediaElement["src"], soundIdx: number) => {
  const audio = document.createElement("audio");
  audio.src = sound;
  audio.controls = true;
  audio.onended = (_) => {
    audio.src = sound;
  };
  const li = document.createElement("li");
  li.innerText = String(soundIdx);
  li.appendChild(audio);
  // @ts-ignore
  soundList.appendChild(li);

  // process into spectrogram image
  if (audio.duration > 2) {
    return;
  }

};
let waveFile: WaveFile;
let waveBuffer: Uint8Array;
const detectWorker = new DetectWorker();
detectWorker.onmessage = async (
  // @ts-ignore
  event
) => {
  // clip the sample out
  // @ts-ignore
  const numChannels: number = waveFile.fmt.numChannels;
  // @ts-ignore
  const sampleRate: number = waveFile.fmt.sampleRate;

  const clipIdx = event.data.clipIdx;
  const clipPeakVolume = event.data.peakVolume;
  console.log(`clip ${clipIdx} peak volume is ${clipPeakVolume}`)
  // if (clipPeakVolume < 0.001) return;

  // @ts-ignore
  const bytesPerSampleFrame = numChannels * (waveFile.fmt.bitsPerSample / 8);
  const onsetBytes = (clipIdx * sampleRate + event.data.onset) * bytesPerSampleFrame;
  const offsetBytes =
    (clipIdx * sampleRate + event.data.offset) * bytesPerSampleFrame;
  const sampleDuration = (offsetBytes - onsetBytes)/(bytesPerSampleFrame * sampleRate)
  if (sampleDuration < 0.01 || sampleDuration > 2.0) return;

  const soundBuffer = waveBuffer.slice(onsetBytes, offsetBytes);

  const sound = makeSample(buffer.slice(0, waveFile.head + 8), soundBuffer);

  const soundWave = new WaveFile();
  soundWave.fromBuffer(sound);
  // addSound(soundWave.toDataURI(), clipIdx);
  if (soundWave)
    addSound(createSoundBlob(await normalizeVolume(soundWave, clipPeakVolume)), soundsCreated++);
};

fileInput?.addEventListener("change", async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file: File = (target.files as FileList)[0];
  // console.log(file);
  // console.log("file.type", file.type);
  buffer = new Uint8Array(await file.arrayBuffer());
  // console.log("buffer", buffer);

  waveFile = new WaveFile(buffer);
  // @ts-ignore
  // waveBuffer = waveFile.getSamples(true, Float32Array);
  waveBuffer = waveFile.data.samples;

  // @ts-ignore
  // update samplerate of worker script
  detectWorker.postMessage({ params: { sampleRate: waveFile.fmt.sampleRate } });
  // @ts-ignore
  const header = buffer.slice(0, waveFile.head + 8);

  const totalBytes = waveFile.chunkSize;
  // @ts-ignore
  const byteRate = waveFile.fmt.byteRate;
  console.log(waveFile)
  console.log(`bit depth = ${8 * waveFile.fmt.byteRate / (waveFile.fmt.sampleRate * waveFile.fmt.numChannels)}`)

  const newHeader = header.slice();
  // @ts-ignore
  // create 1 second clip header
  new DataView(newHeader.buffer).setUint32(4, waveFile.head + byteRate, true);
  // @ts-ignore
  new DataView(newHeader.buffer).setUint32(waveFile.head + 4, byteRate, true);

  // setting this to the clip length is unnecessary because we're just using decodeAudioData
  const offlineContext = new OfflineAudioContext(
    // @ts-ignore
    waveFile.fmt.numChannels,
    // @ts-ignore
    96000,
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
  // console.log(header, newHeader);
  return newHeader;
};

function createSoundBlob(wav: WaveFile) {
  const blob = new Blob([wav.toBuffer()], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

async function normalizeVolume(wav: WaveFile, peakVolume: number) {
  const offlineCtx = new OfflineAudioContext(
    // @ts-ignore
  wav.fmt.numChannels,
  // @ts-ignore
  wav.data.chunkSize,
  // @ts-ignore
  wav.fmt.sampleRate)
  const gainNode = offlineCtx.createGain();
  console.log(peakVolume);
  gainNode.gain.value = .95/peakVolume;
  
  try {
    const audioBuffer = await offlineCtx.decodeAudioData(wav.toBuffer().buffer);
  
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
  
    source.start(0);
  
    const renderedBuffer = await offlineCtx.startRendering();

    const newWav = new WaveFile();
    // console.log(renderedBuffer)
    newWav.fromScratch(wav.fmt.numChannels, wav.fmt.sampleRate, '32f', [renderedBuffer.getChannelData(0), renderedBuffer.getChannelData(1)]);
    newWav.toBitDepth(wav.bitDepth);
    return newWav;
  } catch (error) {
    console.error("An error occurred:", error);
  }
  }