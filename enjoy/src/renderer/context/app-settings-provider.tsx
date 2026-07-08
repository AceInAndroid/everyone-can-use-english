import { createContext, useContext, useEffect, useState } from "react";
import { WEB_API_URL, LANGUAGES, IPA_MAPPINGS } from "@/constants";
import { Client } from "@/api";
import i18n from "@renderer/i18n";
import ahoy from "ahoy.js";
import { DbProviderContext } from "@renderer/context";
import { UserSettingKeyEnum } from "@/types/enums";

type AppSettingsProviderState = {
  webApi: Client;
  apiUrl?: string;
  setApiUrl?: (url: string) => Promise<void>;
  user: UserType | null;
  initialized: boolean;
  version?: string;
  libraryPath?: string;
  setLibraryPath?: (path: string) => Promise<void>;
  EnjoyApp: EnjoyAppType;
  language?: "en" | "zh-CN";
  switchLanguage?: (language: "en" | "zh-CN") => void;
  nativeLanguage?: string;
  switchNativeLanguage?: (lang: string) => void;
  learningLanguage?: string;
  switchLearningLanguage?: (lang: string) => void;
  proxy?: ProxyConfigType;
  setProxy?: (config: ProxyConfigType) => Promise<void>;
  vocabularyConfig?: VocabularyConfigType;
  setVocabularyConfig?: (config: VocabularyConfigType) => Promise<void>;
  ahoy?: typeof ahoy;
  recorderConfig?: RecorderConfigType;
  setRecorderConfig?: (config: RecorderConfigType) => Promise<void>;
  ipaMappings?: { [key: string]: string };
  displayPreferences?: boolean;
  setDisplayPreferences?: (display: boolean) => void;
};

const EnjoyApp = window.__ENJOY_APP__;

const initialState: AppSettingsProviderState = {
  webApi: null,
  user: null,
  initialized: false,
  EnjoyApp: EnjoyApp,
};

export const AppSettingsProviderContext =
  createContext<AppSettingsProviderState>(initialState);

