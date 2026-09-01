#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Application } from "./application.js";
import BuildManager from "./build-manager.js";
import DeployManager from "./deploy-manager.js";
import { Repository } from "./git.js";
import { GitFlow } from "./git-flow.js";
import { JobOutput } from "./src/job-output.js";
import questionnaireConfig from "./questionnaire-config.json" with { type: "json" };
import { Survey, loadMergedSurvey, generateReport } from "@ares/survey";

function loadQuestionnaireConfig() {
  return questionnaireConfig;
}

function validateAnswer(question, answer) {
  if (question.required && (!answer || (typeof answer === "string" && !answer.trim()))) {
    return `Campo obbligatorio: ${question.label}`;
  }
  if (question.type === "select" && question.options) {
    const valid = question.options.some(o => o.value === answer);
    if (!valid) return `Valore non valido per ${question.label}`;
  }
  return null;
}

async function askQuestion(question, defaultValue = "") {
  const hint = question.default ? ` [${question.default}]` : "";
  const helpText = question.help ? ` (${question.help})` : "";
  const promptText = `${question.label}${helpText}${hint}: `;

  return new Promise((resolve) => {
    process.stdout.write(promptText);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.once("data", (data) => {
      process.stdin.pause();
      let answer = data.trim();
      if (!answer && question.default !== undefined) answer = question.default;
      if (!answer && defaultValue !== "") answer = defaultValue;
      resolve(answer);
    });
  });
}

async function runQuestionnaire(options = {}) {
  const config = loadQuestionnaireConfig();
  const results = {};
  const skipSections = options.skipSections || [];

  console.log(`\n[SURVEY] ${config.title}`);
  console.log(`   ${config.description}\n`);

  for (const section of config.sections) {
    if (skipSections.includes(section.id)) continue;

    console.log(`\n[SECTION] ${section.title}`);
    console.log(`   ${section.description}\n`);

    results[section.id] = {};

    for (const question of section.questions) {
      // Check dependencies
      if (question.dependsOn) {
        const depValue = results[section.id]?.[question.dependsOn] ?? results[question.dependsOn];
        if (!depValue) continue;
      }

      let answer = null;
      let retries = 0;

      while (retries < 3) {
        answer = await askQuestion(question);
        const error = validateAnswer(question, answer);
        if (!error) break;
        console.log(`   [WARN] ${error}`);
        retries++;
      }

      if (error) {
        console.log(`   [WARN] Using default: ${question.default ?? "vuoto"}`);
        answer = question.default ?? "";
      }

      // Type conversion
      if (question.type === "boolean") {
        answer = answer === "true" || answer === "s" || answer === "y" || answer === "yes";
      } else if (question.type === "number") {
        answer = parseFloat(answer);
      }

      results[section.id][question.id] = answer;
    }
  }

  // Add metadata
  results._meta = {
    timestamp: new Date().toISOString(),
    version: config.version,
    questionnaireVersion: config.version
  };

  return results;
}

