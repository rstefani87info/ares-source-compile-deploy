import { exec } from "child_process";
import path from "path";
import fs from "fs";

class BuildManager {
  constructor(application) {
    this.application = application;
    this.buildPath = application.buildingPath;
    this.sourcePath = application.developmentPath;
    this.buildConfig = null;
  }

  loadBuildConfig(configPath) {
    try {
      const configData = fs.readFileSync(configPath, "utf8");
      this.buildConfig = JSON.parse(configData);
      return true;
    } catch (error) {
      console.error(`Error loading build configuration: ${error.message}`);
      return false;
    }
  }

  build(type = "development") {
    if (!this.buildConfig) {
      console.error("Build configuration not loaded");
      return false;
    }

    const buildScript = this.buildConfig[type];
    if (!buildScript) {
      console.error(`Build type '${type}' not defined in configuration`);
      return false;
    }

    return new Promise((resolve, reject) => {
      console.log(`Starting ${type} build...`);

      exec(buildScript, { cwd: this.sourcePath }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Build error: ${error.message}`);
          reject(error);
          return;
        }

        if (stdout) {
          console.log(`Build output: ${stdout}`);
        }

        if (stderr) {
          console.warn(`Build warnings: ${stderr}`);
        }

        console.log(`${type} build completed successfully`);
        resolve(true);
      });
    });
  }

  copyToBuildDirectory(outputDir = "") {
    const targetDir = path.join(this.buildPath, outputDir);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const sourceDir = path.join(
        this.sourcePath,
        this.buildConfig.outputDir || ""
      );

      exec(
        `xcopy "${sourceDir}" "${targetDir}" /E /I /Y`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error copying build files: ${error.message}`);
            reject(error);
            return;
          }

          console.log(`Build files copied to ${targetDir}`);
          resolve(true);
        }
      );
    });
  }

  runTests() {
    if (!this.buildConfig || !this.buildConfig.testCommand) {
      console.error("Test command not defined in build configuration");
      return false;
    }

    return new Promise((resolve, reject) => {
      console.log("Running tests...");

      exec(
        this.buildConfig.testCommand,
        { cwd: this.sourcePath },
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Test error: ${error.message}`);
            reject(error);
            return;
          }

          console.log(`Test output: ${stdout}`);
          resolve(true);
        }
      );
    });
  }
}

export default BuildManager;
