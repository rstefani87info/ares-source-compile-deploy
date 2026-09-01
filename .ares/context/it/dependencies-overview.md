# Panoramica dipendenze @ares/scd

## Dipendenze aReS (@ares/*)

`@ares/scd` **non dipende da altri moduli `@ares/*` dichiarati in `package.json`**. La sua unica dipendenza dichiarata è:

| Pacchetto | Perché (uso reale nel codice) |
|---|---|
| `axios` (^1.7.2) | Usato in `git.js` per creare repository remoti via REST: `createOnGitHub()` → `POST https://api.github.com/user/repos` e `createOnBitbucket()` → `POST https://api.bitbucket.org/2.0/repositories/...`. |

### Dipendenze dinamiche (non dichiarate ma caricate lazy)

- `@ares/ai-3rd-party` — caricato dinamicamente solo per i comandi `make prompt/docs/ticket`, `work ticket`, `analyze code`. Il module lo cerca su più path del monorepo (`@ares/ai-3rd-party/index.js`, `../ai/ai-3rd-party/index.js`, ecc.); se assente, fallisce con messaggio esplicito oppure usa lo stub offline con `--sample` (vedi `cli.js` → `loadAIModule`).

## Moduli che dipendono da @ares/scd

`@ares/scd` è il toolchain più diffuso del workspace. In `dependencies` (runtime) è presente in: `@ares/ai-3rd-party-server`, `@ares/coding-js`, `@ares/comics`, `@ares/core-dev`, `@ares/datasource-files`, `@ares/dev-test-server`, `@ares/file-sync`, `@ares/programming`, `@ares/project-manager`. Come `devDependencies` è pressoché in ogni modulo del monorepo (`core`, `files`, `web`, `email`, `media`, `mcp`, `ai`, `google`, `os`, `jquery`, `sql`, `standard-protocol-io`, `text-comprehension`, `rufus`, `react-ui-pdfeditor`, `w3schools-crawler`, ecc.). È quindi il punto di riferimento per build/deploy/git e per i comandi context/docs/task dell'ecosistema.