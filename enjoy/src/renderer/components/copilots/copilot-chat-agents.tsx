import { useContext, useEffect, useMemo, useState } from "react";
import { AppSettingsProviderContext, DbProviderContext } from "@renderer/context";
import i18next, { t } from "i18next";
import { useDebounce } from "@uidotdev/usehooks";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Input,
  toast,
} from "@renderer/components/ui";
import {
  chatAgentTemplateToDto,
  getChatAgentPresetSource,
  getChatAgentTemplateKeyFromSource,
  localizeChatAgentTemplates,
} from "@/constants";
import type { LocalizedChatAgentTemplate } from "@/constants";
import { ChatAgentTypeEnum } from "@/types/enums";

type AssistantAgentPickerRow =
  | {
      kind: "agent";
      id: string;
      agent: ChatAgentType;
      searchText: string;
      marker: "custom" | "preset-created";
    }
  | {
      kind: "preset";
      key: string;
      template: LocalizedChatAgentTemplate;
      displayName: string;
      displayDescription: string;
      searchText: string;
      marker: "preset";
    };

export const CopilotChatAgents = (props: {
  onSelect: (agent: ChatAgentType) => void;
}) => {
  const { onSelect } = props;
  const { EnjoyApp } = useContext(AppSettingsProviderContext);
  const { addDblistener, removeDbListener } = useContext(DbProviderContext);
  const [chatAgents, setChatAgents] = useState<ChatAgentType[]>([]);
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState(i18next.language);
  const [creatingPresetSources, setCreatingPresetSources] = useState<
    Set<string>
  >(() => new Set());
  const debouncedQuery = useDebounce(query, 500);
  const templates = useMemo(
    () => localizeChatAgentTemplates(locale),
    [locale]
  );
  const templatesByKey = useMemo(() => {
    return new Map(templates.map((template) => [template.key, template]));
  }, [templates]);

  const fetchChatAgents = async () => {
    EnjoyApp.chatAgents
      .findAll({
        where: {
          type: ChatAgentTypeEnum.GPT,
        },
      })
      .then((agents) => {
        setChatAgents(agents);
      });
  };

  useEffect(() => {
    fetchChatAgents();
  }, []);

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
    const onTransactionUpdate = (event: CustomEvent) => {
      const { model } = event.detail || {};
      if (model === "ChatAgent") {
        fetchChatAgents();
      }
    };

    addDblistener?.(onTransactionUpdate);
    return () => {
      removeDbListener?.(onTransactionUpdate);
    };
  }, [addDblistener, removeDbListener]);

  const rows = useMemo<AssistantAgentPickerRow[]>(() => {
    const agentRows: AssistantAgentPickerRow[] = chatAgents
      .filter((agent) => agent.type === ChatAgentTypeEnum.GPT)
      .map((agent) => {
        const templateKey = getChatAgentTemplateKeyFromSource(agent.source);
        const template = templateKey ? templatesByKey.get(templateKey) : null;
        const searchText = [
          agent.name,
          agent.description,
          agent.source,
          template?.key,
          template?.name,
          template?.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return {
          kind: "agent",
          id: agent.id,
          agent,
          searchText,
          marker: templateKey ? "preset-created" : "custom",
        };
      });
    const presetRows: AssistantAgentPickerRow[] = templates.map((template) => ({
      kind: "preset",
      key: template.key,
      template,
      displayName: template.name,
      displayDescription: template.description,
      searchText: [template.key, template.name, template.description]
        .join(" ")
        .toLowerCase(),
      marker: "preset",
    }));
    const normalizedQuery = debouncedQuery.trim().toLowerCase();

    return [...agentRows, ...presetRows].filter((row) => {
      if (!normalizedQuery) return true;
      return row.searchText.includes(normalizedQuery);
    });
  }, [chatAgents, debouncedQuery, templates, templatesByKey]);

  const handleSelect = (row: AssistantAgentPickerRow) => {
    if (row.kind === "agent") {
      onSelect(row.agent);
      return;
    }

    const source = getChatAgentPresetSource(row.key);
    if (creatingPresetSources.has(source)) {
      return;
    }

    const existingAgent = chatAgents.find(
      (agent) =>
        agent.type === ChatAgentTypeEnum.GPT && agent.source === source
    );
    if (existingAgent) {
      onSelect(existingAgent);
      return;
    }

    setCreatingPresetSources((sources) => new Set(sources).add(source));
    EnjoyApp.chatAgents
      .create(chatAgentTemplateToDto(row.template, locale))
      .then((agent) => {
        setChatAgents((agents) => [agent, ...agents]);
        onSelect(agent);
      })
      .catch((error) => {
        toast.error(error.message);
      })
      .finally(() => {
        setCreatingPresetSources((sources) => {
          const nextSources = new Set(sources);
          nextSources.delete(source);
          return nextSources;
        });
      });
  };

  const markerLabel = (marker: AssistantAgentPickerRow["marker"]) => {
    if (marker === "preset") return t("preset");
    if (marker === "preset-created") return t("presetCreated");
    return t("custom");
  };

  return (
    <div className="relative">
      <div className="sticky py-2 px-1">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded h-8 text-xs"
          placeholder={t("search")}
        />
      </div>
      {rows.length === 0 && (
        <div className="text-center my-4">
          <span className="text-sm text-muted-foreground">{t("noData")}</span>
        </div>
      )}
      {rows.map((row) => (
        <div
          key={row.kind === "agent" ? row.id : `preset:${row.key}`}
          className="flex items-center space-x-2 px-2 py-1 rounded-lg cursor-pointer hover:bg-muted"
          onClick={() => handleSelect(row)}
        >
          <Avatar className="w-8 h-8">
            <img
              src={
                row.kind === "agent"
                  ? row.agent.avatarUrl
                  : `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(
                      row.displayName
                    )}`
              }
              alt={row.kind === "agent" ? row.agent.name : row.displayName}
            />
            <AvatarFallback>
              {(row.kind === "agent" ? row.agent.name : row.displayName)[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between space-x-1 line-clamp-1 w-full">
              <div className="text-sm flex-1 line-clamp-1">
                {row.kind === "agent" ? row.agent.name : row.displayName}
              </div>
              <Badge className="text-xs px-1" variant="secondary">
                {markerLabel(row.marker)}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {row.kind === "agent"
                ? row.agent.description
                : row.displayDescription}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
