import {
  AudioSubtitleLoader,
  SubtitleFormat,
} from "langchain/document_loaders/web/assemblyai";

// You can also use a local file path and the loader will upload it to AssemblyAI for you.
const audioUrl = "https://storage.googleapis.com/aai-docs-samples/espn.m4a";

const loader = new AudioSubtitleLoader(
  {
    audio_url: audioUrl,
    // any other parameters as documented here: https://www.assemblyai.com/docs/API%20reference/transcript#create-a-transcript
  },
  SubtitleFormat.Srt, // srt or vtt
  {
    apiKey: "<ASSEMBLYAI_API_KEY>", // or set the `ASSEMBLYAI_API_KEY` env variable
  }
);

const docs = await loader.load();
console.dir(docs, { depth: Infinity });
