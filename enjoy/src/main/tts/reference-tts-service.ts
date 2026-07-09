import fs from "fs-extra";
import path from "path";
import settings from "@main/settings";
import { hashFile } from "@main/utils";
import { Speech } from "@main/db/models";
import { buildReferenceTtsCacheKey } from "./reference-tts-cache-key";
import { kokoroQ8Service } from "./kokoro-q8-service";

export const DEFAULT_REFERENCE_TTS_CONFIG: ReferenceTtsConfigType = {
  provider: "kokoro",
  model: "kokoro-q8",
  voice: "af_heart",
  speed: 1,
};

class ReferenceTtsService {
  status() {
    return kokoroQ8Service.status();
  }

  downloadModel() {
    return kokoroQ8Service.downloadModel();
  }

  importModel(sourceDir: string) {
    return kokoroQ8Service.importModel(sourceDir);
  }

  private resolveConfig(params: ReferenceTtsGenerateParamsType) {
    return {
      provider: params.provider || DEFAULT_REFERENCE_TTS_CONFIG.provider,
      model: params.model || DEFAULT_REFERENCE_TTS_CONFIG.model,
      voice: params.voice || DEFAULT_REFERENCE_TTS_CONFIG.voice,
      speed: params.speed || DEFAULT_REFERENCE_TTS_CONFIG.speed,
    };
  }

  async generateSpeech(params: ReferenceTtsGenerateParamsType) {
    const text = params.text?.trim();
    if (!text) {
      throw new Error("Reference TTS text is required");
    }

    const config = this.resolveConfig(params);
    if (config.provider !== "kokoro" || config.model !== "kokoro-q8") {
      throw new Error(
        `Reference TTS provider is not supported: ${config.provider}`
      );
    }

    const cacheKey = buildReferenceTtsCacheKey({
      ...params,
      text,
      ...config,
    });
    const cached = await Speech.findOne({ where: { cacheKey } });
    if (cached) {
      return cached;
    }

    const extname = ".wav";
    const tmpFilePath = path.join(
      settings.userDataPath(),
      "speeches",
      `${Date.now()}-${Math.random().toString(16).slice(2)}${extname}`
    );

    await kokoroQ8Service.generateToFile({
      text,
      voice: config.voice,
      speed: config.speed,
      filePath: tmpFilePath,
    });

    const md5 = await hashFile(tmpFilePath, { algo: "md5" });
    const filePath = path.join(path.dirname(tmpFilePath), `${md5}${extname}`);
    await fs.move(tmpFilePath, filePath, { overwrite: true });

    try {
      return await Speech.create({
        sourceId: params.sourceId,
        sourceType: params.sourceType,
        text,
        extname,
        md5,
        cacheKey,
        configuration: {
          engine: "reference-tts",
          provider: config.provider,
          model: config.model,
          voice: config.voice,
          speed: config.speed,
          granularity: params.granularity,
          purpose: "subtitle-reference",
        },
      });
    } catch (err: any) {
      const existing = await Speech.findOne({ where: { cacheKey } });
      await fs.remove(filePath);
      if (existing) {
        return existing;
      }
      throw err;
    }
  }
}

export const referenceTtsService = new ReferenceTtsService();