function saveQuestionnaireResults(results, outputPath) {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n[OK] Questionario salvato in: ${outputPath}`);
  return outputPath;
}

async function questionnaireCommand(positional, options, job) {
  const outputPath = options.output || path.join(process.cwd(), ".ares", "questionnaire-results.json");
  const skipSections = options.skip ? options.skip.split(",").map(s => s.trim()) : [];

  const results = await runQuestionnaire({ skipSections });
  const savedPath = saveQuestionnaireResults(results, outputPath);

  job.logInfo("questionnaire", "Questionario completato", { outputPath: savedPath });

  return {
    outputPath: savedPath,
    results,
    sectionsCompleted: Object.keys(results).filter(k => k !== "_meta").length
  };
}
// Global flag to prevent double logging initialization
let _cliLoggingInitialized = false;

function setupCliLogging(argv) {
  if (_cliLoggingInitialized) {
    return {
      logFile: null,
      outputLines: [],
      finish: () => {}
    };
  }
  _cliLoggingInitialized = true;
  
  const logDir = path.join(process.cwd(), '.ares', 'cli-logs');
  fs.mkdirSync(logDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logDir, timestamp + '.log');

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const outputLines = [];

  function captureOutput(type, args) {
    const line = args.map(String).join(' ');
    outputLines.push('[' + type + '] ' + line);
  }

  console.log = (...args) => { captureOutput('LOG', args); originalLog.apply(console, args); };
  console.error = (...args) => { captureOutput('ERR', args); originalError.apply(console, args); };
  console.warn = (...args) => { captureOutput('WRN', args); originalWarn.apply(console, args); };

  return {
    logFile,
    outputLines,
    finish: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      const header = 'Command: ' + argv.join(' ') + '\n\n';
      const content = header + outputLines.join('\n') + '\n';
      fs.writeFileSync(logFile, content);
      console.log('\n[LOG] Log salvato: ' + logFile);
    }
  };
}

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

function consumeGlobalFlags(options) {
  const json = Boolean(options.json ?? options.j ?? false);
  const cleaned = { ...options };
  delete cleaned.json;
  delete cleaned.j;
  return { json, cleaned };
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
    path.join(basePath, ".ares", "docs"),
    "aReS User",
    `${name} application`,
    "",
    path.join(basePath, ".ares", "gantt")
  );
}

function help() {
  console.log(`aReS SCD

Usage:
  ares-scd init <name> [--version 1.0.0] [--base-path ./app] [--json]
  ares-scd build [--type development] [--config ./build-config.json] [--json]
  ares-scd deploy [--env staging] [--config ./deploy-config.json] [--json]
  ares-scd git [--init] [--commit "message"] [--push] [--tag v1 --message "Release"] [--json]
  ares-scd test [--config ./build-config.json] [--json]
  ares-scd git-status [--json]
  ares-scd git-flow-start --type <feature|release|hotfix> --name <name> [--main-branch main] [--develop-branch develop] [--json]
  ares-scd git-flow-finish --type <feature|release|hotfix> --name <name> [--main-branch main] [--develop-branch develop] [--json]
  ares-scd make prompt (--path <file|URL> | --text <testo> | <stdin>) [--output-dir .prompt] [--title-hint "..."] [--title "Titolo completo"] [--scope <dir>] [--sample] [--json]
  ares-scd make docs [--scope <dir>] [--lang it|en] [--instructions "..."] [--sample] [--json]
  ares-scd make ticket (--path <file|URL> | --text <testo> | <stdin>) [--output-dir .ares/tasks] [--sample] [--json]
  ares-scd work ticket <filename-or-slug> [--output report.json] [--sample] [--json]
  ares-scd analyze code [--scope <dir>] [--max-depth 3] [--output report.json] [--sample] [--json]
  ares-scd install-local <repo-name> [--path <parent-dir>] [--local-name <dir>] [--module <name>] [--description "..."] [--github-user <user>] [--yes] [--json]
  ares-scd create-remote <repo-name> --github-token <token> [--private] [--description "..."] [--json]
  ares-scd create <repo-name> --github-token <token> [--path <parent-dir>] [--local-name <dir>] [--description "..."] [--yes] [--remote-only] [--local-only] [--json]
  ares-scd survey [run|list|init] [--config <dir>] [--output <file>] [--lang it|en] [--json]
  ares-scd questionnaire [--output <file>] [--skip <sections>] [--json]

Global flags:
  --json, -j     Print full structured JSON result instead of human output
  --sample, -s   Use offline stub AI instead of @ares/ai-3rd-party provider
  --yes, -y      Skip interactive prompts (use defaults)
`);
}

function emitJobResult(job, json, fallbackMessage, fallbackStream = "stdout") {
  if (json) {
    const payload = JSON.stringify(job.toJSON(), null, 2);
    if (job.status === "FAILED") {
      process.stderr.write(payload + "\n");
    } else {
      process.stdout.write(payload + "\n");
    }
  } else if (fallbackMessage) {
    (fallbackStream === "stderr" ? process.stderr : process.stdout).write(fallbackMessage + "\n");
  }
}

function logSubprocessOutput(job, { stdout = "", stderr = "" }, source) {
  if (stdout) {
    for (const line of String(stdout).split(/\r?\n/).filter(Boolean)) {
      job.logInfo(source, line);
      console.log(`[${source}] ${line}`);
    }
  }
  if (stderr) {
    for (const line of String(stderr).split(/\r?\n/).filter(Boolean)) {
      job.logWarn(source, line);
      console.warn(`[${source}] ${line}`);
    }
  }
}

function runYarn(args, options = {}) {
  const { cwd = process.cwd(), shell = true } = options;
  const yarnCmd = process.platform === "win32" ? "yarn.cmd" : "yarn";
  const cmdArgs = Array.isArray(args) ? args.join(" ") : args;
  
  return new Promise((resolve, reject) => {
    const { spawn } = require("node:child_process");
    const fullCmd = `${yarnCmd} ${cmdArgs}`;
    console.log(`[YARN] ${fullCmd} (cwd: ${cwd})`);
    const child = spawn(fullCmd, { cwd, shell, windowsHide: true });
    let stdout = "";
    let stderr = "";
    
    child.stdout?.on("data", (data) => { stdout += data.toString(); });
    child.stderr?.on("data", (data) => { stderr += data.toString(); });
    
    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`yarn failed with code ${code}: ${stderr}`));
    });
  });
}

function promptInput(prompt, defaultValue = "") {
  return new Promise((resolve) => {
    process.stdout.write(`${prompt} [${defaultValue}]: `);
    process.stdin.once("data", (data) => {
      const input = data.toString().trim();
      resolve(input || defaultValue);
    });
  });
}

function promptYesNo(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(`${prompt} (y/N): `);
    process.stdin.once("data", (data) => {
      const input = data.toString().trim().toLowerCase();
      resolve(input === "y" || input === "yes");
    });
  });
}

async function initCommand(positional, options, job) {
  const name = positional[0];
  if (!name) throw new Error("Application name is required");

  const basePath = path.resolve(option(options, "base-path", "b", process.cwd()));
  const version = option(options, "version", "v", "1.0.0");
  const author = option(options, "author", "a", "aReS User");
  const description = option(options, "description", "d", `${name} application`);
  const url = option(options, "url", "u", "");

  job.logInfo("init", `Initializing application '${name}' at ${basePath}`, {
    name,
    version,
    basePath,
  });

  const app = new Application(
    name,
    version,
    basePath,
    path.join(basePath, "src"),
    path.join(basePath, "lib"),
    path.join(basePath, "build"),
    path.join(basePath, ".ares", "docs"),
    author,
    description,
    url,
    null,
    null,
    {},
    "",
    path.join(basePath, ".ares", "gantt")
  );

  app.createDirectories();
  job.logInfo("init", "Created directory skeleton");

  const buildConfigPath = path.join(basePath, "build-config.json");
  if (!fs.existsSync(buildConfigPath)) {
    const cfg = {
      development: "npm run build:dev",
      production: "npm run build:prod",
      outputDir: "dist",
      testCommand: "npm test",
    };
    fs.writeFileSync(buildConfigPath, JSON.stringify(cfg, null, 2));
    job.addArtifact({
      filePath: buildConfigPath,
      name: "build-config.json",
      kind: "config",
      storage: "local",
    });
    job.logInfo("init", `Generated default build-config.json at ${buildConfigPath}`);
  } else {
    job.logInfo("init", `Using existing build-config.json at ${buildConfigPath}`);
  }

  return { name, version, basePath, author, description, url };
}

async function buildCommand(options, job) {
  const app = createCurrentApplication(option(options, "app", "a"));
  const configPath = path.resolve(option(options, "config", "c", "./build-config.json"));
  const buildType = option(options, "type", "t", "development");

  job.logInfo("build", `Starting ${buildType} build`, {
    app: app.name,
    configPath,
    buildType,
    sourcePath: app.developmentPath,
    buildPath: app.buildingPath,
  });

  const manager = new BuildManager(app);
  const cfg = manager.loadBuildConfig(configPath);
  job.logDebug("build", `Loaded build config`, Object.keys(cfg));

  const buildOut = await manager.build(buildType);
  logSubprocessOutput(job, buildOut, "build/script");
  job.logInfo("build", `Build script (${buildType}) completed`);

  const targetDir = await manager.copyToBuildDirectory();
  job.logInfo("build", `Copy artifacts to ${targetDir}`);
  job.addDirectoryArtifacts(targetDir, {
    storage: "local",
    computeChecksum: false,
    baseName: path.basename(targetDir),
  });

  return {
    buildType,
    configPath,
    sourcePath: app.developmentPath,
    buildOutput: targetDir,
    artifactsCount: job.artifacts.length,
  };
}

async function deployCommand(options, job) {
  const app = createCurrentApplication(option(options, "app", "a"));
  const configPath = path.resolve(option(options, "config", "c", "./deploy-config.json"));
  const env = option(options, "env", "e", "staging");

  job.logInfo("deploy", `Starting deploy to environment '${env}'`, {
    app: app.name,
    configPath,
    env,
  });

  const manager = new DeployManager(app);
  const cfg = manager.loadDeployConfig(configPath);
  job.logDebug("deploy", `Loaded deploy config:`, {
    environments: Object.keys(cfg.environments ?? {}),
  });

  const result = await manager.deploy(env);
  if (result && (result.stdout || result.stderr)) {
    logSubprocessOutput(job, result, "deploy/script");
  }

  if (result?.target) {
    job.addArtifact({
      filePath: result.target,
      name: "deploy-target",
      kind: "deploy",
      storage: "local",
      computeChecksum: false,
    });
  }

  return {
    environment: env,
    configPath,
    deployResult: result,
  };
}

async function gitCommand(options, job) {
  const repoPath = process.cwd();
  const repo = new Repository(path.basename(repoPath), repoPath, option(options, "user", "u", ""));
  const actions = [];

  job.logInfo("git", `Operating on repository at ${repoPath}`);

  if (options.init || options.i) {
    const out = await repo.init(repoPath);
    logSubprocessOutput(job, out, "git/init");
    actions.push("init");
    job.logInfo("git", "Initialized git repository");
  }
  if (options.commit || options.c) {
    const message = option(options, "commit", "c");
    const addOut = await repo.add();
    logSubprocessOutput(job, addOut, "git/add");
    const commitOut = await repo.commit(message);
    logSubprocessOutput(job, commitOut, "git/commit");
    actions.push({ name: "commit", message });
    job.logInfo("git", `Committed: ${message}`);
  }
  if (options.push || options.p) {
    const out = await repo.push();
    logSubprocessOutput(job, out, "git/push");
    actions.push("push");
    job.logInfo("git", "Pushed to remote");
  }
  if (options.tag || options.t) {
    const tagName = option(options, "tag", "t");
    const tagMessage = option(options, "message", "m", tagName);
    const out = await repo.tag(tagName, tagMessage);
    logSubprocessOutput(job, out, "git/tag");
    actions.push({ name: "tag", tag: tagName, message: tagMessage });
    job.logInfo("git", `Tagged: ${tagName}`);
  }

  return {
    repoPath,
    actions,
  };
}

async function testCommand(options, job) {
  const app = createCurrentApplication();
  const configPath = path.resolve(option(options, "config", "c", "./build-config.json"));

  job.logInfo("test", "Running tests", { app: app.name, configPath });

  const manager = new BuildManager(app);
  const cfg = manager.loadBuildConfig(configPath);
  job.logDebug("test", `Loaded build config`, { testCommand: cfg.testCommand });

  const out = await manager.runTests();
  logSubprocessOutput(job, out, "test/runner");

  return {
    configPath,
    testCommand: cfg.testCommand,
  };
}

async function gitStatusCommand(_positional, _options, job) {
  const repoPath = process.cwd();
  const repo = new Repository(path.basename(repoPath), repoPath);

  job.logInfo("git-status", `Inspecting repository at ${repoPath}`);

  const branches = await repo.loadAllBranches();
  const currentBranch = repo.getCurrentBranch();
  job.logInfo("git-status", `Current branch: ${currentBranch ?? "n/a"}`, {
    totalBranches: branches.length,
  });

  const porcelainOut = await repo.git(["status", "--porcelain"]);
  const workingTreeStatus = porcelainOut.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2);
      const file = line.slice(3).trim();
      return { code, file };
    });

  logSubprocessOutput(job, porcelainOut, "git/status");

  return {
    repoPath,
    currentBranch,
    branches: repo.getAllBranches(),
    workingTree: workingTreeStatus,
    clean: workingTreeStatus.length === 0,
  };
}

async function gitFlowStartCommand(_positional, options, job) {
  const type = option(options, "type", "t");
  const name = option(options, "name", "n");
  const mainBranch = option(options, "main-branch", null, "main");
  const developBranch = option(options, "develop-branch", null, "develop");

  if (!type) throw new Error("git-flow-start requires --type (feature|release|hotfix)");
  if (!name) throw new Error("git-flow-start requires --name");
  if (!["feature", "release", "hotfix"].includes(type)) {
    throw new Error(`Invalid git-flow type: ${type}. Use feature, release, or hotfix.`);
  }

  const repoPath = process.cwd();
  const repo = new Repository(path.basename(repoPath), repoPath);
  const flow = new GitFlow(repo, { mainBranch, developBranch });

  job.logInfo("git-flow-start", `Starting ${type} '${name}'`, {
    type,
    name,
    mainBranch,
    developBranch,
  });

  let branchName;
  switch (type) {
    case "feature":
      branchName = await flow.startFeature(name);
      break;
    case "release":
      branchName = await flow.startRelease(name);
      break;
    case "hotfix":
      branchName = await flow.startHotfix(name);
      break;
  }

  job.logInfo("git-flow-start", `Switched to branch ${branchName}`);
  return { type, name, branchName, mainBranch, developBranch };
}

async function gitFlowFinishCommand(_positional, options, job) {
  const type = option(options, "type", "t");
  const name = option(options, "name", "n");
  const mainBranch = option(options, "main-branch", null, "main");
  const developBranch = option(options, "develop-branch", null, "develop");

  if (!type) throw new Error("git-flow-finish requires --type (feature|release|hotfix)");
  if (!name) throw new Error("git-flow-finish requires --name");
  if (!["feature", "release", "hotfix"].includes(type)) {
    throw new Error(`Invalid git-flow type: ${type}. Use feature, release, or hotfix.`);
  }

  const repoPath = process.cwd();
  const repo = new Repository(path.basename(repoPath), repoPath);
  const flow = new GitFlow(repo, { mainBranch, developBranch });

  job.logInfo("git-flow-finish", `Finishing ${type} '${name}'`, {
    type,
    name,
    mainBranch,
    developBranch,
  });

  let branchName;
  switch (type) {
    case "feature":
      branchName = await flow.finishFeature(name);
      break;
    case "release":
      branchName = await flow.finishRelease(name);
      break;
    case "hotfix":
      branchName = await flow.finishHotfix(name);
      break;
  }

  job.logInfo("git-flow-finish", `Completed ${type}; branch ${branchName} merged and removed`);
  return { type, name, branchName, mainBranch, developBranch };
}

// =================== AI Bridge (lazy) ===================
const AI_NOT_AVAILABLE = {
  ok: false,
  ai: { available: false, mode: "stub_scd_fallback" },
  error: "@ares/ai-3rd-party non disponibile. Esegui `yarn install` nel workspace aReS oppure usa --sample per modalitÃ  offline.",
};

let _aiCached = null;
let _aiCliBootstrapTried = false;
async function loadAIModule({ sample = false, bootstrapCli = true } = {}) {
  if (_aiCached) {
    if (bootstrapCli && !_aiCliBootstrapTried) {
      _aiCliBootstrapTried = true;
      try { if (typeof _aiCached.bootstrapCliProvidersFromConfig === "function") await _aiCached.bootstrapCliProvidersFromConfig(); } catch {}
    }
    return _aiCached;
  }
  let mods = null;
  const searchPaths = [
    () => import("@ares/ai-3rd-party/index.js"),
    () => import("../../ai/ai-3rd-party/index.js"),
    () => import("../ai/ai-3rd-party/index.js"),
    () => import("../../ai-3rd-party/index.js"),
    () => import("../ai-3rd-party/index.js"),
  ];
  for (const loader of searchPaths) {
    try { mods = await loader(); if (mods) break; } catch {}
  }
  if (!mods || !mods.runCapability) {
    if (sample) {
      mods = buildSampleAIStub();
    } else {
      return null;
    }
  }
  _aiCached = mods;
  if (bootstrapCli && !_aiCliBootstrapTried) {
    _aiCliBootstrapTried = true;
    try { if (typeof mods.bootstrapCliProvidersFromConfig === "function") await mods.bootstrapCliProvidersFromConfig(); } catch {}
  }
  return mods;
}

function buildSampleAIStub() {
  return {
    runCapability: async function (capId, opts = {}) {
      const prompt = String(opts.prompt || opts.text || "");
      const now = Date.now();
      const guardrail = { issues: 0, riskScore: 0, matches: [], redacted: prompt, ok: true };
      if (/[\w.-]+@[\w-]+\.[\w.-]{2,}/.test(prompt)) { guardrail.issues++; guardrail.riskScore += 20; guardrail.matches.push({ type: "email" }); guardrail.redacted = guardrail.redacted.replace(/[\w.-]+@[\w-]+\.[\w.-]{2,}/g, "***REDACTED***"); }
      if (/3\d{2}[.\s-]?\d{3,4}[.\s-]?\d{3}/.test(prompt)) { guardrail.issues++; guardrail.riskScore += 30; guardrail.matches.push({ type: "phone" }); guardrail.redacted = guardrail.redacted.replace(/3\d{2}[.\s-]?\d{3,4}[.\s-]?\d{3}/g, "***REDACTED***"); }
      if (guardrail.riskScore >= 50) guardrail.ok = false;
      const sampleTitles = {
        prompt_refactor: (p) => {
          const cleaned = (p.split(/\r?\n/)[0] || p).replace(/[^\w\s-]/g, "").trim().slice(0, 80) || "prompt-di-lavoro";
          return cleaned.toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        },
      };
      if (capId === "prompt_refactor") {
        const suggested = sampleTitles.prompt_refactor(prompt);
        const md = buildRestructuredPromptMarkdown(prompt);
        return {
          ok: guardrail.ok,
          capId,
          providerId: "sample_scd_stub",
          sample: true,
          sessionId: "stub-" + now,
          tokensIn: prompt.length,
          tokensOut: md.length,
          riskScore: guardrail.riskScore,
          latencyMs: 50,
          guardrail,
          result: { suggested_title: suggested, restructured_markdown: md, title_slug: suggested },
        };
      }
      if (capId === "generate_docs") {
        return {
          ok: true, capId, providerId: "sample_scd_stub", sample: true,
          sessionId: "stub-" + now, tokensIn: prompt.length, tokensOut: 1200, riskScore: guardrail.riskScore,
          latencyMs: 40, guardrail,
          result: { files_generated: [".ares/docs/it/index.md",".ares/docs/en/index.md"], summary: "[sample] Documentazione generata in stub. Usare AI reale per contenuti veritieri." },
        };
      }
      if (capId === "refactor_code" || capId === "answer_question") {
        return {
          ok: true, capId, providerId: "sample_scd_stub", sample: true,
          sessionId: "stub-" + now, tokensIn: prompt.length, tokensOut: 500, riskScore: guardrail.riskScore,
          latencyMs: 30, guardrail,
          result: {
            tickets_completed: ["[sample] Analisi checklist ticket effettuata in modalitÃ  stub"],
            next_steps: ["[sample] Prossimo passo: rieseguire senza --sample con AI disponibile"],
            modified_files: [],
            suggestions: ["[sample] Nessun suggerimento disponibile in stub mode"],
          },
        };
      }
      if (capId === "analyze_code") {
        return {
          ok: true, capId, providerId: "sample_scd_stub", sample: true,
          sessionId: "stub-" + now, tokensIn: prompt.length, tokensOut: 1500, riskScore: guardrail.riskScore,
          latencyMs: 60, guardrail,
          result: {
            tickets: [
              { title: "[sample] Stub Ticket 1 - Pulizia codice", slug: "stub-pulizia-codice", body: buildTicketChecklist("[sample] Pulizia codice") },
              { title: "[sample] Stub Ticket 2 - Contratti API", slug: "stub-contratti-api", body: buildTicketChecklist("[sample] Contratti API pubbliche") },
            ],
            summary: "[sample] Analisi codice effettuata in modalitÃ  stub - 2 ticket suggeriti",
          },
        };
      }
      return { ok: guardrail.ok, capId, providerId: "sample_scd_stub", sample: true, guardrail, result: { raw: guardrail.redacted } };
    },
    chatCompletion: async function (opts = {}) {
      const msgs = Array.isArray(opts.messages) ? opts.messages : [{ role: "user", content: String(opts.prompt || "") }];
      const last = msgs[msgs.length - 1] || { content: "" };
      const prompt = String(last.content || "");
      const run = await this.runCapability("prompt_refactor", { prompt, ...opts });
      if (!run.ok) return { ok:false, messages: msgs, reply: run.error || "blocked" };
      return {
        ok: true, sessionId: run.sessionId, turns: msgs.length,
        reply: JSON.stringify({ suggested_title: run.result.suggested_title, restructured_markdown: run.result.restructured_markdown }, null, 2),
        providerId: run.providerId, tokensOut: run.tokensOut,
      };
    },
  };
}

// =================== Helper serializzazione ===================
function buildRestructuredPromptMarkdown(rawPrompt) {
  const lines = String(rawPrompt || "").split(/\r?\n/).filter(Boolean);
  const firstLine = (lines[0] || "Prompt di lavoro").trim().slice(0,120);
  return [
    "# Prompt di lavoro (ristrutturato)",
    "",
    "## Scopo",
    "",
    (lines[0] || firstLine) || "Obiettivo da definire.",
    "",
    "## Dettagli di contesto",
    "",
    ...(lines.slice(1).map((l) => "- " + l).slice(0, 10) || ["- Nessun dettaglio aggiuntivo fornito."]),
    "",
    "## Note operative",
    "",
    "- Prompt in formato markdown strutturato per riesecuzione futura",
    "- Prompt originale accodato in coda come citazione",
    "",
    "## Prompt originale (rif.)",
    "",
    "> " + String(rawPrompt || "").split(/\r?\n/).join("\n> "),
  ].join("\n");
}

function slugifyForFilename(s) {
  return String(s || "prompt")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['"`]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "prompt";
}

