# @ares/scd

## Purpose

`@ares/scd` is the aReS module for source, build, deploy, Git repository management, and code modeling/generation.

It absorbs the useful features of the former `@ares/programming` module. `@ares/programming` remains as a compatibility wrapper.

Beyond the classic CI/CD + Git jobs, the module also exposes an **AI-assisted command family** (`make prompt` / `make docs` / `make ticket`, `work ticket`, `analyze code`) that delegates generation, revision and code analysis to the aReS AI bridge (`@ares/ai-3rd-party`) and writes structured artifacts into `.prompt/` and `.ares/tasks/`.

## Installation

```json
{
  "type": "module",
  "bin": { "ares-scd": "./cli.js" },
  "exports": {
    ".": "./index.js",
    "./index": "./index.js",
    "./index.js": "./index.js",
    "./application": "./application.js",
    "./build-manager": "./build-manager.js",
    "./deploy-manager": "./deploy-manager.js",
    "./git": "./git.js",
    "./git-flow": "./git-flow.js",
    "./programming": "./programming.js",
    "./job-output": "./src/job-output.js",
    "./cli": "./cli.js",
    "./package.json": "./package.json"
  },
  "dependencies": {
    "axios": "^1.7.2"
  }
}
```

```bash
yarn add @ares/scd
# inside a Yarn Workspaces monorepo
yarn workspace <app> add @ares/scd
```

The CLI is dependency-free: it uses its own `parseArgs` (no yargs) and the `@ares/ai-3rd-party` dependency is loaded dynamically only for the `make`/`work ticket`/`analyze code` commands.

## Quickstart

**As a library:**

```js
import { Application, BuildManager, Repository, programming } from "@ares/scd";

const app = new Application("my-app");
const build = new BuildManager(app);
const repo = new Repository("my-app", process.cwd(), "user");
const flow = new programming.Flow().addStep("return", new programming.Return("ok"));
```

**As a CLI (13 commands, human or JSON output):**

```bash
# General help + global flags
ares-scd --help

# Build / deploy / git workflow
ares-scd init my-app
ares-scd build  --type development
ares-scd deploy --env staging
ares-scd test
ares-scd git --init --commit "Initial commit" --push
ares-scd git-status --json
ares-scd git-flow-start --type feature --name add-imports
ares-scd git-flow-finish --type feature --name add-imports

# AI-assisted commands (offline stub with --sample)
ares-scd make prompt --text "Vuoi preparare un prompt su..." --sample
ares-scd make docs --scope ./src --lang it --sample
ares-scd make ticket --text "..." --sample
ares-scd work ticket <filename-or-slug> --sample
ares-scd analyze code --scope ./src --max-depth 3 --sample
```

## CLI & the `--json` flag

> **Output strategy**:
> - default = human-readable terminal output.
> - with `-j, --json` = structured JSON on stdout (or stderr on FAILED), conforming to `JobOutput`.
> - `--sample, -s` = use an offline stub AI instead of the real `@ares/ai-3rd-party` provider (all `make`/`work`/`analyze` commands).

### Command list (13 total)

| Command | jobName | Purpose |
|---|---|---|
| `init <name>` | `scd-init` | Init a SCD project (default `build-config.json`) |
| `build` | `scd-build` | Run build (`--type development`) + copy artifacts |
| `deploy` | `scd-deploy` | Run deploy (`--env staging`) |
| `test` | `scd-test` | Run the test suite from `build-config.json` |
| `git` | `scd-git` | Generic Git actions (`--init/--commit/--push/--tag/--message/--user`) |
| `git-status` | `scd-git-status` | Repo status (branches, current branch, working tree) |
| `git-flow-start` | `scd-git-flow-start` | Start feature/release/hotfix (off develop or main for hotfix) |
| `git-flow-finish` | `scd-git-flow-finish` | Finish feature/release/hotfix (merge + tag + delete branch) |
| `make prompt` | `scd-make-prompt` | AI restructure of a prompt into `.prompt/<ts>-<slug>.md` |
| `make docs` | `scd-make-docs` | AI generation of module docs into `.ares/docs/<lang>/index.md` |
| `make ticket` | `scd-make-ticket` | AI generation of a structured ticket checklist into `.ares/tasks/` |
| `work ticket <file>` | `scd-work-ticket` | AI execution of a ticket checklist (reports completed/next steps) |
| `analyze code` | `scd-analyze-code` | AI code analysis → suggested tickets in `.ares/tasks/suggested/` |

