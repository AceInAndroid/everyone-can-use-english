import {
  AfterCreate,
  AfterUpdate,
  AfterDestroy,
  BelongsTo,
  Table,
  Column,
  Default,
  IsUUID,
  Model,
  HasMany,
  HasOne,
  DataType,
  Unique,
} from "sequelize-typescript";
import {
  Audio,
  Recording,
  Speech,
  Transcription,
} from "@main/db/models";
import settings from "@main/settings";
import { AudioFormats, MIME_TYPES, VideoFormats } from "@/constants";
import { hashFile, pathToEnjoyUrl } from "@main/utils";
import path from "path";
import fs from "fs-extra";
import { t } from "i18next";
import mainWindow from "@main/window";
import log from "@main/logger";
import { Client } from "@/api";
import startCase from "lodash/startCase";
import { v5 as uuidv5 } from "uuid";
import FfmpegWrapper from "@main/ffmpeg";

const logger = log.scope("db/models/video");
const BROWSER_SAFE_VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".webm"]);
const BROWSER_SAFE_AUDIO_CODECS = new Set([
  "aac",
  "mp3",
  "opus",
  "vorbis",
  "flac",
]);
const TEXT_SUBTITLE_CODECS = new Set([
  "ass",
  "ssa",
  "subrip",
  "srt",
  "webvtt",
  "mov_text",
]);

@Table({
  modelName: "Video",
  tableName: "videos",
  underscored: true,
  timestamps: true,
})
export class Video extends Model<Video> {
  @IsUUID("all")
  @Default(DataType.UUIDV4)
  @Column({ primaryKey: true, type: DataType.UUID })
  id: string;

  @Column(DataType.STRING)
  language: string;

  @Column(DataType.STRING)
  source: string;

  @Unique
  @Column(DataType.STRING)
  md5: string;

  @Column(DataType.STRING)
  name: string;

  @Column(DataType.STRING)
  description: string;

  @Column(DataType.JSON)
  metadata: any;

  @Column(DataType.STRING)
  coverUrl: string;

  @HasMany(() => Recording, {
    foreignKey: "targetId",
    constraints: false,
    scope: { target_type: "Video" },
  })
  recordings: Recording[];

  @HasOne(() => Transcription, {
    foreignKey: "targetId",
    constraints: false,
    scope: { target_type: "Video" },
  })
  transcription: Transcription;

  @BelongsTo(() => Speech, {
    foreignKey: "md5",
    constraints: false,
  })
  speech: Speech;

  @Default(0)
  @Column(DataType.INTEGER)
  recordingsCount: number;

  @Default(0)
  @Column(DataType.INTEGER)
  recordingsDuration: number;

  @Column(DataType.DATE)
  syncedAt: Date;

  @Column(DataType.DATE)
  uploadedAt: Date;

  @Column(DataType.VIRTUAL)
  get isSynced(): boolean {
    return Boolean(this.syncedAt) && this.syncedAt >= this.updatedAt;
  }

  @Column(DataType.VIRTUAL)
  get isUploaded(): boolean {
    return Boolean(this.uploadedAt);
  }

  @Column(DataType.VIRTUAL)
  get transcribing(): boolean {
    return this.transcription?.state === "processing";
  }

  @Column(DataType.VIRTUAL)
  get transcribed(): boolean {
    return this.transcription?.state === "finished";
  }

  @Column(DataType.VIRTUAL)
  get src(): string {
    if (this.compressedFilePath) {
      return `enjoy://${path.posix.join(
        "library",
        "videos",
        this.getDataValue("md5") + ".compressed.mp4"
      )}`;
    } else if (this.originalFilePath) {
      return `enjoy://${path.posix.join(
        "library",
        "videos",
        this.getDataValue("md5") + this.extname
      )}`;
    } else {
      return null;
    }
  }

  @Column(DataType.VIRTUAL)
  get duration(): number {
    return this.getDataValue("metadata").duration;
  }

  @Column(DataType.VIRTUAL)
  get mediaType(): string {
    return "Video";
  }

