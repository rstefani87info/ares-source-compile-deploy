# Documentazione @ares/scd

## Scopo

`@ares/scd` è il modulo aReS per la gestione di sorgenti, build, deploy, repository Git e modellazione/generazione di codice. Assorbe le funzionalità utili del vecchio `@ares/programming`, che resta come wrapper di compatibilità.

Oltre al classico set di job CI/CD + Git, il modulo espone anche una **famiglia di comandi assistiti da AI** (`make prompt` / `make docs` / `make ticket`, `work ticket`, `analyze code`) che delega la generazione, la revisione e l'analisi del codice al bridge AI di aReS (`@ares/ai-3rd-party`) e scrive artefatti strutturati in `.prompt/` e `.ares/tasks/`.

## Installazione

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
# oppure in un workspace
yarn workspace <app> add @ares/scd
```

La CLI è senza dipendenze: usa un proprio `parseArgs` (niente yargs) e la dipendenza `@ares/ai-3rd-party` viene caricata dinamicamente solo per i comandi `make`/`work ticket`/`analyze code`.

## Quickstart

**Come libreria:**

```js
import { Application, BuildManager, Repository, programming } from "@ares/scd";

const app = new Application("my-app");
const build = new BuildManager(app);
const repo = new Repository("my-app", process.cwd(), "user");
const flow = new programming.Flow().addStep("return", new programming.Return("ok"));
```

**Come CLI (13 comandi, output umano o JSON):**

```bash
# Aiuto generale + flag globali
ares-scd --help

# Workflow build / deploy / git
ares-scd init my-app
ares-scd build  --type development
ares-scd deploy --env staging
ares-scd test
ares-scd git --init --commit "Initial commit" --push
ares-scd git-status --json
ares-scd git-flow-start --type feature --name add-imports
ares-scd git-flow-finish --type feature --name add-imports

# Comandi AI (offline stub con --sample)
ares-scd make prompt --text "Vuoi preparare un prompt su..." --sample
ares-scd make docs --scope ./src --lang it --sample
ares-scd make ticket --text "..." --sample
ares-scd work ticket <filename-or-slug> --sample
ares-scd analyze code --scope ./src --max-depth 3 --sample
```

## CLI e flag `--json`

> **Strategia output**:
> - default = output umano, leggibile in terminale.
> - con `-j, --json` = JSON strutturato su stdout (o stderr se FAILED), conforme allo shape `JobOutput`.
> - `--sample, -s` = usa uno stub AI offline al posto del provider reale `@ares/ai-3rd-party` (tutti i comandi `make`/`work`/`analyze`).

### Elenco comandi (13)

| Comando | jobName | Scopo |
|---|---|---|
| `init <name>` | `scd-init` | Inizializza progetto SCD (default `build-config.json`) |
| `build` | `scd-build` | Esegue build (`--type development`) + copia artefatti |
| `deploy` | `scd-deploy` | Esegue deploy (`--env staging`) |
| `test` | `scd-test` | Lancia la suite di test da `build-config.json` |
| `git` | `scd-git` | Azioni Git generiche (`--init/--commit/--push/--tag/--message/--user`) |
| `git-status` | `scd-git-status` | Stato repo (branch, branch corrente, working tree) |
| `git-flow-start` | `scd-git-flow-start` | Avvia feature/release/hotfix (da develop, o main per hotfix) |
| `git-flow-finish` | `scd-git-flow-finish` | Chiude feature/release/hotfix (merge + tag + delete branch) |
| `make prompt` | `scd-make-prompt` | Ristrutturazione AI di un prompt in `.prompt/<ts>-<slug>.md` |
| `make docs` | `scd-make-docs` | Generazione AI di documentazione in `.ares/docs/<lang>/index.md` |
| `make ticket` | `scd-make-ticket` | Generazione AI di un ticket checklist in `.ares/tasks/` |
| `work ticket <file>` | `scd-work-ticket` | Esecuzione AI di un ticket checklist (report completed/next steps) |
| `analyze code` | `scd-analyze-code` | Analisi AI del codice → ticket suggeriti in `.ares/tasks/suggested/` |

Sono accettate anche le forme composte/alias: `make prompt` / `prompt:make`, `make docs` / `docs:make`, `make ticket` / `ticket:make`, `work ticket` / `ticket:work`, `analyze code` / `code:analyze`, oltre alle forme con trattino `make-prompt` / `make-docs` / `make-ticket` / `work-ticket` / `analyze-code`.

### Naming job per orchestratori

Convenzione esposta su `POST /api/jobs/execute` (dev-test-server, Fase 4):

```
scd-init, scd-build, scd-deploy, scd-test, scd-git, scd-git-status,
scd-git-flow-start, scd-git-flow-finish,
scd-make-prompt, scd-make-docs, scd-make-ticket, scd-work-ticket, scd-analyze-code
```

Il `jobName` usa i trattini (es. `scd-build`), non i due punti.

## Shape `JobOutput` standard (export pubblici)

La classe `JobOutput` nel subpath `@ares/scd/job-output` è la forma contrattuale usata **da tutti i comandi** quando passano `-j`/`--json`, e consumata dal server.

```js
import { JobOutput, JOB_STATUS, LOG_LEVEL } from "@ares/scd/job-output";