function formatPromptTimestamp(now = new Date()) {
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function buildTicketChecklist(titleHint = "Ticket") {
  return [
    `# ${titleHint}`,
    "",
    "## Alta prioritÃ ",
    "",
    "- [ ] Item 1",
    "- [ ] Item 2",
    "",
    "## Contratto Modulo (API Pubbliche)",
    "",
    "- [ ] Definire interfacce esportate",
    "- [ ] Validazione parametri in ingresso",
    "",
    "## Packaging",
    "",
    "- [ ] Dipendenze dichiarate in package.json",
    "- [ ] Export barrel / index aggiornati",
    "",
    "## Robustezza Runtime",
    "",
    "- [ ] Gestione errori e fallback",
    "- [ ] Logging strutturato",
    "",
    "## QualitÃ  (Test e Lint)",
    "",
    "- [ ] Unit test copertura minima",
    "- [ ] Lint / typecheck passanti",
    "",
    "## Documentazione e Adozione",
    "",
    "- [ ] .ares/docs/it o .ares/docs/en aggiornati",
    "- [ ] Esempi di utilizzo",
    "",
  ].join("\n");
}

async function readPromptInput({ path: filePath, text }) {
  if (text) return String(text);
  if (filePath) {
    if (/^https?:\/\//i.test(filePath)) {
      const { get } = await import("node:https");
      const { get: httpGet } = await import("node:http");
      return new Promise((resolve, reject) => {
        const getter = /^https/i.test(filePath) ? get : httpGet;
        getter(filePath, (res) => {
          let data = "";
          res.on("data", (c) => data += c);
          res.on("end", () => resolve(data));
        }).on("error", reject);
      });
    }
    const abs = path.resolve(filePath);
    return fs.readFileSync(abs, "utf8");
  }
  if (!process.stdin.isTTY) {
    return new Promise((resolve) => {
      let buf = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => buf += c);
      process.stdin.on("end", () => resolve(buf));
    });
  }
  throw new Error("Nessun input fornito: usa --path <file|URL>, --text <testo>, oppure pipe da stdin");
}

