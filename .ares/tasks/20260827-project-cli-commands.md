# Comandi `project:*` @ares/scd

> Bozza migrata da `draft/ampliamento cli.txt`.

## Goal

Aggiungere a `@ares/scd` una famiglia di comandi `project:*` per l'analisi della completezza del progetto a runtime, sul modello dei comandi `storyline:*` già presenti in `@ares/comics` (`comics/ai/scripts/storyline-cli.js`). Implica l'uso di `@ares/ai-3rd-party` (valutare se usare il server o la dipendenza secca).

## Task

### Scaffold folder
- [ ] 1. Suggerire in `@ares/scd` gli scaffold folder `/context` e `/diagrams` per i progetti runtime.

### Comandi `project:*`
- [ ] 2. `project:context` — estrazione documentazione di contesto: genera in `/context` file `.md` nella lingua `--lang=*`.
- [ ] 3. `project:docs` — generazione documentale per utenti secondo lo standard ares.
- [ ] 4. `project:task` — esecuzione di task tramite analisi secondo lo standard ares: `--files="file name1,file name 2"` indica i task da eseguire per gli step descritti.
- [ ] 5. `project:audit` — ricerca bug di logica nel codice e nella documentazione secondo lo standard ares.
- [ ] 6. `project:diagram` — costruzione UML, ER, flowchart in base al prompt richiesto (vedi esempio sotto). Output standard in `/diagrams`, in `html+svg` con `--web`, altrimenti `.md`. Con `--verbose` produce suggerimenti con checkbox, descrizioni, ecc.
- [ ] 7. `project:overview` — riassunto AI sullo scopo del modulo; wrapper di `project:diagram` con prompt costante. Con `--suggest` produce suggerimenti numerati; con `--tasks` li salva come task. `--lang=IT` / `--lang=EN` (default lingua di sistema tramite modulo `os`).
- [ ] 8. `project:task-from-draft` — trasforma i file in `tasks/draft/*.(txt|md|html|docx|odt)` in file task. `--destroy` cancella gli originali; l'output elenca cosa si ripete nei task esistenti e cosa è già implementato.
- [ ] 9. `project:task-doctor` — corregge errori testuali nelle richieste; assicura nessun task duplicato (in tal caso non elimina ma spunta il checkbox).

### Note comuni
- [ ] 10. I comandi documentali (`docs`, `task`, `audit`) devono passare all'AI i riferimenti dei documenti nella directory `/context` del progetto runtime.
- [ ] 11. Preparare prompt wrapper che ottimizzino l'azione da eseguire in AI.
- [ ] 12. Valutare l'uso del server vs dipendenza secca di `@ares/ai-3rd-party`.

## Esempio `project:diagram`

```
project:diagram "descrivi in uml il ciclo di vita del server e come vengono effettuate le
richieste. Indica in flowchart i passaggi dal controller fino alla BusinessLogic e ritorno.
Indica con ER le classi/tabelle utilizzate in questo percorso"
```

## Riferimenti

- Pattern `storyline:*`: `../../comics/ai/scripts/storyline-cli.js`
- README task: `./README.md`
