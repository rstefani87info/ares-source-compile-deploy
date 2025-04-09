import { exec } from "child_process";
import path from "path";
import fs from "fs";

class DeployManager {
  constructor(application) {
    this.application = application;
    this.buildPath = application.buildingPath;
    this.deployConfig = null;
  }

  loadDeployConfig(configPath) {
    try {
      const configData = fs.readFileSync(configPath, "utf8");
      this.deployConfig = JSON.parse(configData);
      return true;
    } catch (error) {
      console.error(`Error loading deployment configuration: ${error.message}`);
      return false;
    }
  }

  deploy(environment = "staging") {
    if (!this.deployConfig) {
      console.error("Deployment configuration not loaded");
      return false;
    }

    const envConfig = this.deployConfig.environments[environment];
    if (!envConfig) {
      console.error(
        `Environment '${environment}' not defined in configuration`
      );
      return false;
    }

    console.log(`Starting deployment to ${environment}...`);

    if (envConfig.preDeployHooks) {
      this._executeHooks(envConfig.preDeployHooks);
    }

    switch (envConfig.type) {
      case "ftp":
        return this._deployViaFTP(envConfig);
      case "ssh":
        return this._deployViaSSH(envConfig);
      case "local":
        return this._deployToLocalDirectory(envConfig);
      case "custom":
        return this._executeCustomDeployment(envConfig);
      default:
        console.error(`Unsupported deployment type: ${envConfig.type}`);
        return Promise.reject(
          new Error(`Unsupported deployment type: ${envConfig.type}`)
        );
    }
  }

  _deployViaFTP(config) {
    return new Promise((resolve, reject) => {
      const ftpCommand = `"${path.join(
        __dirname,
        "tools",
        "ftp-deploy.bat"
      )}" "${this.buildPath}" "${config.host}" "${config.username}" "${
        config.password
      }" "${config.remotePath}"`;

      exec(ftpCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`FTP deployment error: ${error.message}`);
          reject(error);
          return;
        }

        console.log(`FTP deployment output: ${stdout}`);

        if (config.postDeployHooks) {
          this._executeHooks(config.postDeployHooks);
        }

        console.log(`Deployment to ${config.host} completed successfully`);
        resolve(true);
      });
    });
  }

  _deployViaSSH(config) {
    return new Promise((resolve, reject) => {
      const sshCommand = `"${path.join(
        __dirname,
        "tools",
        "ssh-deploy.bat"
      )}" "${this.buildPath}" "${config.host}" "${config.username}" "${
        config.keyFile
      }" "${config.remotePath}"`;

      exec(sshCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`SSH deployment error: ${error.message}`);
          reject(error);
          return;
        }

        console.log(`SSH deployment output: ${stdout}`);

        if (config.postDeployHooks) {
          this._executeHooks(config.postDeployHooks);
        }

        console.log(`Deployment to ${config.host} completed successfully`);
        resolve(true);
      });
    });
  }

  _deployToLocalDirectory(config) {
    return new Promise((resolve, reject) => {
      const targetDir = config.path;

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      exec(
        `xcopy "${this.buildPath}" "${targetDir}" /E /I /Y`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Local deployment error: ${error.message}`);
            reject(error);
            return;
          }

          console.log(`Files deployed to ${targetDir}`);

          if (config.postDeployHooks) {
            this._executeHooks(config.postDeployHooks);
          }

          console.log(`Local deployment completed successfully`);
          resolve(true);
        }
      );
    });
  }

  _executeCustomDeployment(config) {
    return new Promise((resolve, reject) => {
      exec(config.command, { cwd: this.buildPath }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Custom deployment error: ${error.message}`);
          reject(error);
          return;
        }

        console.log(`Custom deployment output: ${stdout}`);

        if (config.postDeployHooks) {
          this._executeHooks(config.postDeployHooks);
        }

        console.log(`Custom deployment completed successfully`);
        resolve(true);
      });
    });
  }

  _executeHooks(hooks) {
    hooks.forEach((hook) => {
      try {
        exec(hook, { cwd: this.buildPath }, (error, stdout, stderr) => {
          if (error) {
            console.error(`Hook execution error: ${error.message}`);
            return;
          }

          console.log(`Hook output: ${stdout}`);
        });
      } catch (error) {
        console.error(`Error executing hook: ${error.message}`);
      }
    });
  }
}

export default DeployManager;