const out = new JobOutput("scd-build", { projectRoot: process.cwd() });
out.logInfo("build/script", "> tsc --project tsconfig.json");
out.addArtifact({ filePath: "./dist/app.js", name: "dist/app.js", storage: "local" });
out.markDone({ buildHash: "abc123" });
process.stdout.write(JSON.stringify(out.toJSON(), null, 2));
```

Shape minima del JSON prodotto:

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
      "checksum": "<sha256 opzionale>",
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

Member pubblici `JobOutput`:
- costanti `JOB_STATUS` (`RUNNING|DONE|FAILED`) e `LOG_LEVEL` (`INFO|WARN|ERROR|DEBUG`);
- `constructor(jobName, { projectRoot?, executionMode? })` (lancia errore se manca `jobName`);
- `pushLog(level, source, message, data?)` più shortcut `logInfo`, `logWarn`, `logError`, `logDebug`;
- `addArtifact({ filePath, name?, kind?, storage?, metadata?, computeChecksum? })` (stat + detect mime + SHA-256 opzionale; risolve i relativi rispetto a `projectRoot`);
- `addDirectoryArtifacts(dirPath, { storage?, computeChecksum?, baseName? })`;
- `markDone(result?)` → imposta `DONE`, ritorna `toJSON()`;
- `markFailed(error)` → serializza `{ name, message, stack, extra }`, ritorna `toJSON()`;
- `toJSON()`.

## API pubbliche (exports)

### Entrypoint root `@ares/scd`

Export principali:
- `Application`, `DataSource`, `DataSourceEntity`, `DataSourceView`
- `BuildManager` (+ `DefaultBuildManager`), `DeployManager` (+ `DefaultDeployManager`)
- `Repository`, `GitFlow` (+ `DefaultGitFlow`)
- `createSuite(application, options?)` (alias `crateSuite`) → `{ application, build, deploy, repository, gitFlow }`
- namespace `programming`
- alias metamodello: `ProgrammingApplication`, `ApplicationMember`, `SourceFile`, `Flow`, `Class`, `Interface`, `Method`, `Property`, `Type`, `EcmaScriptDriver`, `writeEcmaClass`, `writeEcmaMember`, `writeEcmaMethod`, `classDesignPatterns`, `Comment`, `Constructor`, `Condition`, `Data`, `Definition`, `Return`, `Call`, `Error`, `ModuleMethod`, `ModuleProperty`, `ProgramModule`, `Ternary`, `TernaryAssignation`, `Attribute`
- `cli` (= `main` da `cli.js`)

### Subpath pubblici aggiuntivi (stabili)

| Subpath | Contenuto |
|---|---|
| `@ares/scd/job-output` | `JobOutput` class, `JOB_STATUS`, `LOG_LEVEL` |
| `@ares/scd/application.js` | `Application`, `DataSource`, `DataSourceEntity`, `DataSourceView` |
| `@ares/scd/build-manager.js` | `BuildManager` |
| `@ares/scd/deploy-manager.js` | `DeployManager` |
| `@ares/scd/git.js` | `Repository` + comandi grezzi Git |
| `@ares/scd/git-flow.js` | `GitFlow` (start/finish feature/release/hotfix) |
| `@ares/scd/programming.js` | Namespace `programming` (modello generazione codice) |
| `@ares/scd/cli.js` | Entrypoint CLI (`main`), `makePromptCommand`, `makeDocsCommand`, `makeTicketCommand`, `workTicketCommand`, `analyzeCodeCommand`, e helper di analisi `extractKeywords`, `analyzeCodebaseContext`, `scoreFileRelevance`, `extractSnippet`, `buildContextBlock` |

## Configurazione

### Build

`BuildManager` legge un JSON con comandi per ambiente (default `./build-config.json`):

```json
{
  "development": "npm run build:dev",
  "production": "npm run build:prod",
  "outputDir": "dist",
  "testCommand": "npm test"
}
```

### Deploy

`DeployManager` legge un JSON con ambienti (default `./deploy-config.json`):

```json
{
  "environments": {
    "staging": { "type": "local",  "path": "./deploy/staging" },
    "prod":    { "type": "custom", "command": "rsync ..." }
  }
}
```

Tipi supportati: `local`, `custom`, `ftp`, `ssh` (gli ultimi due richiedono `command` esplicito), con hook pre/post opzionali.

## Note di compatibilità

`@ares/programming` è mantenuto come wrapper verso `@ares/scd/programming.js`. Il nuovo codice dovrebbe importare direttamente da `@ares/scd`.

## Contratto condiviso (Fase 1)

Perimetro "application managing": allineamento al ticket fondativo `../../../.ares/tasks/20260819-phase1-dev-tools-foundation-contract.md`:
- naming CLI e shape dei job (§ JobOutput sopra);
- integrazione con il datasource di maintenance `../../../ecosystem/datasources/maintenance`.

## Test

```bash
yarn workspace @ares/scd test
node ./test/smoke.test.js
```

## Note

- Per l'integrazione con `@ares/dev-test-server` (runner ibrido in-process/subprocess) e la lista `JOBS_FAST_SET` vedi le Note Operative Fasi 3-4 nel report `../../../application-managing-report.md`.
- Playbook operativi aggiuntivi: `../application-playbook.md`, `../build-manager-playbook.md`, `../deploy-manager-playbook.md`, `../git-playbook.md`, `../git-flow-playbook.md`.
- La famiglia di comandi `project:*` (context/docs/task/audit/diagram/overview/task-from-draft/task-doctor) è pianificata ma non ancora implementata (vedi `.ares/tasks/20260827-project-cli-commands.md`).
