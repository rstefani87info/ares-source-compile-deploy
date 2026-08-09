# @ares/scd

## Purpose

`@ares/scd` is the aReS module for source, build, deploy, Git repository management, and code modeling/generation.

It now absorbs the useful pieces of the former `@ares/programming` module. `@ares/programming` remains as a compatibility wrapper.

## Installation

```bash
yarn add @ares/scd
```

In a Yarn Workspaces monorepo:

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

## Public API (exports)

Root entrypoint:

- `@ares/scd`

Public subpaths:

- `@ares/scd/application.js`
- `@ares/scd/build-manager.js`
- `@ares/scd/deploy-manager.js`
- `@ares/scd/git.js`
- `@ares/scd/git-flow.js`
- `@ares/scd/programming.js`
- `@ares/scd/cli.js`

Main exports:

- `Application`, `DataSource`, `DataSourceEntity`, `DataSourceView`
- `BuildManager`
- `DeployManager`
- `Repository`
- `GitFlow`
- `createSuite`
- `programming` namespace
- root aliases for the metamodel: `ProgrammingApplication`, `ApplicationMember`, `SourceFile`, `Flow`, `Class`, `Interface`, `Method`, `Property`, `Type`, `EcmaScriptDriver`

## Configuration

### Build

`BuildManager` reads a JSON file with environment commands:

```json
{
  "development": "npm run build:dev",
  "production": "npm run build:prod",
  "outputDir": "dist",
  "testCommand": "npm test"
}
```

### Deploy

`DeployManager` reads a JSON file with environments:

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

Supported types:

- `local`: copies the build directory to `path`
- `custom`: executes `command`
- `ftp` / `ssh`: require an explicit `command`

## Compatibility Notes

`@ares/programming` is kept as a wrapper around `@ares/scd/programming.js`. New code should import directly from `@ares/scd`.

## Tests

```bash
yarn workspace @ares/scd test
```
