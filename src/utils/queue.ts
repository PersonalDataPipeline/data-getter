import * as path from "path";
import getConfig from "./config.js";
import { makeDirectory, pathExists, readFile, writeFile } from "./fs.js";
import { RunLogger } from "./logger.js";
import { runDateUtc } from "./date-time.js";
import { ApiHandler, EpChronological, EpSnapshot } from "./types.js";

let queue: QueueEntry[] = [];
let queueFile = "";

////
/// Types
//

export interface QueueEntry {
  endpoint: string;
  runAfter: number;
  params: object;
  historic: boolean;
}

interface RunEntry extends Omit<QueueEntry, "runAfter"> {}

////
/// Helpers
//

const getStandardEntriesFor = (endpoint: string): QueueEntry[] => {
  return queue.filter((entry: QueueEntry) => {
    const sameEndpoint = entry.endpoint === endpoint;
    return sameEndpoint && isStandardEntry(entry);
  });
};

const isStandardEntry = (entry: QueueEntry) => {
  const hasParams = entryHasParams(entry);
  return !hasParams && !entry.historic;
};

const writeQueue = () => {
  if (!queueFile) {
    throw new Error("Trying to write to a queue that has not been initialized");
  }
  queue = queue.filter((entry) => entry);
  writeFile(queueFile, JSON.stringify(queue, null, 2));
};

////
/// Export
//

export const loadQueue = (apiHandler: ApiHandler) => {
  const apiName = apiHandler.getApiName();
  const dirPath = path.join(getConfig().outputDir, apiName);
  queueFile = path.join(dirPath, "_queue.json");

  if (!pathExists(queueFile)) {
    makeDirectory(dirPath);
    writeFile(queueFile, "[]");
    queue = [];
  } else {
    const queueContents = readFile(queueFile);
    queue = (queueContents ? JSON.parse(queueContents) : []) as QueueEntry[];
  }
};

export const entryHasParams = (entry: { params?: object }) => {
  return !!(entry.params && Object.keys(entry.params).length);
};

export const getQueue = () => {
  return queue;
};

export const getQueueFile = () => {
  return queueFile;
};

export const hasStandardEntryFor = (endpoint: string) => {
  return getStandardEntriesFor(endpoint).length > 0;
};

export const addEntry = ({
  runAfter,
  endpoint,
  params = {},
  historic = false,
}: {
  runAfter: number;
  endpoint: string;
  params?: object;
  historic?: boolean;
}) => {
  queue.push({ historic, runAfter, endpoint, params });
  writeQueue();
};

export const processQueue = (
  apiHandler: ApiHandler,
  logger: RunLogger,
  forceRun: boolean = false
): RunEntry[] => {
  if (!queueFile) {
    loadQueue(apiHandler);
  }

  const runQueue: RunEntry[] = [];
  const runDate = runDateUtc();
  const handledEndpoints: string[] = [];
  const handlerDict: { [key: string]: EpChronological | EpSnapshot } = {};
  for (const endpointHandler of apiHandler.endpointsPrimary) {
    handledEndpoints.push(endpointHandler.getEndpoint());
    handlerDict[endpointHandler.getEndpoint()] = endpointHandler;
  }

  for (const [index, entry] of queue.entries()) {
    const endpoint = entry.endpoint;

    // If an endpoint was removed from the handler, remove from the queue
    if (!handledEndpoints.includes(endpoint)) {
      logger.info({
        message: "Removing unknown endpoint",
        endpoint,
      });
      delete queue[index];
      continue;
    }

    // If we're too early for an entry to run, add back as-is
    if (!forceRun && entry.runAfter > runDate.seconds) {
      const waitMinutes = Math.ceil((entry.runAfter - runDate.seconds) / 60);
      logger.info({
        message: `Skipping ${entry.historic ? "historic" : "standard"} for ${waitMinutes} minutes`,
        endpoint,
      });
      continue;
    }

    const hasParams = entryHasParams(entry);

    logger.info({
      message: `Running ${entry.historic ? "historic" : "standard"} now ...`,
      endpoint,
    });

    runQueue.push({
      endpoint,
      historic: !!entry.historic,
      params: hasParams ? entry.params : {},
    });
  }

  writeQueue();
  return runQueue;
};

export const hasHistoricEntryFor = (endpoint: string) => {
  return (
    queue.filter((entry: QueueEntry) => {
      const sameEndpoint = entry.endpoint === endpoint;
      return sameEndpoint && entry.historic;
    }).length > 0
  );
};

export const updateStandardEntry = (
  epHandler: EpChronological | EpSnapshot,
  runAfter?: number
) => {
  const runDate = runDateUtc();
  const endpoint = epHandler.getEndpoint();
  let seenStandard = false;
  for (const [index, entry] of queue.entries()) {
    if (entry.endpoint !== endpoint || !isStandardEntry(entry)) {
      continue;
    }

    if (seenStandard) {
      delete queue[index];
      continue;
    }

    queue[index].runAfter = runAfter || epHandler.getDelay() + runDate.seconds;
    seenStandard = true;
  }
  writeQueue();
};

export const updateHistoricEntry = ({
  endpoint,
  runAfter,
  params,
}: {
  endpoint: string;
  runAfter: number;
  params?: object;
}) => {
  let seenHistoric = false;
  for (const [index, entry] of queue.entries()) {
    if (entry.endpoint !== endpoint || !entry.historic) {
      continue;
    }

    if (seenHistoric) {
      delete queue[index];
      continue;
    }

    queue[index].runAfter = runAfter;
    queue[index].params = params || queue[index].params;
    seenHistoric = true;
  }
  writeQueue();
};
