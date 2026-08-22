# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: npm library · public

## 1. Security docs
- [x] `SECURITY.md` present — contact info + "How this repository is secured" summary — PR #506
- [x] `DEFENSE_IN_DEPTH.md` present (this file) — PR #506

## 2. CODEOWNERS and cloud bootstrap
- [x] `.github/CODEOWNERS` covers `/.github/`, `/.cursor/`, `/.devcontainer/`, `/scripts/` with owners the maintainer names — PR #517
- [x] Codespaces and Cursor Cloud Agents bootstrap Aikido Safe Chain via scripts/setup-cloud-environment.sh (--ci shims, frozen lockfile) — PR #518

## 3. Dependencies (pnpm)
- [x] `packageManager: pnpm@11.3+` pinned in `package.json` — verified 2026-08-21 (`pnpm@11.21.0`)
- [x] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false`; no first-party `minimumReleaseAgeExclude` — PR #506
- [x] `trustPolicy: no-downgrade`; no first-party `trustPolicyExclude` — PR #519
- [x] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline — PR #506 (reviewed exceptions for `esbuild` and `unrs-resolver`)
- [x] `blockExoticSubdeps: true` — PR #506
- [x] Lockfile committed; CI installs with `pnpm install --frozen-lockfile` — PR #506
- [x] No `.github/dependabot.yml`; other dependency-update tools (if any) open PRs only — never auto-merge — verified 2026-08-21

## 4. GitHub Actions
- [x] `permissions: contents: read` (or `{}` + per-job grants) on every workflow — PR #506
- [x] No `contents: write` except jobs whose purpose is mutating the repo (GitHub Release, Changesets version PR); generated output is a workflow artifact, never committed back from CI — verified 2026-08-21
- [x] Every action pinned to a full commit SHA (`npx actions-up`) — verified 2026-08-21
- [x] Every job installs Socket Firewall (`SocketDev/action` SHA-pinned, `firewall-version` pinned); `pnpm install` / `npm install` run as `sfw pnpm install` / `sfw npm install` — PR #520
- [x] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR — PR #506
- [x] `persist-credentials: false` on checkouts that don't push — PR #506
- [x] No `pull_request_target` on workflows that run untrusted PR code — verified 2026-08-21
- [x] Artifact-publishing workflows disable `actions/setup-node` default caching (`package-manager-cache: false`) to prevent cache poisoning — verified 2026-08-21 (`release.yml`)
- [x] No npm tokens (or other registry credentials) in Actions secrets — verified 2026-08-15 (no workflow references `NPM_TOKEN` / `NODE_AUTH_TOKEN`; publish uses OIDC provenance)

## 5. npm publishing — npm libraries only
- [x] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live (manual) — verified 2026-08-15 (maintainer)
- [x] `.github/workflows/release.yaml` packs then stages with `pnpm stage publish ./packed/*.tgz --no-git-checks` — PR #521
- [x] Maintainer promotes staged versions with 2FA (manual) — verified 2026-08-15 (maintainer)
- [x] Drydock connected — staged releases reviewed before promotion (manual) — verified 2026-08-15 (maintainer)
- [x] No direct publish rights: package requires 2FA and disallows tokens (manual) — verified 2026-08-15 (maintainer)
- [x] `package.json` `repository.url` accurate so provenance maps to this repo — verified 2026-08-21

## 6. Security tooling
- [x] Aikido runs on every build — verified 2026-08-21 (GitHub check "Aikido Security: check code" passed on PR #516)
- [x] Aikido release gate: the release workflow's stage-publish job `needs:` a passing `scan-release` — PR #506
- [x] Socket reviews every PR that changes dependencies — verified 2026-08-21 (GitHub checks "Socket Security: Pull Request Alerts" and "Project Report" on PR #516)

## 7. Repository lockdown
- [ ] `lockdown-repo.sh` applied; `--check` with `--required-checks` and `--allowed-actions` passes (PRs required on the default branch, merges blocked unless required status checks pass, tag ruleset, immutable releases, fork-PR approval, read-only workflow tokens, Actions allowlist, secret scanning, Dependabot disabled, private vulnerability reporting as applicable) (PR #522 pending)
- [x] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts (manual) — verified 2026-08-15 (maintainer)
- [x] Recovery codes stored offline in a password manager (manual) — verified 2026-08-15 (maintainer)
