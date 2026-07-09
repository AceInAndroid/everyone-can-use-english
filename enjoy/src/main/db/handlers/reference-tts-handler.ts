import { ipcMain, IpcMainEvent } from "electron";
import { referenceTtsService } from "@main/tts/reference-tts-service";

class ReferenceTtsHandler {
  private async status() {
    return referenceTtsService.status();
  }

  private async downloadModel() {
    return referenceTtsService.downloadModel();
  }

  private async importModel(_event: IpcMainEvent, sourceDir: string) {
    return referenceTtsService.importModel(sourceDir);
  }

  private async generateSpeech(
    _event: IpcMainEvent,
    params: ReferenceTtsGenerateParamsType
  ) {
    const speech = await referenceTtsService.generateSpeech(params);
    return speech.toJSON();
  }

  register() {
    ipcMain.handle("reference-tts-status", this.status);
    ipcMain.handle("reference-tts-download-model", this.downloadModel);
    ipcMain.handle("reference-tts-import-model", this.importModel);
    ipcMain.handle("reference-tts-generate-speech", this.generateSpeech);
  }

  unregister() {
    ipcMain.removeHandler("reference-tts-status");
    ipcMain.removeHandler("reference-tts-download-model");
    ipcMain.removeHandler("reference-tts-import-model");
    ipcMain.removeHandler("reference-tts-generate-speech");
  }
}

export const referenceTtsHandler = new ReferenceTtsHandler();