export const AppSettingsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [version, setVersion] = useState<string>("");
  const [apiUrl, setApiUrl] = useState<string>(WEB_API_URL);
  const [webApi, setWebApi] = useState<Client>(null);
  const [user, setUser] = useState<UserType | null>(null);
  const [libraryPath, setLibraryPath] = useState("");
  const [language, setLanguage] = useState<"en" | "zh-CN">();
  const [nativeLanguage, setNativeLanguage] = useState<string>("zh-CN");
  const [learningLanguage, setLearningLanguage] = useState<string>("en-US");
  const [vocabularyConfig, setVocabularyConfig] =
    useState<VocabularyConfigType>(null);
  const [proxy, setProxy] = useState<ProxyConfigType>();
  const [recorderConfig, setRecorderConfig] = useState<RecorderConfigType>();
  const [ipaMappings] = useState<{ [key: string]: string }>(IPA_MAPPINGS);
  const [displayPreferences, setDisplayPreferences] = useState<boolean>(false);

  const db = useContext(DbProviderContext);

  const fetchLanguages = async () => {
    const language = await EnjoyApp.userSettings.get(
      UserSettingKeyEnum.LANGUAGE
    );
    setLanguage((language as "en" | "zh-CN") || "en");
    i18n.changeLanguage(language);

    const _nativeLanguage =
      (await EnjoyApp.userSettings.get(UserSettingKeyEnum.NATIVE_LANGUAGE)) ||
      "zh-CN";
    setNativeLanguage(_nativeLanguage);

    const _learningLanguage =
      (await EnjoyApp.userSettings.get(UserSettingKeyEnum.LEARNING_LANGUAGE)) ||
      "en-US";
    setLearningLanguage(_learningLanguage);
  };

  const switchLanguage = (language: "en" | "zh-CN") => {
    EnjoyApp.userSettings
      .set(UserSettingKeyEnum.LANGUAGE, language)
      .then(() => {
        i18n.changeLanguage(language);
        setLanguage(language);
      });
  };

  const switchNativeLanguage = (lang: string) => {
    if (LANGUAGES.findIndex((l) => l.code == lang) < 0) return;
    if (lang == learningLanguage) return;

    setNativeLanguage(lang);
    EnjoyApp.userSettings.set(UserSettingKeyEnum.NATIVE_LANGUAGE, lang);
  };

  const switchLearningLanguage = (lang: string) => {
    if (LANGUAGES.findIndex((l) => l.code == lang) < 0) return;
    if (lang == nativeLanguage) return;

    EnjoyApp.userSettings.set(UserSettingKeyEnum.LEARNING_LANGUAGE, lang);
    setLearningLanguage(lang);
  };

  const fetchVersion = async () => {
    const version = EnjoyApp.app.version;
    setVersion(version);
  };

  const fetchApiUrl = async () => {
    const apiUrl = await EnjoyApp.app.apiUrl();
    setApiUrl(apiUrl);
  };

  const loadLocalUser = async () => {
    const currentUser = await EnjoyApp.appSettings.getUser();
    if (!currentUser) return;

    const localUser = {
      id: currentUser.id,
      name: currentUser.name || "Local User",
    };
    setUser(localUser);
    await EnjoyApp.appSettings.setUser(localUser);
  };

  const fetchLibraryPath = async () => {
    const dir = await EnjoyApp.appSettings.getLibrary();
    setLibraryPath(dir);
  };

  const setLibraryPathHandler = async (dir: string) => {
    await EnjoyApp.appSettings.setLibrary(dir);
    setLibraryPath(dir);
  };

  const fetchProxyConfig = async () => {
    const config = await EnjoyApp.system.proxy.get();
    setProxy(config);
    EnjoyApp.system.proxy.refresh();
  };

  const setProxyConfigHandler = async (config: ProxyConfigType) => {
    EnjoyApp.system.proxy.set(config).then(() => {
      setProxy(config);
      EnjoyApp.system.proxy.refresh();
    });
  };

  const setApiUrlHandler = async (url: string) => {
    EnjoyApp.appSettings.setApiUrl(url).then(() => {
      EnjoyApp.app.reload();
    });
  };

  const fetchRecorderConfig = async () => {
    const config = await EnjoyApp.userSettings.get(UserSettingKeyEnum.RECORDER);
    if (config) {
      setRecorderConfig(config);
    } else {
      const defaultConfig: RecorderConfigType = {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
        sampleSize: 16,
      };
      setRecorderConfigHandler(defaultConfig);
    }
  };

  const setRecorderConfigHandler = async (config: RecorderConfigType) => {
    return EnjoyApp.userSettings
      .set(UserSettingKeyEnum.RECORDER, config)
      .then(() => {
        setRecorderConfig(config);
      });
  };

  const fetchVocabularyConfig = async () => {
    EnjoyApp.userSettings
      .get(UserSettingKeyEnum.VOCABULARY)
      .then((config) => {
        setVocabularyConfig(config || { lookupOnMouseOver: true });
      })
      .catch((err) => {
        console.error(err);
        setVocabularyConfig({ lookupOnMouseOver: true });
      });
  };

  const setVocabularyConfigHandler = async (config: VocabularyConfigType) => {
    await EnjoyApp.userSettings.set(UserSettingKeyEnum.VOCABULARY, config);
    setVocabularyConfig(config);
  };

  useEffect(() => {
    if (db.state === "connected") {
      fetchLanguages();
      fetchVocabularyConfig();
      fetchRecorderConfig();
    }
  }, [db.state]);

  useEffect(() => {
    loadLocalUser();
    fetchVersion();
    fetchLibraryPath();
    fetchProxyConfig();
    fetchApiUrl();
  }, []);

  useEffect(() => {
    if (!apiUrl) return;

    setWebApi(
      new Client({
        baseUrl: apiUrl,
        locale: language,
      })
    );
  }, [apiUrl, language]);

  useEffect(() => {
    if (!apiUrl) return;

    ahoy.configure({
      urlPrefix: apiUrl,
    });
  }, [apiUrl]);

  useEffect(() => {
    if (!user) return;

    db.connect();
    return () => {
      db.disconnect();
    };
  }, [user?.id]);

  return (
    <AppSettingsProviderContext.Provider
      value={{
        language,
        switchLanguage,
        nativeLanguage,
        switchNativeLanguage,
        learningLanguage,
        switchLearningLanguage,
        EnjoyApp,
        version,
        webApi,
        apiUrl,
        setApiUrl: setApiUrlHandler,
        user,
        libraryPath,
        setLibraryPath: setLibraryPathHandler,
        proxy,
        setProxy: setProxyConfigHandler,
        vocabularyConfig,
        setVocabularyConfig: setVocabularyConfigHandler,
        initialized: Boolean(db.state === "connected" && libraryPath),
        ahoy,
        recorderConfig,
        setRecorderConfig: setRecorderConfigHandler,
        ipaMappings,
        displayPreferences,
        setDisplayPreferences,
      }}
    >
      {children}
    </AppSettingsProviderContext.Provider>
  );
};
