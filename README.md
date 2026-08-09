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
