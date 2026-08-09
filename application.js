import fs from "fs";
import path from "path";

function readPackageMetadata(directoryPath) {
  const packageJsonPath = path.join(directoryPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch {
    return {};
  }
}

export class Application {
  constructor(
    name,
    version = "1.0.0",
    basePath = process.cwd(),
    developmentPath = path.join(basePath, "src"),
    librariesPath = path.join(basePath, "lib"),
    buildingPath = path.join(basePath, "build"),
    documentationPath = path.join(basePath, "docs"),
    author = "",
    description = "",
    url = "",
    git = null,
    flow = null,
    userSettings = {},
    endPoint = ""
  ) {
    if (!name) throw new Error("Application name is required");
    if (!version) throw new Error("Application version is required");
    if (!basePath) throw new Error("Base path is required");

    this.name = name;
    this.version = version;
    this.basePath = basePath;
    this.developmentPath = developmentPath;
    this.librariesPath = librariesPath;
    this.buildingPath = buildingPath;
    this.documentationPath = documentationPath;
    this.author = author;
    this.description = description;
    this.url = url;
    this.git = git;
    this.flow = flow;
    this.userSettings = userSettings;
    this.endPoint = endPoint;
  }

  get id() {
    return this.name.replaceAll(/\W/g, "_").toLowerCase();
  }

  createDirectories() {
    for (const directory of [
      this.basePath,
      this.developmentPath,
      this.librariesPath,
      this.buildingPath,
      this.documentationPath,
    ]) {
      fs.mkdirSync(directory, { recursive: true });
    }
    return true;
  }

  showGitAsHTML() {
    if (!this.git) return '<span class="no-git">No Git repository</span>';
    const label = this.git.name ?? this.git.url ?? "Repository";
    const link = this.git.url ? `<a href="${this.git.url}">${this.git.url}</a>` : "";
    return `<div class="git-info"><span class="git-repo">${label}</span>${link}</div>`;
  }

  showFlowAsHTML() {
    if (!this.flow) return '<span class="no-flow">No workflow defined</span>';
    return [
      '<div class="flow-info">',
      `<span class="flow-type">${this.flow.type ?? "Standard flow"}</span>`,
      `<div class="flow-description">${this.flow.description ?? ""}</div>`,
      "</div>",
    ].join("");
  }

  showAsHTML(classes = [], i18n = null) {
    const detailsLabel = i18n?.t?.("application.details") ?? "details";
    const officialUrlLabel = i18n?.t?.("application.official.url") ?? "official URL";
    return `
      <div class="${this.constructor.name} ${classes.join(" ")}" id="${this.id}">
        <h1>${this.name} ${this.version}</h1>
        <details>
          <summary>${detailsLabel}</summary>
          <ul>
            <li class="official-url"><label>${officialUrlLabel}</label> <a href="${this.url}">${this.url}</a></li>
            <li class="git-url">${this.showGitAsHTML()}</li>
          </ul>
        </details>
        <hr/>
        <p>${this.description}</p>
        ${this.showFlowAsHTML()}
      </div>
    `;
  }

  static scan(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`Directory does not exist: ${directoryPath}`);
    }

    const packageJson = readPackageMetadata(directoryPath);
    const name = packageJson.name ?? path.basename(directoryPath);
    const basePath = directoryPath;
    const git =
      packageJson.repository
        ? {
            name,
            url:
              typeof packageJson.repository === "string"
                ? packageJson.repository
                : packageJson.repository.url,
          }
        : null;

    return new Application(
      name,
      packageJson.version ?? "1.0.0",
      basePath,
      path.join(basePath, "src"),
      path.join(basePath, "lib"),
      path.join(basePath, "build"),
      path.join(basePath, "docs"),
      packageJson.author ?? "",
      packageJson.description ?? "",
      packageJson.homepage ?? "",
      git
    );
  }
}

export class DataSource extends Application {
  constructor(name, version, basePath, options = {}) {
    super(
      name,
      version,
      basePath,
      options.developmentPath ?? path.join(basePath, "datasources"),
      options.librariesPath ?? path.join(basePath, "lib"),
      options.buildingPath ?? path.join(basePath, "build"),
      options.documentationPath ?? path.join(basePath, "docs"),
      options.author ?? "",
      options.description ?? "",
      options.url ?? "",
      options.git ?? null,
      options.flow ?? null,
      options.userSettings ?? {},
      options.endPoint ?? ""
    );
  }
}

export class DataSourceEntity extends DataSource {
  constructor(parentDataSource, name, indexType = "primary", options = {}) {
    super(
      name,
      options.version ?? parentDataSource.version,
      options.basePath ?? path.join(parentDataSource.developmentPath, name),
      options
    );
    this.parentDataSource = parentDataSource;
    this.indexType = indexType;
  }
}

export class DataSourceView extends DataSourceEntity {
  constructor(parentDataSource, name, indexType = "view", options = {}) {
    super(parentDataSource, name, indexType, options);
  }
}