function detectScopeFiles(scope, maxDepth = 3) {
  const base = path.resolve(scope || process.cwd());
  const out = [];
  function walk(dir, depth = 0) {
    if (depth > maxDepth) return;
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (e === "node_modules" || e === ".git") continue;
      const full = path.join(dir, e);
      try {
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full, depth + 1);
        else if (/\.(js|ts|jsx|tsx|md|json|ya?ml)$/i.test(e)) out.push(path.relative(base, full).replace(/\\/g, "/"));
      } catch {}
    }
  }
  try { walk(base); } catch {}
  return out.slice(0, 200);
}

const STOPWORDS = new Set([
  "il","lo","la","i","gli","le","un","uno","una","di","a","da","in","con","su","per","tra","fra","e","ed","o","ma","che","chi","non","piÃ¹","come","se","del","della","delle","dei","al","alla","alle","ai","nel","nella","nelle","nei","dal","dalla","dalle","dai","sul","sulla","sulle","sui",
  "the","a","an","of","to","in","on","with","for","by","from","at","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","can","this","that","these","those","it","its","and","or","but","not","no","nor","as","if","than","then","so","such","what","when","where","which","who","whom","how","why","because","about","into","through","during","before","after","above","below","between","out","off","over","under","again","further","only","own","same","too","very"
]);

function extractKeywords(text) {
  if (!text) return [];
  const tokens = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9Ã Ã¨Ã©Ã¬Ã²Ã¹Ã€ÃˆÃ‰ÃŒÃ’Ã™'\-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const counts = new Map();
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (STOPWORDS.has(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 12);
}

function scoreFileRelevance(relativePath, content, keywords) {
  if (!keywords.length) return { score: 0, hits: [] };
  const name = path.basename(relativePath).toLowerCase();
  const dir = path.dirname(relativePath).toLowerCase();
  const contentLow = String(content || "").toLowerCase();
  let score = 0;
  const hits = [];
  for (const kw of keywords) {
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const inName = name.includes(kw) ? 3 : 0;
    const inDir = dir.includes(kw) ? 1 : 0;
    const matches = contentLow.match(re);
    const inContent = matches ? matches.length : 0;
    const total = inName + inDir + inContent;
    if (total > 0) {
      score += total;
      hits.push({ keyword: kw, inName: inName > 0, inDir: inDir > 0, count: inContent + (inName?1:0) + (inDir?1:0) });
    }
  }
  return { score, hits };
}

function analyzeCodebaseContext(title, scope, maxFiles = 5, maxDepth = 3) {
  const keywords = extractKeywords(title);
  if (!keywords.length) {
    return { keywords: [], files: [], summary: "Nessuna parola chiave utile estratta dal titolo." };
  }
  const base = path.resolve(scope || process.cwd());
  const files = detectScopeFiles(base, maxDepth);
  const scored = [];
  for (const rel of files) {
    const full = path.join(base, rel);
    let content = "";
    try {
      const st = fs.statSync(full);
      if (st.size > 200 * 1024) continue;
      content = fs.readFileSync(full, "utf8");
    } catch { continue; }
    const { score, hits } = scoreFileRelevance(rel, content, keywords);
    if (score > 0) {
      scored.push({ rel, score, hits, snippet: extractSnippet(content, keywords) });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxFiles);
  const summaryLines = [
    `Parole chiave estratte: ${keywords.join(", ")}`,
    `File analizzati: ${files.length} | match rilevanti: ${scored.length} | top ${top.length}:`,
    ...top.map((f, i) => `  ${i+1}. ${f.rel} (score=${f.score}) [hits: ${f.hits.map(h=>h.keyword).join(",")}]`),
  ];
  return { keywords, files: top, summary: summaryLines.join("\n") };
}

function extractSnippet(content, keywords, window = 80) {
  if (!content || !keywords.length) return "";
  const lower = content.toLowerCase();
  let bestIdx = -1;
  let bestCount = 0;
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx >= 0) {
      const before = lower.slice(Math.max(0, idx - window), idx);
      const after = lower.slice(idx, Math.min(lower.length, idx + window));
      const local = before + after;
      let c = 0;
      for (const k of keywords) if (local.includes(k)) c += 1;
      if (c > bestCount || bestIdx === -1) {
        bestCount = c;
        bestIdx = idx;
      }
    }
  }
  if (bestIdx === -1) return content.slice(0, 200).replace(/\s+/g, " ").trim();
  const start = Math.max(0, bestIdx - window);
  const end = Math.min(content.length, bestIdx + window);
  const snip = content.slice(start, end).replace(/\s+/g, " ").trim();
  return (start > 0 ? "..." : "") + snip + (end < content.length ? "..." : "");
}

function buildContextBlock(ctx) {
  if (!ctx || !ctx.files || !ctx.files.length) return "";
  const lines = [
    "## Contesto auto-analizzato dalla codebase",
    "",
    `> Keyword individuate dal titolo: ${ctx.keywords.join(", ")}`,
    "",
    "### File piÃ¹ rilevanti:",
    "",
  ];
  for (const f of ctx.files) {
    lines.push(`- **${f.rel}** (relevance score: ${f.score})`);
    lines.push(`  - Hits: ${f.hits.map(h=>`${h.keyword}(${h.count})`).join(", ")}`);
    if (f.snippet) lines.push(`  - Snippet: ${f.snippet}`);
    lines.push("");
  }
  return lines.join("\n");
}

function findTicketFile(identifier) {
  const ticketsDir = path.resolve(".ares", "tasks");
  if (!fs.existsSync(ticketsDir)) return null;
  const entries = fs.readdirSync(ticketsDir).filter((f) => f.endsWith(".md"));
  for (const f of entries) {
    if (f === identifier || f.replace(/\.md$/, "") === identifier) return path.join(ticketsDir, f);
  }
  for (const f of entries) {
    if (f.startsWith(identifier) || f.includes(identifier)) return path.join(ticketsDir, f);
  }
  return null;
}