  @Column(DataType.VIRTUAL)
  get filename(): string {
    return this.getDataValue("md5") + this.extname;
  }

  get mimeType(): string {
    return MIME_TYPES[this.extname.toLowerCase()] || "video/mp4";
  }

  get extname(): string {
    return (
      this.getDataValue("metadata").extname ||
      path.extname(this.getDataValue("source")) ||
      ""
    );
  }

  get filePath(): string {
    return this.compressedFilePath || this.originalFilePath;
  }

  get originalFilePath(): string {
    const file = path.join(
      settings.userDataPath(),
      "videos",
      this.getDataValue("md5") + this.extname
    );

    if (fs.existsSync(file)) {
      return file;
    } else {
      return null;
    }
  }

  get compressedFilePath(): string {
    const file = path.join(
      settings.userDataPath(),
      "videos",
      `${this.getDataValue("md5")}.compressed.mp4`
    );

    if (fs.existsSync(file)) {
      return file;
    } else {
      return null;
    }
  }

  static subtitleSidecarDir(md5: string): string {
    return path.join(settings.userDataPath(), "videos", "subtitles", md5);
  }

  static async cleanupSubtitleSidecars(md5: string) {
    if (!md5) return;
    await fs.remove(this.subtitleSidecarDir(md5));
  }

  static async cleanupOrphanSubtitleSidecars() {
    const subtitlesDir = path.join(settings.userDataPath(), "videos", "subtitles");
    if (!fs.pathExistsSync(subtitlesDir)) return;

    const existingMd5s = new Set(
      (await Video.findAll({ attributes: ["md5"] })).map((video) =>
        video.getDataValue("md5")
      )
    );
    const entries = await fs.readdir(subtitlesDir);

    for (const entry of entries) {
      if (!existingMd5s.has(entry)) {
        await fs.remove(path.join(subtitlesDir, entry));
      }
    }
  }

  static async extractSubtitleTracksFromFile(
    filePath: string,
    md5: string,
    fileMetadata: any,
    ffmpeg: FfmpegWrapper
  ): Promise<{
    subtitleTracks: VideoSubtitleTrackType[];
    subtitleTrackWarnings: VideoSubtitleTrackWarningType[];
  }> {
    const subtitleTracks: VideoSubtitleTrackType[] = [];
    const subtitleTrackWarnings: VideoSubtitleTrackWarningType[] = [];
    const streams = fileMetadata.streams || [];

    for (const stream of streams) {
      if (stream.codec_type !== "subtitle") continue;

      const streamIndex = stream.index;
      const tags = ((stream as any).tags || {}) as Record<string, string>;
      const language = tags.language;
      const title = tags.title;
      const codecName = stream.codec_name;
      const handlerName = tags.handler_name || tags.handlerName;
      const dispositionDefault = Boolean((stream as any).disposition?.default);
      if (!TEXT_SUBTITLE_CODECS.has(codecName)) {
        subtitleTrackWarnings.push({
          index: streamIndex,
          language,
          title,
          codecName,
          error: "Image-based subtitle cannot be converted to text.",
        });
        continue;
      }

      const sidecarFile = path.join(
        this.subtitleSidecarDir(md5),
        `${streamIndex}.srt`
      );

      try {
        const extracted = await ffmpeg.extractSubtitle({
          input: filePath,
          streamIndex,
          outputFormat: "srt",
          sidecarPath: sidecarFile,
        });

        if (!extracted.text.trim()) {
          throw new Error("Extracted subtitle is empty");
        }

        subtitleTracks.push({
          index: streamIndex,
          language,
          title,
          codecName,
          handlerName,
          dispositionDefault,
          sidecarPath: pathToEnjoyUrl(sidecarFile),
          format: "srt",
        });
      } catch (err) {
        logger.warn("subtitle extraction failed", {
          streamIndex,
          codecName,
          language,
          error: err.message,
        });
        subtitleTrackWarnings.push({
          index: streamIndex,
          language,
          title,
          codecName,
          error: err.message,
        });
      }
    }

    return { subtitleTracks, subtitleTrackWarnings };
  }

