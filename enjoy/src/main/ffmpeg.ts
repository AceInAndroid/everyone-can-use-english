import { ipcMain } from "electron";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "@andrkrn/ffprobe-static";
import Ffmpeg from "fluent-ffmpeg";
import log from "@main/logger";
import path from "path";
import fs from "fs-extra";
import settings from "@main/settings";
import { FFMPEG_CONVERT_WAV_OPTIONS } from "@/constants";
import { enjoyUrlToPath, pathToEnjoyUrl } from "@main/utils";

/*
 * ffmpeg and ffprobe bin file will be in /app.asar.unpacked instead of /app.asar
 * the /samples folder is also in /app.asar.unpacked
 */
Ffmpeg.setFfmpegPath(ffmpegPath.replace("app.asar", "app.asar.unpacked"));
Ffmpeg.setFfprobePath(ffprobePath.replace("app.asar", "app.asar.unpacked"));
const __dirname = import.meta.dirname.replace("app.asar", "app.asar.unpacked");

const logger = log.scope("ffmpeg");
export default class FfmpegWrapper {
  checkCommand(): Promise<boolean> {
    const ffmpeg = Ffmpeg();
    const sampleFile = path.join(__dirname, "samples", "jfk.wav");
    return new Promise((resolve) => {
      ffmpeg.input(sampleFile).getAvailableFormats((err) => {
        if (err) {
          logger.error("Command not valid:", err);
          resolve(false);
        } else {
          logger.info("Command valid, available formats");
          resolve(true);
        }
      });
    });
  }

  generateMetadata(input: string): Promise<Ffmpeg.FfprobeData> {
    const ffmpeg = Ffmpeg();
    return new Promise((resolve, reject) => {
      ffmpeg
        .input(input)
        .on("start", (commandLine) => {
          logger.info("Spawned FFmpeg with command: " + commandLine);
        })
        .on("error", (err) => {
          logger.error(err);
          reject(err);
        })
        .ffprobe((err, metadata) => {
          if (err) {
            logger.error(err);
            reject(err);
          }

          resolve(metadata);
        });
    });
  }

