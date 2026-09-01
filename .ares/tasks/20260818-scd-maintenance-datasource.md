# Maintenance datasource (nota)

Nel panorama “application managing”, `@ares/scd` e i servizi che lo usano (es. `@ares/dev-test-server`) dovranno poter registrare:

- progetti / workspace gestiti;
- job di build/deploy e relative esecuzioni;
- task, stati, log e metadati (audit).

## Task

- [x] 1. Verificare ed esplicitare la posizione e il contract del DB di manutenzione (vedi `../ecosystem/datasources/maintenance`).
- [ ] 2. Definire un modello minimo (tabelle/collezioni) per: projects, jobs, job_runs, artifacts, tasks.
- [ ] 3. Decidere se questo DB è solo “dev-local” o anche “server production” e documentare.

> Nota: il contratto fondativo condiviso è nel ticket `../../tickets/20260819-phase1-dev-tools-foundation-contract.md` e il datasource canonico è documentato in `../../ecosystem/datasources/maintenance/README.md`.
