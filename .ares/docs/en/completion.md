# Completion Plan @ares/scd
> Updated: 2026-05-15

## Current Status

- package.json: ESM package with root and subpath `exports`
- CLI: available as `ares-scd`
- test script: real Node smoke test
- test files: present in `test/smoke.test.js`
- docs: main EN/IT docs updated
- scope: source/build/deploy/Git plus merged programming metamodel

## Completed In This Pass

- Merged the useful `@ares/programming` metamodel into `@ares/scd/programming.js`.
- Consolidated Git and GitFlow into the `@ares/scd` implementation.
- Replaced the CLI with a dependency-free native CLI.
- Added build/deploy/application APIs with stable root exports.
- Added compatibility exports consumed by `@ares/programming`.
- Added smoke tests for root exports, suite creation, code generation, and CLI help.

## Remaining Work

### High Priority

- Add integration tests for real build and deploy configurations.
- Decide whether to publish TypeScript declarations or JSDoc-generated types.
- Stabilize the public names that should remain semver-protected.

### Medium Priority

- Add lint/format checks once workspace tooling is available.
- Expand Git/GitFlow tests with mocked command execution.
- Add examples for build/deploy config files.

### Low Priority

- Decide formal deprecation language for direct `@ares/programming` usage.
- Add more code-generation examples for the programming metamodel.

## References

- Main doc EN: ./scd.md
- Main doc IT: ../it/scd.md
- Ticket: ../../tickets/20260506-1052.md