Compound/alias spellings are also accepted: `make prompt` / `prompt:make`, `make docs` / `docs:make`, `make ticket` / `ticket:make`, `work ticket` / `ticket:work`, `analyze code` / `code:analyze`, and the hyphenated `make-prompt` / `make-docs` / `make-ticket` / `work-ticket` / `analyze-code`.

### Job naming convention (for orchestrators)

Used by `POST /api/jobs/execute` in `dev-test-server` (Phase 4):

```
scd-init, scd-build, scd-deploy, scd-test, scd-git, scd-git-status,
scd-git-flow-start, scd-git-flow-finish,
scd-make-prompt, scd-make-docs, scd-make-ticket, scd-work-ticket, scd-analyze-code
```

The `jobName` uses hyphens (e.g. `scd-build`), not colons.

## Standard `JobOutput` shape (public exports)

The `JobOutput` class in the subpath `@ares/scd/job-output` is the contractual shape used by **every command** under `-j/--json`, and consumed by the server.

```js
import { JobOutput, JOB_STATUS, LOG_LEVEL } from "@ares/scd/job-output";

const out = new JobOutput("scd-build", { projectRoot: process.cwd() });
out.logInfo("build/script", "> tsc --project tsconfig.json");
out.addArtifact({ filePath: "./dist/app.js", name: "dist/app.js", storage: "local" });
out.markDone({ buildHash: "abc123" });
process.stdout.write(JSON.stringify(out.toJSON(), null, 2));
```

Minimum JSON shape:

```json
{
  "jobName": "scd-build",
  "status": "DONE",
  "startedAt": "2026-08-20T15:24:13.459Z",
  "completedAt": "2026-08-20T15:24:17.881Z",
  "durationMs": 4422,
  "projectRoot": "C:\\progetti\\my-app",
  "executionMode": "in-process",
  "pid": 30472,
  "artifacts": [
    {
      "path": "C:\\progetti\\my-app\\build\\dist\\app.js",
      "name": "dist/app.js",
      "kind": "file",
      "mime_type": "text/javascript",
      "bytes": 123800,
      "checksum": "<sha256 optional>",
      "storage": "local"
    }
  ],
  "logs": [
    {
      "timestamp": "2026-08-20T15:24:13.460Z",
      "level": "INFO | WARN | ERROR | DEBUG",
      "source": "build/script",
      "message": "> tsc --project tsconfig.json"
    }
  ],
  "result": { "buildHash": "abc123" },
  "error": null
}
```

Public `JobOutput` members:
- constants `JOB_STATUS` (`RUNNING|DONE|FAILED`) and `LOG_LEVEL` (`INFO|WARN|ERROR|DEBUG`);
- `constructor(jobName, { projectRoot?, executionMode? })` (throws if `jobName` is missing);
- `pushLog(level, source, message, data?)` plus shortcuts `logInfo`, `logWarn`, `logError`, `logDebug`;
- `addArtifact({ filePath, name?, kind?, storage?, metadata?, computeChecksum? })` (stats + mime detection + optional SHA-256; resolves relative to `projectRoot`);
- `addDirectoryArtifacts(dirPath, { storage?, computeChecksum?, baseName? })`;
- `markDone(result?)` → sets `DONE`, returns `toJSON()`;
- `markFailed(error)` → serialises `{ name, message, stack, extra }`, returns `toJSON()`;
- `toJSON()`.

## Public APIs (exports)

