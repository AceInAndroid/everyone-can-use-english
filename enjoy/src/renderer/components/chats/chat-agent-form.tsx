import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Avatar,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@renderer/components/ui";
import i18next, { t } from "i18next";
import { TTSForm } from "@renderer/components";
import {
  AISettingsProviderContext,
  AppSettingsProviderContext,
} from "@renderer/context";
import { useContext, useEffect, useMemo, useState } from "react";
import { ChatAgentTypeEnum } from "@/types/enums";
import {
  CHAT_AGENT_TEMPLATES,
  getChatAgentPresetSource,
  getChatAgentTemplateKeyFromSource,
  localizeChatAgentTemplates,
} from "@/constants";
import { cn } from "@/renderer/lib/utils";
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";

const selectedTemplateFromAgent = (agent?: ChatAgentType) => {
  const templateKey = getChatAgentTemplateKeyFromSource(agent?.source);
  return templateKey &&
    CHAT_AGENT_TEMPLATES.some((template) => template.key === templateKey)
    ? templateKey
    : "custom";
};

export const ChatAgentForm = (props: {
  agent?: ChatAgentType;
  onFinish: () => void;
}) => {
  const { agent, onFinish } = props;
  const { EnjoyApp } = useContext(AppSettingsProviderContext);
  const { ttsConfig } = useContext(AISettingsProviderContext);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(() =>
    selectedTemplateFromAgent(agent)
  );
  const [locale, setLocale] = useState(i18next.language);
  const [templateSelectionChanged, setTemplateSelectionChanged] =
    useState(false);
  const localizedTemplates = useMemo(
    () => localizeChatAgentTemplates(locale),
    [locale]
  );

  const agentFormSchema = z.object({
    type: z.enum([ChatAgentTypeEnum.GPT, ChatAgentTypeEnum.TTS]),
    name: z.string().min(1),
    description: z.string().optional(),
    config: z.object({
      prompt: z.string().optional(),
      tts: z
        .object({
          engine: z.string().optional(),
          model: z.string().optional(),
          language: z.string().optional(),
          voice: z.string().optional(),
        })
        .optional(),
    }),
  });
  const defaultConfig = () => ({
    prompt: "",
    tts: {},
  });

  const form = useForm<z.infer<typeof agentFormSchema>>({
    resolver: zodResolver(agentFormSchema),
    values: agent
      ? {
          type: agent.type,
          name: agent.name,
          description: agent.description,
          config: {
            ...defaultConfig(),
            ...agent.config,
          },
        }
      : {
          type: ChatAgentTypeEnum.GPT,
          name: "",
          description: "",
          config: defaultConfig(),
        },
  });

  const onSubmit = form.handleSubmit((data) => {
    const { type, name, description, config } = data;
    const selectedPresetKey =
      type === ChatAgentTypeEnum.GPT &&
      CHAT_AGENT_TEMPLATES.some(
        (template) => template.key === selectedTemplate
      )
        ? selectedTemplate
        : null;
    const existingPresetKey = getChatAgentTemplateKeyFromSource(agent?.source);
    const selectedPresetTemplate = selectedPresetKey
      ? localizedTemplates.find((template) => template.key === selectedPresetKey)
      : null;
    const selectedPresetContentMatches =
      Boolean(selectedPresetTemplate) &&
      name === selectedPresetTemplate?.name &&
      (description || "") === (selectedPresetTemplate?.description || "") &&
      (config.prompt || "") === (selectedPresetTemplate?.prompt || "");
    const shouldKeepPresetSource =
      Boolean(selectedPresetKey) && selectedPresetContentMatches;
    const shouldClearPresetSource =
      Boolean(agent && existingPresetKey) &&
      (!shouldKeepPresetSource || type !== ChatAgentTypeEnum.GPT);
    const source = shouldKeepPresetSource
      ? getChatAgentPresetSource(selectedPresetKey)
      : shouldClearPresetSource
        ? null
        : agent?.source || null;

    if (type === ChatAgentTypeEnum.TTS) {
      config.tts = {
        engine: config.tts?.engine || ttsConfig.engine,
        model: config.tts?.model || ttsConfig.model,
        language: config.tts?.language || ttsConfig.language,
        voice: config.tts?.voice || ttsConfig.voice,
      };
    }

    if (agent?.id) {
      EnjoyApp.chatAgents
        .update(agent.id, {
          type,
          name,
          description,
          source,
          config,
        })
        .then(() => {
          toast.success(t("models.chatAgent.updated"));
          form.reset();
          onFinish();
        })
        .catch((error) => {
          toast.error(error.message);
        });
    } else {
      EnjoyApp.chatAgents
        .create({
          type,
          name,
          description,
          ...(source ? { source } : {}),
          config,
        })
        .then(() => {
          toast.success(t("models.chatAgent.created"));
          form.reset();
          onFinish();
        })
        .catch((error) => {
          toast.error(error.message);
        });
    }
  });

  const TEMPLATES = [
    {
      key: "custom",
      name: t("custom"),
      description: "",
      prompt: "",
    },
    {
      key: "default",
      name: t("models.chatAgent.namePlaceholder"),
      description: t("models.chatAgent.descriptionPlaceholder"),
      prompt: t("models.chatAgent.promptPlaceholder"),
    },
    ...localizedTemplates,
  ];

  const applyTemplate = () => {
    if (form.watch("type") !== ChatAgentTypeEnum.GPT) {
      form.setValue("name", "");
      form.setValue("config.prompt", "");
    } else {
      const template = TEMPLATES.find((p) => p.key === selectedTemplate);
      if (!template) return;

      if (selectedTemplate === "custom") {
        if (!agent) {
          form.setValue("name", "");
          form.setValue("description", "");
          form.setValue("config.prompt", "");
        }
        return;
      } else {
        form.setValue("name", template.name || "");
        form.setValue("description", template.description || "");
      }
      form.setValue("config.prompt", template.prompt || "");
    }
  };

  useEffect(() => {
    const onLanguageChanged = (language: string) => {
      setLocale(language);
    };

    i18next.on("languageChanged", onLanguageChanged);
    return () => {
      i18next.off("languageChanged", onLanguageChanged);
    };
  }, []);

  useEffect(() => {
    setSelectedTemplate(selectedTemplateFromAgent(agent));
    setTemplateSelectionChanged(false);
  }, [agent?.id, agent?.source]);

  useEffect(() => {
    if (agent && !templateSelectionChanged) return;

    applyTemplate();
  }, [selectedTemplate, form.watch("type")]);

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <div className="mb-4">{agent?.id ? t("editAgent") : t("newAgent")}</div>
        <div className="space-y-2 px-2 mb-6">
          {form.watch("name") && (
            <Avatar className="w-12 h-12 border">
              <img
                src={
                  agent?.avatarUrl ||
                  `https://api.dicebear.com/9.x/shapes/svg?seed=${form.watch(
                    "name"
                  )}`
                }
                alt={form.watch("name")}
              />
            </Avatar>
          )}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("models.chatAgent.type")}</FormLabel>
                <Select
                  required
                  onValueChange={field.onChange}
                  value={field.value as string}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("models.chatAgent.type")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={ChatAgentTypeEnum.GPT}>
                      {ChatAgentTypeEnum.GPT}
                    </SelectItem>
                    <SelectItem value={ChatAgentTypeEnum.TTS}>
                      {ChatAgentTypeEnum.TTS}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {form.watch("type") === ChatAgentTypeEnum.GPT && (
                  <FormDescription>
                    {t("models.chatAgent.typeGptDescription")}
                  </FormDescription>
                )}
                {form.watch("type") === ChatAgentTypeEnum.TTS && (
                  <FormDescription>
                    {t("models.chatAgent.typeTtsDescription")}
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch("type") === ChatAgentTypeEnum.GPT && (
            <FormItem className="flex flex-col">
              <FormLabel className="capitalize">{t("templates")}</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      !selectedTemplate && "text-muted-foreground"
                    )}
                  >
                    {selectedTemplate
                      ? TEMPLATES.find(
                          (template) => template.key === selectedTemplate
                        )?.name
                      : t("templates")}
                    <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popper-anchor-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder={t("templates")}
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>{t("noTemplatesFound")}</CommandEmpty>
                      <CommandGroup>
                        {TEMPLATES.map((template) => (
                          <CommandItem
                            key={template.key}
                            value={[
                              template.key,
                              template.name,
                              template.description,
                            ].join(" ")}
                            onSelect={() => {
                              setTemplateSelectionChanged(true);
                              setSelectedTemplate(template.key);
                            }}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{template.name}</span>
                              {template.description && (
                                <span className="text-xs text-muted-foreground line-clamp-2">
                                  {template.description}
                                </span>
                              )}
                            </div>
                            <CheckIcon
                              className={cn(
                                "ml-auto h-4 w-4",
                                template.key === selectedTemplate
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FormItem>
          )}

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("models.chatAgent.name")}</FormLabel>
                <Input
                  placeholder={t("models.chatAgent.namePlaceholder")}
                  required
                  {...field}
                />
                <FormDescription>
                  {t("models.chatAgent.nameDescription")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("models.chatAgent.description")}</FormLabel>
                <Textarea
                  placeholder={t("models.chatAgent.descriptionPlaceholder")}
                  required
                  className="max-h-36"
                  {...field}
                />
                <FormDescription>
                  {t("models.chatAgent.descriptionDescription")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch("type") === ChatAgentTypeEnum.GPT && (
            <FormField
              control={form.control}
              name="config.prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("models.chatAgent.prompt")}</FormLabel>
                  <Textarea
                    placeholder={t("models.chatAgent.promptPlaceholder")}
                    required
                    className="min-h-36 max-h-64"
                    {...field}
                  />
                  <FormDescription>
                    {t("models.chatAgent.promptDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {form.watch("type") === ChatAgentTypeEnum.TTS && (
            <TTSForm form={form} />
          )}
        </div>
        <div className="flex items-center justify-end space-x-4">
          <Button type="button" variant="ghost" onClick={onFinish}>
            {t("cancel")}
          </Button>
          <Button type="submit" onClick={onSubmit}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Form>
  );
};
