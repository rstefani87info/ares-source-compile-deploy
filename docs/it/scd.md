# Documentazione @ares/scd

## Scopo

`@ares/scd` e' il modulo aReS per gestione di sorgenti, build, deploy, repository Git e modellazione/generazione di codice.

Il modulo assorbe le funzionalita' utili del vecchio `@ares/programming`, che resta come wrapper di compatibilita'.

## Installazione

```bash
yarn add @ares/scd
```

In un monorepo Yarn Workspaces:

```bash
yarn workspace <app> add @ares/scd
```

## Quickstart

```js
import { Application, BuildManager, Repository, programming } from "@ares/scd";

const app = new Application("my-app");
const build = new BuildManager(app);
const repo = new Repository("my-app", process.cwd(), "user");

const flow = new programming.Flow().addStep("return", new programming.Return("ok"));
```

CLI:

```bash
ares-scd help
ares-scd init my-app
ares-scd build --type development
ares-scd deploy --env staging
```

## API pubbliche (exports)

Entrypoint root:

- `@ares/scd`

Subpath pubblici:

- `@ares/scd/application.js`
- `@ares/scd/build-manager.js`
- `@ares/scd/deploy-manager.js`
- `@ares/scd/git.js`
- `@ares/scd/git-flow.js`
- `@ares/scd/programming.js`
- `@ares/scd/cli.js`

Export principali:

- `Application`, `DataSource`, `DataSourceEntity`, `DataSourceView`
- `BuildManager`
- `DeployManager`
- `Repository`
- `GitFlow`
- `createSuite`
- namespace `programming`
- alias root per il metamodel: `ProgrammingApplication`, `ApplicationMember`, `SourceFile`, `Flow`, `Class`, `Interface`, `Method`, `Property`, `Type`, `EcmaScriptDriver`

## Configurazione

### Build

`BuildManager` legge un file JSON con comandi per ambiente:

```json
{
  "development": "npm run build:dev",
  "production": "npm run build:prod",
  "outputDir": "dist",
  "testCommand": "npm test"
}
```

### Deploy

`DeployManager` legge un file JSON con ambienti:

```json
{
  "environments": {
    "staging": {
      "type": "local",
      "path": "./deploy/staging"
    }
  }
}
```

Tipi supportati:

- `local`: copia la directory build verso `path`
- `custom`: esegue `command`
- `ftp` / `ssh`: richiedono `command` esplicito

## Note compatibilita'

`@ares/programming` e' mantenuto come wrapper verso `@ares/scd/programming.js`. Nuovo codice dovrebbe importare direttamente da `@ares/scd`.

## Test

```bash
yarn workspace @ares/scd test
```
