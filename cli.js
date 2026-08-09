#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Application } from "./application.js";
import BuildManager from "./build-manager.js";
import DeployManager from "./deploy-manager.js";
import { Repository } from "./git.js";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  const positional = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("-")) {
      positional.push(arg);
      continue;
    }

    const key = arg.replace(/^-+/, "");
    const next = rest[i + 1];
    if (!next || next.startsWith("-")) {
      options[key] = true;
    } else {
      options[key] = next;
      i += 1;
    }
  }

  return { command, positional, options };
}

function option(options, longName, shortName, fallback = undefined) {
  return options[longName] ?? options[shortName] ?? fallback;
}

function createCurrentApplication(name = path.basename(process.cwd())) {
  const basePath = process.cwd();
  return new Application(
    name,
    "1.0.0",
    basePath,
    path.join(basePath, "src"),
    path.join(basePath, "lib"),
    path.join(basePath, "build"),
    path.join(basePath, "docs"),
    "aReS User",
    `${name} application`
  );
}

function help() {
  console.log(`aReS SCD

Usage:
  ares-scd init <name> [--version 1.0.0] [--base-path ./app]
  ares-scd build [--type development] [--config ./build-config.json]
  ares-scd deploy [--env staging] [--config ./deploy-config.json]
  ares-scd git [--init] [--commit "message"] [--push] [--tag v1 --message "Release"]
  ares-scd test [--config ./build-config.json]
`);
}

async function initCommand(positional, options) {
  const name = positional[0];
  if (!name) throw new Error("Application name is required");

  const basePath = path.resolve(option(options, "base-path", "b", process.cwd()));
  const app = new Application(
    name,
    option(options, "version", "v", "1.0.0"),
    basePath,
    path.join(basePath, "src"),
    path.join(basePath, "lib"),
    path.join(basePath, "build"),
    path.join(basePath, "docs"),
    option(options, "author", "a", "aReS User"),
    option(options, "description", "d", `${name} application`),
    option(options, "url", "u", "")
  );

  app.createDirectories();

  const buildConfigPath = path.join(basePath, "build-config.json");
  if (!fs.existsSync(buildConfigPath)) {
    fs.writeFileSync(
      buildConfigPath,
      JSON.stringify(
        {
          development: "npm run build:dev",
          production: "npm run build:prod",
          outputDir: "dist",
          testCommand: "npm test",
        },
        null,
        2
      )
    );
  }

  console.log(`Application ${name} initialized at ${basePath}`);
}

async function buildCommand(options) {
  const app = createCurrentApplication(option(options, "app", "a"));
  const manager = new BuildManager(app);
  manager.loadBuildConfig(path.resolve(option(options, "config", "c", "./build-config.json")));
  await manager.build(option(options, "type", "t", "development"));
  await manager.copyToBuildDirectory();
  console.log("Build completed");
}

async function deployCommand(options) {
  const app = createCurrentApplication(option(options, "app", "a"));
  const manager = new DeployManager(app);
  manager.loadDeployConfig(path.resolve(option(options, "config", "c", "./deploy-config.json")));
  await manager.deploy(option(options, "env", "e", "staging"));
  console.log("Deploy completed");
}

async function gitCommand(options) {
  const repoPath = process.cwd();
  const repo = new Repository(path.basename(repoPath), repoPath, option(options, "user", "u", ""));

  if (options.init || options.i) await repo.init(repoPath);
  if (options.commit || options.c) {
    await repo.add();
    await repo.commit(option(options, "commit", "c"));
  }
  if (options.push || options.p) await repo.push();
  if (options.tag || options.t) await repo.tag(option(options, "tag", "t"), option(options, "message", "m", option(options, "tag", "t")));
}

async function testCommand(options) {
  const app = createCurrentApplication();
  const manager = new BuildManager(app);
  manager.loadBuildConfig(path.resolve(option(options, "config", "c", "./build-config.json")));
  await manager.runTests();
  console.log("Tests completed");
}

export async function main(argv = process.argv.slice(2)) {
  const { command, positional, options } = parseArgs(argv);

  switch (command) {
    case "init":
      return initCommand(positional, options);
    case "build":
      return buildCommand(options);
    case "deploy":
      return deployCommand(options);
    case "git":
      return gitCommand(options);
    case "test":
      return testCommand(options);
    case "help":
    case "--help":
    case "-h":
    case undefined:
      help();
      return null;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
