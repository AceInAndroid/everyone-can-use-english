import { createContext, useEffect, useState, useContext } from "react";
import {
  AppSettingsProviderContext,
  DbProviderContext,
} from "@renderer/context";
import { SttEngineOptionEnum, UserSettingKeyEnum } from "@/types/enums";
import { GPT_PROVIDERS, TTS_PROVIDERS } from "@renderer/components";
import {
  DEFAULT_ECHOGARDEN_MULTILINGUAL_MODEL,
  DEFAULT_ECHOGARDEN_STT_ENGINE,
  getDefaultEchogardenSttModel,
  WHISPER_MODELS,
} from "@/constants";

type AISettingsProviderState = {
  sttEngine?: SttEngineOptionEnum;
  setSttEngine?: (name: string) => Promise<void>;
  openai?: LlmProviderType;
  setOpenai?: (config: LlmProviderType) => void;
  setGptEngine?: (engine: GptEngineSettingType) => void;
  currentGptEngine?: GptEngineSettingType;
  gptProviders?: typeof GPT_PROVIDERS;
  ttsProviders?: typeof TTS_PROVIDERS;
  ttsConfig?: TtsConfigType;
  setTtsConfig?: (config: TtsConfigType) => Promise<void>;
  echogardenSttConfig?: EchogardenSttConfigType;
  setEchogardenSttConfig?: (config: EchogardenSttConfigType) => Promise<void>;
};

const initialState: AISettingsProviderState = {};
const REMOVED_STT_ENGINES = ["azure", "cloudflare"].map(
  (engine) => `enjoy_${engine}`
);

const normalizeLegacyWhisperModel = (
  whisperModel: string,
  learningLanguage?: string
) => {
  let model = getDefaultEchogardenSttModel(learningLanguage);

  if (whisperModel.match(/large/)) {
    model = DEFAULT_ECHOGARDEN_MULTILINGUAL_MODEL;
  } else if (WHISPER_MODELS.includes(whisperModel)) {
    model = whisperModel;
  } else if (whisperModel.match(/tiny/)) {
    model = "tiny";
  } else if (whisperModel.match(/base/)) {
    model = "base";
  } else if (whisperModel.match(/small/)) {
    model = "small";
  } else if (whisperModel.match(/medium/)) {
    model = "medium";
  }

  if (
    learningLanguage?.match(/en/) &&
    model.match(/^(tiny|base|small|medium)$/)
  ) {
    return `${model}.en`;
  }

  return model;
};

export const AISettingsProviderContext =
  createContext<AISettingsProviderState>(initialState);

