type ReferenceTtsProviderType = "kokoro" | "pocket-tts";

type ReferenceTtsModelType = "kokoro-q8";

type ReferenceTtsGranularityType = "sentence" | "word" | "selection";

type ReferenceTtsConfigType = {
  provider: ReferenceTtsProviderType;
  model: ReferenceTtsModelType;
  voice: string;
  speed: number;
};

type ReferenceTtsStatusType = {
  provider: "kokoro";
  model: "kokoro-q8";
  state: "missing" | "invalid" | "installed" | "loaded" | "downloading" | "error";
  installed: boolean;
  modelDir: string;
  files: {
    path: string;
    exists: boolean;
    bytes: number;
    requiredBytes?: number;
  }[];
  error?: string;
};

type ReferenceTtsGenerateParamsType = {
  sourceId: string;
  sourceType: string;
  text: string;
  provider?: ReferenceTtsProviderType;
  model?: ReferenceTtsModelType;
  voice?: string;
  speed?: number;
  granularity: ReferenceTtsGranularityType;
  contextText?: string;
  media?: {
    id?: string;
    type?: string;
    md5?: string;
  };
  caption?: {
    id?: number | string;
    startTime?: number;
    endTime?: number;
    text?: string;
  };
};
