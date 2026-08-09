import { execFile } from "child_process";
import axios from "axios";

const messages = {
  it: {
    repositoryCreated: "Repository creato con successo",
    repositoryCloned: "Repository clonato con successo",
    repositoryUpdated: "Repository aggiornato con successo",
    errorCreatingRepository: "Errore durante la creazione del repository",
    errorCloningRepository: "Errore durante il clonaggio del repository",
    errorUpdatingRepository: "Errore durante l'aggiornamento del repository",
  },
  en: {
    repositoryCreated: "Repository created successfully",
    repositoryCloned: "Repository cloned successfully",
    repositoryUpdated: "Repository updated successfully",
    errorCreatingRepository: "Error creating repository",
    errorCloningRepository: "Error cloning repository",
    errorUpdatingRepository: "Error updating repository",
  },
};

function choose(language, key) {
  return messages[language]?.[key] ?? messages.en[key] ?? key;
}

function parseCommand(command) {
  if (Array.isArray(command)) return command.map(String);
  return String(command)
    .match(/"[^"]*"|'[^']*'|\S+/g)
    ?.map((part) => part.replace(/^["']|["']$/g, "")) ?? [];
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
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

export class Repository {
  constructor(
    name,
    path,
    user,
    description = "",
    url = "",
    isPrivate = false,
    license = null,
    accessToken = null,
    defaultBranch = "main",
    language = "en"
  ) {
    if (!name) throw new Error("Repository name is required");
    if (!path) throw new Error("Repository path is required");

    this.name = String(name).toLowerCase();
    this.path = path;
    this.user = user;
    this.description = description?.en ?? description ?? "";
    this.url = url;
    this.isPrivate = Boolean(isPrivate);
    this.license = license;
    this.accessToken = accessToken;
    this.defaultBranch = defaultBranch ?? "main";
    this.language = language in messages ? language : "en";
    this.stashList = [];
    this.branchList = [];
  }

  message(key) {
    return choose(this.language, key);
  }

  async git(args, { cwd = this.path, callback = null } = {}) {
    const normalizedArgs = parseCommand(args);
    try {
      const result = await run("git", normalizedArgs, { cwd });
      callback?.(null, result.stdout, result.stderr);
      return result;
    } catch (error) {
      callback?.(error, error.stdout ?? "", error.stderr ?? "");
      throw error;
    }
  }

  exec(command, callback) {
    return this.git(command, { callback });
  }

  async createOnGitHub() {
    if (!this.accessToken) throw new Error("GitHub access token is required");

    const response = await axios.post(
      "https://api.github.com/user/repos",
      {
        name: this.name,
        description: this.description,
        private: this.isPrivate,
        auto_init: true,
        license_template: this.license ?? undefined,
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    this.url = response.data.clone_url ?? response.data.html_url;
    return response.data;
  }

  async createOnBitbucket() {
    if (!this.user) throw new Error("Bitbucket user is required");
    if (!this.accessToken) throw new Error("Bitbucket access token is required");

    const response = await axios.post(
      `https://api.bitbucket.org/2.0/repositories/${this.user}/${this.name}`,
      {
        scm: "git",
        is_private: this.isPrivate,
        description: this.description,
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    this.url = response.data.links?.clone?.find((link) => link.name === "https")?.href;
    return response.data;
  }

  init(targetPath = this.path) {
    return this.git(["init", targetPath], { cwd: process.cwd() });
  }

  createLocalRepository() {
    return this.init(this.path);
  }

  clone(targetPath = this.path) {
    if (!this.url) throw new Error("Repository URL is required");
    return this.git(["clone", this.url, targetPath], { cwd: process.cwd() });
  }

  add(...paths) {
    return this.git(["add", ...(paths.length ? paths : ["."])]);
  }

  commit(message) {
    if (!message) throw new Error("Commit message is required");
    return this.git(["commit", "-m", message]);
  }

  push(branch = this.defaultBranch) {
    return this.git(["push", "-u", "origin", branch]);
  }

  pull() {
    return this.git(["pull"]);
  }

  fetch() {
    return this.git(["fetch"]);
  }

  delete(...paths) {
    return this.git(["rm", "-r", ...(paths.length ? paths : ["."])]);
  }

  checkout(branch = this.defaultBranch, ...paths) {
    return this.git(["checkout", branch, ...paths]);
  }

  async loadAllBranches() {
    const { stdout } = await this.git(["branch", "-a"]);
    this.branchList = stdout
      .split(/\r?\n/)
      .map((branch) => branch.trim())
      .filter(Boolean);
    return this.branchList;
  }

  getAllBranches() {
    return this.branchList.map((branch) => branch.replace(/^\*\s*/, "").trim());
  }

  getCurrentBranch() {
    return this.branchList
      .find((branch) => branch.startsWith("*"))
      ?.replace(/^\*\s*/, "")
      .trim();
  }

  stash(message = null) {
    return this.git(["stash", ...(message ? ["push", "-m", message] : [])]);
  }

  stashPop() {
    return this.git(["stash", "pop"]);
  }

  async loadStashList() {
    const { stdout } = await this.git(["stash", "list"]);
    this.stashList = stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [ref, ...messageParts] = line.split(": ");
        return {
          ref,
          message: messageParts.join(": "),
          patches: [],
          loadPatches: async () => {
            const patch = await this.git(["stash", "show", "-p", ref]);
            return patch.stdout;
          },
        };
      });
    return this.stashList;
  }

  tag(name, message = name) {
    if (!name) throw new Error("Tag name is required");
    return this.git(["tag", "-a", name, "-m", message]);
  }

  release(name, message = `Release ${name}`) {
    return this.tag(name, message);
  }

  merge(fromBranch) {
    if (!fromBranch) throw new Error("Source branch is required");
    return this.git(["merge", fromBranch]);
  }

  editLastCommit(message) {
    if (!message) throw new Error("Commit message is required");
    return this.git(["commit", "--amend", "-m", message]);
  }
}
