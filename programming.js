import fs from "fs";
import path from "path";
import { Repository } from "./git.js";

export class ApplicationMember {
  constructor(application = null, description = "") {
    this.uuid = `${this.constructor.name}.${Date.now()}.${Math.random().toString(16).slice(2)}`;
    this.application = application;
    this.description = typeof description === "string" ? { en: description } : description;
  }

  get metaType() {
    return this.constructor.name;
  }

  write(driver) {
    const methodName = `write${this.constructor.name}`;
    if (typeof driver?.[methodName] !== "function") {
      throw new Error(`${methodName} is not implemented by the selected driver`);
    }
    return driver[methodName](this);
  }
}

export class Application extends ApplicationMember {
  constructor(
    workspaceDir,
    name,
    dirName,
    nature = "application",
    applicationParent = null,
    configuration = {},
    datasources = {},
    structure = {},
    gitSettings = {},
    description = "",
    flows = []
  ) {
    super(applicationParent, description);
    this.workspaceDir = workspaceDir;
    this.name = name;
    this.dirName = dirName;
    this.dirPathName = path.join(workspaceDir, dirName).replace(/\\/g, "/");
    this.nature = nature;
    this.configuration = configuration;
    this.datasources = datasources;
    this.structure = structure;
    this.flows = flows;
    this.gitRepository = new Repository(
      this.dirName,
      this.dirPathName,
      gitSettings.user ?? "",
      this.description?.en ?? "",
      gitSettings.url ?? "",
      gitSettings.isPrivate ?? false,
      gitSettings.license ?? null,
      gitSettings.accessToken ?? null,
      gitSettings.defaultBranch ?? "main",
      gitSettings.language ?? "en"
    );
    this.events = {
      run: [],
      initWorkspace: [],
      initWorkspaceError: [],
      initApplication: [],
      initApplicationError: [],
      addEventListener: [],
      setAsFirstEventListener: [],
      clearEventListeners: [],
    };
  }

  setStructureComponent(key, block) {
    this.structure[key] = block;
    return this;
  }

  addEventListener(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    this.events.addEventListener.forEach((listener) => listener(event, callback));
    return this;
  }

  setAsFirstEventListener(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].unshift(callback);
    this.events.setAsFirstEventListener.forEach((listener) => listener(event, callback));
    return this;
  }

  clearEventListeners(event) {
    this.events[event] = [];
    this.events.clearEventListeners.forEach((listener) => listener(event));
    return this;
  }

  dumpEventListeners(event) {
    return this.events[event]?.map((listener) => listener.toString()) ?? [];
  }

  dumpEventListenerNames(event) {
    return this.events[event]?.map((listener) => listener.name || listener.constructor.name) ?? [];
  }

  initWorkspace({ backupExisting = true } = {}) {
    try {
      if (!fs.existsSync(this.workspaceDir)) {
        fs.mkdirSync(this.workspaceDir, { recursive: true });
      } else if (backupExisting) {
        const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
        fs.mkdirSync(path.join(this.workspaceDir, "_backup"), { recursive: true });
        fs.cpSync(this.workspaceDir, path.join(this.workspaceDir, "_backup", stamp), {
          recursive: true,
          force: true,
          filter: (source) => !source.includes(`${path.sep}_backup${path.sep}`),
        });
      }
      this.events.initWorkspace.forEach((callback) => callback(this));
      return true;
    } catch (error) {
      this.events.initWorkspaceError.forEach((callback) => callback(error, this));
      throw error;
    }
  }

  async initApplication() {
    try {
      if (this.gitRepository.url) await this.gitRepository.clone();
      else await this.gitRepository.init();
      this.events.initApplication.forEach((callback) => callback(this));
      return true;
    } catch (error) {
      this.events.initApplicationError.forEach((callback) => callback(error, this));
      throw error;
    }
  }

  run(environment) {
    return this.events.run.map((callback) => callback(environment, this));
  }

  stop(environment) {
    return this.events.run.map((callback) => callback.stop?.(environment, this));
  }
}

export class Comment extends ApplicationMember {}

export class SourceFile extends ApplicationMember {
  constructor(pathName = [], application = null, description = "", sourceCodeElements = []) {
    super(application, description);
    this.pathName = Array.isArray(pathName) ? pathName : String(pathName).split(/[\\/]/);
    this.sourceCodeElements = sourceCodeElements;
  }

  get name() {
    return this.pathName.at(-1);
  }

  get dirName() {
    return this.pathName.at(-2);
  }

  get filePathName() {
    return this.pathName.join("/");
  }

  get fileDirPathName() {
    return this.pathName.slice(0, -1).join("/");
  }