  static needsPlaybackOptimizedCopy(
    extname: string,
    fileMetadata: any
  ): boolean {
    if (!BROWSER_SAFE_VIDEO_EXTENSIONS.has(extname)) return true;

    const audioStream = (fileMetadata.streams || []).find(
      (stream: any) => stream.codec_type === "audio"
    );
    if (!audioStream) return false;

    return !BROWSER_SAFE_AUDIO_CODECS.has(audioStream.codec_name);
  }

  // generate a local cover image without remote storage.
  async generateCover() {
    if (this.coverUrl) return;

    const ffmpeg = new FfmpegWrapper();
    const coverFile = await ffmpeg.generateCover(
      this.filePath,
      path.join(settings.cachePath(), `${Date.now()}.png`)
    );
    const hash = await hashFile(coverFile, { algo: "md5" });
    const dir = path.join(settings.userDataPath(), "videos");
    fs.ensureDirSync(dir);
    const filename = `${hash}.cover.png`;
    const finalFile = path.join(dir, filename);
    fs.moveSync(coverFile, finalFile, { overwrite: true });
    await this.update({
      coverUrl: `enjoy://${path.posix.join("library", "videos", filename)}`,
    });
  }

  async sync() {
    if (this.isSynced) return;

    const webApi = new Client({
      baseUrl: settings.apiUrl(),
      logger,
    });

    return webApi.syncVideo(this.toJSON()).then(() => {
      return this.update(
        { syncedAt: new Date() },
        { hooks: false, silent: true }
      );
    });
  }

  async crop(params: { startTime: number; endTime: number }) {
    const { startTime, endTime } = params;

    const ffmpeg = new FfmpegWrapper();
    const output = path.join(
      settings.cachePath(),
      `${this.name}(${startTime.toFixed(2)}s-${endTime.toFixed(2)}).mp3`
    );
    await ffmpeg.crop(this.filePath, {
      startTime,
      endTime,
      output,
    });

    return output;
  }

  @AfterCreate
  static autoSync(video: Video) {
    video.sync().catch((err) => {
      logger.error("sync video error", video.id, err);
    });
    video.generateCover().catch((err) => {
      logger.error("generate cover error", video.id, err);
    });
  }

  @AfterCreate
  static notifyForCreate(video: Video) {
    this.notify(video, "create");
  }

  @AfterUpdate
  static notifyForUpdate(video: Video) {
    this.notify(video, "update");
    video.sync().catch((err) => {
      logger.error("sync video error", video.id, err);
    });
  }

  @AfterDestroy
  static notifyForDestroy(video: Video) {
    this.notify(video, "destroy");
  }

  @AfterDestroy
  static async cleanupFile(video: Video) {
    if (video.filePath) {
      fs.remove(video.filePath);
    }
    await Video.cleanupSubtitleSidecars(video.getDataValue("md5"));
    Recording.destroy({
      where: {
        targetId: video.id,
        targetType: "Video",
      },
    });

    const webApi = new Client({
      baseUrl: settings.apiUrl(),
      logger: log.scope("video/cleanupFile"),
    });

    webApi.deleteVideo(video.id).catch((err) => {
      logger.error("deleteAudio failed:", err.message);
    });
  }

