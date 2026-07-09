import { t } from "i18next";
import {
  Button,
  toast,
  Form,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
} from "@renderer/components/ui";
import {
  AISettingsProviderContext,
  AppSettingsProviderContext,
} from "@renderer/context";
import { useContext, useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TTSForm } from "@renderer/components";
import { UserSettingKeyEnum } from "@/types/enums";

const ttsConfigSchema = z.object({
  config: z.object({
    tts: z.object({
      engine: z.string().min(1),
      model: z.string().min(1),
      language: z.string().min(1),
      voice: z.string().min(1),
    }),
  }),
});

export const TtsSettings = () => {
  const [editing, setEditing] = useState(false);
  const { ttsConfig, setTtsConfig } = useContext(AISettingsProviderContext);
  const form = useForm<z.infer<typeof ttsConfigSchema>>({
    resolver: zodResolver(ttsConfigSchema),
    values: {
      config: {
        tts: ttsConfig,
      },
    },
  });

  const onSubmit = (data: z.infer<typeof ttsConfigSchema>) => {
    setTtsConfig(data.config.tts as TtsConfigType)
      .then(() => toast.success(t("saved")))
      .finally(() => setEditing(false));
  };

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex items-start justify-between py-4">
            <div className="">
              <div className="flex items-center mb-2">
                <span>{t("ttsService")}</span>
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                {form.watch("config.tts.engine") === "openai"
                  ? t("openaiTtsServiceDescription")
                  : t("enjoyTtsServiceDescription")}
              </div>
              <div
                className={`text-sm text-muted-foreground space-y-3 px-1 ${
                  editing ? "" : "hidden"
                }`}
              >
                <TTSForm form={form} />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={editing ? "outline" : "secondary"}
                size="sm"
                type="reset"
                onClick={(event) => {
                  event.preventDefault();
                  form.reset();
                  setEditing(!editing);
                }}
              >
                {editing ? t("cancel") : t("edit")}
              </Button>
              <Button
                className={editing ? "" : "hidden"}
                size="sm"
                type="submit"
              >
                {t("save")}
              </Button>
            </div>
          </div>
        </form>
      </Form>
      <ReferenceTtsSettings />
    </div>
  );
};

const DEFAULT_REFERENCE_TTS_CONFIG: ReferenceTtsConfigType = {
  provider: "kokoro",
  model: "kokoro-q8",
  voice: "af_heart",
  speed: 1,
};

const REFERENCE_TTS_VOICES = [
  "af_heart",
  "af_bella",
  "af_nicole",
  "af_sarah",
  "am_michael",
  "am_puck",
  "bf_emma",
  "bm_george",
];

const ReferenceTtsSettings = () => {
  const { EnjoyApp } = useContext(AppSettingsProviderContext);
  const [config, setConfig] = useState<ReferenceTtsConfigType>(
    DEFAULT_REFERENCE_TTS_CONFIG
  );
  const [status, setStatus] = useState<ReferenceTtsStatusType | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);

  const refreshStatus = () => {
    EnjoyApp.referenceTts
      .status()
      .then(setStatus)
      .catch((err) => toast.error(err.message));
  };

  useEffect(() => {
    EnjoyApp.userSettings
      .get(UserSettingKeyEnum.REFERENCE_TTS)
      .then((storedConfig) => {
        setConfig({
          ...DEFAULT_REFERENCE_TTS_CONFIG,
          ...(storedConfig || {}),
        });
      });
    refreshStatus();
  }, []);

  const saveConfig = async (nextConfig: ReferenceTtsConfigType) => {
    setConfig(nextConfig);
    setSaving(true);
    try {
      await EnjoyApp.userSettings.set(
        UserSettingKeyEnum.REFERENCE_TTS,
        nextConfig
      );
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    setDownloading(true);
    const downloadPromise = EnjoyApp.referenceTts
      .downloadModel()
      .then(setStatus)
      .finally(() => setDownloading(false));

    toast.promise(downloadPromise, {
      loading: t("referenceTtsDownloadingModel"),
      success: t("referenceTtsModelReady"),
      error: (err) => err.message || t("downloadFailed"),
      position: "bottom-right",
    });
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const paths = await EnjoyApp.dialog.showOpenDialog({
        properties: ["openDirectory"],
      });
      if (!paths?.[0]) return;
      const nextStatus = await EnjoyApp.referenceTts.importModel(paths[0]);
      setStatus(nextStatus);
      toast.success(t("referenceTtsModelReady"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  const installed = status?.installed;

  return (
    <div className="flex items-start justify-between py-4 border-t">
      <div className="max-w-[70%]">
        <div className="flex items-center mb-2">
          <span>{t("referenceTtsService")}</span>
        </div>
        <div className="text-sm text-muted-foreground mb-3">
          {t("referenceTtsServiceDescription")}
        </div>
        <div className="text-sm text-muted-foreground space-y-3 px-1">
          <div className="flex items-center gap-2">
            <span className="min-w-24">{t("status")}</span>
            <span>{installed ? t("ready") : t("notReady")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="min-w-24">{t("model")}</span>
            <span>Kokoro ONNX q8</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="min-w-24">{t("provider")}</span>
            <Select
              value={config.provider}
              onValueChange={(provider: ReferenceTtsProviderType) =>
                saveConfig({
                  ...config,
                  provider,
                })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kokoro">Kokoro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="min-w-24">{t("voice")}</span>
            <Select
              value={config.voice}
              onValueChange={(voice) =>
                saveConfig({
                  ...config,
                  voice,
                })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFERENCE_TTS_VOICES.map((voice) => (
                  <SelectItem key={voice} value={voice}>
                    {voice}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="min-w-24">{t("speed")}</span>
            <Input
              className="w-24"
              min={0.7}
              max={1.3}
              step={0.05}
              type="number"
              value={config.speed}
              onChange={(event) =>
                saveConfig({
                  ...config,
                  speed: Number(event.target.value) || 1,
                })
              }
            />
          </div>
          {status?.error ? (
            <div className="text-destructive">{status.error}</div>
          ) : null}
          <div className="text-xs text-muted-foreground break-all">
            {status?.modelDir}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={saving || downloading}
          onClick={handleDownload}
        >
          {downloading ? t("downloading") : t("download")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={importing}
          onClick={handleImport}
        >
          {t("import")}
        </Button>
      </div>
    </div>
  );
};
