import { createHash } from "crypto";
import { createReadStream } from "fs";
import settings from "./settings";
import path from "path";

const ENJOY_URL_PROTOCOL = "enjoy:";
const ENJOY_LIBRARY_HOST = "library";
const USER_DATA_LIBRARY_DIRECTORIES = new Set([
  "audios",
  "videos",
  "recordings",
  "speeches",
  "segments",
  "documents",
]);
const LIBRARY_DIRECTORIES = new Set([
  ...USER_DATA_LIBRARY_DIRECTORIES,
  "cache",
  "dictionaries",
  "waveforms",
]);

export function hashFile(
  path: string,
  options: { algo: string }
): Promise<string> {
  const algo = options.algo || "md5";
  return new Promise((resolve, reject) => {
    const hash = createHash(algo);
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export function hashBlob(
  blob: Blob,
  options: { algo: string }
): Promise<string> {
  const algo = options.algo || "md5";
  return new Promise((resolve, reject) => {
    const hash = createHash(algo);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        const buffer = Buffer.from(reader.result);
        hash.update(buffer);
        resolve(hash.digest("hex"));
      } else {
        reject(new Error("Unexpected result from FileReader"));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

export const isPathWithin = (root: string, filePath: string) => {
  const relative = path.relative(path.resolve(root), path.resolve(filePath));
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
};

export const resolvePathWithin = (root: string, relativePath: string) => {
  if (path.isAbsolute(relativePath)) return null;

  const filePath = path.resolve(root, relativePath);
  return isPathWithin(root, filePath) ? filePath : null;
};

export const isSafeFileName = (filename: string) =>
  Boolean(filename) &&
  filename !== "." &&
  filename !== ".." &&
  !filename.includes("\0") &&
  !filename.includes("/") &&
  !filename.includes("\\");

export const resolveEnjoyUrlToPath = (enjoyUrl: string) => {
  try {
    const url = new URL(enjoyUrl);
    if (
      url.protocol !== ENJOY_URL_PROTOCOL ||
      url.hostname !== ENJOY_LIBRARY_HOST ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    const [topLevelDirectory] = segments;

    if (
      !topLevelDirectory ||
      !LIBRARY_DIRECTORIES.has(topLevelDirectory) ||
      segments.some(
        (segment) =>
          segment === "." ||
          segment === ".." ||
          segment.includes("\0") ||
          segment.includes("/") ||
          segment.includes("\\")
      )
    ) {
      return null;
    }

    const root = USER_DATA_LIBRARY_DIRECTORIES.has(topLevelDirectory)
      ? settings.userDataPath()
      : settings.libraryPath();
    return resolvePathWithin(root, path.join(...segments));
  } catch {
    return null;
  }
};

/*
 * Convert an Enjoy library URL to an absolute local path. Local paths remain
 * supported for IPC callers that have not been normalized to Enjoy URLs yet.
 */
export function enjoyUrlToPath(value: string): string {
  if (!value.startsWith(ENJOY_URL_PROTOCOL)) return value;

  const filePath = resolveEnjoyUrlToPath(value);
  if (!filePath) {
    throw new Error("Invalid Enjoy library URL");
  }
  return filePath;
}

/*
 * Convert file path to enjoy url
 *
 * @param {string} filePath - file path
 * @returns {string} enjoy url
 */
export function pathToEnjoyUrl(filePath: string): string {
  const roots = [
    settings.userDataPath(),
    settings.libraryPath(),
  ];
  const resolvedFilePath = path.resolve(filePath);

  for (const root of roots) {
    if (!isPathWithin(root, resolvedFilePath)) continue;

    const segments = path.relative(root, resolvedFilePath).split(path.sep);
    if (!segments[0] || !LIBRARY_DIRECTORIES.has(segments[0])) continue;

    return `${ENJOY_URL_PROTOCOL}//${ENJOY_LIBRARY_HOST}/${segments
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`;
  }

  throw new Error("File is outside the Enjoy library");
}
