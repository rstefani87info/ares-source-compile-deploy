# ares-source-compile-deploy

`@ares/scd` manages source, build, deploy, Git flows and the programming metamodel formerly exposed by `@ares/programming`.

```js
import { Application, BuildManager, Repository, programming } from "@ares/scd";

const app = new Application("my-app");
const build = new BuildManager(app);
const repo = new Repository("my-app", process.cwd(), "user");
const flow = new programming.Flow();
```

CLI:

```bash
ares-scd help
```

## Documentazione

### English
- [Documentation Index](./.ares/docs/en/index.md)
- [SCD](./.ares/docs/en/scd.md)

### Italiano
- [Indice Documentazione](./.ares/docs/it/index.md)
- [SCD](./.ares/docs/it/scd.md)

## Task / Ticket

- [Tasks](./.ares/tasks/README.md) (cartella canonica)
- [Ticket Fase 3 – contratto toolchain](./.ares/tasks/20260819-phase3-toolchain-contract.md)
