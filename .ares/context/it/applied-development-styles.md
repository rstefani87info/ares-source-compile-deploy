# Stili di sviluppo applicati @ares/scd

## Standard di stile

- Package ESM (`"type": "module"`) con entrypoint `main` = `index.js` e `bin` = `{ "ares-scd": "./cli.js" }`.
- `exports` espliciti per ogni subpath pubblicizzato (`./application`, `./build-manager`, `./deploy-manager`, `./git`, `./git-flow`, `./programming`, `./job-output`, `./cli`, `./package.json`).
- CLI senza dipendenze di parsing: `parseArgs` interno (niente yargs). Output umano di default, JSON di shape `JobOutput` con `--json`.
- `@ares/ai-3rd-party` caricato dinamicamente (lazy) solo per i comandi `make/work/analyze`; `--sample` usa uno stub offline.
- Documentazione di modulo in `.ares/docs/<lang>/` (it/en), playbook operativi accanto agli script (`*-playbook.md`).
- Job standardizzati: classe `JobOutput` con `JOB_STATUS` (`RUNNING|DONE|FAILED`) e `LOG_LEVEL` (`INFO|WARN|ERROR|DEBUG`).

## Albero del modulo

```txt
scd/
├─ .ares/
│  ├─ context/
│  │  ├─ README.md          # convenzione contesto (manuale)
│  │  └─ it/                # documenti di contesto (manuali)
│  ├─ docs/
│  │  ├─ it/                # documentazione modulo (manuale + generabile via make docs)
│  │  └─ en/
│  │  ├─ *-playbook.md      # playbook operativi (manuali)
│  └─ tasks/                # task/ticket canonici (manuali/AI)
├─ src/
│  └─ job-output.js         # classe JobOutput (manuale)
├─ test/                    # test node:test (manuali)
├─ application.js           # modello applicazione/datasource (manuale)
├─ build-manager.js         # BuildManager (manuale)
├─ cli.js                   # CLI ares-scd (manuale)
├─ deploy-manager.js        # DeployManager (manuale)
├─ git-flow.js              # GitFlow (manuale)
├─ git.js                   # Repository git + axios API GitHub/Bitbucket (manuale)
├─ index.js                 # entrypoint/barrel (manuale)
├─ programming.js           # metamodello programmazione (manuale)
├─ node_modules/  (ignorato)
└─ package.json             # manifest (manuale)
```

> Nota: la CLI `init` genera nei *progetti consumatori* `src/`, `lib/`, `build/`, `.ares/docs`, `.ares/gantt` e `build-config.json`: in quel contesto quegli artefatti sono GENERATI dal modulo SCD.

## Generato automaticamente vs MANUALE

### GENERATO (non modificare a mano, rigenerabile)

- `node_modules/` · `.git/` — ambiente/versione.
- Artefatti di build/deploy prodotti dai progetti consumatori (`build/`, `dist/`).
- `.ares/docs/en` e fette di `.ares/docs/it` — quando rigenerati con `ares-scd make docs`/`make ticket` (comandi AI); i contenuti veritieri vanno poi riscritti a mano.
- `.ares/tasks/suggested/*` — ticket suggeriti da `ares-scd analyze code --output`.
- `.prompt/*` — prompt ristrutturati da `ares-scd make prompt`.
- `build-config.json` / `deploy-config.json` — creati da `init` se assenti (sono configurazione, ma di default generata con valori boilerplate).
- Report JSON (`--output`) di `work ticket` / `analyze code`.

### MANUALE (scritto a mano, NON rigenerare/sovrascrivere)

- Tutto il codice sorgente: `index.js`, `application.js`, `build-manager.js`, `deploy-manager.js`, `git.js`, `git-flow.js`, `programming.js`, `cli.js`, `src/job-output.js`.
- `package.json` — manifest con `bin` ed `exports` (contratto di packaging).
- `test/*.test.js` — suite test.
- `.ares/docs/it/scd.md` e `index.md` (documento principale redatto a mano, allineato ai ticket).
- Tutto in `.ares/context/` e `.ares/tasks/` (tranne `suggested/`).
- Configurazioni di progetto consumatore (`build-config.json`/`deploy-config.json`) quando customizzate: SCD le rispetta, non le sovrascrive.

## Contratto directory

- Layout applicativo standard (coerente con `init`): `src/` (sviluppo), `lib/`, `build/` (distribuzione), `.ares/docs`, `.ares/gantt`.
- Job naming a trattini (es. `scd-build`, `scd-make-prompt`) esposti su `POST /api/jobs/execute` del dev-test-server.