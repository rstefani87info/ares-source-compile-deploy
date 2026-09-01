# Documentation `@ares/scd`

## Purpose

Module-level docs for `@ares/scd`: aReS module for source, build, deploy, Git repository management and code modeling/generation. Absorbs the useful pieces of legacy `@ares/programming` (still kept as a compat wrapper).

## Recommended Reading Path

1. **CLI & JSON output** → [scd.md](./scd.md) § `ares-scd` CLI, global `--json`/`--sample` flags, standard `JobOutput` shape
2. **Library API** → Application / BuildManager / Repository / `programming` namespace
3. **Git + GitFlow** → `git`, `git-status`, `git-flow-start`, `git-flow-finish`
4. **AI-assisted commands** → `make prompt` / `make docs` / `make ticket`, `work ticket`, `analyze code`
5. **Operational playbooks** → `../application-playbook.md`, `../build-manager-playbook.md`, `../deploy-manager-playbook.md`, `../git-playbook.md`, `../git-flow-playbook.md`
6. **Tickets / roadmap** → `../../.ares/tasks/` (in-scope) and `../../tasks/`

## Available Docs

- [scd.md](./scd.md) — main document (CLI, JobOutput, public APIs, configuration)
- [Completion plan](./completion.md) — module progress checklist
- Playbooks: [application](../application-playbook.md), [build](../build-manager-playbook.md), [deploy](../deploy-manager-playbook.md), [git](../git-playbook.md), [git-flow](../git-flow-playbook.md), [index](../index-playbook.md)

## Note

This module is both a **runtime library** (classes, `programming` metamodel) and an **operational CLI** (13 commands + `--json` / `--sample` flags). The standardised `JobOutput` shape is the contract consumed by `@ares/dev-test-server`.
