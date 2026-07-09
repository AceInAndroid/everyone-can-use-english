type VideoSubtitleTrackType = {
  index: number;
  language?: string;
  title?: string;
  codecName?: string;
  handlerName?: string;
  dispositionDefault?: boolean;
  sidecarPath?: string;
  format?: "srt" | "vtt";
};

type VideoSubtitleTrackWarningType = {
  index: number;
  language?: string;
  title?: string;
  codecName?: string;
  error: string;
};

type VideoType = {
  mediaType: string,
  id: string;
  source: string;
  name: string;
  filename: string;
  language?: string;
  description?: string;
  src?: string;
  coverUrl?: string;
  md5: string;
  metadata?: Ffmpeg.FfprobeData & {
    subtitleTracks?: VideoSubtitleTrackType[];
    subtitleTrackWarnings?: VideoSubtitleTrackWarningType[];
  };
  duration?: number;
  transcribed?: boolean;
  transcribing?: boolean;
  recordingsCount?: number;
  recordingsDuration?: number;
  isUploaded?: boolean;
  uploadedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
