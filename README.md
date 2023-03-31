# wavChunks

## What is this?

It is a sample splitting proof of concept running completely in the browser

## Motivation

This is an experimental piece of a larger project [samplekiller.com](https://samplekiller.com). I needed to get sample splitting working in the browser, but it was such a big feature that I needed to develop it separately.

## Installation

1. git clone REPO
1. cd REPO
1. npm install
1. npm run dev -- --open

## Usage

Upload a wavefile of samples you've recorded and it will generate audio clips at onsets

### Notes on this development

Fixing samplekiller.com for public use took two weeks of intense work and long days. I had to go much broader and much deeper than I expected.

I learned the Web Audio API and all about webworkers. I committed myself to typescript and jsdoc. I discovered new resources outside of MDN. Especially the WHATWG spec and google's technical blogs. I reached out to another developer working on similar ideas and I read his source code. I also attempted to read chromium source code.

Looking at my data and reading documentation helped me break through blockages to achieve the goal.

### Things I want to try next

- Automatic testing with selenium or similar

- Audio Context playback with MediaElementAudioSourceNode

  - This could allow me to replace a lot of jank on samplekiller.com, especially the preloading of audio src as the user browses samples and I suspect and hope it might perform better and use less memory
