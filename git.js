import { exec } from "child_process";
import axios from "axios";
import { chooseMessage } from "@ares/core/i18n.js";

const vocabulary = {
  it: {
    invalidRepositoryName: "Il nome del repository è obbligatorio",
    invalidUser: "L'utente è obbligatorio",
    invalidAccessToken: "Il token di accesso è obbligatorio",
    invalidDescription: "La descrizione del repository è obbligatoria",
    invalidUrl: "L'URL del repository è obbligatoria",
    invalidLicense: "La licenza del repository è obbligatoria",
    invalidDefaultBranch: "La branch di default del repository è obbligatoria",
    repositoryCreated: "Repository creato con successo",
    repositoryCloned: "Repository clonato con successo",
    repositoryUpdated: "Repository aggiornato con successo",
    repositoryDeleted: "Repository eliminato con successo",
    errorCreatingRepository: "Errore durante la creazione del repository",
    errorCloningRepository: "Errore durante il clonaggio del repository",
    errorUpdatingRepository: "Errore durante l'aggiornamento del repository",
    errorDeletingRepository: "Errore durante l'eliminazione del repository",
  },
  en: {
    invalidRepositoryName: "Repository name is required",
    invalidUser: "User is required",
    invalidAccessToken: "Access token is required",
    invalidDescription: "Repository description is required",
    invalidUrl: "Repository URL is required",
    invalidLicense: "Repository license is required",
    invalidDefaultBranch: "Repository default branch is required",
    repositoryCreated: "Repository created successfully",
    repositoryCloned: "Repository cloned successfully",
    repositoryUpdated: "Repository updated successfully",
    repositoryDeleted: "Repository deleted successfully",
    errorCreatingRepository: "Error creating repository",
    errorCloningRepository: "Error cloning repository",
    errorUpdatingRepository: "Error updating repository",
    errorDeletingRepository: "Error deleting repository",
  },
};

export class Repository {
  constructor(
    name,
    path,
    user,
    description = null,
    url = null,
    isPrivate = false,
    license = null,
    accessToken = null,
    defaultBranch = null,
    language = "en"
  ) {
    this.name = name.toLower();
    this.path = path;
    this.user = user;
    this.description = description;
    this.url = url;
    this.isPrivate = isPrivate;
    this.license = license;
    this.accessToken = accessToken;
    this.defaultBranch = defaultBranch;
    this.language = language in vocabulary ? language : "en";

    this.stashList = [];
    this.branchList = [];
  }
  
  // Remove the getMessage helper method and use chooseMessage instead
  