### Root entrypoint `@ares/scd`

Main exports:
- `Application`, `DataSource`, `DataSourceEntity`, `DataSourceView`
- `BuildManager` (+ `DefaultBuildManager`), `DeployManager` (+ `DefaultDeployManager`)
- `Repository`, `GitFlow` (+ `DefaultGitFlow`)
- `createSuite(application, options?)` (alias `crateSuite`) → `{ application, build, deploy, repository, gitFlow }`
- `programming` namespace
- metamodel aliases: `ProgrammingApplication`, `ApplicationMember`, `SourceFile`, `Flow`, `Class`, `Interface`, `Method`, `Property`, `Type`, `EcmaScriptDriver`, `writeEcmaClass`, `writeEcmaMember`, `writeEcmaMethod`, `classDesignPatterns`, `Comment`, `Constructor`, `Condition`, `Data`, `Definition`, `Return`, `Call`, `Error`, `ModuleMethod`, `ModuleProperty`, `ProgramModule`, `Ternary`, `TernaryAssignation`, `Attribute`
- `cli` (= `main` from `cli.js`)

### Additional stable public subpaths

| Subpath | Contents |
|---|---|
| `@ares/scd/job-output` | `JobOutput` class, `JOB_STATUS`, `LOG_LEVEL` |
| `@ares/scd/application.js` | `Application`, `DataSource`, `DataSourceEntity`, `DataSourceView` |
| `@ares/scd/build-manager.js` | `BuildManager` |
| `@ares/scd/deploy-manager.js` | `DeployManager` |
| `@ares/scd/git.js` | `Repository` + raw Git commands |
| `@ares/scd/git-flow.js` | `GitFlow` (start/finish feature/release/hotfix) |
| `@ares/scd/programming.js` | `programming` namespace (code generation model) |
| `@ares/scd/cli.js` | CLI entrypoint (`main`), `makePromptCommand`, `makeDocsCommand`, `makeTicketCommand`, `workTicketCommand`, `analyzeCodeCommand`, and analysis helpers `extractKeywords`, `analyzeCodebaseContext`, `scoreFileRelevance`, `extractSnippet`, `buildContextBlock` |

## Configuration

### Build

`BuildManager` reads a per-environment commands JSON file (`./build-config.json` by default):

```json
{
  "development": "npm run build:dev",
  "production": "npm run build:prod",
  "outputDir": "dist",
  "testCommand": "npm test"
}
```

### Deploy

`DeployManager` reads an environments JSON file (`./deploy-config.json` by default):

```json
{
  "environments": {
    "staging": { "type": "local",  "path": "./deploy/staging" },
    "prod":    { "type": "custom", "command": "rsync ..." }
  }
}
```

Supported types: `local`, `custom`, `ftp`, `ssh` (the last two require an explicit `command`), with optional pre/post hooks.

## Compatibility Notes

`@ares/programming` is kept as a wrapper around `@ares/scd/programming.js`. New code should import directly from `@ares/scd`.

## Shared contract

Within the "application managing" perimeter, `@ares/scd` aligns to the Phase-1 foundation ticket `../../../.ares/tasks/20260819-phase1-dev-tools-foundation-contract.md` — especially for CLI naming, job outputs, and integration with the maintenance datasource.

## Tests

```bash
yarn workspace @ares/scd test
node ./test/smoke.test.js
```

## Notes

- See Phases 3–4 in `../../../application-managing-report.md` for `@ares/dev-test-server` integration (hybrid in-process/subprocess runner) and the `JOBS_FAST_SET` list.
- Extra operational playbooks: `../application-playbook.md`, `../build-manager-playbook.md`, `../deploy-manager-playbook.md`, `../git-playbook.md`, `../git-flow-playbook.md`.
- The `project:*` command family (context/docs/task/audit/diagram/overview/task-from-draft/task-doctor) is planned but not yet implemented (see `.ares/tasks/20260827-project-cli-commands.md`).
