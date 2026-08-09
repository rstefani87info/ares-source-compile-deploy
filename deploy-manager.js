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

export class DeployManager {
  constructor(application) {
    this.application = application;
    this.buildPath = application.buildingPath;
    this.deployConfig = null;
  }

  loadDeployConfig(configPath) {
    this.deployConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return this.deployConfig;
  }

  async deploy(environment = "staging") {
    if (!this.deployConfig) throw new Error("Deployment configuration not loaded");

    const envConfig = this.deployConfig.environments?.[environment];
    if (!envConfig) throw new Error(`Environment '${environment}' not defined in configuration`);

    await this.executeHooks(envConfig.preDeployHooks);

    let result;
    switch (envConfig.type) {
      case "local":
        result = await this.deployToLocalDirectory(envConfig);
        break;
      case "custom":
        result = await this.executeCustomDeployment(envConfig);
        break;
      case "ftp":
      case "ssh":
        result = await this.executeRemoteDeployment(envConfig);
        break;
      default:
        throw new Error(`Unsupported deployment type: ${envConfig.type}`);
    }

    await this.executeHooks(envConfig.postDeployHooks);
    return result;
  }

  async deployToLocalDirectory(config) {
    if (!config.path) throw new Error("Local deployment path is required");
    fs.mkdirSync(config.path, { recursive: true });
    await fs.promises.cp(this.buildPath, config.path, {
      recursive: true,
      force: true,
      filter: (source) => path.resolve(source) !== path.resolve(config.path),
    });
    return { target: config.path };
  }

  executeCustomDeployment(config) {
    if (!config.command) throw new Error("Custom deployment command is required");
    return run(config.command, { cwd: this.buildPath });
  }

  executeRemoteDeployment(config) {
    if (!config.command) {
      throw new Error(`${config.type} deployment requires an explicit command`);
    }
    return run(config.command, { cwd: this.buildPath });
  }

  async executeHooks(hooks = []) {
    for (const hook of hooks) {
      await run(hook, { cwd: this.buildPath });
    }
  }
}

export default DeployManager;
