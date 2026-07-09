import fs from "fs-extra";
import path from "path";
import settings from "@main/settings";
import log from "@main/logger";
import proxyAgent from "@main/proxy-agent";

const logger = log.scope("tts/kokoro-q8-service");

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const MODEL_NAME = "kokoro-q8";
const MODEL_BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/main`;
const MODEL_MIN_BYTES = 80 * 1024 * 1024;

const REQUIRED_FILES = [
  { relativePath: "config.json" },
  { relativePath: "tokenizer.json" },
  { relativePath: "tokenizer_config.json" },
  {
    relativePath: "onnx/model_quantized.onnx",
    requiredBytes: MODEL_MIN_BYTES,
  },
];

class KokoroQ8Service {
  private loadedModel: any | null = null;
  private loadingPromise: Promise<any> | null = null;
  private downloadPromise: Promise<ReferenceTtsStatusType> | null = null;
  private downloading = false;
  private lastError?: string;

  modelDir() {
    return path.join(settings.userDataPath(), "models", MODEL_NAME);
  }

  private modelCacheDir() {
    return path.join(this.modelDir(), MODEL_ID);
  }

  private filePath(relativePath: string) {
    return path.join(this.modelCacheDir(), relativePath);
  }

  private clearLoadedModel() {
    this.loadedModel = null;
    this.loadingPromise = null;
  }

  status(): ReferenceTtsStatusType {
    const files = REQUIRED_FILES.map((file) => {
      const filePath = this.filePath(file.relativePath);
      const exists = fs.existsSync(filePath);
      const bytes = exists ? fs.statSync(filePath).size : 0;

      return {
        path: filePath,
        exists,
        bytes,
        requiredBytes: file.requiredBytes,
      };
    });

    const missing = files.some((file) => !file.exists);
    const invalid = files.some(
      (file) => file.requiredBytes && file.bytes < file.requiredBytes
    );
    const installed = !missing && !invalid;
    const state = this.downloading
      ? "downloading"
      : this.lastError
      ? "error"
      : this.loadedModel
      ? "loaded"
      : installed
      ? "installed"
      : invalid
      ? "invalid"
      : "missing";

    return {
      provider: "kokoro",
      model: MODEL_NAME,
      state,
      installed,
      modelDir: this.modelDir(),
      files,
      error: this.lastError,
    };
  }

  async downloadModel() {
    if (this.downloadPromise) {
      return this.downloadPromise;
    }

    this.downloading = true;
    this.lastError = undefined;

    this.downloadPromise = (async () => {
      await fs.ensureDir(this.modelCacheDir());
      const { fetch } = proxyAgent();

      for (const file of REQUIRED_FILES) {
        const destination = this.filePath(file.relativePath);
        const currentBytes = fs.existsSync(destination)
          ? fs.statSync(destination).size
          : 0;

        if (
          currentBytes > 0 &&
          (!file.requiredBytes || currentBytes >= file.requiredBytes)
        ) {
          continue;
        }

        const url = `${MODEL_BASE_URL}/${file.relativePath}`;
        const tmp = `${destination}.download`;
        logger.info(`Downloading Kokoro q8 file: ${url}`);
        await fs.ensureDir(path.dirname(destination));

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to download ${file.relativePath}: ${response.status} ${response.statusText}`
          );
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        if (file.requiredBytes && buffer.byteLength < file.requiredBytes) {
          throw new Error(
            `Downloaded ${file.relativePath} is too small for Kokoro q8`
          );
        }

        await fs.outputFile(tmp, buffer);
        await fs.move(tmp, destination, { overwrite: true });
      }

      this.clearLoadedModel();
      await this.validateLoadable();
      return this.status();
    })()
      .catch((err) => {
        this.lastError = err instanceof Error ? err.message : `${err}`;
        throw err;
      })
      .finally(() => {
        this.downloading = false;
        this.downloadPromise = null;
      });

    return this.downloadPromise;
  }

  async importModel(sourceDir: string) {
    this.lastError = undefined;
    await fs.ensureDir(this.modelCacheDir());
    const sourceBase = (await fs.pathExists(path.join(sourceDir, MODEL_ID)))
      ? path.join(sourceDir, MODEL_ID)
      : sourceDir;

    for (const file of REQUIRED_FILES) {
      const source = path.join(sourceBase, file.relativePath);
      if (!(await fs.pathExists(source))) {
        throw new Error(`Missing Kokoro q8 file: ${file.relativePath}`);
      }
      if (
        file.requiredBytes &&
        (await fs.stat(source)).size < file.requiredBytes
      ) {
        throw new Error(`Invalid Kokoro q8 file: ${file.relativePath}`);
      }
      const destination = this.filePath(file.relativePath);
      await fs.ensureDir(path.dirname(destination));
      await fs.copy(source, destination, { overwrite: true });
    }

    this.clearLoadedModel();
    await this.validateLoadable();
    return this.status();
  }

  private async validateLoadable() {
    try {
      await this.loadModel();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : `${err}`;
      throw err;
    }
  }

  private async loadModel() {
    const status = this.status();
    if (!status.installed) {
      throw new Error("Kokoro q8 model is not installed");
    }

    if (this.loadedModel) {
      return this.loadedModel;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = (async () => {
        const [{ KokoroTTS }, { env }] = await Promise.all([
          import("kokoro-js"),
          import("@huggingface/transformers"),
        ]);

        env.cacheDir = this.modelDir();
        env.localModelPath = this.modelDir();
        env.allowLocalModels = true;
        env.allowRemoteModels = false;

        const model = await KokoroTTS.from_pretrained(MODEL_ID, {
          dtype: "q8",
          device: "cpu",
        });
        this.loadedModel = model;
        return model;
      })().finally(() => {
        this.loadingPromise = null;
      });
    }

    return this.loadingPromise;
  }

  async generateToFile(params: {
    text: string;
    voice: string;
    speed: number;
    filePath: string;
  }) {
    this.lastError = undefined;

    try {
      const model = await this.loadModel();
      const audio = await model.generate(params.text, {
        voice: params.voice,
        speed: params.speed,
      });
      await fs.ensureDir(path.dirname(params.filePath));
      await audio.save(params.filePath);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : `${err}`;
      throw err;
    }
  }
}

export const kokoroQ8Service = new KokoroQ8Service();
