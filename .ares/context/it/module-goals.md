# Obiettivi del modulo @ares/scd

## Introduzione

`@ares/scd` (Source, Compilation and Distribution management) è il modulo toolchain centrale di aReS: governa il ciclo di vita dei progetti — sorgenti, build, deploy, operazioni Git e Git-Flow — ed espone il metamodello di generazione/modellazione del codice ereditato dal legacy `@ares/programming` (mantenuto come wrapper di compatibilità). Offre sia una libreria runtime (`index.js` con classi esportate) sia una CLI operativa `ares-scd` con 13 comandi.

## Obiettivi

- Inizializzare progetti: skeleton directory (`src`, `lib`, `build`, `.ares/docs`, `.ares/gantt`) e `build-config.json` di default.
- Eseguire le build (`--type development|production`) e copiare gli artefatti nella build dir tramite `BuildManager`.
- Eseguire i deploy (`--env staging|prod`, tipi local/custom/ftp/ssh) tramite `DeployManager`.
- Operare su repository Git in modo deterministico (`git` con azioni `--init/--commit/--push/--tag`) e produrre lo status (`git-status`).
- Gestire Git-Flow feature/release/hotfix (`git-flow-start` / `git-flow-finish`).
- Assistere il lavoro con l'AI (bridge verso `@ares/ai-3rd-party`): ristrutturare prompt (`make prompt`), generare documentazione `.ares/docs` (`make docs`), creare ticket checklist (`make ticket`), eseguire ticket (`work ticket`), analizzare il codice (`analyze code`), con modalità offline stub (`--sample`).
- Standardizzare l'output dei job tramite la classe `JobOutput` (`@ares/scd/job-output`), contratto consumato dal `dev-test-server`.

## Responsabilità

- `Application`, `DataSource`, `DataSourceEntity`, `DataSourceView` — modello applicativo e datasource.
- `BuildManager`/`DefaultBuildManager` — build config, esecuzione comandi di build, copia artefatti, test (`runTests`).
- `DeployManager`/`DefaultDeployManager` — deploy config multi-ambiente.
- `Repository` — wrapper git locale + creazione repo remoto GitHub/Bitbucket (via HTTP con axios).
- `GitFlow`/`DefaultGitFlow` — start/finish di feature, release, hotfix.
- `createSuite(application, options?)` — assembla `{ application, build, deploy, repository, gitFlow }`.
- namespace `programming` — metamodello di modellazione/generazione di codice (Class, Interface, Method, Flow, EcmaScriptDriver, ...).
- CLI `ares-scd` — 13 comandi con flag globali `--json/-j` (output `JobOutput`) e `--sample/-s` (stub AI offline).

## Cosa NON fa

- Non esegue build/deploy in modalità container/CICD propria: delega ai comandi configurati (es. `npm run build:dev`) e interpreta i risultati.
- Non è una piattaforma di orchestrazione: il `dev-test-server` consuma i job SCD.
- La famiglia di comandi `project:*` (context/docs/task/audit/diagram/overview) è pianificata ma non ancora implementata.
- Non include test di unità estensivi: solo la suite `node --test ./test/*.test.js`.