# Piano di completamento @ares/scd
> Aggiornato: 2026-05-15

## Stato Attuale

- package.json: package ESM con `exports` root e subpath
- CLI: disponibile come `ares-scd`
- script test: smoke test Node reale
- file test: presenti in `test/smoke.test.js`
- docs: documenti principali IT/EN aggiornati
- scope: sorgenti/build/deploy/Git piu' metamodel programming fuso

## Completato in questo passaggio

- Fuse le parti utili di `@ares/programming` in `@ares/scd/programming.js`.
- Consolidati Git e GitFlow nell'implementazione di `@ares/scd`.
- Sostituita la CLI con una CLI nativa senza dipendenze esterne.
- Aggiunte API application/build/deploy con export stabili dal root.
- Aggiunti export di compatibilita' consumati da `@ares/programming`.
- Aggiunti smoke test per export root, creazione suite, generazione codice e help CLI.

## Lavoro residuo

### Alta Priorita

- Aggiungere test di integrazione per configurazioni reali di build e deploy.
- Decidere se pubblicare dichiarazioni TypeScript o tipi generati da JSDoc.
- Stabilizzare i nomi pubblici che devono restare protetti da semver.

### Media Priorita

- Aggiungere controlli lint/format quando il tooling workspace sara' disponibile.
- Espandere i test Git/GitFlow con command execution mockata.
- Aggiungere esempi per i file di configurazione build/deploy.

### Bassa Priorita

- Decidere il testo di deprecazione formale per l'uso diretto di `@ares/programming`.
- Aggiungere altri esempi di generazione codice per il metamodel programming.

## Riferimenti

- Documento principale IT: ./scd.md
- Documento principale EN: ../en/scd.md
- Ticket: ../../tickets/20260506-1052.md