export const AISettingsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { EnjoyApp, libraryPath, learningLanguage } = useContext(
    AppSettingsProviderContext
  );
  const [gptProviders, setGptProviders] = useState<any>(GPT_PROVIDERS);
  const [ttsProviders, setTtsProviders] = useState<any>(TTS_PROVIDERS);
  const db = useContext(DbProviderContext);

  const [sttEngine, setSttEngine] = useState<SttEngineOptionEnum>(
    SttEngineOptionEnum.LOCAL
  );
  const [ttsConfig, setTtsConfig] = useState<TtsConfigType>(null);
  const [echogardenSttConfig, setEchogardenSttConfig] =
    useState<EchogardenSttConfigType>(null);
  const [gptEngine, setGptEngine] = useState<GptEngineSettingType>({
    name: "openai",
    models: {
      default: "gpt-4o",
    },
  });
  const [openai, setOpenai] = useState<LlmProviderType>(null);

  const refreshGptProviders = async () => {
    const providers: Record<string, any> = {
      ...GPT_PROVIDERS,
      openai: { ...GPT_PROVIDERS.openai },
      ollama: { ...GPT_PROVIDERS.ollama },
    };

    try {
      const response = await fetch(providers["ollama"]?.baseUrl + "/api/tags");
      providers["ollama"].models = (await response.json()).models.map(
        (m: any) => m.name
      );
    } catch (e) {
      console.warn(`No ollama server found: ${e.message}`);
    }

    if (openai?.models) {
      providers["openai"].models = openai.models.split(",");
    }

    setGptProviders({ ...providers });
  };

  const refreshTtsProviders = async () => {
    const providers: Record<string, any> = {
      ...TTS_PROVIDERS,
      openai: { ...TTS_PROVIDERS.openai },
    };

    setTtsProviders({ ...providers });
  };

  const refreshTtsConfig = async () => {
    let config = await EnjoyApp.userSettings.get(UserSettingKeyEnum.TTS_CONFIG);
    if (!config) {
      config = {
        engine: "openai",
        model: "tts-1",
        voice: "alloy",
        language: learningLanguage,
      };
      EnjoyApp.userSettings.set(UserSettingKeyEnum.TTS_CONFIG, config);
    } else if (config.engine === "enjoyai") {
      const model = config.model?.replace(/^openai\//, "");
      config = {
        ...config,
        engine: "openai",
        model: ["tts-1", "tts-1-hd"].includes(model) ? model : "tts-1",
      };
      EnjoyApp.userSettings.set(UserSettingKeyEnum.TTS_CONFIG, config);
    } else if (config.engine === "openai") {
      const model = config.model?.replace(/^openai\//, "");
      if (!["tts-1", "tts-1-hd"].includes(model)) {
        config = {
          ...config,
          model: "tts-1",
        };
        EnjoyApp.userSettings.set(UserSettingKeyEnum.TTS_CONFIG, config);
      }
    }
    setTtsConfig(config);
  };

  const handleSetTtsConfig = async (config: TtsConfigType) => {
    return EnjoyApp.userSettings
      .set(UserSettingKeyEnum.TTS_CONFIG, config)
      .then(() => {
        setTtsConfig(config);
      });
  };

  const refreshEchogardenSttConfig = async () => {
    let config = await EnjoyApp.userSettings.get(UserSettingKeyEnum.ECHOGARDEN);

    if (!config) {
      const whisperModel =
        (await EnjoyApp.userSettings.get(UserSettingKeyEnum.WHISPER)) || "";
      const model = normalizeLegacyWhisperModel(whisperModel, learningLanguage);

      config = {
        engine: DEFAULT_ECHOGARDEN_STT_ENGINE,
        whisper: {
          model,
          temperature: 0.2,
          prompt: "",
          encoderProvider: "cpu",
          decoderProvider: "cpu",
        },
        whisperCpp: {
          model,
          temperature: 0.2,
          prompt: "",
          enableGPU: false,
        },
      };
      EnjoyApp.userSettings.set(UserSettingKeyEnum.ECHOGARDEN, config);
    }
    setEchogardenSttConfig(config);
  };

  const handleSetEchogardenSttConfig = async (
    config: EchogardenSttConfigType
  ) => {
    return EnjoyApp.userSettings
      .set(UserSettingKeyEnum.ECHOGARDEN, config)
      .then(() => {
        setEchogardenSttConfig(config);
      });
  };

  useEffect(() => {
    refreshGptProviders();
    refreshTtsProviders();
  }, [openai, gptEngine]);

  useEffect(() => {
    if (db.state !== "connected") return;

    fetchSettings();
  }, [db.state]);

  useEffect(() => {
    if (db.state !== "connected") return;
    if (!libraryPath) return;
  }, [db.state, libraryPath]);

  const handleSetSttEngine = async (name: SttEngineOptionEnum) => {
    setSttEngine(name);
    return EnjoyApp.userSettings.set(UserSettingKeyEnum.STT_ENGINE, name);
  };

  const fetchSettings = async () => {
    const _sttEngine = await EnjoyApp.userSettings.get(
      UserSettingKeyEnum.STT_ENGINE
    );
    if (_sttEngine) {
      if (REMOVED_STT_ENGINES.includes(_sttEngine)) {
        handleSetSttEngine(SttEngineOptionEnum.LOCAL);
      } else {
        setSttEngine(_sttEngine);
      }
    }

    const _openai = await EnjoyApp.userSettings.get(UserSettingKeyEnum.OPENAI);
    if (_openai) {
      setOpenai(Object.assign({ name: "openai" }, _openai));
    }

    const _gptEngine = await EnjoyApp.userSettings.get(
      UserSettingKeyEnum.GPT_ENGINE
    );
    if (_gptEngine) {
      if (_gptEngine.name === "enjoyai") {
        const engine = {
          ..._gptEngine,
          name: "openai",
        };
        EnjoyApp.userSettings
          .set(UserSettingKeyEnum.GPT_ENGINE, engine)
          .then(() => {
            setGptEngine(engine);
          });
      } else {
        setGptEngine(_gptEngine);
      }
    } else if (_openai?.key) {
      const engine = {
        name: "openai",
        models: {
          default: "gpt-4o",
        },
      };
      EnjoyApp.userSettings
        .set(UserSettingKeyEnum.GPT_ENGINE, engine)
        .then(() => {
          setGptEngine(engine);
        });
    } else {
      const engine = {
        name: "openai",
        models: {
          default: "gpt-4o",
        },
      };
      EnjoyApp.userSettings
        .set(UserSettingKeyEnum.GPT_ENGINE, engine)
        .then(() => {
          setGptEngine(engine);
        });
    }

    refreshEchogardenSttConfig();
    refreshTtsConfig();
  };

  const handleSetOpenai = async (config: LlmProviderType) => {
    await EnjoyApp.userSettings.set(UserSettingKeyEnum.OPENAI, config);
    setOpenai(Object.assign({ name: "openai" }, config));
  };

  return (
    <AISettingsProviderContext.Provider
      value={{
        setGptEngine: (engine: GptEngineSettingType) => {
          EnjoyApp.userSettings
            .set(UserSettingKeyEnum.GPT_ENGINE, engine)
            .then(() => {
              setGptEngine(engine);
            });
        },
        currentGptEngine:
          gptEngine.name === "openai"
            ? Object.assign(gptEngine, {
                key: openai?.key,
                baseUrl: openai?.baseUrl,
              })
            : gptEngine,
        openai,
        setOpenai: (config: LlmProviderType) => handleSetOpenai(config),
        echogardenSttConfig,
        setEchogardenSttConfig: (config: EchogardenSttConfigType) =>
          handleSetEchogardenSttConfig(config),
        sttEngine,
        setSttEngine: (name: SttEngineOptionEnum) => handleSetSttEngine(name),
        ttsConfig,
        setTtsConfig: (config: TtsConfigType) => handleSetTtsConfig(config),
        gptProviders,
        ttsProviders,
      }}
    >
      {children}
    </AISettingsProviderContext.Provider>
  );
};
