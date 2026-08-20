---
'better-wiki': patch
---

Fix the published ESM in `dist/` being unimportable on plain Node (`ERR_MODULE_NOT_FOUND`). Relative import/export specifiers were emitted extensionless (e.g. `from './better-wiki'`), which Node's ESM resolver rejects — the package worked under Bun (which tolerates extensionless specifiers) but crashed on first `import` under Node, including on serverless platforms. `tsconfig.json` now uses `"module": "NodeNext"` / `"moduleResolution": "NodeNext"`, all relative specifiers in `src/` carry explicit `.js` extensions, and a `check:esm` script runs in CI after the build step to catch any regression of this class on plain Node.
