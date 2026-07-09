import { ipcMain, IpcMainEvent } from "electron";
import { Audio, Segment, Transcription, Video } from "@main/db/models";

class SegmentsHandler {
  private async find(_event: IpcMainEvent, id: string) {
    const segment = await Segment.findByPk(id);
    return segment.toJSON();
  }

  private async findAll(
    _event: IpcMainEvent,
    params: {
      targetId: string;
      targetType: string;
      segmentIndex: number;
    }
  ) {
    const { targetId, targetType, segmentIndex } = params;
    const segments = await Segment.findAll({
      where: {
        targetId,
        targetType,
        segmentIndex,
      },
      include: [Audio, Video],
      order: [["updatedAt", "DESC"]],
    });

    const transcription = await Transcription.findOne({
      where: { targetId, targetType },
    });
    const caption = transcription?.result?.timeline?.[segmentIndex];
    if (!caption) {
      return segments.map((segment) => segment.toJSON());
    }

    const currentSegments = segments.filter((segment) =>
      Segment.matchesCaption(segment, caption)
    );
    const staleSegments = segments.filter(
      (segment) => !Segment.matchesCaption(segment, caption)
    );

    await Promise.all(staleSegments.map((segment) => segment.destroy()));

    return currentSegments.map((segment) => segment.toJSON());
  }

  private async create(
    _event: IpcMainEvent,
    params: {
      targetId: string;
      targetType: string;
      segmentIndex: number;
    }
  ) {
    const segment = await Segment.generate({
      targetId: params.targetId,
      targetType: params.targetType,
      segmentIndex: params.segmentIndex,
    });
    return segment.toJSON();
  }

  private async sync(_event: IpcMainEvent, id: string) {
    const segment = await Segment.findByPk(id);
    await segment.sync();
    return segment.toJSON();
  }

  register() {
    ipcMain.handle("segments-create", this.create);
    ipcMain.handle("segments-find", this.find);
    ipcMain.handle("segments-find-all", this.findAll);
    ipcMain.handle("segments-sync", this.sync);
  }

  unregister() {
    ipcMain.removeHandler("segments-create");
    ipcMain.removeHandler("segments-find");
    ipcMain.removeHandler("segments-find-all");
    ipcMain.removeHandler("segments-sync");
  }
}

export const segmentsHandler = new SegmentsHandler();
