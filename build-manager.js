import { exec } from "child_process";
import fs from "fs";
import path from "path";

function run(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export class BuildManager {
  constructor(application) {
    this.application = application;
    this.buildPath = application.buildingPath;
    this.sourcePath = application.developmentPath;
    this.buildConfig = null;
  }

  loadBuildConfig(configPath) {
    this.buildConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return this.buildConfig;
  }

  async build(type = "development") {
    if (!this.buildConfig) throw new Error("Build configuration not loaded");

    const buildScript = this.buildConfig[type];
    if (!buildScript) throw new Error(`Build type '${type}' not defined in configuration`);

    return run(buildScript, { cwd: this.sourcePath });
  }

  async copyToBuildDirectory(outputDir = "") {
    if (!this.buildConfig) throw new Error("Build configuration not loaded");

    const sourceDir = path.join(this.sourcePath, this.buildConfig.outputDir || "");
    const targetDir = path.join(this.buildPath, outputDir);

    fs.mkdirSync(targetDir, { recursive: true });
    await fs.promises.cp(sourceDir, targetDir, { recursive: true, force: true });
    return targetDir;
  }

  async runTests() {
    if (!this.buildConfig?.testCommand) {
      throw new Error("Test command not defined in build configuration");
    }

    return run(this.buildConfig.testCommand, { cwd: this.sourcePath });
  }
}

export default BuildManager;
