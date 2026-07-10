import { app, BrowserWindow, protocol, net } from "electron";
import path from "path";
import { pathToFileURL } from "node:url";
import fs from "fs-extra";
import settings from "@main/settings";
import log from "@main/logger";
import mainWindow from "@main/window";
import ElectronSquirrelStartup from "electron-squirrel-startup";
import contextMenu from "electron-context-menu";
import { t } from "i18next";

const logger = log.scope("main");

const USER_DATA_LIBRARY_DIRECTORIES = new Set([
  "audios",
  "videos",
  "recordings",
  "speeches",
  "segments",
  "documents",
]);

const resolveEnjoyLibraryFile = (requestUrl: string) => {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== "enjoy:" || url.hostname !== "library") {
      return null;
    }

    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!relativePath) return null;

    const [topLevelDirectory] = relativePath.split("/");
    const root = USER_DATA_LIBRARY_DIRECTORIES.has(topLevelDirectory)
      ? settings.userDataPath()
      : settings.libraryPath();
    const filePath = path.resolve(root, relativePath);
    const relativeToRoot = path.relative(root, filePath);

    if (
      relativeToRoot === ".." ||
      relativeToRoot.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeToRoot)
    ) {
      return null;
    }

    return filePath;
  } catch {
    return null;
  }
};

app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer");

if (!app.isPackaged) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-software-rasterizer");
}

// Add context menu
contextMenu({
  showSearchWithGoogle: false,
  showInspectElement: false,
  showLookUpSelection: false,
  showLearnSpelling: false,
  showSelectAll: false,
  labels: {
    copy: t("copy"),
    cut: t("cut"),
    paste: t("paste"),
    selectAll: t("selectAll"),
  },
  shouldShowMenu: (_event, params) => {
    return params.isEditable || !!params.selectionText;
  },
  prepend: (
    _defaultActions,
    parameters,
    browserWindow: BrowserWindow,
    _event
  ) => [
    {
      label: t("lookup"),
      visible:
        parameters.selectionText.trim().length > 0 &&
        !parameters.selectionText.trim().includes(" "),
      click: () => {
        const { x, y, selectionText } = parameters;
        browserWindow.webContents.send("on-lookup", selectionText, "", {
          x,
          y,
        });
      },
    },
    {
      label: t("aiTranslate"),
      visible: parameters.selectionText.trim().length > 0,
      click: () => {
        const { x, y, selectionText } = parameters;
        browserWindow.webContents.send("on-translate", selectionText, { x, y });
      },
    },
  ],
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (ElectronSquirrelStartup) {
  app.quit();
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "enjoy",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      stream: true,
      codeCache: true,
      corsEnabled: true,
    },
  },
]);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  if (!app.isPackaged) {
    import("electron-devtools-installer")
      .then((mymodule: any) => {
        const installExtension = mymodule.default.default; // Default export
        installExtension(mymodule.default.REACT_DEVELOPER_TOOLS, {
          loadExtensionOptions: {
            allowFileAccess: true,
          },
        }); // replace param with the ext ID of your choice
      })
      .catch((err) => console.log("An error occurred: ", err));
  }

  protocol.handle("enjoy", async (request) => {
    const filePath = resolveEnjoyLibraryFile(request.url);
    if (!filePath) {
      return new Response("Invalid Enjoy library URL", { status: 400 });
    }

    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return new Response("Enjoy library file not found", { status: 404 });
      }

      return net.fetch(pathToFileURL(filePath).toString(), {
        headers: request.headers,
        bypassCustomProtocolHandlers: true,
      });
    } catch (error) {
      logger.warn("Failed to read Enjoy library file", filePath, error);
      return new Response("Enjoy library file not found", { status: 404 });
    }
  });

  mainWindow.init();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow.init();
  }
});

// Clean up cache folder before quit
app.on("before-quit", () => {
  try {
    fs.emptyDirSync(settings.cachePath());
  } catch (err) {}
});
