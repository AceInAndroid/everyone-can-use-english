import settings from "electron-settings";
import { LIBRARY_PATH_SUFFIX, DATABASE_NAME, WEB_API_URL } from "@/constants";
import { ipcMain, app } from "electron";
import path from "path";
import fs from "fs-extra";
import { AppSettingsKeyEnum } from "@/types/enums";

const LOCAL_USER: UserType = {
  id: "00000000",
  name: "Local User",
};
const LOCAL_STORAGE_NAMESPACE = LOCAL_USER.id;

if (process.env.SETTINGS_PATH) {
  settings.configure({
    dir: process.env.SETTINGS_PATH,
    prettify: true,
  });
}

const libraryPath = () => {
  const _library = settings.getSync("library");

  if (!_library || typeof _library !== "string") {
    settings.setSync(
      AppSettingsKeyEnum.LIBRARY,
      process.env.LIBRARY_PATH ||
        path.join(app.getPath("documents"), LIBRARY_PATH_SUFFIX)
    );
  } else if (path.parse(_library).base !== LIBRARY_PATH_SUFFIX) {
    settings.setSync(
      AppSettingsKeyEnum.LIBRARY,
      path.join(_library, LIBRARY_PATH_SUFFIX)
    );
  }

  const library = settings.getSync(AppSettingsKeyEnum.LIBRARY) as string;
  fs.ensureDirSync(library);

  return library;
};

const cachePath = () => {
  const tmpDir = path.join(libraryPath(), "cache");
  fs.ensureDirSync(tmpDir);

  return tmpDir;
};

const dbPath = () => {
  if (!userDataPath()) return null;

  const dbName = app.isPackaged
    ? `${DATABASE_NAME}.sqlite`
    : `${DATABASE_NAME}_dev.sqlite`;
  return path.join(userDataPath(), dbName);
};

const localStorageNamespace = () => LOCAL_STORAGE_NAMESPACE;

const userDataPath = () => {
  ensureLocalUser();
  const userData = path.join(libraryPath(), localStorageNamespace());
  fs.ensureDirSync(userData);

  return userData;
};

const migrateLegacyUserData = (legacyUserId?: string) => {
  if (!legacyUserId || legacyUserId === localStorageNamespace()) return;

  const library = libraryPath();
  const legacyUserData = path.join(library, legacyUserId.toString());
  const localUserData = path.join(library, localStorageNamespace());
  if (!fs.existsSync(legacyUserData)) return;

  fs.ensureDirSync(localUserData);
  fs.copySync(legacyUserData, localUserData, {
    overwrite: false,
    errorOnExist: false,
  });
};

const ensureLocalUser = (): UserType => {
  const currentUser = settings.getSync(AppSettingsKeyEnum.USER) as
    | UserType
    | undefined;
  migrateLegacyUserData(currentUser?.id?.toString());

  const localUser = {
    ...LOCAL_USER,
    name: currentUser?.name || LOCAL_USER.name,
  };
  settings.setSync(AppSettingsKeyEnum.USER, localUser);
  return localUser;
};

const apiUrl = () => {
  const url: string = settings.getSync(AppSettingsKeyEnum.API_URL) as string;
  return process.env.WEB_API_URL || url || WEB_API_URL;
};

// Login/account has been removed; only the fixed local library namespace is active.
const sessions = () => {
  ensureLocalUser();
  return [{ id: localStorageNamespace(), name: localStorageNamespace() }];
};

export default {
  registerIpcHandlers: () => {
    ipcMain.handle("app-settings-get-library", (_event) => {
      libraryPath();
      return settings.getSync(AppSettingsKeyEnum.LIBRARY);
    });

    ipcMain.handle("app-settings-set-library", (_event, library) => {
      if (path.parse(library).base === LIBRARY_PATH_SUFFIX) {
        settings.setSync(AppSettingsKeyEnum.LIBRARY, library);
      } else {
        const dir = path.join(library, LIBRARY_PATH_SUFFIX);
        fs.ensureDirSync(dir);
        settings.setSync(AppSettingsKeyEnum.LIBRARY, dir);
      }
    });

    ipcMain.handle("app-settings-get-user", (_event) => {
      return ensureLocalUser();
    });

    ipcMain.handle("app-settings-set-user", (_event, user) => {
      settings.setSync(AppSettingsKeyEnum.USER, {
        ...LOCAL_USER,
        name: user?.name || LOCAL_USER.name,
      });
    });

    ipcMain.handle("app-settings-get-user-data-path", (_event) => {
      return userDataPath();
    });

    ipcMain.handle("app-settings-get-api-url", (_event) => {
      return settings.getSync(AppSettingsKeyEnum.API_URL);
    });

    ipcMain.handle("app-settings-set-api-url", (_event, url) => {
      settings.setSync(AppSettingsKeyEnum.API_URL, url);
    });

    ipcMain.handle("app-settings-get-sessions", (_event) => {
      return sessions();
    });
  },
  cachePath,
  libraryPath,
  localStorageNamespace,
  userDataPath,
  dbPath,
  apiUrl,
  ...settings,
};