  get dirPath() {
    return this.pathName.slice(0, -1);
  }
}

export class Type {
  constructor(name, defaultValue = null, isPointer = false, description = null, clone = null, isIterable = false, isArray = false, isMap = false) {
    this.name = name;
    this.description = description;
    this.defaultValue = defaultValue;
    this.isPointer = isPointer;
    this.clone = clone;
    this.isIterable = isIterable;
    this.isArray = isArray;
    this.isMap = isMap;
  }

  write(driver) {
    return driver.writeType(this);
  }
}

export class Flow {
  constructor(parameters = [], returnObject = null, description = null) {
    this.parameters = parameters;
    this.returnObject = returnObject;
    this.description = description;
    this.steps = [];
    this.stepMap = {};
    this.variables = {};
  }

  addStep(stepName, step, description = null) {
    this.steps.push(stepName);
    this.stepMap[stepName] = { step, description };
    return this;
  }

  addSteps(stepNames, steps) {
    stepNames.forEach((stepName, index) => this.addStep(stepName, steps[index]));
    return this;
  }

  removeStep(stepName) {
    this.steps = this.steps.filter((step) => step !== stepName);
    delete this.stepMap[stepName];
    return this;
  }

  removeSteps(stepNames) {
    stepNames.forEach((stepName) => this.removeStep(stepName));
    return this;
  }

  write(driver) {
    return driver.writeFlow(this);
  }
}

export class Definition {
  constructor(subject, type, defaultValue = null, isConstant = false, description = null, context = null) {
    this.subject = subject;
    this.type = type;
    this.isConstant = isConstant;
    this.defaultValue = defaultValue;
    this.description = description;
    this.context = context;
  }

  get name() {
    return this.subject?.getUsedNameFrom?.(this.context) ?? this.subject?.name ?? this.subject;
  }

  write(driver) {
    return driver.writeDefinition(this);
  }
}

export class Assignation {
  constructor(subject, value, parameters = [], description = null, context = null) {
    this.subject = subject;
    this.value = value;
    this.parameters = parameters;
    this.description = description;
    this.context = context;
  }

  get name() {
    return this.subject?.getUsedNameFrom?.(this.context) ?? this.subject?.name ?? this.subject;
  }

  write(driver) {
    return driver.writeAssignation(this);
  }
}

export const Assignment = Assignation;

export class Ternary {
  constructor(condition, trueValue, falseValue, description = null, context = null) {
    this.condition = condition;
    this.trueValue = trueValue;
    this.falseValue = falseValue;
    this.description = description;
    this.context = context;
  }

  write(driver) {
    return driver.writeTernary(this);
  }
}

export class TernaryAssignation extends Assignation {
  constructor(subject, condition, trueValue, falseValue, parameters = [], description = null, context = null) {
    super(subject, new Ternary(condition, trueValue, falseValue, description, context), parameters, description, context);
  }
}

export class Condition {
  static ConditionOperators = {
    Equal: class Equal {
      constructor(left, right) {
        this.left = left;
        this.right = right;
      }
    },
    Not: class Not {
      constructor(comparison) {
        this.comparison = comparison;
      }
    },
    And: class And {
      constructor(left, right) {
        this.left = left;
        this.right = right;
      }
    },
    Or: class Or {
      constructor(left, right) {
        this.left = left;
        this.right = right;
      }
    },
    NotEqual: class NotEqual {
      constructor(left, right) {
        this.left = left;
        this.right = right;
      }
    },
    GreaterThan: class GreaterThan {
      constructor(left, right) {
        this.left = left;
        this.right = right;
      }
    },
    LessThan: class LessThan {
      constructor(left, right) {
        this.left = left;
        this.right = right;
      }
    },
    GreaterThanOrEqual: class GreaterThanOrEqual {
      constructor(left, right) {
        this.left = left;
        this.right = right;
      }
    },
    LessThanOrEqual: class LessThanOrEqual {
      constructor(left, right) {
        this.left = left;
        this.right = right;
      }
    },
    Exist: class Exist {
      constructor(value) {
        this.value = value;
      }
    },
    NotExist: class NotExist {
      constructor(value) {
        this.value = value;
      }
    },
  };

  static Operators = Condition.ConditionOperators;

  constructor(elements = [], trueCaseFlow = null, falseCaseFlow = null, description = null, context = null) {
    this.elements = elements;
    this.trueCaseFlow = trueCaseFlow;
    this.falseCaseFlow = falseCaseFlow;
    this.description = description;
    this.context = context;
  }

  write(driver) {
    return driver.writeCondition(this);
  }
}

