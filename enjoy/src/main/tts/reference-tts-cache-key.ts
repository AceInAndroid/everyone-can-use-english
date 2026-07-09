import { createHash } from "crypto";

function stableValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        const item = value[key];
        if (item !== undefined) {
          result[key] = stableValue(item);
        }
        return result;
      }, {} as any);
  }

  return value;
}

export function buildReferenceTtsCacheKey(
  params: ReferenceTtsGenerateParamsType & {
    provider: ReferenceTtsProviderType;
    model: ReferenceTtsModelType;
    voice: string;
    speed: number;
  }
) {
  const payload = stableValue({
    namespace: "reference-tts",
    version: 1,
    provider: params.provider,
    model: params.model,
    voice: params.voice,
    speed: params.speed,
    granularity: params.granularity,
    contextText: params.contextText || "",
    sourceId: params.sourceId,
    sourceType: params.sourceType,
    text: params.text,
    media: params.media || {},
    caption: params.caption || {},
  });

  return `reference-tts:${createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")}`;
}