  static async buildFromLocalFile(
    filePath: string,
    params?: {
      name?: string;
      description?: string;
      source?: string;
      coverUrl?: string;
      compressing?: boolean;
    }
  ): Promise<Audio | Video> {
    const { compressing = true } = params || {};

    // Check if file exists
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch {
      throw new Error(t("models.video.fileNotFound", { file: filePath }));
    }

    // Check if file format is supported
    const extname = path.extname(filePath).toLocaleLowerCase();
    if (AudioFormats.includes(extname.split(".").pop() as string)) {
      return Audio.buildFromLocalFile(filePath, params);
    } else if (!VideoFormats.includes(extname.split(".").pop() as string)) {
      throw new Error(t("models.video.fileNotSupported", { file: filePath }));
    }

    const md5 = await hashFile(filePath, { algo: "md5" });
    const destDir = path.join(settings.userDataPath(), "videos");

    // check if file already exists
    const existing = await Video.findOne({
      where: {
        md5,
      },
    });
    if (existing) {
      logger.warn("Video already exists:", existing.id, existing.name);
      try {
        const ffmpeg = new FfmpegWrapper();
        const fileMetadata = await ffmpeg.generateMetadata(filePath);
        const metadata = {
          ...existing.getDataValue("metadata"),
        };
        const optimizedPlaybackFile = path.join(destDir, `${md5}.compressed.mp4`);
        const { subtitleTracks, subtitleTrackWarnings } =
          await this.extractSubtitleTracksFromFile(
            filePath,
            md5,
            fileMetadata,
            ffmpeg
          );
        if (compressing && !existing.compressedFilePath) {
          await ffmpeg.compressVideo(filePath, optimizedPlaybackFile);
        } else if (
          !compressing &&
          !existing.compressedFilePath &&
          this.needsPlaybackOptimizedCopy(
            path.extname(filePath).toLowerCase(),
            fileMetadata
          )
        ) {
          await ffmpeg.optimizeVideoForPlayback(filePath, optimizedPlaybackFile);
          Object.assign(metadata, {
            playbackOptimized: true,
            playbackOptimizedReason:
              "Original container or audio codec is not reliably playable in Electron.",
          });
        }
        await existing.update({
          metadata: {
            ...metadata,
            subtitleTracks,
            subtitleTrackWarnings,
          },
        });
      } catch (err) {
        logger.warn("refresh subtitle metadata failed:", err.message);
      }
      existing.changed("updatedAt", true);
      existing.update({ updatedAt: new Date() });
      return existing;
    }

    // Generate ID
    const userId = settings.localStorageNamespace();
    const id = uuidv5(`${userId}/${md5}`, uuidv5.URL);
    logger.debug("Generated ID:", id);

    let destFile = path.join(
      destDir,
      compressing ? `${md5}.compressed.mp4` : `${md5}${extname}`
    );

    let metadata = {
      extname,
    };

    // Copy file to library
    try {
      // Create directory if not exists
      fs.ensureDirSync(destDir);

      // fetch metadata
      const ffmpeg = new FfmpegWrapper();
      const fileMetadata = await ffmpeg.generateMetadata(filePath);
      const { subtitleTracks, subtitleTrackWarnings } =
        await this.extractSubtitleTracksFromFile(
          filePath,
          md5,
          fileMetadata,
          ffmpeg
        );
      metadata = Object.assign(metadata, {
        ...fileMetadata,
        duration: fileMetadata.format.duration,
        subtitleTracks,
        subtitleTrackWarnings,
      });

      if (compressing) {
        // Compress file to destFile
        await ffmpeg.compressVideo(filePath, destFile);
      } else if (this.needsPlaybackOptimizedCopy(extname, fileMetadata)) {
        destFile = path.join(destDir, `${md5}.compressed.mp4`);
        await ffmpeg.optimizeVideoForPlayback(filePath, destFile);
        metadata = Object.assign(metadata, {
          playbackOptimized: true,
          playbackOptimizedReason:
            "Original container or audio codec is not reliably playable in Electron.",
        });
      } else {
        // Copy file
        fs.copyFileSync(filePath, destFile);
      }

      // Check if file copied
      fs.accessSync(destFile, fs.constants.R_OK);
    } catch {
      throw new Error(t("models.video.failedToCopyFile", { file: filePath }));
    }

    const {
      name = startCase(path.basename(filePath, extname)),
      description,
      source,
      coverUrl,
    } = params || {};
    const record = this.build({
      id,
      source,
      md5,
      name,
      description,
      coverUrl,
      metadata,
    });

    return record.save().catch((err) => {
      logger.error(err);
      // Remove copied file
      fs.removeSync(destFile);
      throw err;
    });
  }

  static notify(video: Video, action: "create" | "update" | "destroy") {
    if (!mainWindow.win) return;

    mainWindow.win.webContents.send("db-on-transaction", {
      model: "Video",
      id: video.id,
      action: action,
      record: video.toJSON(),
    });
  }
}