export class Call {
  constructor(subject, parameters = [], returnType = null, description = null, context = null) {
    this.subject = subject;
    this.arguments = parameters;
    this.returnType = returnType;
    this.description = description;
    this.context = context;
  }

  get flow() {
    return this.subject?.flow;
  }

  get parameters() {
    return this.arguments;
  }

  get name() {
    return this.subject?.getUsedNameFrom?.(this.context) ?? this.subject?.name ?? this.subject;
  }

  get parametrize() {
    return this.subject?.parametrize?.(this.arguments) ?? this.arguments;
  }

  write(driver) {
    return driver.writeCall(this);
  }
}

export class Return {
  constructor(subject, parameters = [], description = null, context = null) {
    this.subject = subject;
    this.parameters = parameters;
    this.description = description;
    this.context = context;
  }

  get name() {
    return this.subject?.getUsedNameFrom?.(this.context) ?? this.subject?.name ?? this.subject;
  }

  write(driver) {
    return driver.writeReturn(this);
  }
}

export class ErrorCall extends Call {}
export { ErrorCall as Error };

export class Data extends ApplicationMember {
  constructor(type, root = null, attributes = {}, children = [], description = null, application = null) {
    super(application, description);
    this.type = type;
    this.root = root;
    this.attributes = attributes;
    this.children = children;
  }

  write(driver) {
    return driver.writeData(this);
  }
}

export class Attribute extends ApplicationMember {
  constructor(root, name, type, value = null, children = [], description = null, application = null) {
    super(application, description);
    this.root = root;
    this.name = name;
    this.type = type;
    this.value = value;
    this.children = children;
  }

  write(driver) {
    return driver.writeAttribute?.(this) ?? driver.writeData(this);
  }
}

class CodeMember extends ApplicationMember {
  constructor(owner, name, type = null, defaultValue = null, isConstant = false, description = null, access = "public", isStatic = false, application = null) {
    super(application, description);
    this.owner = owner;
    this.name = name;
    this.type = type;
    this.isConstant = isConstant;
    this.defaultValue = defaultValue;
    this.access = access;
    this.isStatic = isStatic;
  }

  getUsedNameFrom() {
    return this.name;
  }
}

export class ProgramModule extends CodeMember {
  constructor(name, properties = [], functions = [], namespace = [], description = null, access = "public", dependencies = [], application = null) {
    super(null, name, null, null, false, description, access, false, application);
    this.properties = properties;
    this.functions = functions;
    this.namespace = namespace;
    this.dependencies = dependencies;
  }

  write(driver) {
    return driver.writeModule(this);
  }
}

export class ModuleProperty extends CodeMember {
  write(driver) {
    return driver.writeProperty(this);
  }
}

export class ModuleMethod extends CodeMember {
  constructor(module, name, type, parameters = [], description = null, flow = null, isAbstract = false, access = "public", application = null) {
    super(module, name, type, null, true, description, access, false, application);
    this.module = module;
    this.parameters = parameters;
    this.flow = flow;
    this.isAbstract = isAbstract;
  }

  write(driver) {
    return driver.writeMethod(this);
  }
}

export class Class extends CodeMember {
  constructor(
    name,
    properties = [],
    constructors = [],
    methods = [],
    namespace = [],
    superClass = [],
    interfaces = [],
    description = null,
    pattern = null,
    isAbstract = false,
    access = "public",
    isStatic = false,
    dependencies = [],
    application = null
  ) {
    super(null, name, null, null, false, description, access, isStatic, application);
    this.properties = properties;
    this.constructors = constructors;
    this.methods = methods;
    this.namespace = namespace;
    this.superClass = superClass;
    this.interfaces = interfaces;
    this.pattern = pattern;
    this.isAbstract = isAbstract;
    this.dependencies = dependencies;
  }

  toType() {
    return new Type([this.namespace, this.name].flat().filter(Boolean).join("."), null, true, this.description, this.getMethod?.("clone"));
  }

  write(driver) {
    return driver.writeClass(this);
  }
}

export class Interface extends CodeMember {
  constructor(name, namespace = [], methods = [], description = null, application = null) {
    super(null, name, null, null, false, description, "public", false, application);
    this.namespace = namespace;
    this.methods = methods;
  }

  toType() {
    return new Type([this.namespace, this.name].flat().filter(Boolean).join("."), null, true, this.description);
  }

  write(driver) {
    return driver.writeInterface(this);
  }
}

export class Method extends CodeMember {
  constructor(clazz, name, type, parameters = [], description = null, flow = null, isAbstract = false, access = "public", isStatic = false, application = null) {
    super(clazz, name, type, null, true, description, access, isStatic, application);
    this.class = clazz;
    this.parameters = parameters;
    this.isAbstract = isAbstract;
    this.flow = isAbstract ? null : flow;
  }

