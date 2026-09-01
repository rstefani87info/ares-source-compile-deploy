# Fase 3 – contratto toolchain @ares/scd (ticket)

## Scopo

Consolidare `@ares/scd` come **centro dei job esecutivi** del framework per:

- build
- deploy
- repository Git / Git Flow
- flussi di automazione collegati al codice

## Responsabilità

- inizializzazione applicazione e metadati progetto;
- build;
- deploy;
- gestione repository Git;
- Git flow;
- modellazione/generazione collegata al namespace `programming`.

## Contratto dei job

I job devono usare un lessico stabile, riusabile da:

- `@ares/dev-test-server`
- `@ares/project-manager`

### Job minimi (target)

- `init`
- `test`
- `build`
- `deploy`
- `git-status`
- `git-flow-start`
- `git-flow-finish`

## Shape minima output

Ogni job produce almeno:

- `jobName`
- `status`
- `startedAt`
- `completedAt`
- `projectRoot`
- `artifacts`
- `logs`

## Configurazione

- build: leggibile anche da orchestratori esterni;
- deploy: distinguere ambienti, tipo, destinazione, comando custom;
- repository: serializzare stato repo in modo leggibile da altri moduli.

## Rapporto con `@ares/programming`

`@ares/programming` resta compatibilità, ma il design converge su `@ares/scd`.

## Criterio di maturità (fase 3)

- job nominati e documentati in modo univoco;
- output e config consumabili da `@ares/dev-test-server`;
- semantica job non dipendente dal chiamante.

## Nice to have

### Contratti da estrarre

- `JobDescriptorContract` condiviso tra `scd`, server e IDE;
- `BuildArtifactContract` per distinguere output test/build/deploy;
- `RepositoryEventContract` per streaming/persistenza dello stato Git.

### Dipendenze aReS da valutare

- `@ares/core` per tipi base, eventi e strutture risultato;
- `@ares/files` per layout output e path;
- mantenere `@ares/programming` solo come wrapper legacy.

### Vendor o librerie utili

| Pacchetto | Pagina web | URL git | Comando yarn |
|---|---|---|---|
| `simple-git` | https://www.npmjs.com/package/simple-git | https://github.com/steveukx/git-js | `yarn add simple-git` |
| `execa` | https://www.npmjs.com/package/execa | https://github.com/sindresorhus/execa | `yarn add execa` |
| `pino` | https://www.npmjs.com/package/pino | https://github.com/pinojs/pino | `yarn add pino` |

### Helper e classi utili

- `JobRunner`;
- `ArtifactCollector`;
- `RepositoryStateReader`.

## Backlog ereditato (ex checklist 2026-05-06)

- [ ] 1. Verificare `types` e file pubblicati
- [ ] 2. Dichiarare peerDependencies dove necessario
- [ ] 3. Aggiungere lint/format se previsto dal workspace
