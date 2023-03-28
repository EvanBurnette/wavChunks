import "./style.css";
import { WaveFile } from "wavefile";

const fileInput = document.querySelector("#fileInput");

// when file is loaded confirm in console
fileInput?.addEventListener("change", async (event: Event) => {
  console.log("file loaded");
  const target = event.target as HTMLInputElement;
  const file: File = (target.files as FileList)[0];
  console.log(file);
  // read the file

  // const reader = new FileReader();
  // reader.readAsArrayBuffer(file);

  const buffer = await file.arrayBuffer();
  console.log(buffer);

  // console.log(buffer.slice(0, 44));
  const start = Date.now();
  const waveFile = new WaveFile(new Uint8Array(buffer));
  const end = Date.now();
  console.log(`${end - start} ms for new wavefile ${waveFile.fmt}`);

  const totalBytes = waveFile.data.chunkSize;
  const oneSecondBytes = waveFile.fmt.byteRate;

  const headerEnd = 44;

  console.log(waveFile);
  let i = headerEnd;
  {
    const start = Date.now();
    for (; i < totalBytes + 44; i += oneSecondBytes) {
      const clip = new WaveFile();
      clip.fromScratch(
        waveFile.fmt.numChannels,
        waveFile.fmt.sampleRate,
        waveFile.bitDepth,
        waveFile.data.samples.slice(i, i + oneSecondBytes)
      );
    }
    const end = Date.now();
    console.log(
      `${end - start} ms to slice up ${i / oneSecondBytes} one second samples`
    );
  }
});

// interface FMT {
//   numChannels: number;
//   sampleRate: number;
// }

// interface DATA {
//   samples: number[];
//   chunkSize: number;
// }

// interface WAVE {
//   data: DATA;
//   fmt: FMT;
// }

// type MyWave = WAVE | WaveFile;
