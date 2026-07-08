import axios, { AxiosInstance } from "axios";
import decamelizeKeys from "decamelize-keys";
import camelcaseKeys from "camelcase-keys";

const ONE_MINUTE = 1000 * 60; // 1 minute
const LOCAL_MODE_SKIPPED = { skipped: true, reason: "local-mode" } as const;

export class Client {
  public api: AxiosInstance;
  public baseUrl: string;
  public logger: any;

  constructor(options: {
    baseUrl: string;
    logger?: any;
    locale?: "en" | "zh-CN";
    onError?: (err: any) => void;
    onSuccess?: (res: any) => void;
  }) {
    const {
      baseUrl,
      logger,
      locale = "en",
      onError,
      onSuccess,
    } = options;
    this.baseUrl = baseUrl;
    this.logger = logger || console;

    this.api = axios.create({
      baseURL: baseUrl,
      timeout: ONE_MINUTE,
      headers: {
        "Content-Type": "application/json",
      },
    });
    this.api.interceptors.request.use((config) => {
      config.headers["Accept-Language"] = locale;

      this.logger.debug(
        config.method.toUpperCase(),
        config.baseURL + config.url,
        config.data,
        config.params
      );
      return config;
    });
    this.api.interceptors.response.use(
      (response) => {
        if (onSuccess) {
          onSuccess(response);
        }

        this.logger.debug(
          response.status,
          response.config.method.toUpperCase(),
          response.config.baseURL + response.config.url
        );
        return camelcaseKeys(response.data, { deep: true });
      },
      (err) => {
        if (onError) {
          onError(err);
        }

        if (err.response) {
          this.logger.error(
            err.response.status,
            err.response.config.method.toUpperCase(),
            err.response.config.baseURL + err.response.config.url
            // err.response.data
          );

          if (err.response.data) {
            if (typeof err.response.data === "string") {
              err.message = err.response.data;
            } else if (typeof err.response.data === "object") {
              err.message =
                err.response.data.error ||
                err.response.data.message ||
                JSON.stringify(err.response.data);
            }
          }
          return Promise.reject(err);
        }

        return Promise.reject(err);
      }
    );
  }

  up() {
    return this.api.get("/up");
  }

  config(key: string): Promise<any> {
    return this.api.get(`/api/config/${key}`);
  }

  private skipAuthenticatedWrite() {
    this.logger.debug("skip authenticated API write in local mode");
    return Promise.resolve(LOCAL_MODE_SKIPPED);
  }

  syncAudio(audio: Partial<AudioType>) {
    return this.skipAuthenticatedWrite();
  }

  deleteAudio(id: string) {
    return this.skipAuthenticatedWrite();
  }

  syncVideo(video: Partial<VideoType>) {
    return this.skipAuthenticatedWrite();
  }

  deleteVideo(id: string) {
    return this.skipAuthenticatedWrite();
  }

  syncTranscription(transcription: Partial<TranscriptionType>) {
    return this.skipAuthenticatedWrite();
  }

  syncSegment(
    segment: Partial<Omit<SegmentType, "audio" | "video" | "target">>
  ) {
    return this.skipAuthenticatedWrite();
  }

  syncNote(note: Partial<Omit<NoteType, "segment">>) {
    return this.skipAuthenticatedWrite();
  }

  deleteNote(id: string) {
    return this.skipAuthenticatedWrite();
  }

  syncRecording(recording: Partial<RecordingType>) {
    return this.skipAuthenticatedWrite();
  }

  deleteRecording(id: string) {
    return this.skipAuthenticatedWrite();
  }

  syncPronunciationAssessment(
    pronunciationAssessment: Partial<PronunciationAssessmentType>
  ) {
    return this.skipAuthenticatedWrite();
  }

  lookup(params: {
    word: string;
    context: string;
    sourceId?: string;
    sourceType?: string;
    nativeLanguage?: string;
  }): Promise<LookupType> {
    return this.api.post("/api/lookups", decamelizeKeys(params));
  }

  updateLookup(
    id: string,
    params: {
      meaning: Partial<MeaningType>;
      sourceId?: string;
      sourceType?: string;
    }
  ): Promise<LookupType> {
    return this.api.put(`/api/lookups/${id}`, decamelizeKeys(params));
  }

  lookupInBatch(
    lookups: {
      word: string;
      context: string;
      sourceId?: string;
      sourceType?: string;
    }[]
  ): Promise<{ successCount: number; errors: string[]; total: number }> {
    return this.api.post("/api/lookups/batch", {
      lookups: decamelizeKeys(lookups, { deep: true }),
    });
  }

  mineMeanings(params?: {
    page?: number;
    items?: number;
    sourceId?: string;
    sourceType?: string;
    status?: string;
  }): Promise<
    {
      meanings: MeaningType[];
    } & PagyResponseType
  > {
    return this.api.get("/api/mine/meanings", {
      params: decamelizeKeys(params),
    });
  }

  segments(params?: {
    page?: number;
    segmentIndex?: number;
    targetId?: string;
    targetType?: string;
  }): Promise<
    {
      segments: SegmentType[];
    } & PagyResponseType
  > {
    return this.api.get("/api/segments", {
      params: decamelizeKeys(params),
    });
  }

  createLlmChat(params: {
    agentId: string;
    agentType: string;
  }): Promise<LLmChatType> {
    return this.api.post("/api/chats", decamelizeKeys(params));
  }

  llmChat(id: string): Promise<LLmChatType> {
    return this.api.get(`/api/chats/${id}`);
  }

  createLlmMessage(
    chatId: string,
    params: {
      query: string;
      agentId?: string;
      agentType?: string;
    }
  ): Promise<LlmMessageType> {
    return this.api.post(
      `/api/chats/${chatId}/messages`,
      decamelizeKeys(params)
    );
  }

  llmMessages(
    chatId: string,
    params: {
      page?: number;
      items?: number;
    }
  ): Promise<
    {
      messages: LlmMessageType[];
    } & PagyResponseType
  > {
    return this.api.get(`/api/chats/${chatId}/messages`, {
      params: decamelizeKeys(params),
    });
  }

  syncDocument(document: Partial<DocumentEType>) {
    return this.skipAuthenticatedWrite();
  }

  deleteDocument(id: string) {
    return this.skipAuthenticatedWrite();
  }

  translations(params?: {
    md5?: string;
    translatedLanguage?: string;
    engine?: string;
  }): Promise<
    {
      translations: TranslationType[];
    } & PagyResponseType
  > {
    return this.api.get("/api/translations", {
      params: decamelizeKeys(params),
    });
  }

  createTranslation(params: {
    md5: string;
    content: string;
    translatedContent: string;
    language: string;
    translatedLanguage: string;
    engine: string;
  }): Promise<TranslationType> {
    return this.api.post("/api/translations", decamelizeKeys(params));
  }
}
