import {
  AISettingsProviderContext,
  AppSettingsProviderContext,
} from "@renderer/context";
import { zodResolver } from "@hookform/resolvers/zod";
import { useContext, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  PingPoint,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  toast,
} from "@renderer/components/ui";
import { t } from "i18next";
import { LANGUAGES } from "@/constants";
import { ChevronDownIcon, ChevronUpIcon, LoaderIcon } from "lucide-react";
import { SttEngineOptionEnum } from "@/types/enums";
import {
  getSubtitleEnglishPreference,
  normalizeSubtitleText,
  SubtitleFileType,
} from "@renderer/lib/subtitles";

const transcriptionSchema = z.object({
  language: z.string(),
  service: z.union([z.nativeEnum(SttEngineOptionEnum), z.literal("upload")]),
  text: z.string().optional(),
  isolate: z.boolean().optional(),
  sourceMeta: z.any().optional(),
  normalization: z.any().optional(),
});

export const TranscriptionCreateForm = (props: {
  onSubmit: (data: z.infer<typeof transcriptionSchema>) => void;
  media?: AudioType | VideoType;
  originalText?: string;
  sourceMeta?: TranscriptionSourceMetaType;
  normalization?: TranscriptionNormalizationType;
  onCancel?: () => void;
  transcribing: boolean;
  transcribingProgress: number;
  transcribingOutput: string;
}) => {
  const {
    transcribing = false,
    transcribingProgress = 0,
    transcribingOutput,
    onSubmit,
    onCancel,
    media,
    originalText,
    sourceMeta: initialSourceMeta,
    normalization: initialNormalization,
  } = props;
  const { EnjoyApp, learningLanguage } = useContext(AppSettingsProviderContext);
  const { sttEngine, echogardenSttConfig } = useContext(
    AISettingsProviderContext
  );
  const subtitleTracks: VideoSubtitleTrackType[] =
    media?.mediaType === "Video"
      ? ((media as VideoType).metadata?.subtitleTracks || [])
      : [];
  const usableSubtitleTracks = subtitleTracks.filter(
    (track): track is VideoSubtitleTrackType & { sidecarPath: string } =>
      Boolean(track.sidecarPath)
  );
  const preferredSubtitleTrack =
    usableSubtitleTracks.find((track) => track.language?.startsWith("en")) ||
    usableSubtitleTracks.find((track) => track.dispositionDefault) ||
    usableSubtitleTracks[0];

  const form = useForm<z.infer<typeof transcriptionSchema>>({
    resolver: zodResolver(transcriptionSchema),
    defaultValues: {
      language: learningLanguage,
      service: originalText || preferredSubtitleTrack ? "upload" : sttEngine,
      text: originalText || "",
      isolate: false,
    },
  });
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const [loadedEmbeddedTrackKey, setLoadedEmbeddedTrackKey] = useState("");
  const [sourceMeta, setSourceMeta] =
    useState<TranscriptionSourceMetaType>(initialSourceMeta);
  const [normalization, setNormalization] =
    useState<TranscriptionNormalizationType>(initialNormalization);

  const handleSubmit = (data: z.infer<typeof transcriptionSchema>) => {
    const { service, text } = data;

    if (service === "upload" && !text) {
      toast.error(t("pleaseUploadTranscriptFile"));
      return;
    }

    onSubmit({
      ...data,
      sourceMeta:
        service === "upload"
          ? sourceMeta || {
              kind: text?.includes("-->")
                ? "uploaded-subtitle"
                : "pasted-transcript",
            }
          : undefined,
      normalization: service === "upload" ? normalization : undefined,
    });
  };

  const trackKey = (track: VideoSubtitleTrackType) => {
    return `${track.index}:${track.sidecarPath || ""}`;
  };

  const loadEmbeddedSubtitle = async (track: VideoSubtitleTrackType) => {
    if (!track.sidecarPath) {
      throw new Error("Subtitle sidecar missing. Please re-import the video.");
    }

    const result = await EnjoyApp.ffmpeg.readSubtitleSidecar({
      sidecarPath: track.sidecarPath,
      format: track.format || "srt",
    });
    const normalized = await normalizeSubtitleText(result.text, {
      type: result.format,
    });

    form.setValue("service", "upload");
    form.setValue("text", normalized.text);
    setLoadedEmbeddedTrackKey(trackKey(track));
    setSourceMeta({
      kind: "embedded-subtitle",
      subtitleTrackIndex: track.index,
      subtitleLanguage: track.language,
      subtitleTitle: track.title,
      subtitleCodec: track.codecName,
      sourceFileName: (media as VideoType).filename,
    });
    setNormalization(normalized.normalization);
  };

  const selectPreferredSubtitleTrack = async () => {
    if (usableSubtitleTracks.length === 0) return undefined;

    const scoredTracks = await Promise.all(
      usableSubtitleTracks.map(async (track) => {
        try {
          const result = await EnjoyApp.ffmpeg.readSubtitleSidecar({
            sidecarPath: track.sidecarPath,
            format: track.format || "srt",
          });
          const preference = getSubtitleEnglishPreference(result.text);
          const languageBonus = track.language?.startsWith("en") ? 500 : 0;
          const defaultBonus = track.dispositionDefault ? 50 : 0;

          return {
            track,
            score: preference.score + languageBonus + defaultBonus,
          };
        } catch {
          return {
            track,
            score: Number.NEGATIVE_INFINITY,
          };
        }
      })
    );

    return scoredTracks.sort((a, b) => b.score - a.score)[0]?.track;
  };

  useEffect(() => {
    if (!preferredSubtitleTrack) return;
    if (originalText) return;
    if (loadedEmbeddedTrackKey) return;

    selectPreferredSubtitleTrack()
      .then((track) => {
        return loadEmbeddedSubtitle(track || preferredSubtitleTrack);
      })
      .catch((error) => {
        toast.error(error.message);
      });
  }, [preferredSubtitleTrack?.index, preferredSubtitleTrack?.sidecarPath]);

  const parseSubtitle = (file: File) => {
    const fileType = file.name.split(".").pop();
    return new Promise<{
      text: string;
      sourceMeta: TranscriptionSourceMetaType;
      normalization: TranscriptionNormalizationType;
    }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          if (typeof text !== "string") {
            reject(new Error("Failed to read file"));
            return;
          }

          const normalized = await normalizeSubtitleText(text, {
            type: fileType as SubtitleFileType,
          });
          if (normalized.text.length === 0) {
            reject(new Error("No text found in the file"));
            return;
          }

          resolve({
            text: normalized.text,
            sourceMeta: {
              kind:
                fileType === "txt" ? "pasted-transcript" : "uploaded-subtitle",
              sourceFileName: file.name,
            },
            normalization: normalized.normalization,
          });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (e) => {
        reject(e);
      };

      reader.readAsText(file);
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="gap-4 grid w-full"
      >
        <FormField
          control={form.control}
          name="service"
          render={({ field }) => (
            <FormItem className="grid w-full items-center">
              <FormLabel>{t("sttAiService")}</FormLabel>
              <Select
                disabled={transcribing}
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SttEngineOptionEnum.LOCAL}>
                    {t("local")}
                  </SelectItem>
                  <SelectItem value={SttEngineOptionEnum.OPENAI}>
                    OpenAI
                  </SelectItem>
                  <SelectItem value="upload">{t("upload")}</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                {form.watch("service") === SttEngineOptionEnum.LOCAL &&
                  echogardenSttConfig && (
                    <>
                      <div>{t("localSpeechToTextDescription")}</div>
                      <div>
                        * {t("model")}: {echogardenSttConfig.engine} /{" "}
                        {
                          echogardenSttConfig[
                            echogardenSttConfig.engine?.replace(
                              ".cpp",
                              "Cpp"
                            ) as "whisper" | "whisperCpp"
                          ]?.model
                        }
                      </div>
                    </>
                  )}

                {form.watch("service") === SttEngineOptionEnum.OPENAI &&
                  t("openaiSpeechToTextDescription")}
                {form.watch("service") === "upload" &&
                  t("uploadSpeechToTextDescription")}
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem className="grid w-full items-center">
              <FormLabel>{t("language")}</FormLabel>
              <Select
                disabled={transcribing}
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {language.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.watch("service") === "upload" &&
          usableSubtitleTracks.length > 0 && (
          <FormItem className="grid w-full items-center">
            <FormLabel>{t("embeddedSubtitle")}</FormLabel>
            <Select
              disabled={transcribing}
              value={loadedEmbeddedTrackKey}
              onValueChange={(value) => {
                const track = usableSubtitleTracks.find(
                  (item) => trackKey(item) === value
                );
                if (!track) return;
                loadEmbeddedSubtitle(track).catch((error) => {
                  toast.error(error.message);
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectEmbeddedSubtitle")} />
              </SelectTrigger>
              <SelectContent>
                {usableSubtitleTracks.map((track) => (
                  <SelectItem key={trackKey(track)} value={trackKey(track)}>
                    {[
                      track.language || "und",
                      track.title,
                      track.codecName,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>{t("embeddedSubtitleDescription")}</FormDescription>
          </FormItem>
        )}
        {form.watch("service") === "upload" && (
          <>
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem className="grid w-full items-center">
                  {field.value != undefined && (
                    <>
                      <FormLabel>{t("transcript")}</FormLabel>
                      <Textarea
                        className="h-36"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          setSourceMeta({
                            kind: event.target.value.includes("-->")
                              ? "uploaded-subtitle"
                              : "pasted-transcript",
                          });
                          setNormalization(undefined);
                        }}
                        disabled={transcribing}
                      />
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
          <CollapsibleContent className="mb-4 space-y-4">
            {form.watch("service") === "upload" && (
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem className="grid w-full items-center">
                    <FormLabel>{t("uploadTranscriptFile")}</FormLabel>
                    <Input
                      disabled={transcribing}
	                      type="file"
                      accept=".txt,.srt,.vtt"
	                      onChange={async (event) => {
	                        const file = event.target.files[0];

	                        if (file) {
	                          parseSubtitle(file)
	                            .then((result) => {
	                              field.onChange(result.text);
	                              setSourceMeta(result.sourceMeta);
	                              setNormalization(result.normalization);
	                            })
                            .catch((error) => {
                              toast.error(error.message);
                            });
                        } else {
                          field.onChange("");
                        }
                      }}
                    />
                    <FormDescription>
                      {t("uploadTranscriptFileDescription")}
                    </FormDescription>
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="isolate"
              render={({ field }) => (
                <FormItem className="grid w-full items-center">
                  <FormLabel>{t("isolateVoice")}</FormLabel>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={transcribing}
                  />
                  <FormDescription>
                    {t("isolateVoiceDescription")}
                  </FormDescription>
                </FormItem>
              )}
            />
          </CollapsibleContent>
          <div className="flex justify-center">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {collapsibleOpen ? (
                  <>
                    <ChevronUpIcon className="h-4 w-4" />
                    <span className="ml-2">{t("lessOptions")}</span>
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="h-4 w-4" />
                    <span className="ml-2">{t("moreOptions")}</span>
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </Collapsible>

        <TranscribeProgress
          service={form.watch("service")}
          transcribing={transcribing}
          transcribingProgress={transcribingProgress}
          transcribingOutput={transcribingOutput}
        />

        <div className="flex justify-end space-x-4">
          {onCancel && !transcribing && (
            <Button type="reset" variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
          )}
          <Button
            data-testid="transcribe-continue-button"
            disabled={transcribing}
            type="submit"
            variant="default"
          >
            {transcribing && <LoaderIcon className="animate-spin w-4 mr-2" />}
            {t("continue")}
          </Button>
        </div>
      </form>
    </Form>
  );
};

const TranscribeProgress = (props: {
  service: string;
  transcribing: boolean;
  transcribingProgress: number;
  transcribingOutput?: string;
}) => {
  const { service, transcribing, transcribingProgress, transcribingOutput } =
    props;
  if (!transcribing) return null;

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center space-x-4 mb-2">
        <PingPoint colorClassName="bg-yellow-500" />
        <span>{t("transcribing")}</span>
      </div>
      {service === "local" && transcribingProgress > 0 && (
        <Progress value={transcribingProgress} />
      )}
      {transcribingOutput && (
        <div className="max-w-full rounded-lg border bg-zinc-950 p-3 dark:bg-zinc-900 h-20 overflow-y-auto">
          <code className="px-[0.3rem] py-[0.2rem] rounded text-muted-foreground font-mono text-xs break-words">
            {transcribingOutput}
          </code>
        </div>
      )}
    </div>
  );
};
