import "./style.css";
import { WaveFile } from "wavefile";
import DetectWorker from "./detectWorker.js?worker";

const fileInput = document.querySelector("#fileInput");
const soundList = document.querySelector("#sounds");

var encode = (bytes) => {
  return btoa(bytes);
};

const addSound = (sound: HTMLMediaElement["src"], soundIdx: number) => {
  // console.log("sound", sound);
  const audio = document.createElement("audio");
  audio.src = sound;
  audio.controls = true;
  audio.onended = (event) => {
    audio.src = sound;
  };
  const li = document.createElement("li");
  li.innerText = String(soundIdx);
  li.appendChild(audio);
  //@ts-ignore
  soundList.appendChild(li);
};
let waveFile: WaveFile;
let waveBuffer: Float32Array;
const detectWorker = new DetectWorker();
detectWorker.onmessage = (
  // @ts-ignore
  event
) => {
  // const soundBuffer: ArrayLike<number> = waveFile.data.samples;
  // @ts-ignore
  const numChannels: number = waveFile.fmt.numChannels;
  // @ts-ignore
  const sampleRate: number = waveFile.fmt.sampleRate;
  const bitDepth: string = waveFile.bitDepth;
  // const bits: number = waveFile.dataType.bits;
  // const bytesPerSample = bits / 8;
  // const byteRate = waveFile.fmt.byteRate;
  const clipIdx = event.data.clipIdx;
  const onset = clipIdx * sampleRate + event.data.onset;
  const offset = clipIdx * sampleRate + event.data.offset;
  // const onset = clipIdx * byteRate + event.data.onset;
  // const offset = clipIdx * byteRate + event.data.offset;
  const sound = new WaveFile();
  sound.fromScratch(
    numChannels,
    sampleRate,
    bitDepth,
    waveBuffer.slice(onset, offset)
    //TODO: replace this slow conversion to float64buffer with just slicing the raw buffer
    //TODO: use the same header trick from before because all this converting stuff is super slow when working with 24bit audio
    // waveFile.data.samples.slice(onset, offset)
  );
  addSound(sound.toDataURI(), clipIdx);
};

// when file is loaded confirm in console
fileInput?.addEventListener("change", async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file: File = (target.files as FileList)[0];
  console.log(file);
  console.log("file.type", file.type);
  const buffer = new Uint8Array(await file.arrayBuffer());

  waveFile = new WaveFile(buffer);
  waveBuffer = waveFile.getSamples(true, Int32Array);
  // update samplerate of worker script
  detectWorker.postMessage({ params: { sampleRate: waveFile.fmt.sampleRate } });
  // @ts-ignore
  const header = buffer.slice(0, waveFile.head + 8);

  console.log(waveFile);
  const totalBytes = waveFile.chunkSize;
  // @ts-ignore
  const byteRate = waveFile.fmt.byteRate;

  const newHeader = structuredClone(header);
  // @ts-ignore
  new DataView(newHeader.buffer).setUint32(4, waveFile.head + byteRate);
  new DataView(newHeader.buffer).setUint32(4, byteRate);

  console.log("header", new DataView(header.buffer).getUint32(4));
  console.log("newHeader", new DataView(newHeader.buffer).getUint32(4));

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
