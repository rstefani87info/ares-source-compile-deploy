import test from "node:test";
import assert from "node:assert/strict";

import {
  Application,
  BuildManager,
  Class,
  EcmaScriptDriver,
  Flow,
  ProgrammingApplication,
  Repository,
  Return,
  createSuite,
  programming,
} from "@ares/scd";
import { main } from "@ares/scd/cli.js";

test("scd root exports operational managers and programming model", () => {
  assert.equal(typeof Application, "function");
  assert.equal(typeof BuildManager, "function");
  assert.equal(typeof Repository, "function");
  assert.equal(typeof ProgrammingApplication, "function");
  assert.equal(typeof Flow, "function");
  assert.equal(typeof Class, "function");
  assert.equal(typeof programming.Type, "function");
});

test("createSuite wires application build/deploy managers", () => {
  const app = new Application("demo");
  const suite = createSuite(app);

  assert.equal(suite.application, app);
  assert.equal(typeof suite.build.build, "function");
  assert.equal(typeof suite.deploy.deploy, "function");
});

test("programming flow and ECMA class writer work", () => {
  const flow = new Flow().addStep("return", new Return("value"));
  assert.deepEqual(flow.steps, ["return"]);

  const source = EcmaScriptDriver.writeClass(new Class("Demo"));
  assert.match(source, /class Demo/);
});

test("cli help can be invoked programmatically", async () => {
  await assert.doesNotReject(() => main(["help"]));
});