// =================== Comandi make / work / analyze ===================
async function makePromptCommand(positional, options, job) {
  const sample = Boolean(option(options, "sample", "s", false));
  const ai = await loadAIModule({ sample });
  if (!ai) throw new Error(AI_NOT_AVAILABLE.error);

  const title = option(options, "title", "T");
  const scope = option(options, "scope", "S", process.cwd());
  const titleHint = option(options, "title-hint") || title || "";

  let rawPrompt = "";
  let inputSource = "none";
  try {
    rawPrompt = await readPromptInput({
      path: option(options, "path", "p"),
      text: option(options, "text", "t"),
    });
    inputSource = option(options, "path", "p") ? "path" : option(options, "text", "t") ? "text" : "stdin";
  } catch (e) {
    if (!title) throw e;
    rawPrompt = "";
    inputSource = "title-only";
  }

  let ctx = { keywords: [], files: [], summary: "Nessuna analisi codebase eseguita." };
  if (title) {
    ctx = analyzeCodebaseContext(title, scope, 5, 3);
    job.logInfo("make-prompt", "Analisi codebase da titolo", {
      title,
      keywordsFound: ctx.keywords.length,
      relevantFiles: ctx.files.length,
      scope,
    });
  }

  const contextBlock = buildContextBlock(ctx);

  if (inputSource === "title-only") {
    const kwLine = ctx.keywords.length ? `Keyword individuate: ${ctx.keywords.join(", ")}` : "";
    rawPrompt = [
      `# Richiesta: ${title}`,
      "",
      "## Descrizione",
      "",
      `Titolo fornito: ${title}`,
      kwLine ? kwLine : "",
      ctx.files.length ? `File potenzialmente coinvolti (${ctx.files.length}): ${ctx.files.map(f=>f.rel).join(", ")}` : "",
      "",
      "## Richiesta esplicita (da espandere con AI)",
      "",
      "Si prega di investigare la codebase sopra elencata e produrre:",
      "",
      "1. Analisi del problema/questione implicito nel titolo",
      "2. Soluzioni proposte con pro e contro",
      "3. Checklist di implementazione",
      "",
    ].filter(Boolean).join("\n");
  }

  const outputDir = path.resolve(option(options, "output-dir", "o", ".ares/prompt"));
  const effectiveTitle = title || titleHint || rawPrompt.split(/\r?\n/)[0] || "prompt";

  job.logInfo("make-prompt", "Inviando prompt a capability prompt_refactor", {
    inputLength: rawPrompt.length,
    inputSource,
    title: effectiveTitle,
    titleExplicit: Boolean(title),
    outputDir,
    codebaseFiles: ctx.files.length,
  });

  const aiPrompt = [
    title ? `Titolo (esplicito, usalo come titolo finale): ${title}` : titleHint ? `Suggerimento titolo: ${titleHint}` : "",
    contextBlock ? "Nota: l'utente ha fornito un titolo, ho automaticamente analizzato la codebase ed estratto il contesto seguente. Usalo per arricchire il prompt e calibrare la sezione Scopo/Dettagli:\n\n" + contextBlock : "",
    `Ristruttura e migliora il seguente prompt in markdown:\n\n${rawPrompt}`,
  ].filter(Boolean).join("\n\n");

  const res = await ai.runCapability("prompt_refactor", { prompt: aiPrompt, sample });
  const slug = res.result?.title_slug || slugifyForFilename(effectiveTitle);
  const ts = formatPromptTimestamp();
  const filename = `${ts}-${slug}.md`;
  const fullPath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  const rawRestructured = res.result?.restructured_markdown || buildRestructuredPromptMarkdown(rawPrompt);
  const content = [
    rawRestructured.trim(),
    "",
    "---",
    "",
    `<details><summary>Context Trace (analisi codebase automatica, ${new Date().toISOString()})</summary>`,
    "",
    `**Titolo esplicito**: ${title || "_non fornito_"}  `,
    `**Scope analisi**: \`${path.resolve(scope)}\`  `,
    `**Input source**: \`${inputSource}\`  `,
    "",
    "```",
    ctx.summary,
    "```",
    "",
    ctx.files.length ? "**Top file rilevanti**:" : "",
    ...ctx.files.map((f,i) => `${i+1}. \`${f.rel}\` â€” score ${f.score} | hits: ${f.hits.map(h=>`${h.keyword}(${h.count})`).join(", ")}`),
    "",
    "</details>",
    "",
  ].filter((l, idx, arr) => !(l === "" && arr[idx-1] === "")).join("\n");
  fs.writeFileSync(fullPath, content, "utf8");

  job.addArtifact({
    filePath: fullPath,
    name: filename,
    kind: "prompt",
    storage: "local",
  });
  job.logInfo("make-prompt", `Prompt salvato in ${fullPath}`, {
    providerId: res.providerId,
    sample: Boolean(res.sample),
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut,
  });

  return {
    outputDir,
    outputFile: fullPath,
    slug,
    timestamp: ts,
    title: res.result?.suggested_title || effectiveTitle,
    titleExplicit: Boolean(title),
    inputSource,
    codebaseContext: {
      scope: path.resolve(scope),
      keywords: ctx.keywords,
      relevantFiles: ctx.files.map((f) => ({ rel: f.rel, score: f.score, hits: f.hits })),
    },
    providerId: res.providerId,
    sample: Boolean(res.sample),
  };
}

async function makeDocsCommand(positional, options, job) {
  const sample = Boolean(option(options, "sample", "s", false));
  const ai = await loadAIModule({ sample });
  if (!ai) throw new Error(AI_NOT_AVAILABLE.error);

  const scope = path.resolve(option(options, "scope", null, process.cwd()));
  const lang = option(options, "lang", null, "it");
  const instructions = option(options, "instructions", null, "");
  const files = detectScopeFiles(scope, 3);

  job.logInfo("make-docs", "Generazione documentazione AI", { scope, lang, filesFound: files.length });

  const aiPrompt = [
    `Genera o aggiorna documentazione per il modulo/cartella situato in scope: ${scope}.`,
    `Lingua doc principale richiesta: ${lang}.`,
    `File presenti (fino a 200): ${files.length}`,
    files.length ? `- Lista file: ${files.slice(0, 60).join(", ")}${files.length > 60 ? " ... (truncated)" : ""}` : "",
    instructions ? `- Istruzioni aggiuntive: ${instructions}` : "",
    `Rispetta lo standard di documentazione aReS: .ares/docs/it e .ares/docs/en con index.md + file nome modulo + completion.md.`,
  ].filter(Boolean).join("\n");

  const res = await ai.runCapability("generate_docs", {
    projectId: path.basename(scope),
    prompt: aiPrompt,
    sample,
    context: { scope, files, lang, type: "docs_generate" },
  });

  const docsLangDir = path.join(scope, ".ares", "docs", lang);
  fs.mkdirSync(docsLangDir, { recursive: true });

  const indexPath = path.join(docsLangDir, "index.md");
  const indexContent = res.result?.summary
    ? `# Documentazione (${lang})\n\n${res.result.summary}\n`
    : `# Documentazione (${lang})\n\n_Scope: ${scope}_\n`;
  fs.writeFileSync(indexPath, indexContent, "utf8");
  job.addArtifact({ filePath: indexPath, name: `index.md (${lang})`, kind: "docs", storage: "local" });

  const otherLang = lang === "it" ? "en" : "it";
  const otherDir = path.join(scope, ".ares", "docs", otherLang);
  fs.mkdirSync(otherDir, { recursive: true });
  const otherIndex = path.join(otherDir, "index.md");
  if (!fs.existsSync(otherIndex)) {
    fs.writeFileSync(otherIndex, `# Documentation (${otherLang})\n\n_Scope: ${scope}_\n`, "utf8");
    job.addArtifact({ filePath: otherIndex, name: `index.md (${otherLang})`, kind: "docs", storage: "local" });
  }

  job.logInfo("make-docs", `Documentazione generata in .ares/docs/${lang}`, {
    providerId: res.providerId,
    sample: Boolean(res.sample),
  });

  return {
    scope,
    lang,
    filesFound: files.length,
    docsDir: path.join(scope, ".ares", "docs"),
    filesGenerated: (res.result?.files_generated || [indexPath]).concat(res.sample ? [] : []),
    summary: res.result?.summary || "",
    providerId: res.providerId,
    sample: Boolean(res.sample),
  };
}

async function makeTicketCommand(positional, options, job) {
  const sample = Boolean(option(options, "sample", "s", false));
  const ai = await loadAIModule({ sample });
  if (!ai) throw new Error(AI_NOT_AVAILABLE.error);

  const rawInput = await readPromptInput({
    path: option(options, "path", "p"),
    text: option(options, "text", "t"),
  });

  const titleHint = option(options, "title-hint") || rawInput.split(/\r?\n/)[0] || "ticket";
  const outputDir = path.resolve(option(options, "output-dir", "o", ".ares/tasks"));

  job.logInfo("make-ticket", "Generazione ticket checklist", { titleHint, outputDir });

  const aiPrompt = [
    `Converti la seguente richiesta in un ticket checklist strutturato.`,
    `Usa ESATTAMENTE queste sezioni: ## Alta prioritÃ , ## Contratto Modulo (API Pubbliche), ## Packaging, ## Robustezza Runtime, ## QualitÃ  (Test e Lint), ## Documentazione e Adozione.`,
    `Titolo suggerito: ${titleHint}`,
    `\nInput:\n\n${rawInput}`,
  ].join("\n");

  const res = await ai.runCapability("prompt_refactor", { prompt: aiPrompt, sample });
  const slug = res.result?.title_slug || slugifyForFilename(titleHint);
  const ts = formatPromptTimestamp();
  const filename = `${ts}-${slug}.md`;
  const fullPath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  const content = res.result?.restructured_markdown
    ? res.result.restructured_markdown
    : buildTicketChecklist(titleHint);
  fs.writeFileSync(fullPath, content, "utf8");

  job.addArtifact({ filePath: fullPath, name: filename, kind: "ticket", storage: "local" });
  job.logInfo("make-ticket", `Ticket salvato in ${fullPath}`, {
    providerId: res.providerId,
    sample: Boolean(res.sample),
  });

  return {
    outputDir,
    outputFile: fullPath,
    slug,
    timestamp: ts,
    title: res.result?.suggested_title || titleHint,
    providerId: res.providerId,
    sample: Boolean(res.sample),
  };
}