  createOnGitHub() {
    const data = {
      name: this.name,
      description: this.description,
      private: this.isPrivate,
      auto_init: true,
      license: this.license,
    };

    const options = {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    axios
      .post("https://api.github.com/repos", data, options)
      .then((response) => {
        console.log(chooseMessage(this.language, vocabulary, "repositoryCreated"), response.data);
      })
      .catch((error) => {
        console.error(chooseMessage(this.language, vocabulary, "errorCreatingRepository"), error.response.data);
      });
    return `https://github.com/${user}/${repositoryName}`;
  }
  createOnBitbucket() {
    const data = {
      name: this.name,
      description: this.description,
      private: this.isPrivate,
      scm: "git",
      owner: {
        username: this.user,
      },
      license: this.license,
    };
    const options = {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    axios
      .post("https://api.bitbucket.org/api/2.0/repositories", data, options)
      .then((response) => {
        console.log(chooseMessage(this.language, vocabulary, "repositoryCreated"), response.data);
      })
      .catch((error) => {
        console.error(chooseMessage(this.language, vocabulary, "errorCreatingRepository"), error.response.data);
      });
    return `https://bitbucket.org/${user}/${repositoryName}`;
  }
  createLocalRepository() {
    let completePath = (this.path ? this.path + "/" : "") + this.name;
    this.exec(`init ${completePath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }

  clone() {
    this.exec(`clone ${this.url} ${this.path}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`${chooseMessage(this.language, vocabulary, "errorCloningRepository")}: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(chooseMessage(this.language, vocabulary, "repositoryCloned"), stdout);
      }
      if (stderr) {
        console.error(stderr);
      }
    });
  }

  add(...paths) {
    if (paths.length === 0) paths = ".";
    this.exec(`add ${paths.join(" ")}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }

  commit(message) {
    this.exec(`commit -m "${message}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }

  push(branch = null) {
    if (!branch) branch = this.defaultBranch;
    this.exec(`push -u origin ${branch}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }

  pull() {
    this.exec(`pull`, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }

  fetch() {
    this.exec(`fetch`, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }
  delete(...paths) {
    if (paths.length === 0) paths = ".";
    this.exec(`rm -r ${paths.join(" ")}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }

  checkout(branch = null, ...paths) {
    if (!branch) branch = this.defaultBranch;
    if (paths.length === 0) paths = ".";
    this.exec(
      `git checkout ${branch} ${paths.join(" ")}`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`error: ${error.message}`);
          return;
        }
        if (stdout) {
          console.log(`stdout: ${stdout}`);
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }
      }
    );
  }
  getAllBranches() {
    return this.branches.map((branch) => branch.replace("*", "").trim());
  }
  getCurrentBranch() {
    return this.branches
      .where((branch) => branch.includes("*"))
      .map((branch) => branch.replace("*", "").trim())
      .pop();
  }
  loadAllBranches() {
    this.exec(`branch -a`, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
        this.branches = stdout.split("\n");
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }
  stash(message) {
    this.exec(
      `git stash ${message ? `-m ${JSON.stringify(message ?? "")}` : ""}`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`error: ${error.message}`);
          return;
        }
        if (stdout) {
          console.log(`stdout: ${stdout}`);
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }
      }
    );
  }
  stashPop() {
    this.exec(`stash pop`, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }

  loadStashList() {
    this.exec(`stash list`, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
        this.stashList = stdout
          .split("\n")
          .replaceAll(/stash@\{d+\}: /)
          .map((stash) => {
            stash = stash
              .trim()
              .replace("wip on ", "")
              .replace(":", "")
              .split(" ");
            stash = {
              branch: stash[0],
              message: stash[1],
              patches: [],
              loadPatches: () => {
                this.exec(
                  `git stash show -p ${stash[0]}`,
                  (error, stdout, stderr) => {
                    if (error) {
                      console.error(`error: ${error.message}`);
                      return;
                    }
                    if (stdout) {
                      console.log(`stdout: ${stdout}`);
                      stash.patches = stdout.split("\n");
                      // TODO split patches in patches per file object
                    }
                    if (stderr) {
                      console.error(`stderr: ${stderr}`);
                    }
                  }
                );
              },
            };
            return stash;
          });
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }

  init() {
    this.exec(`init `, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
    });
  }

  githubCreateAndPull() {}

  exec(command, callback) {
    exec(`git ${command}`, { cwd: this.path }, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      callback(error, stdout, stderr);
    });
  }

  release(name, message) {
    this.exec(
      `git release -a ${name} -m "${message}"`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`${this.getMessage("errorCreatingRepository")}: ${error.message}`);
          return;
        }
        console.log(`${this.getMessage("repositoryCreated")}: ${name}`);
      }
    );
  }

  merge(fromBranch, toBranch) {
    this.exec(
      `git merge ${fromBranch} ${toBranch}`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`${this.getMessage("errorUpdatingRepository")}: ${error.message}`);
          return;
        }
        console.log(`${this.getMessage("repositoryUpdated")}: ${fromBranch} into ${toBranch}`);
      }
    );
  }

  commit(message) {
    this.exec(`commit -m "${message}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`${this.getMessage("errorUpdatingRepository")}: ${error.message}`);
        return;
      }
      console.log(`${this.getMessage("repositoryUpdated")}: ${message}`);
    });
  }

  editLastCommit(message) {
    this.exec(`commit --amend -m "${message}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`${this.getMessage("errorUpdatingRepository")}: ${error.message}`);
        return;
      }
      console.log(`${this.getMessage("repositoryUpdated")}: ${message}`);
    });
  }

  tag(name, message) {
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error(chooseMessage(this.language, vocabulary, "invalidRepositoryName"));
    }

    this.exec(`tag -a ${name} -m "${message}"`, (error, stdout, stderr) => {
      if (error) {
        throw new Error(
          `${chooseMessage(this.language, vocabulary, "errorCreatingRepository")}: ${error.message}`
        );
      }
      console.log(`${chooseMessage(this.language, vocabulary, "repositoryCreated")}: ${name}`);
    });
  }
}
