# Panoramica CLI @ares/scd

## Binario

- `bin`: `ares-scd` → `./cli.js`.
- Uso generico: `ares-scd <comando> [opzioni]`.
- Flag globali: `-j, --json` (output JSON strutturato `JobOutput` su stdout, o stderr se FAILED) e `-s, --sample` (stub AI offline per i comandi AI).
- `ares-scd help` (o nessun argomento) stampa l'usage.

## Comandi (13)

### Ciclo build / deploy / git

| Comando | Scopo | Uso |
|---|---|---|
| `init <name>` | Inizializza progetto: skeleton dirs + `build-config.json` di default | `ares-scd init my-app [--version 1.0.0] [--base-path ./app]` |
| `build` | Esegue la build (`--type development` di default) e copia gli artefatti in build dir | `ares-scd build [--type development] [--config ./build-config.json]` |
| `deploy` | Esegue il deploy (`--env staging` di default) | `ares-scd deploy [--env staging] [--config ./deploy-config.json]` |
| `test` | Lancia la suite di test definita in build-config | `ares-scd test [--config ./build-config.json]` |
| `git` | Azioni Git combinate (init/commit/push/tag) | `ares-scd git [--init] [--commit "msg"] [--push] [--tag v1 --message "Release"]` |
| `git-status` | Stato del repository (branch corrente, branch, working tree) | `ares-scd git-status` |
| `git-flow-start` | Avvia feature/release/hotfix | `ares-scd git-flow-start --type <feature|release|hotfix> --name <name>` |
| `git-flow-finish` | Chiude feature/release/hotfix (merge + tag + delete branch) | `ares-scd git-flow-finish --type <...> --name <name>` |

### Comandi assistiti da AI (bridge `@ares/ai-3rd-party`)

| Comando | Scopo | Uso |
|---|---|---|
| `make prompt` | Ristruttura un prompt in markdown e lo salva in `.prompt/<ts>-<slug>.md`; con un `--title` analizza la codebase (keyword + file rilevanti) | `ares-scd make prompt (--path <file|URL> \| --text <testo> \| stdin) [--title ...] [--output-dir .prompt]` |
| `make docs` | Genera/aggiorna documentazione aReS in `.ares/docs/<lang>/index.md` | `ares-scd make docs [--scope <dir>] [--lang it\|en] [--instructions "..."]` |
| `make ticket` | Converte una richiesta in un ticket checklist e lo salva in `.ares/tasks/` | `ares-scd make ticket (--path <file\|URL> \| --text <testo> \| stdin) [--output-dir .ares/tasks]` |
| `work ticket <file-slug>` | Esegue un ticket checklist (AI) e produce un report completed/next steps/modified | `ares-scd work ticket <filename-or-slug> [--output report.json]` |
| `analyze code` | Analizza il codice dello scope e genera ticket suggeriti in `.ares/tasks/suggested/` | `ares-scd analyze code [--scope <dir>] [--max-depth 3] [--output report.json]` |

### Forme accettate (alias)

Sono valide anche le forme composte o con due punti/trattino: `make prompt` = `prompt:make` = `make-prompt`, così per `make docs`/`docs:make`, `make ticket`/`ticket:make`, `work ticket`/`ticket:work`, `analyze code`/`code:analyze` (e relative forme con trattino).

## Script npm

| Script | Scopo | Uso |
|---|---|---|
| `test` | Suite di test `node --test ./test/*.test.js` | `yarn workspace @ares/scd test` |
| `ares-scd` | Richiama il binario | `yarn ares-scd` |

## Naming job (orchestratori)

`scd-init`, `scd-build`, `scd-deploy`, `scd-test`, `scd-git`, `scd-git-status`, `scd-git-flow-start`, `scd-git-flow-finish`, `scd-make-prompt`, `scd-make-docs`, `scd-make-ticket`, `scd-work-ticket`, `scd-analyze-code` — consumati da `@ares/dev-test-server` su `POST /api/jobs/execute`.