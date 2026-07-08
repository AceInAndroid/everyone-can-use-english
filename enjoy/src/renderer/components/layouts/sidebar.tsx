import {
  Button,
  Dialog,
  DialogContent,
  ScrollArea,
  Separator,
  DialogTitle,
} from "@renderer/components/ui";
import {
  SettingsIcon,
  HomeIcon,
  HeadphonesIcon,
  VideoIcon,
  NewspaperIcon,
  BookMarkedIcon,
  BotIcon,
  LucideIcon,
  NotebookPenIcon,
  SpeechIcon,
  MessagesSquareIcon,
  PanelLeftOpenIcon,
  PanelLeftCloseIcon,
} from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { t } from "i18next";
import { Preferences } from "@renderer/components";
import { AppSettingsProviderContext } from "@renderer/context";
import { useContext, useEffect } from "react";

export const Sidebar = (props: {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}) => {
  const { isCollapsed, setIsCollapsed } = props;
  const location = useLocation();
  const activeTab = location.pathname;
  const { EnjoyApp, displayPreferences, setDisplayPreferences } =
    useContext(AppSettingsProviderContext);

  // Save the sidebar state to cache
  useEffect(() => {
    EnjoyApp.cacheObjects.set("sidebarOpen", isCollapsed);
  }, [isCollapsed]);

  // Restore the sidebar state from cache
  useEffect(() => {
    EnjoyApp.cacheObjects.get("sidebarOpen").then((value) => {
      if (value !== undefined) {
        setIsCollapsed(!!value);
      }
    });
  }, []);

  useEffect(() => {
    if (displayPreferences) {
      EnjoyApp.view.hide();
    } else {
      EnjoyApp.view.show();
    }
  }, [displayPreferences]);

  return (
    <div
      className={`h-content pt-8 transition-all relative draggable-region ${
        isCollapsed
          ? "w-[--sidebar-collapsed-width]"
          : "w-[--sidebar-expanded-width]"
      }`}
      data-testid="sidebar"
    >
      <div
        className={`fixed top-0 left-0 h-full bg-muted border-r ${
          isCollapsed
            ? "w-[--sidebar-collapsed-width]"
            : "w-[--sidebar-expanded-width]"
        }`}
      >
        <ScrollArea className="w-full h-full pb-12 pt-8">
          <div className="grid gap-2 mb-4">
            <SidebarItem
              href="/"
              label={t("sidebar.home")}
              tooltip={t("sidebar.home")}
              active={activeTab === "/"}
              Icon={HomeIcon}
              isCollapsed={isCollapsed}
            />

            <SidebarItem
              href="/chats"
              label={t("sidebar.chats")}
              tooltip={t("sidebar.chats")}
              active={activeTab.startsWith("/chats")}
              Icon={MessagesSquareIcon}
              isCollapsed={isCollapsed}
            />

            <SidebarItem
              href="/audios"
              label={t("sidebar.audios")}
              tooltip={t("sidebar.audios")}
              active={activeTab.startsWith("/audios")}
              Icon={HeadphonesIcon}
              isCollapsed={isCollapsed}
            />

            <SidebarItem
              href="/videos"
              label={t("sidebar.videos")}
              tooltip={t("sidebar.videos")}
              active={activeTab.startsWith("/videos")}
              Icon={VideoIcon}
              isCollapsed={isCollapsed}
            />

            <SidebarItem
              href="/documents"
              label={t("sidebar.documents")}
              tooltip={t("sidebar.documents")}
              active={activeTab.startsWith("/documents")}
              Icon={NewspaperIcon}
              isCollapsed={isCollapsed}
            />

            <Separator />

            <SidebarItem
              href="/conversations"
              label={t("sidebar.aiAssistant")}
              tooltip={t("sidebar.aiAssistant")}
              active={activeTab.startsWith("/conversations")}
              Icon={BotIcon}
              testid="sidebar-conversations"
              isCollapsed={isCollapsed}
            />

            <SidebarItem
              href="/pronunciation_assessments"
              label={t("sidebar.pronunciationAssessment")}
              tooltip={t("sidebar.pronunciationAssessment")}
              active={activeTab.startsWith("/pronunciation_assessments")}
              Icon={SpeechIcon}
              testid="sidebar-pronunciation-assessments"
              isCollapsed={isCollapsed}
            />

            <SidebarItem
              href="/notes"
              label={t("sidebar.notes")}
              tooltip={t("sidebar.notes")}
              active={activeTab === "/notes"}
              Icon={NotebookPenIcon}
              isCollapsed={isCollapsed}
            />

            <SidebarItem
              href="/vocabulary"
              label={t("sidebar.vocabulary")}
              tooltip={t("sidebar.vocabulary")}
              active={activeTab.startsWith("/vocabulary")}
              Icon={BookMarkedIcon}
              isCollapsed={isCollapsed}
            />

            <Separator />

            <div className="px-1 non-draggable-region">
              <Button
                size="sm"
                variant={displayPreferences ? "default" : "ghost"}
                id="preferences-button"
                className={`w-full ${
                  isCollapsed ? "justify-center" : "justify-start"
                }`}
                data-tooltip-id="global-tooltip"
                data-tooltip-content={t("sidebar.preferences")}
                data-tooltip-place="right"
                onClick={() => setDisplayPreferences(true)}
              >
                <SettingsIcon className="size-4" />
                {!isCollapsed && (
                  <span className="ml-2"> {t("sidebar.preferences")} </span>
                )}
              </Button>
            </div>

            <Dialog
              open={displayPreferences}
              onOpenChange={setDisplayPreferences}
            >
              <DialogContent
                aria-describedby={undefined}
                container={document.body}
                className="max-w-screen-md xl:max-w-screen-lg h-5/6 p-0"
              >
                <DialogTitle className="hidden">
                  {t("sidebar.preferences")}
                </DialogTitle>
                <Preferences />
              </DialogContent>
            </Dialog>
          </div>
        </ScrollArea>

        <div className="w-full absolute bottom-0 pt-4 pb-2 px-1">
          <Button
            size="sm"
            variant="ghost"
            className={`w-full non-draggable-region ${
              isCollapsed ? "justify-center" : "justify-start"
            }`}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <PanelLeftOpenIcon className="size-4" />
            ) : (
              <PanelLeftCloseIcon className="size-4" />
            )}
            {!isCollapsed && (
              <span className="ml-2"> {t("sidebar.collapse")} </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

const SidebarItem = (props: {
  href: string;
  label: string;
  tooltip: string;
  active: boolean;
  Icon: LucideIcon;
  testid?: string;
  isCollapsed: boolean;
}) => {
  const { href, label, tooltip, active, Icon, testid, isCollapsed } = props;

  return (
    <Link
      to={href}
      data-tooltip-id="global-tooltip"
      data-tooltip-content={tooltip}
      data-tooltip-place="right"
      data-testid={testid}
      className="block px-1 non-draggable-region"
    >
      <Button
        size="sm"
        variant={active ? "default" : "ghost"}
        className={`w-full ${isCollapsed ? "justify-center" : "justify-start"}`}
      >
        <Icon className="size-4" />
        {!isCollapsed && <span className="ml-2">{label}</span>}
      </Button>
    </Link>
  );
};
