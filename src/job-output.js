import path from "node:path";
import crypto from "node:crypto";
import { fileExists, getFileContent, isDirectory, isFile, getFilesRecursively } from "@ares/files";

const STATUS = {
  RUNNING: "RUNNING",
  DONE: "DONE",
  FAILED: "FAILED",
};

const LEVEL = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
  DEBUG: "DEBUG",
};

function nowISO() {
  return new Date().toISOString();
}

function fileStatsSyncOrNull(filePath) {
  try {
    if (!fileExists(filePath)) return null;
    if (isDirectory(filePath)) return { isDirectory: () => true, isFile: () => false };
    const content = getFileContent(filePath);
    return { size: Buffer.byteLength(content, "utf8"), isDirectory: () => false, isFile: () => true };
  } catch (_e) {
    return null;
  }
}

function sha256FileSync(filePath) {
  try {
    const content = getFileContent(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch (_e) {
    return null;
  }
}

function detectMime(name, fallback = "application/octet-stream") {
  const ext = path.extname(name).toLowerCase();
  const map = {
    ".json": "application/json",
    ".js": "text/javascript",
    ".ts": "text/typescript",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".html": "text/html",
    ".css": "text/css",
    ".sql": "text/sql",
    ".log": "text/plain",
    ".zip": "application/zip",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".xml": "application/xml",
    ".yml": "application/x-yaml",
    ".yaml": "application/x-yaml",
  };
  return map[ext] ?? fallback;
}

export class JobOutput {
  constructor(jobName, { projectRoot = process.cwd(), executionMode = "in-process", logToConsole = false } = {}) {
    if (!jobName) throw new Error("jobName is required");
    this.jobName = String(jobName);
    this.status = STATUS.RUNNING;
    this.startedAt = nowISO();
    this.completedAt = null;
    this.durationMs = null;
    this.projectRoot = projectRoot;
    this.executionMode = executionMode;
    this.pid = process.pid;
    this.artifacts = [];
    this.logs = [];
    this.result = null;
    this.error = null;
    this._startHr = process.hrtime.bigint();
    this.logToConsole = logToConsole;
  }

  pushLog(level, source, message, data = undefined) {
    const entry = {
      timestamp: nowISO(),
      level: level in LEVEL ? level : LEVEL.INFO,
      source: source ?? this.jobName,
      message: message ?? "",
    };
    if (data !== undefined) entry.data = data;
    this.logs.push(entry);
    if (this.logToConsole) {
      const prefix = `[${level}] [${source ?? this.jobName}]`;
      if (level === "ERROR" || level === "WARN") {
        console.warn(`${prefix} ${message}`);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
    return entry;
  }

  logInfo(source, message, data) {
    return this.pushLog(LEVEL.INFO, source, message, data);
  }

  logWarn(source, message, data) {
    return this.pushLog(LEVEL.WARN, source, message, data);
  }

  logError(source, message, data) {
    return this.pushLog(LEVEL.ERROR, source, message, data);
  }

  logDebug(source, message, data) {
    return this.pushLog(LEVEL.DEBUG, source, message, data);
  }

  addArtifact({
    filePath,
    name,
    kind = "file",
    storage = "local",
    metadata = undefined,
    computeChecksum = true,
  }) {
    if (!filePath) throw new Error("artifact filePath is required");
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(this.projectRoot, filePath);
    const stats = fileStatsSyncOrNull(absolute);
    const artifact = {
      path: absolute,
      name: name ?? path.basename(absolute),
      kind,
      mime_type: detectMime(name ?? path.basename(absolute)),
      bytes: stats?.size ?? null,
      checksum: computeChecksum ? sha256FileSync(absolute) : null,
      storage,
    };
    if (metadata !== undefined) artifact.metadata = metadata;
    this.artifacts.push(artifact);
    return artifact;
  }

  addDirectoryArtifacts(dirPath, { storage = "local", computeChecksum = false, baseName = null } = {}) {
    const absolute = path.isAbsolute(dirPath) ? dirPath : path.resolve(this.projectRoot, dirPath);
    const stat = fileStatsSyncOrNull(absolute);
    if (!stat?.isDirectory()) return [];
    const entries = getFilesRecursively(absolute, /.*/);
    const out = [];
    for (const full of entries) {
      if (!isFile(full)) continue;
      const relBase = baseName ?? path.basename(absolute);
      const rel = path.relative(absolute, full);
      out.push(
        this.addArtifact({
          filePath: full,
          name: path.join(relBase, rel),
          kind: "file",
          storage,
          computeChecksum,
        })
      );
    }
    return out;
  }

  markDone(result = undefined) {
    this.status = STATUS.DONE;
    this.completedAt = nowISO();
    this.durationMs = Number((process.hrtime.bigint() - this._startHr) / 1_000_000n);
    if (result !== undefined) this.result = result;
    return this.toJSON();
  }

  markFailed(error) {
    this.status = STATUS.FAILED;
    this.completedAt = nowISO();
    this.durationMs = Number((process.hrtime.bigint() - this._startHr) / 1_000_000n);
    if (error instanceof Error) {
      this.error = {
        name: error.name,
        message: error.message,
        stack: error.stack ?? null,
        extra: Object.fromEntries(
          Object.entries(error).filter(([k]) => !["name", "message", "stack"].includes(k))
        ),
      };
    } else if (error != null) {
      this.error = { message: String(error) };
    } else {
      this.error = { message: "Unknown error" };
    }
    return this.toJSON();
  }

  toJSON() {
    return {
      jobName: this.jobName,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      durationMs: this.durationMs,
      projectRoot: this.projectRoot,
      executionMode: this.executionMode,
      pid: this.pid,
      artifacts: this.artifacts,
      logs: this.logs,
      result: this.result,
      error: this.error,
    };
  }
}

export const JOB_STATUS = STATUS;
export const LOG_LEVEL = LEVEL;

export default JobOutput;