  generateCover(input: string, output: string): Promise<string> {
    const ffmpeg = Ffmpeg();
    return new Promise((resolve, reject) => {
      ffmpeg
        .input(input)
        .thumbnail({
          count: 1,
          filename: path.basename(output),
          folder: path.dirname(output),
        })
        .on("start", (commandLine) => {
          logger.info("Spawned FFmpeg with command: " + commandLine);
          fs.ensureDirSync(path.dirname(output));
        })
        .on("end", () => {
          logger.info(`File ${output} created`);
          resolve(output);
        })
        .on("error", (err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  ensureSampleRate(
    input: string,
    output: string,
    sampleRate = 16000
  ): Promise<string> {
    logger.info(`Trying to convert ${input} to 16-bit file ${output}`);
    if (fs.pathExistsSync(output)) {
      logger.warn(`File ${output} already exists, deleting.`);
      fs.removeSync(output);
    }

    const ffmpeg = Ffmpeg();
    return new Promise((resolve, reject) => {
      ffmpeg
        .input(input)
        .outputOptions("-ar", `${sampleRate}`)
        .on("error", (err) => {
          logger.error(err);
          reject(err);
        })
        .on("end", () => {
          logger.info(`File ${output} created`);
          resolve(output);
        })
        .save(output);
    });
  }

  convertToWav(
    input: string,
    output: string,
    options: string[] = []
  ): Promise<string> {
    const ffmpeg = Ffmpeg();
    return new Promise((resolve, reject) => {
      ffmpeg
        .input(input)
        .outputOptions(
          "-ar",
          "16000",
          "-ac",
          "1",
          "-c:a",
          "pcm_s16le",
          ...options
        )
        .on("start", (commandLine) => {
          logger.debug(`Trying to convert ${input} to ${output}`);
          logger.info("Spawned FFmpeg with command: " + commandLine);
          fs.ensureDirSync(path.dirname(output));
        })
        .on("end", (stdout, stderr) => {
          if (stdout) {
            logger.debug(stdout);
          }

          if (stderr) {
            logger.info(stderr);
          }

          if (fs.existsSync(output)) {
            resolve(output);
          } else {
            reject(new Error("FFmpeg command failed"));
          }
        })
        .on("error", (err: Error) => {
          logger.error(err);
          reject(err);
        })
        .save(output);
    });
  }

  async prepareForWhisper(input: string, output: string): Promise<string> {
    const metadata = await this.generateMetadata(input);

    if (metadata.format.format_name === "wav") {
      if (metadata.streams[0].sample_rate === 16000) {
        logger.info(`File ${input} already in 16-bit WAVE format`);
        return input;
      } else {
        return this.ensureSampleRate(
          input,
          input.replace(path.extname(input), "_16bit.wav")
        );
      }
    }

    logger.info(`Trying to convert ${input} to 16-bit WAVE file ${output}`);
    if (fs.pathExistsSync(output)) {
      logger.warn(`File ${output} already exists, deleting.`);
      fs.removeSync(output);
    }

    return this.convertToWav(input, output);
  }

  async transcode(
    input: string,
    output?: string,
    options?: string[]
  ): Promise<string> {
    input = enjoyUrlToPath(input);

    if (!output) {
      output = path.join(settings.cachePath(), `${path.basename(input)}.wav`);
    } else {
      output = enjoyUrlToPath(output);
    }

    options = options || FFMPEG_CONVERT_WAV_OPTIONS;

    const ffmpeg = Ffmpeg();
    return new Promise((resolve, reject) => {
      ffmpeg
        .input(input)
        .outputOptions(...options)
        .on("start", (commandLine) => {
          logger.debug(`Trying to convert ${input} to ${output}`);
          logger.info("Spawned FFmpeg with command: " + commandLine);
          fs.ensureDirSync(path.dirname(output));
        })
        .on("end", (stdout, stderr) => {
          if (stdout) {
            logger.debug(stdout);
          }

          if (stderr) {
            logger.info(stderr);
          }

          if (fs.existsSync(output)) {
            resolve(pathToEnjoyUrl(output));
          } else {
            reject(new Error("FFmpeg command failed"));
          }
        })
        .on("error", (err: Error) => {
          logger.error(err);
          reject(err);
        })
        .save(output);
    });
  }

  // Crop video or audio from start to end time to a mp3 file
  // Save the file to the output path
  crop(
    input: string,
    options: {
      startTime: number;
      endTime: number;
      output: string;
    }
  ) {
    const { startTime, endTime, output } = options;
    const duration = endTime - startTime;
    if (duration <= 0) {
      throw new Error("Invalid crop range");
    }

    const ffmpeg = Ffmpeg();

    return new Promise((resolve, reject) => {
      ffmpeg
        .input(input)
        .outputOptions(
          "-ss",
          startTime.toString(),
          "-t",
          duration.toString(),
          "-map",
          "0:a:0?",
          "-vn",
          "-sn",
          "-dn"
        )
        .on("start", (commandLine) => {
          logger.info("Spawned FFmpeg with command: " + commandLine);
          fs.ensureDirSync(path.dirname(output));
        })
        .on("end", () => {
          logger.info(`File "${output}" created`);
          resolve(output);
        })
        .on("error", (err) => {
          logger.error(err);
          reject(err);
        })
        .save(output);
    });
  }

  // Concatenate videos or audios into a single file
  concat(inputs: string[], output: string) {
    let command = Ffmpeg();
    inputs.forEach((input) => {
      command = command.input(input);
    });
    return new Promise((resolve, reject) => {
      command
        .on("start", (commandLine) => {
          logger.info("Spawned FFmpeg with command: " + commandLine);
          fs.ensureDirSync(path.dirname(output));
        })
        .on("end", () => {
          logger.info(`File "${output}" created`);
          resolve(output);
        })
        .on("error", (err) => {
          logger.error(err);
          reject(err);
        })
        .mergeToFile(output, settings.cachePath());
    });
  }

  compressVideo(input: string, output: string) {
    const ffmpeg = Ffmpeg();
    return new Promise((resolve, reject) => {
      ffmpeg
        .input(input)
        .outputOptions(
          "-c:v",
          "libx264",
          "-tag:v",
          "avc1",
          "-movflags",
          "faststart",
          "-crf",
          "30",
          "-preset",
          "superfast",
          "-c:a",
          "aac",
          "-b:a",
          "128k"
        )
        .on("start", (commandLine) => {
          logger.info("Spawned FFmpeg with command: " + commandLine);
          fs.ensureDirSync(path.dirname(output));
        })
        .on("end", () => {
          logger.info(`File "${output}" created`);
          resolve(output);
        })
        .on("error", (err) => {
          logger.error(err);
          reject(err);
        })
        .save(output);
    });
  }

  optimizeVideoForPlayback(input: string, output: string) {
    const ffmpeg = Ffmpeg();
    return new Promise((resolve, reject) => {
      ffmpeg
        .input(input)
        .outputOptions(
          "-map",
          "0:v:0",
          "-map",
          "0:a:0?",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-movflags",
          "faststart",
          "-map_chapters",
          "-1",
          "-dn",
          "-sn"
        )
        .on("start", (commandLine) => {
          logger.info("Spawned FFmpeg with command: " + commandLine);
          fs.ensureDirSync(path.dirname(output));
        })
        .on("end", () => {
          logger.info(`File "${output}" created`);
          resolve(output);
        })
        .on("error", (err) => {
          logger.error(err);
          reject(err);
        })
        .save(output);
    });
  }

  compressAudio(input: string, output: string) {
    const ffmpeg = Ffmpeg();
    return new Promise((resolve, reject) => {
      ffmpeg
        .input(input)
        .outputOptions(
          "-ar",
          "16000",
          "-b:a",
          "32000",
          "-ac",
          "1",
          "-preset",
          "superfast"
        )
        .on("start", (commandLine) => {
          logger.info("Spawned FFmpeg with command: " + commandLine);
          fs.ensureDirSync(path.dirname(output));
        })
        .on("end", () => {
          logger.info(`File "${output}" created`);
          resolve(output);
        })
        .on("error", (err) => {
          logger.error(err.message);
          reject(err);
        })
        .save(output);
    });
  }

  async extractSubtitle(params: {
    input: string;
    streamIndex: number;
    outputFormat?: "srt" | "vtt";
    sidecarPath?: string;
  }): Promise<{
    text: string;
    format: "srt" | "vtt";
    track: {
      streamIndex: number;
      sidecarPath?: string;
    };
  }> {
    const { streamIndex, outputFormat = "srt" } = params;
    const input = enjoyUrlToPath(params.input);
    const sidecarPath = params.sidecarPath
      ? this.ensureSubtitleSidecarPath(params.sidecarPath)
      : path.join(
          settings.cachePath(),
          `${path.basename(input)}.${streamIndex}.${outputFormat}`
        );

    if (fs.pathExistsSync(sidecarPath)) {
      return {
        text: await fs.readFile(sidecarPath, "utf-8"),
        format: outputFormat,
        track: {
          streamIndex,
          sidecarPath: pathToEnjoyUrl(sidecarPath),
        },
      };
    }

    const tmpOutput = `${sidecarPath}.${Date.now()}.tmp.${outputFormat}`;
    fs.ensureDirSync(path.dirname(tmpOutput));

    const ffmpeg = Ffmpeg();
    await new Promise<void>((resolve, reject) => {
      ffmpeg
        .input(input)
        .outputOptions(
          "-map",
          `0:${streamIndex}`,
          "-c:s",
          outputFormat === "vtt" ? "webvtt" : "srt"
        )
        .on("start", (commandLine) => {
          logger.info("Spawned FFmpeg with command: " + commandLine);
        })
        .on("end", () => {
          resolve();
        })
        .on("error", (err: Error) => {
          logger.error(err);
          fs.remove(tmpOutput).catch(() => {});
          reject(err);
        })
        .save(tmpOutput);
    });

    if (!fs.pathExistsSync(tmpOutput)) {
      throw new Error("FFmpeg subtitle extraction failed");
    }

    fs.ensureDirSync(path.dirname(sidecarPath));
    fs.moveSync(tmpOutput, sidecarPath, { overwrite: true });

    return {
      text: await fs.readFile(sidecarPath, "utf-8"),
      format: outputFormat,
      track: {
        streamIndex,
        sidecarPath: pathToEnjoyUrl(sidecarPath),
      },
    };
  }

  async readSubtitleSidecar(params: {
    sidecarPath: string;
    format?: "srt" | "vtt";
  }): Promise<{
    text: string;
    format: "srt" | "vtt";
    track: {
      sidecarPath: string;
    };
  }> {
    const sidecarPath = this.ensureSubtitleSidecarPath(params.sidecarPath);
    if (!fs.pathExistsSync(sidecarPath)) {
      throw new Error("Subtitle sidecar missing. Please re-import the video.");
    }

    return {
      text: await fs.readFile(sidecarPath, "utf-8"),
      format: params.format || "srt",
      track: {
        sidecarPath: pathToEnjoyUrl(sidecarPath),
      },
    };
  }

  private ensureSubtitleSidecarPath(sidecarPath: string) {
    const resolvedPath = path.resolve(enjoyUrlToPath(sidecarPath));
    const subtitlesRoot = path.resolve(
      settings.userDataPath(),
      "videos",
      "subtitles"
    );
    const relative = path.relative(subtitlesRoot, resolvedPath);

    if (
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      ![".srt", ".vtt"].includes(path.extname(resolvedPath).toLowerCase())
    ) {
      throw new Error("Invalid subtitle sidecar path");
    }

    return resolvedPath;
  }

  registerIpcHandlers() {
    ipcMain.handle("ffmpeg-check-command", async () => {
      return await this.checkCommand();
    });

    ipcMain.handle(
      "ffmpeg-transcode",
      async (_event, input, output, options) => {
        return await this.transcode(input, output, options);
      }
    );

    ipcMain.handle("ffmpeg-read-subtitle-sidecar", async (_event, params) => {
      return await this.readSubtitleSidecar(params);
    });
  }
}
