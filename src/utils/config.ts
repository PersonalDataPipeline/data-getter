import { homedir } from "os";
import { existsSync, readdirSync } from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

import { config as dotenvConfig } from "dotenv";

import { makeDirectory, pathExists } from "./fs.js";
import { ValidLogLevels } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.join(__dirname, "..", "..", ".env") });

const {
  DEBUG_OUTPUT = "false",
  DEBUG_SAVE_MOCKS = "false",
  DEBUG_ALL = "false",
  LOG_LEVEL,
  PATH_TO_CONFIG,
} = process.env;

////
/// Types
//

export interface Config {
  outputDir: string;
  filesOutputDir: string;
  compressJson: boolean;
  timezone: string;
  originDate: string;
  apis: {
    [key: string]: string[] | true;
  };
  apisSupported: string[];
  saveEmptyLogs: boolean;
  imports: string[];
  importsSupported: string[];
  logLevel: ValidLogLevels;
  debugSaveMocks: boolean;
  debugOutputDir: string;
  debugCompressJson: boolean;
}

interface ConfigFile extends Partial<Config> {}

////
/// Helpers
//

const validLogLevels: ValidLogLevels[] = ["debug", "info", "warn", "success", "error"];

const config: Config = {
  timezone: "GMT",
  outputDir: path.join(homedir(), "api-data"),
  filesOutputDir: path.join(homedir(), "api-data", "_files"),
  originDate: "1900-01-01",
  apis: {},
  apisSupported: [],
  imports: [],
  importsSupported: [],
  compressJson: true,
  logLevel: "info",
  debugSaveMocks: false,
  saveEmptyLogs: true,
  debugOutputDir: path.join(homedir(), "api-data-DEBUG"),
  debugCompressJson: false,
};

const configPath = PATH_TO_CONFIG
  ? PATH_TO_CONFIG
  : path.join(__dirname, "..", "..", ".config.js");

let configImport: null | ConfigFile = null;
let attemptedImport = false;
if (!attemptedImport && existsSync(configPath)) {
  try {
    configImport = (await import(configPath)) as object;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "<unknown error>";
    console.log(
      `❌ Config file ${configPath} exists but could not be loaded: ${errorMessage}`
    );
    process.exit(1);
  }
  attemptedImport = true;
}

////
/// Export
//

let processedConfig: Config | null = null;
export default (): Config => {
  if (processedConfig !== null) {
    return processedConfig;
  }

  let localConfig: ConfigFile = {};
  if (configImport !== null) {
    localConfig = (configImport as { default: object }).default as ConfigFile;
  }

  processedConfig = Object.assign({}, config, localConfig);

  if (DEBUG_OUTPUT === "true" || DEBUG_ALL === "true") {
    processedConfig.outputDir = localConfig.debugOutputDir || config.debugOutputDir;
    processedConfig.filesOutputDir =
      localConfig.filesOutputDir || path.join(processedConfig.outputDir, "_files");
    processedConfig.compressJson =
      localConfig.debugCompressJson || config.debugCompressJson;
  }

  if (DEBUG_SAVE_MOCKS === "true" || DEBUG_ALL === "true") {
    processedConfig.debugSaveMocks = true;
  }

  if (LOG_LEVEL && validLogLevels.includes(LOG_LEVEL as ValidLogLevels)) {
    processedConfig.logLevel = LOG_LEVEL as ValidLogLevels;
  }

  if (DEBUG_ALL === "true") {
    processedConfig.logLevel = "debug";
  }

  if (!pathExists(processedConfig.outputDir)) {
    makeDirectory(processedConfig.outputDir);
  }

  if (!pathExists(processedConfig.filesOutputDir)) {
    makeDirectory(processedConfig.filesOutputDir);
  }

  const apisSupported = readdirSync(path.join(__dirname, "..", "apis"));
  for (const apiName of Object.keys(processedConfig.apis)) {
    if (!apisSupported.includes(apiName)) {
      throw new Error(`Configured API "${apiName}" is not supported`);
    }
  }
  processedConfig.apisSupported = apisSupported;

  const importsSupported = readdirSync(path.join(__dirname, "..", "imports"));
  for (const importName of processedConfig.imports) {
    if (!importsSupported.includes(importName)) {
      throw new Error(`Configured import "${importName}" is not supported`);
    }
  }
  processedConfig.importsSupported = importsSupported;

  process.env.TZ = processedConfig.timezone;

  return processedConfig;
};