async function workTicketCommand(positional, options, job) {
  const sample = Boolean(option(options, "sample", "s", false));
  const ai = await loadAIModule({ sample });
  if (!ai) throw new Error(AI_NOT_AVAILABLE.error);

  const identifier = positional[0];
  if (!identifier) throw new Error("work ticket richiede un identificativo: nome file, prefisso YYYYMMDD-HHmm o slug");

  const ticketPath = findTicketFile(identifier);
  if (!ticketPath) throw new Error(`Ticket non trovato per: ${identifier}`);

  const ticketContent = fs.readFileSync(ticketPath, "utf8");
  job.logInfo("work-ticket", `Lavoro ticket: ${ticketPath}`);

  const aiPrompt = `Lavora il seguente ticket checklist e restituisci un oggetto JSON con campi: tickets_completed (array stringhe), next_steps (array stringhe), modified_files (array stringhe), suggestions (array stringhe).\n\nContenuto ticket:\n\n${ticketContent}`;

  let res = await ai.runCapability("refactor_code", { prompt: aiPrompt, sample });
  if (!res.ok || !res.result?.tickets_completed) {
    res = await ai.runCapability("answer_question", { prompt: aiPrompt, sample });
  }

  const report = {
    ticketFile: ticketPath,
    tickets_completed: res.result?.tickets_completed || [],
    next_steps: res.result?.next_steps || [],
    modified_files: res.result?.modified_files || [],
    suggestions: res.result?.suggestions || [],
    providerId: res.providerId,
    sample: Boolean(res.sample),
  };

  const outputFile = option(options, "output", "o");
  if (outputFile) {
    const absOut = path.resolve(outputFile);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, JSON.stringify(report, null, 2), "utf8");
    job.addArtifact({ filePath: absOut, name: path.basename(absOut), kind: "report", storage: "local" });
  }

  job.logInfo("work-ticket", `Analisi ticket completata`, {
    completed: report.tickets_completed.length,
    nextSteps: report.next_steps.length,
  });

  return report;
}

async function analyzeCodeCommand(positional, options, job) {
  const sample = Boolean(option(options, "sample", "s", false));
  const ai = await loadAIModule({ sample });
  if (!ai) throw new Error(AI_NOT_AVAILABLE.error);

  const scope = path.resolve(option(options, "scope", null, process.cwd()));
  const maxDepth = parseInt(option(options, "max-depth", null, "3"), 10) || 3;
  const outputFile = option(options, "output", "o");

  const files = detectScopeFiles(scope, maxDepth);
  job.logInfo("analyze-code", `Analisi scope: ${scope}`, {
    filesFound: files.length,
    maxDepth,
  });

  const samples = [];
  for (const f of files.slice(0, 20)) {
    const abs = path.join(scope, f);
    try {
      const raw = fs.readFileSync(abs, "utf8").split(/\r?\n/).slice(0, 50).join("\n");
      samples.push(`--- ${f} ---\n${raw}`);
    } catch {}
  }

  const aiPrompt = [
    `Analizza il codice nel seguente scope per identificare miglioramenti:`,
    `- Scope: ${scope}`,
    `- File totali: ${files.length}`,
    `- File listati: ${files.slice(0, 60).join(", ")}${files.length > 60 ? " ..." : ""}`,
    `- Campioni contenuto (primi 20 file, max 50 linee ciascuno):`,
    "",
    samples.join("\n\n"),
    "",
    "Genera ticket di miglioramento per: ereditarietÃ , polimorfismo, contratti, riuso, pulizia codice.",
    "Restituisci oggetto JSON { tickets: [{title, slug, body}], summary: string }. Ogni body Ã¨ in markdown.",
  ].join("\n");

  const res = await ai.runCapability("analyze_code", { prompt: aiPrompt, sample });
  const tickets = res.result?.tickets || [];
  const suggestedDir = path.resolve(".ares", "tasks", "suggested");
  fs.mkdirSync(suggestedDir, { recursive: true });

  const tsBase = formatPromptTimestamp();
  const savedPaths = [];
  tickets.forEach((t, i) => {
    const slug = t.slug || slugifyForFilename(t.title || `suggestion-${i}`);
    const filename = `${tsBase}-${i.toString().padStart(2,"0")}-${slug}.md`;
    const full = path.join(suggestedDir, filename);
    const body = t.body || buildTicketChecklist(t.title || "Suggested Ticket");
    fs.writeFileSync(full, body, "utf8");
    savedPaths.push(full);
    job.addArtifact({ filePath: full, name: filename, kind: "ticket-suggestion", storage: "local" });
  });

  let report = null;
  if (outputFile) {
    const absOut = path.resolve(outputFile);
    report = {
      scope,
      filesFound: files.length,
      ticketsGenerated: savedPaths.length,
      summary: res.result?.summary || "",
      tickets: savedPaths,
      providerId: res.providerId,
      sample: Boolean(res.sample),
    };
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, JSON.stringify(report, null, 2), "utf8");
    job.addArtifact({ filePath: absOut, name: path.basename(absOut), kind: "report", storage: "local" });
  }

  job.logInfo("analyze-code", `Generati ${savedPaths.length} ticket suggeriti in ${suggestedDir}`, {
    providerId: res.providerId,
    sample: Boolean(res.sample),
  });

  return {
    scope,
    filesFound: files.length,
    maxDepth,
    suggestedDir,
    ticketsGenerated: savedPaths.length,
    ticketFiles: savedPaths,
    summary: res.result?.summary || "",
    reportFile: outputFile ? path.resolve(outputFile) : null,
    providerId: res.providerId,
    sample: Boolean(res.sample),
  };
}

// =================== install-local / create-remote / create / survey ===================

