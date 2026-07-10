import log from "electron-log/main";
import path from "path";
import { app } from "electron";

log.initialize({ preload: true });

log.transports.file.level = "info";
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath("logs"), "main.log");
log.errorHandler.startCatching();

export default log;
