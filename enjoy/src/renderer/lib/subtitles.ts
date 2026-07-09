import { parseText } from "media-captions";
import { TimelineEntry } from "echogarden/dist/utilities/Timeline";
import { milisecondsToTimestamp } from "@/utils";

export type SubtitleFileType = "srt" | "vtt" | "txt" | "ass" | "ssa";

export type NormalizeSubtitleResult = {
  text: string;
  transcript: string;
  segmentTimeline: TimelineEntry[];
  normalization: TranscriptionNormalizationType;
};

export type SubtitleEnglishPreferenceType = {
  latinLineCount: number;
  cjkLineCount: number;
  score: number;
  isLikelyEnglishOnly: boolean;
};

const nonSpeechPattern =
  /(laugh|laughter|applause|music|theme|cheer|audience|silence|inaudible|sigh|groan|clap)/i;

const cueWrapperPattern = /^[\s♪]*(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})[\s♪]*$/;
const cueMarkerPattern = /(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})/g;
const speakerPrefixPattern = /^[A-Z][A-Z\s.'-]{1,24}:\s+/;
const cjkCharsPattern =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu;
const latinPattern = /[A-Za-z]/;
const urlPattern = /(?:https?:\/\/|www\.)\S+/i;
const subtitleCreditPattern =
  /(字幕组|字幕|校订|QQ群|YYeTs|Sohu|cXcY|本影片|压制|翻译|timeline|subtitles?)/i;
const assDrawingPattern =
  /^(?:m|n|l|b|s|p|c)\s+-?\d[\d\s.,mn lbspc-]*$/i;

export const normalizeSubtitleText = async (
  text: string,
  options?: { type?: SubtitleFileType }
): Promise<NormalizeSubtitleResult> => {
  const type = options?.type || "srt";

  if (type === "ass" || type === "ssa") {
    throw new Error(
      "ASS/SSA subtitle upload is not supported directly. Convert it to SRT/VTT first."
    );
  }

  if (type === "txt") {
    const normalized = normalizePlainText(text);
    return {
      text: normalized.text,
      transcript: normalized.text,
      segmentTimeline: [],
      normalization: normalized.normalization,
    };
  }

  const caption = await parseText(text, {
    strict: false,
    type: type as "srt" | "vtt",
  });

  if (caption.cues.length === 0) {
    const normalized = normalizePlainText(text);
    return {
      text: normalized.text,
      transcript: normalized.text,
      segmentTimeline: [],
      normalization: normalized.normalization,
    };
  }

  let removedNonSpeechCueCount = 0;
  const warnings: string[] = [];
  const segmentTimeline: TimelineEntry[] = [];

  caption.cues.forEach((cue) => {
    const normalizedText = normalizeCueText(cue.text);
    if (!normalizedText) {
      removedNonSpeechCueCount += 1;
      return;
    }

    segmentTimeline.push({
      type: "segment",
      text: normalizedText,
      startTime: cue.startTime,
      endTime: cue.endTime,
      timeline: [],
    } as TimelineEntry);
  });

  if (segmentTimeline.length === 0 && caption.cues.length > 0) {
    warnings.push("All subtitle cues were removed as non-speech.");
  }

  return {
    text: timelineToSrtText(segmentTimeline),
    transcript: segmentTimeline.map((entry) => entry.text).join(" "),
    segmentTimeline,
    normalization: {
      removedNonSpeechCueCount,
      retainedCueCount: segmentTimeline.length,
      warnings,
    },
  };
};

export const getSubtitleEnglishPreference = (
  text: string
): SubtitleEnglishPreferenceType => {
  const lines = text
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\[^}]*\}/g, "")
    .split(/\r?\n/)
    .map((line) => normalizeCueLine(line))
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^\d+$/.test(line)) return false;
      if (line.includes("-->")) return false;
      if (urlPattern.test(line)) return false;
      if (assDrawingPattern.test(line)) return false;
      return true;
    });
  const latinLineCount = lines.filter((line) => latinPattern.test(line)).length;
  const cjkLineCount = lines.filter((line) => cjkCharsPattern.test(line)).length;
  const isLikelyEnglishOnly = latinLineCount >= 10 && cjkLineCount === 0;

  return {
    latinLineCount,
    cjkLineCount,
    isLikelyEnglishOnly,
    score:
      (isLikelyEnglishOnly ? 100000 : 0) +
      latinLineCount * 10 -
      cjkLineCount * 20,
  };
};

const normalizePlainText = (
  text: string
): {
  text: string;
  normalization: TranscriptionNormalizationType;
} => {
  let removedNonSpeechCueCount = 0;
  const lines = text.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];

    const normalized = normalizeCueText(line);
    if (normalized) return [normalized];

    removedNonSpeechCueCount += 1;
    return [];
  });

  const normalizedText = lines.join("\n").replace(/[*_`]/g, "").trim();

  return {
    text: normalizedText,
    normalization: {
      removedNonSpeechCueCount,
      retainedCueCount: lines.length,
      warnings: [],
    },
  };
};

const normalizeCueText = (text: string): string => {
  const lines = text
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\[^}]*\}/g, "")
    .split(/\r?\n/)
    .map((line) => normalizeCueLine(line))
    .filter(Boolean);

  const englishLines = lines
    .map((line) => extractEnglishSpeechLine(line))
    .filter(Boolean);

  return englishLines.join(" ").replace(/\s+/g, " ").trim();
};

const normalizeCueLine = (line: string): string => {
  let text = line.trim();
  if (!text) return "";

  const withoutMusicNotes = text.replace(/[♪♫]/g, "").trim();
  if (!withoutMusicNotes) return "";

  if (cueWrapperPattern.test(text) && nonSpeechPattern.test(text)) {
    return "";
  }

  text = text.replace(cueMarkerPattern, (marker) => {
    return nonSpeechPattern.test(marker) ? "" : marker;
  });

  text = text.replace(speakerPrefixPattern, "");

  return text.trim();
};

const extractEnglishSpeechLine = (line: string): string => {
  if (!latinPattern.test(line)) return "";
  if (urlPattern.test(line)) return "";
  if (subtitleCreditPattern.test(line)) return "";

  const text = line
    .replace(cjkCharsPattern, " ")
    .replace(/[，。！？、；：“”‘’《》【】（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (assDrawingPattern.test(text)) return "";

  return text;
};

const timelineToSrtText = (timeline: TimelineEntry[]) => {
  return timeline
    .map((entry, index) => {
      return `${index + 1}\n${milisecondsToTimestamp(
        entry.startTime * 1000
      )} --> ${milisecondsToTimestamp(entry.endTime * 1000)}\n${entry.text}`;
    })
    .join("\n\n");
};