  write(driver) {
    return driver.writeMethod(this);
  }
}

export class Constructor extends Method {
  constructor(clazz, parameters = [], description = null, flow = null, access = "public", application = null) {
    super(clazz, "constructor", clazz, parameters, description, flow, false, access, false, application);
  }

  write(driver) {
    return driver.writeConstructor?.(this) ?? driver.writeMethod(this);
  }
}

export class Property extends CodeMember {
  constructor(clazz, name, type, defaultValue = null, isConstant = false, description = null, access = "public", isStatic = false, application = null) {
    super(clazz, name, type, defaultValue, isConstant, description, access, isStatic, application);
    this.class = clazz;
  }

  write(driver) {
    return driver.writeProperty(this);
  }
}

export const classDesignPatterns = {
  singleton(instanceVariable, clazz, constructor, parameters = [], parameterConvertionFlow = null, renewable = false, access = "private", application = null) {
    clazz.properties.push(new Property(clazz, instanceVariable, clazz, null, !renewable, "Singleton instance", access, true, application));
    if (!clazz.constructors.includes(constructor)) clazz.constructors.push(constructor);

    const method = new Method(clazz, "getInstance", clazz, parameters, "Get singleton instance", null, false, "public", true, application);
    const constructorCall = new Call(constructor, parameterConvertionFlow?.returnObject ?? [], clazz, null, method);
    method.flow = (parameterConvertionFlow ?? new Flow())
      .addStep(
        "instanceAssignation",
        new TernaryAssignation(
          instanceVariable,
          new Condition([new Condition.ConditionOperators.Exist(instanceVariable)], null, null, "Check existence", method),
          instanceVariable,
          constructorCall,
          [],
          "Create instance if not exist",
          method
        )
      )
      .addStep("return", new Return(instanceVariable, [], null, method));
    clazz.methods.push(method);
    return method;
  },
};

function typeName(type) {
  return type?.name ?? type ?? "unknown";
}

export function writeEcmaMember(member) {
  const prefix = [member.access === "public" ? "" : member.access, member.isStatic ? "static" : "", member.isConstant ? "const" : ""]
    .filter(Boolean)
    .join(" ");
  const value = member.defaultValue !== null && member.defaultValue !== undefined ? ` = ${JSON.stringify(member.defaultValue)}` : "";
  return `${prefix ? `${prefix} ` : ""}${member.name}${value};`;
}

export function writeEcmaMethod(method) {
  const params = method.parameters?.map((parameter) => parameter.name ?? parameter).join(", ") ?? "";
  const body = method.flow ? method.flow.write(EcmaScriptDriver) : "";
  const prefix = [method.isStatic ? "static" : ""].filter(Boolean).join(" ");
  return `${prefix ? `${prefix} ` : ""}${method.name}(${params}) {\n${body}\n}`;
}

export function writeEcmaClass(clazz) {
  const extension = clazz.superClass?.[0] ? ` extends ${typeName(clazz.superClass[0])}` : "";
  return [
    `${clazz.access === "public" ? "export " : ""}class ${clazz.name}${extension} {`,
    ...clazz.properties.map((property) => `  ${writeEcmaMember(property)}`),
    ...clazz.constructors.map((constructor) => `  ${writeEcmaMethod(constructor).replaceAll("\n", "\n  ")}`),
    ...clazz.methods.map((method) => `  ${writeEcmaMethod(method).replaceAll("\n", "\n  ")}`),
    "}",
  ].join("\n");
}

export const EcmaScriptDriver = {
  writeClass: writeEcmaClass,
  writeMethod: writeEcmaMethod,
  writeConstructor: writeEcmaMethod,
  writeProperty: writeEcmaMember,
  writeFlow(flow) {
    return flow.steps
      .map((stepName) => flow.stepMap[stepName].step?.write?.(this) ?? "")
      .filter(Boolean)
      .join("\n");
  },
  writeReturn(statement) {
    return `return ${statement.name};`;
  },
  writeAssignation(statement) {
    return `${statement.name} = ${JSON.stringify(statement.value)};`;
  },
};

export default {
  Application,
  ApplicationMember,
  SourceFile,
  Comment,
  Type,
  Flow,
  Definition,
  Assignation,
  Assignment,
  Ternary,
  TernaryAssignation,
  Condition,
  Call,
  Return,
  Error: ErrorCall,
  Data,
  Attribute,
  ProgramModule,
  ModuleProperty,
  ModuleMethod,
  Class,
  Interface,
  Method,
  Constructor,
  Property,
  classDesignPatterns,
  EcmaScriptDriver,
};