async function installLocalCommand(positional, options, job) {
  const name = positional[0];
  if (!name) throw new Error("Repository name is required");

  const yes = Boolean(options.yes ?? options.y ?? false);
  const githubUser = option(options, "github-user", null, "rstefani87info");
  const modulePath = option(options, "path", "p", null);
  const localName = option(options, "local-name", "l", name);
  const moduleName = option(options, "module", "m", name);
  const description = option(options, "description", "d", "");
  const repoUrl = `https://github.com/${githubUser}/${name}.git`;

  let localDir;
  if (modulePath) {
    const resolved = path.isAbsolute(modulePath) ? modulePath : path.resolve(process.cwd(), modulePath);
    localDir = path.join(resolved, localName);
  } else {
    localDir = path.join(process.cwd(), localName);
  }

  job.logInfo("install-local", `Setting up local repository '${name}'`, {
    localDir,
    localName,
    moduleName,
    repoUrl,
  });

  const repo = new Repository(name, localDir, githubUser, "", repoUrl);
  const initResult = await repo.initOrClone(localDir, repoUrl);
  job.logInfo("install-local", `Git: ${initResult.action}`, { path: initResult.path });

  const pkgPath = path.join(localDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    const pkg = {
      name: moduleName,
      version: "1.0.0",
      description,
      main: "index.js",
      type: "module",
      scripts: { test: 'echo "Error: no test specified" && exit 1' },
      author: "Roberto Stefani",
      license: "MIT",
      repository: { type: "git", url: `git+${repoUrl}` },
      bugs: { url: `${repoUrl}/issues` },
      homepage: `${repoUrl}#readme`,
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    job.logInfo("install-local", `Generated ${pkgPath}`);
  }

  const listFile = path.join(path.dirname(localDir), "ares-modules.txt");
  if (fs.existsSync(path.dirname(listFile))) {
    let existing = "";
    try { existing = fs.readFileSync(listFile, "utf8"); } catch {}
    if (!existing.split(/\r?\n/).includes(localDir)) {
      fs.appendFileSync(listFile, localDir + "\n");
      job.logInfo("install-local", `Registered in ares-modules.txt`);
    }
  }

  const indexPath = path.join(localDir, "index.js");
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, "/**\n * @author Roberto Stefani\n**/\n");
  }

  job.logInfo("install-local", "Installing @ares/core");
  const coreOut = await runYarn(["add", "@ares/core@workspace:*"], { cwd: localDir });
  logSubprocessOutput(job, coreOut, "yarn/add-core");
  console.log(`      [OK] @ares/core installato`);

  const deps = positional.slice(1);
  if (deps.length) {
    job.logInfo("install-local", `Installing dependencies: ${deps.join(", ")}`);
    const depsOut = await runYarn(["add", ...deps], { cwd: localDir });
    logSubprocessOutput(job, depsOut, "yarn/add-deps");
    console.log(`      [OK] Dipendenze extra installate`);
  }

  job.logInfo("install-local", "Installing @ares/scd (devDependency)");
  const scdOut = await runYarn(["add", "-D", "@ares/scd@workspace:*"], { cwd: localDir });
  logSubprocessOutput(job, scdOut, "yarn/add-scd");
  console.log(`      [OK] @ares/scd installato`);

  const workspaceResult = { detected: false, added: false };
  const ws = findYarnWorkspaceRoot(localDir);
  if (ws && ws.rootDir !== localDir) {
    workspaceResult.detected = true;
    workspaceResult.workspaceRoot = ws.rootDir;
    const projectRelative = path.relative(ws.rootDir, localDir).replace(/\\/g, "/");
    const reg = addProjectToWorkspace(ws.rootDir, projectRelative);
    workspaceResult.added = reg.added;
    workspaceResult.reason = reg.reason;
    if (reg.added) {
      console.log(`   [WS] Aggiunto al workspace Yarn: ${ws.rootDir} (pattern: ${projectRelative})`);
    } else {
      console.log(`   [WS] Gia coperto dal workspace (${reg.reason})`);
    }
  }

  const steps = [];
  if (yes || await promptYesNo("Vuoi inizializzare la struttura progetto SCD (src/, lib/, build/, docs/) + build-config.json?")) {
    console.log(`   [INIT] Inizializzazione struttura SCD...`);
    await runYarn(["ares-scd", "init", moduleName], { cwd: localDir });
    steps.push("init");
    console.log(`   [OK] Struttura SCD inizializzata (src/, lib/, build/, docs/, build-config.json)`);
  }

  if (yes || await promptYesNo("Vuoi creare un ticket iniziale di bootstrap in tickets/?")) {
    console.log(`   [TASK] Creazione ticket bootstrap...`);
    const ticketText = `Bootstrap modulo ${moduleName}: setup struttura, dipendenze, config iniziale, contratto API, smoke tests`;
    await runYarn(["ares-scd", "make", "ticket", "--text", ticketText, "--sample"], { cwd: localDir });
    steps.push("ticket");
    console.log(`   [OK] Ticket bootstrap creato in .ares/tasks/`);
  }

  if (yes || await promptYesNo("Vuoi generare la documentazione iniziale in docs/it/ e docs/en/?")) {
    console.log(`   [DOCS] Generazione documentazione...`);
    const lang = yes ? "it" : await promptInput("Lingua principale", "it");
    await runYarn(["ares-scd", "make", "docs", "--lang", lang, "--scope", ".", "--sample"], { cwd: localDir });
    steps.push("docs");
    console.log(`   [OK] Documentazione generata in .ares/docs/${lang}/ e .ares/docs/${lang === "it" ? "en" : "it"}/`);
  }

  return {
    name,
    localName,
    moduleName,
    localDir,
    repoUrl,
    gitAction: initResult.action,
    workspace: workspaceResult,
    steps,
  };
}

async function createRemoteCommand(positional, options, job) {
  const name = positional[0];
  if (!name) throw new Error("Repository name is required");

  const token = option(options, "github-token", null, null);
  if (!token) throw new Error("--github-token is required");

  const isPrivate = Boolean(options.private ?? options.p ?? false);
  const description = option(options, "description", "d", "");

  console.log(`\n[GITHUB] Creazione repository GitHub: ${name}`);
  console.log(`   [PRIV] Privato: ${isPrivate ? "Si" : "No"}`);
  if (description) console.log(`   [DESC] Descrizione: ${description}`);

  const repo = new Repository(name, process.cwd(), "", description, "", isPrivate, null, token);
  const result = await repo.createOnGitHub();

  console.log(`   [OK] Repository creato: ${repo.url}`);
  if (result.html_url) console.log(`   [URL] ${result.html_url}`);

  return {
    name,
    url: repo.url,
    htmlUrl: result.html_url,
    private: isPrivate,
  };
}

async function createCommand(positional, options, job) {
  const name = positional[0];
  if (!name) throw new Error("Repository name is required");

  const remoteOnly = Boolean(options["remote-only"]);
  const localOnly = Boolean(options["local-only"]);

  const results = {};

  if (!localOnly) {
    console.log(`\n[STEP 1/2] Creazione repository remoto GitHub...`);
    results.remote = await createRemoteCommand(positional, options, job);
  }

  if (!remoteOnly) {
    console.log(`\n[STEP ${localOnly ? "1" : "2"}/2] Configurazione progetto locale...`);
    results.local = await installLocalCommand(positional, options, job);
  }

  console.log(`\n[DONE] Operazione completata!`);
  if (results.remote) console.log(`   [REMOTE] Remote: ${results.remote.url}`);
  if (results.local) console.log(`   [LOCAL] Locale: ${results.local.localDir}`);

  return results;
}

