# Publishing

## Repository

- Owner: `jordan-a-young` (verified personal GitHub account).
- Repository: `architecture-visualizer`.
- Visibility: public, for the requested open-source project.
- License: MIT.
- One monorepo containing two npm packages.
- Public repository: https://github.com/jordan-a-young/architecture-visualizer
- The initial implementation is proposed through a pull request. No npm packages have been published.

The repository belongs to the personal account `jordan-a-young`. Review and merge the initial implementation through its pull request. npm publication requires separate authorization.

## Package names (2026-09-20)

The chosen unscoped names are `archgraph-core` and `archgraph-react`. They require no npm organization scope. The demo is the private workspace package `archgraph-demo`.

The user approved using these names provisionally and changing them later if an npm collision is found. Availability of these exact names has not been verified or reserved. Recheck them before publication; the previous registry checks for different names do not establish availability of this pair.

## Before any release

1. Check npm availability of both unscoped package names. If renaming, update both package manifests, imports, README examples, tests, scripts and lockfile together.
2. Confirm the personal-account GitHub repository exists and the `repository`, `homepage` and `bugs` metadata in both package manifests points to it.
3. Run `pnpm check`, `pnpm format:check`, `pnpm test:browser`, and `pnpm test:consumer`.
4. Inspect both tarballs. They contain `dist`, README, LICENSE and package.json, and no demo, fixtures, credentials or node_modules.
5. Confirm package versions and license, npm authentication, package publishing rights and any required 2FA. This repository contains no automatic publishing workflow.
6. Publish core first, then React, from the corresponding package directories, only when explicitly authorized. `prepack` rebuilds the selected package; build core before packing React.

The root and demo packages are private. `pnpm pack` rewrites React's `workspace:^` core dependency to a normal semver dependency. Both packages have conditional `types`/`import` exports. React/React DOM/Three/R3F are peers; Drei is a normal externalized dependency. The distribution is ESM only. Styles are a separate export.

## Mirroring into a private registry

No registry URL or credentials are hard-coded. Prefer your registry's npm upstream proxy/mirroring mechanism so package names, versions and integrity hashes remain unchanged. For unscoped packages, configure the consuming project's default registry to your approved private registry/proxy if needed. This applies to all unscoped dependencies, so the proxy must also serve their upstream packages:

```ini
registry=https://your-approved-registry.example/npm/
```

If the private system requires manual upload, use the same tested tarballs and the registry's approved import procedure. Do not republish new bytes under an existing version. Credential configuration belongs outside this repository. Resolve all transitive dependencies through your work registry's approved process. No discovery/provider SDK is required by either package.
