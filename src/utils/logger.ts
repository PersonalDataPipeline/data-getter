import { AxiosError } from "axios";

import { getFormattedDate, getFormattedTime, runDateUtc } from "./date-time.js";
import { makeOutputPath, writeFile } from "./fs.js";
import getConfig from "./config.js";

////
/// Types
//

export interface RunLogger {
  info: (entry: InfoEntry) => void;
  error: (entry: ErrorEntry) => void;
  success: (entry: SuccessEntry) => void;
  shutdown: (apiName?: string) => void;
}

export interface InfoEntry {
  message: string;
  stage: string;
  endpoint?: string;
}

export interface ErrorEntry {
  stage: string;
  error: unknown;
  endpoint?: string;
}

export interface SuccessEntry {
  endpoint: string;
  filesWritten?: number;
  filesSkipped?: number;
  total?: number;
  days?: number;
}

export interface RunLogInfoEntry {
  stage: "startup" | "http" | "parsing_response" | "queue_management" | "other";
  type: "info" | "error" | "success";
  timeMs: number;
  message: string;
  endpoint?: string;
}

export interface RunLogErrorEntry extends RunLogInfoEntry {
  data: object;
}

export interface RunLogSuccessEntry
  extends Omit<RunLogInfoEntry, "endpoint" | "message" | "stage"> {
  endpoint: string;
  filesWritten?: number;
  filesSkipped?: number;
  importFile?: string;
  total?: number;
  days?: number;
}

export interface RunLogFile {
  dateTime: string;
  startTimeMs: number;
  entries: AnyLogEntry[];
  endTimeMs?: number;
  runDurationMs?: number;
}

type AnyLogEntry = RunLogInfoEntry | RunLogSuccessEntry | RunLogErrorEntry;

////
/// Helpers
//

const runLog: RunLogFile = {
  dateTime: runDateUtc().dateTime,
  startTimeMs: Date.now(),
  entries: [],
};

const print = (entry: AnyLogEntry) => {
  console.log(
    "%s %s [LEVEL: %s] %s%s",
    getFormattedDate(),
    getFormattedTime(),
    entry.type,
    "endpoint" in entry && entry.endpoint ? `[ENDPOINT: ${entry.endpoint}] ` : "",
    "message" in entry ? entry.message : ""
  );
};

////
/// Export
//

const info = ({ message, stage, endpoint }: InfoEntry) => {
  const entry = {
    type: "info",
    timeMs: Date.now(),
    message,
    stage,
    endpoint,
  } as RunLogInfoEntry;
  runLog.entries.push(entry);
  print(entry);
};

const success = ({ endpoint, filesWritten, filesSkipped, total, days }: SuccessEntry) => {
  const entry = {
    type: "success",
    timeMs: Date.now(),
    endpoint,
    filesWritten,
    filesSkipped,
    total,
    days,
  } as RunLogSuccessEntry;
  runLog.entries.push(entry);
  print({
    ...entry,
    message: `Got ${total} total for ${days} days; ${filesWritten} files written and ${filesSkipped} files skipped.`,
  });
};

const error = ({ stage, endpoint, error }: ErrorEntry) => {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Unknown error";

  const data =
    error instanceof AxiosError && error.response ? (error.response.data as object) : {};

  const entry = {
    type: "error",
    timeMs: Date.now(),
    stage,
    endpoint,
    message,
    data,
  } as RunLogErrorEntry;
  runLog.entries.push(entry);
  print(entry);
};

const shutdown = (apiName?: string) => {
  const savePath = [...(apiName ? [apiName, "_runs"] : ["_runs"])];
  const outputPath = makeOutputPath(savePath);

  runLog.endTimeMs = Date.now();
  runLog.runDurationMs = Math.floor(runLog.endTimeMs - runLog.startTimeMs);
  const logContent = JSON.stringify(runLog, null, 2);

  writeFile(outputPath, JSON.stringify(runLog, null, 2));

  if (getConfig().debugLogOutput) {
    console.log(logContent);
  }

  runLog.entries = [];
};

const runLogger: RunLogger = {
  info,
  success,
  error,
  shutdown,
};

export default runLogger;