async function surveyCommand(positional, options, job) {
  const subCommand = positional[0] || "run";
  const configDir = options.config || path.join(process.cwd(), "surveys");
  const outputPath = options.output || path.join(process.cwd(), ".ares", "survey-results.json");
  const lang = options.lang || "it";
  const yes = Boolean(options.yes ?? options.y ?? false);

  if (subCommand === "list") {
    console.log(`\n[LIST] Survey disponibili in ${configDir}:`);
    const fs = await import("fs");
    const surveysDir = path.join(configDir);
    if (fs.existsSync(surveysDir)) {
      const files = fs.readdirSync(surveysDir).filter(f => f.endsWith(".json"));
      for (const f of files) {
        try {
          const survey = await import("@ares/survey").then(m => m.Survey.fromFile(path.join(configDir, f)));
          console.log(`  - ${f}: ${survey.getTitle("it")} (${survey.getQuestions().length} domande)`);
        } catch (e) {
          console.log(`  - ${f}: (errore: ${e.message})`);
        }
      }
    } else {
      console.log(`  (directory non trovata)`);
    }
    return { action: "list", surveys: [] };
  }

  if (subCommand === "init") {
    const outputFile = options.output || path.join(process.cwd(), "surveys", "new-survey.json");
    const { createSampleSurvey } = await import("@ares/survey");
    const sample = createSampleSurvey(outputFile, { titleIt: "Nuovo Questionario", titleEn: "New Survey" });
    console.log(`\n[OK] Survey di esempio creato: ${outputFile}`);
    return { action: "init", outputPath: outputFile };
  }

  // Default: run survey
  console.log(`\n[RUN] Esecuzione questionario...`);
  
  let survey;
  try {
    survey = await loadMergedSurvey(configDir);
  } catch (e) {
    throw new Error(`Impossibile caricare survey da ${configDir}: ${e.message}`);
  }

  console.log(`[SURVEY] ${survey.getTitle("it")} / ${survey.getTitle("en")}`);
  if (survey.introduction && Object.keys(survey.introduction).length > 0) {
    console.log(`\n${survey.getIntroduction("it")}\n`);
  }

const answers = {};
  for (const question of survey.getQuestions()) {
    console.log(`\nâ“ [${question.id}] ${question.getQuestionText("it")}`);
    if (question.getHelpText("it")) {
      console.log(`   [HELP] ${question.getHelpText("it")}`);
    }

    if (yes) {
      if (question.isOpenEnded()) {
        answers[question.id] = question.defaultValue || "";
      } else if (question.isSingleChoice() || question.isBoolean()) {
        const options = question.getOptions("it");
        if (options.length > 0) {
          answers[question.id] = question.defaultValue || options[0].value;
        }
      } else if (question.isMultipleChoice()) {
        answers[question.id] = question.defaultValue || [];
      } else if (question.isScale()) {
        answers[question.id] = question.defaultValue || 3;
      }
      console.log(`   âï¸  (auto: ${JSON.stringify(answers[question.id])})`);
      continue;
    }

    if (question.isOpenEnded()) {
      const answer = await promptInput(`   Risposta libera`, "");
      answers[question.id] = answer;
    } else if (question.isSingleChoice() || question.isBoolean()) {
      console.log(`   Opzioni:`);
      for (const opt of question.getOptions("it")) {
        console.log(`   ${opt.value}) ${opt.text}`);
      }
      let answer;
      while (true) {
        answer = await promptInput(`   Scelta`, "");
        const valid = question.getOptions("it").some(o => o.value === answer || o.value === answer);
        if (valid || !question.required) break;
        console.log(`   âŒ Opzione non valida. Riprova.`);
      }
      answers[question.id] = answer;
    } else if (question.isMultipleChoice()) {
      console.log(`   Opzioni (separate da virgola):`);
      for (const opt of question.getOptions("it")) {
        console.log(`   ${opt.value}) ${opt.text}`);
      }
      const input = await promptInput(`   Scelte (es: a,b,c)`, "");
      answers[question.id] = input.split(",").map(s => s.trim()).filter(Boolean);
    } else if (question.isScale()) {
      const input = await promptInput(`   Valore (1-5)`, "3");
      answers[question.id] = parseInt(input) || 3;
    }
  }

  const validation = survey.validateAnswers(answers);
  if (!validation.valid) {
    console.log(`\n[WARN] Errori di validazione:`);
    for (const e of validation.errors) {
      console.log(`  - Q${e.question_id}: ${e.error}`);
    }
  }

  const outputDir = path.dirname(outputPath);
  const fs = await import("fs");
  fs.mkdirSync(outputDir, { recursive: true });
  
  const result = {
    surveyId: survey.title,
    surveyVersion: survey.version,
    lang,
    answers,
    timestamp: new Date().toISOString(),
    validation
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  
  const report = generateReport(survey, answers);
  console.log(`\n${report}`);
  console.log(`\n[OK] Questionario completato! Risultati salvati in: ${outputPath}`);

  return {
    action: "run",
    surveyTitle: survey.getTitle("it"),
    answersCount: Object.keys(answers).length,
    outputPath,
    validation
  };
}


// =================== Dispatcher make / work / analyze ===================
function resolveCompoundCommand(command, positional) {
  const sub = positional[0];
  if (command === "make" && sub === "prompt") return { id: "make-prompt", shift: 1 };
  if (command === "make" && sub === "docs") return { id: "make-docs", shift: 1 };
  if (command === "make" && sub === "ticket") return { id: "make-ticket", shift: 1 };
  if (command === "work" && sub === "ticket") return { id: "work-ticket", shift: 1 };
  if (command === "analyze" && sub === "code") return { id: "analyze-code", shift: 1 };
  if (command === "make-prompt" || command === "prompt:make") return { id: "make-prompt", shift: 0 };
  if (command === "make-docs" || command === "docs:make") return { id: "make-docs", shift: 0 };
  if (command === "make-ticket" || command === "ticket:make") return { id: "make-ticket", shift: 0 };
  if (command === "work-ticket" || command === "ticket:work") return { id: "work-ticket", shift: 0 };
  if (command === "analyze-code" || command === "code:analyze") return { id: "analyze-code", shift: 0 };
  return null;
}

const COMMANDS = {
  init: { name: "scd-init", run: (p, o, j) => initCommand(p, o, j) },
  build: { name: "scd-build", run: (_p, o, j) => buildCommand(o, j) },
  deploy: { name: "scd-deploy", run: (_p, o, j) => deployCommand(o, j) },
  git: { name: "scd-git", run: (_p, o, j) => gitCommand(o, j) },
  test: { name: "scd-test", run: (_p, o, j) => testCommand(o, j) },
  "git-status": { name: "scd-git-status", run: (p, o, j) => gitStatusCommand(p, o, j) },
  "git-flow-start": { name: "scd-git-flow-start", run: (p, o, j) => gitFlowStartCommand(p, o, j) },
  "git-flow-finish": { name: "scd-git-flow-finish", run: (p, o, j) => gitFlowFinishCommand(p, o, j) },
  "make-prompt": { name: "scd-make-prompt", run: (p, o, j) => makePromptCommand(p, o, j) },
  "make-docs": { name: "scd-make-docs", run: (p, o, j) => makeDocsCommand(p, o, j) },
  "make-ticket": { name: "scd-make-ticket", run: (p, o, j) => makeTicketCommand(p, o, j) },
  "work-ticket": { name: "scd-work-ticket", run: (p, o, j) => workTicketCommand(p, o, j) },
  "analyze-code": { name: "scd-analyze-code", run: (p, o, j) => analyzeCodeCommand(p, o, j) },
  "install-local": { name: "scd-install-local", run: (p, o, j) => installLocalCommand(p, o, j) },
  "create-remote": { name: "scd-create-remote", run: (p, o, j) => createRemoteCommand(p, o, j) },
  "create": { name: "scd-create", run: (p, o, j) => createCommand(p, o, j) },
  "survey": { name: "scd-survey", run: (p, o, j) => surveyCommand(p, o, j) },
  "questionnaire": { name: "scd-questionnaire", run: (p, o, j) => questionnaireCommand(p, o, j) },
};

const HUMAN_MESSAGE = {
  "scd-init": (job) => `Application initialized at ${job.result?.basePath ?? job.projectRoot}`,
  "scd-build": (job) => `Build completed (${job.result?.buildType ?? "n/a"}): ${job.result?.buildOutput ?? ""}`,
  "scd-deploy": (job) => `Deploy to '${job.result?.environment ?? "n/a"}' completed`,
  "scd-git": (job) =>
    `Git actions done: ${(job.result?.actions ?? []).map((a) => (typeof a === "string" ? a : a.name)).join(", ") || "none"}`,
  "scd-test": () => `Tests completed`,
  "scd-git-status": (job) =>
    `Branch ${job.result?.currentBranch ?? "n/a"} - ${job.result?.clean ? "clean" : `${job.result?.workingTree?.length ?? 0} change(s)`}`,
  "scd-git-flow-start": (job) => `Started ${job.result?.type ?? ""} '${job.result?.name ?? ""}' -> ${job.result?.branchName ?? ""}`,
  "scd-git-flow-finish": (job) => `Finished ${job.result?.type ?? ""} '${job.result?.name ?? ""}' (merged ${job.result?.branchName ?? ""})`,
  "scd-make-prompt": (job) =>
    `Prompt ristrutturato: ${job.result?.title ?? "n/a"} -> ${job.result?.outputFile ?? ""}${job.result?.sample ? " [sample]" : ""}`,
  "scd-make-docs": (job) =>
    `Docs (${job.result?.lang ?? "n/a"}) generated: ${job.result?.docsDir ?? ""} - ${job.result?.summary ?? ""}${job.result?.sample ? " [sample]" : ""}`,
  "scd-make-ticket": (job) =>
    `Ticket creato: ${job.result?.title ?? "n/a"} -> ${job.result?.outputFile ?? ""}${job.result?.sample ? " [sample]" : ""}`,
  "scd-work-ticket": (job) =>
    `Work ticket: ${job.result?.ticketFile ?? "n/a"} - ${job.result?.tickets_completed?.length ?? 0} completati, ${job.result?.next_steps?.length ?? 0} next steps${job.result?.sample ? " [sample]" : ""}`,
  "scd-analyze-code": (job) =>
    `Analyze code: ${job.result?.ticketsGenerated ?? 0} ticket suggeriti in ${job.result?.suggestedDir ?? "n/a"}${job.result?.sample ? " [sample]" : ""}`,
  "scd-survey": (job) => `Survey: ${job.result?.surveyTitle ?? "n/a"} - ${job.result?.answersCount ?? 0} risposte salvate in ${job.result?.outputPath ?? ""}`,
  "scd-questionnaire": (job) => `Questionario completato: ${job.result?.sectionsCompleted ?? 0} sezioni salvate in ${job.result?.outputPath ?? ""}`,
};

export { makePromptCommand, makeDocsCommand, makeTicketCommand, workTicketCommand, analyzeCodeCommand };
export { extractKeywords, analyzeCodebaseContext, scoreFileRelevance, extractSnippet, buildContextBlock };

export async function main(argv = process.argv.slice(2)) {
  const cliLogging = setupCliLogging(argv);
  const parsed = parseArgs(argv);
  const { json, cleaned: commandOptions } = consumeGlobalFlags(parsed.options);

  if (
    parsed.command === "help" ||
    parsed.command === "--help" ||
    parsed.command === "-h" ||
    parsed.command === undefined
  ) {
    help();
    cliLogging.finish();
    return null;
  }

  let effectiveCommand = parsed.command;
  let effectivePositional = parsed.positional;
  const compound = resolveCompoundCommand(parsed.command, parsed.positional);
  if (compound) {
    effectiveCommand = compound.id;
    effectivePositional = parsed.positional.slice(compound.shift);
  }

  const cmd = COMMANDS[effectiveCommand];
  if (!cmd) {
    const errMsg = `Unknown command: ${parsed.command}${compound ? ` (resolved: ${effectiveCommand})` : ""}`;
    if (json) {
      const job = new JobOutput("scd-unknown", { projectRoot: process.cwd(), logToConsole: false });
      job.markFailed(new Error(errMsg));
      process.stderr.write(JSON.stringify(job.toJSON(), null, 2) + "\n");
    } else {
      console.error(errMsg);
    }
    process.exitCode = 1;
    return null;
  }

  const job = new JobOutput(cmd.name, {
    projectRoot: process.cwd(),
    executionMode: "in-process",
    logToConsole: !json,
  });

  try {
    const result = await cmd.run(effectivePositional, commandOptions, job);
    job.markDone(result);
    emitJobResult(job, json, HUMAN_MESSAGE[cmd.name]?.(job));
  } catch (error) {
    job.markFailed(error);
    emitJobResult(
      job,
      json,
      `${cmd.name} failed: ${error?.message ?? String(error)}`,
      "stderr"
    );
    process.exitCode = 1;
  } finally {
    cliLogging.finish();
  }

  return job.toJSON();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}



























