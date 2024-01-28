import { existsSync } from "fs";

const { DEBUG = false } = process.env;

////
/// Types
//

interface Config {
  outputDir: string;
  compressJson: boolean;
  debug?: boolean;
}

////
/// Helpers
//

const config: Config = {
  outputDir: "/Users/joshcanhelp/Scripts/cortex/_data",
  compressJson: true,
};

if (DEBUG === "true") {
  config.debug = true;
  config.compressJson = false;
  config.outputDir = "/Users/joshcanhelp/Scripts/cortex/_data_debug";
}

if (!existsSync(config.outputDir)) {
  console.log(`❌ Output path "${config.outputDir}" does not exist`);
  process.exit();
}

export default (): Config => {
  return config;
};
