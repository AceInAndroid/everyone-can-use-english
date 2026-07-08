import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@renderer/components/ui";
import {
  SpeechPlayer,
  ConversationShortcuts,
  MarkdownWrapper,
} from "@renderer/components";
import { useContext, useState } from "react";
import { AppSettingsProviderContext } from "@renderer/context";
import {
  CheckCircleIcon,
  LoaderIcon,
  AlertCircleIcon,
  CopyIcon,
  CheckIcon,
  ForwardIcon,
  MoreVerticalIcon,
} from "lucide-react";
import { useCopyToClipboard } from "@uidotdev/usehooks";
import { t } from "i18next";
import Markdown from "react-markdown";
import { formatDateTime } from "@renderer/lib/utils";

export const UserMessageComponent = (props: {
  message: MessageType;
  configuration?: { [key: string]: any };
  onResend: () => void;
  onRemove: () => void;
}) => {
  const { message, onResend, onRemove } = props;
  const speech = message.speeches?.[0];
  const { user } = useContext(AppSettingsProviderContext);
  const [_, copyToClipboard] = useCopyToClipboard();
  const [copied, setCopied] = useState<boolean>(false);

  return (
    <div id={`message-${message.id}`} className="">
      <div className="flex items-center justify-end space-x-2 mb-2">
        <div className="text-sm text-muted-foreground">{user.name}</div>
        <Avatar className="w-8 h-8 bg-background">
          <AvatarImage src={user.avatarUrl} />
          <AvatarFallback className="bg-primary text-white capitalize">
            {user.name?.[0] ?? "U"}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex flex-col gap-2 px-4 py-2 bg-sky-500/30 border-sky-500 rounded-lg shadow-sm w-full mb-2">
        <MarkdownWrapper className="message-content select-text prose dark:prose-invert max-w-full">
          {message.content}
        </MarkdownWrapper>

        {Boolean(speech) && <SpeechPlayer speech={speech} />}

        <DropdownMenu>
          <div className="flex items-center justify-end space-x-4">
            {message.createdAt ? (
              <CheckCircleIcon
                data-tooltip-id="global-tooltip"
                data-tooltip-content={t("sent")}
                className="w-4 h-4"
              />
            ) : message.status === "pending" ? (
              <LoaderIcon
                data-tooltip-id="global-tooltip"
                data-tooltip-content={t("sending")}
                className="w-4 h-4 animate-spin"
              />
            ) : (
              message.status === "error" && (
                <DropdownMenuTrigger>
                  <AlertCircleIcon className="w-4 h-4 text-destructive" />
                </DropdownMenuTrigger>
              )
            )}
            {copied ? (
              <CheckIcon className="w-4 h-4 text-green-500" />
            ) : (
              <CopyIcon
                data-tooltip-id="global-tooltip"
                data-tooltip-content={t("copy")}
                className="w-4 h-4 cursor-pointer"
                onClick={() => {
                  copyToClipboard(message.content);
                  setCopied(true);
                  setTimeout(() => {
                    setCopied(false);
                  }, 3000);
                }}
              />
            )}

            <ConversationShortcuts
              prompt={message.content}
              excludedIds={[message.conversationId]}
              trigger={
                <ForwardIcon
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content={t("forward")}
                  className="w-4 h-4 cursor-pointer"
                />
              }
            />

            <DropdownMenuTrigger>
              <MoreVerticalIcon className="w-4 h-4" />
            </DropdownMenuTrigger>
          </div>

          <DropdownMenuContent>
            <DropdownMenuItem className="cursor-pointer" onClick={onResend}>
              <span className="mr-auto capitalize">{t("resend")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={onRemove}>
              <span className="mr-auto text-destructive capitalize">
                {t("remove")}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex justify-end text-xs text-muted-foreground timestamp">
        {formatDateTime(message.createdAt)}
      </div>
    </div>
  );
};
