import {
  AppSettingsProviderContext,
  AISettingsProviderContext,
} from "@renderer/context";
import { useContext } from "react";
import OpenAI from "openai";
import { t } from "i18next";

export const useSpeech = () => {
  const { EnjoyApp } = useContext(AppSettingsProviderContext);
  const { openai, ttsConfig } = useContext(AISettingsProviderContext);

  const normalizeOpenaiTtsModel = (model?: string) => {
    const normalized = model?.replace(/^openai\//, "");
    return ["tts-1", "tts-1-hd"].includes(normalized) ? normalized : "tts-1";
  };

  const tts = async (params: Partial<SpeechType>) => {
    const configuration = params.configuration || ttsConfig;
    const { engine, voice } = configuration;
    const model = normalizeOpenaiTtsModel(configuration.model);

    let buffer;
    if (engine === "openai") {
      buffer = await openaiTTS({
        ...params,
        configuration: {
          ...configuration,
          model,
        },
      });
    }

    return EnjoyApp.speeches.create(
      {
        text: params.text,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        section: params.section,
        segment: params.segment,
        configuration: {
          engine,
          model,
          voice,
        },
      },
      {
        type: "audio/mp3",
        arrayBuffer: buffer,
      }
    );
  };

  const openaiTTS = async (params: Partial<SpeechType>) => {
    const { configuration } = params;
    const {
      engine = ttsConfig.engine,
      model = ttsConfig.model,
      voice = ttsConfig.voice,
      baseUrl,
    } = configuration || {};

    let client: OpenAI;

    if (engine === "openai" && openai?.key) {
      client = new OpenAI({
        apiKey: openai.key,
        baseURL: baseUrl || openai.baseUrl,
        dangerouslyAllowBrowser: true,
        maxRetries: 1,
      });
    } else {
      throw new Error(t("openaiKeyRequired"));
    }

    const file = await client.audio.speech.create({
      input: params.text,
      model: normalizeOpenaiTtsModel(model),
      voice,
    });

    return file.arrayBuffer();
  };

  return {
    tts,
  };
};
