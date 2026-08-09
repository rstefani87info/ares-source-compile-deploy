import { BuildManager } from "./build-manager.js";
import { DeployManager } from "./deploy-manager.js";
import { GitFlow } from "./git-flow.js";

export { Application, DataSource, DataSourceEntity, DataSourceView } from "./application.js";
export { BuildManager, default as DefaultBuildManager } from "./build-manager.js";
export { DeployManager, default as DefaultDeployManager } from "./deploy-manager.js";
export { Repository } from "./git.js";
export { GitFlow, default as DefaultGitFlow } from "./git-flow.js";
export { main as cli } from "./cli.js";

export * as programming from "./programming.js";
export {
  Application as ProgrammingApplication,
  ApplicationMember,
  Attribute,
  Call,
  Class,
  Comment,
  Condition,
  Constructor,
  Data,
  Definition,
  EcmaScriptDriver,
  Error,
  Flow,
  Interface,
  Method,
  ModuleMethod,
  ModuleProperty,
  ProgramModule,
  Property,
  Return,
  SourceFile,
  Ternary,
  TernaryAssignation,
  Type,
  classDesignPatterns,
  writeEcmaClass,
  writeEcmaMember,
  writeEcmaMethod,
} from "./programming.js";

export function createSuite(application, options = {}) {
  return {
    application,
    build: new BuildManager(application),
    deploy: new DeployManager(application),
    repository: options.repository ?? null,
    gitFlow: options.repository ? new GitFlow(options.repository, options.gitFlow) : null,
  };
}

export const crateSuite = createSuite;
