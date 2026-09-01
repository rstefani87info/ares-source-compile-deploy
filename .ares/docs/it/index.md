# Documentazione `@ares/scd`

## Scopo

Documentazione di modulo per `@ares/scd`: modulo aReS per sorgenti, build, deploy, gestione dei repository Git e modellazione/generazione di codice. Assorbe le parti utili del legacy `@ares/programming` (mantenuto come wrapper di compatibilità).

## Percorso di Lettura Consigliato

1. **CLI e output JSON** → [scd.md](./scd.md) § CLI `ares-scd`, flag globali `--json`/`--sample`, shape standard `JobOutput`
2. **API libreria** → Application / BuildManager / Repository / namespace `programming`
3. **Git e GitFlow** → `git`, `git-status`, `git-flow-start`, `git-flow-finish`
4. **Comandi assistiti da AI** → `make prompt` / `make docs` / `make ticket`, `work ticket`, `analyze code`
5. **Playbook operativi** → `../application-playbook.md`, `../build-manager-playbook.md`, `../deploy-manager-playbook.md`, `../git-playbook.md`, `../git-flow-playbook.md`
6. **Ticket / roadmap** → `../../.ares/tasks/`

## Documenti Disponibili

- [scd.md](./scd.md) — documento principale (CLI, JobOutput, API pubbliche, configurazione)
- [Completamento](./completamento.md) — checklist di avanzamento del modulo
- Playbook: [application](../application-playbook.md), [build](../build-manager-playbook.md), [deploy](../deploy-manager-playbook.md), [git](../git-playbook.md), [git-flow](../git-flow-playbook.md), [index](../index-playbook.md)

## Nota

Questo modulo è sia una **libreria runtime** (classi, metamodello `programming`) sia una **CLI operativa** (13 comandi + flag `--json` / `--sample`). Lo shape standardizzato `JobOutput` è il contratto consumato da `@ares/dev-test-server`.
