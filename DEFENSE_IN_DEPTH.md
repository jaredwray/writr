# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: npm library · public

## 1. Security docs

- [x] `SECURITY.md` present — contact info + "How this repository is secured" summary — PR #506
- [x] `DEFENSE_IN_DEPTH.md` present (this file) — PR #506

## 2. Repository lockdown

- [x] Lockdown script run; `lockdown-repo.sh --check` passes clean — verified 2026-08-15 (maintainer `--check`)
- [x] Pull requests required on the default branch; force pushes and deletion blocked — verified 2026-08-15 (ruleset "Pull requests required")
- [x] Merges blocked unless required status checks pass (`--required-checks "<repo's CI jobs>"`) — verified 2026-08-15 (`tests (22)`, `tests (24)`, `tests (26)`, `zizmor`)
- [x] Tag ruleset "Tags only by admins" active — verified 2026-08-15
- [x] Workflow runs from all outside collaborators require approval — verified 2026-08-15 (maintainer `--check`)
- [x] Default workflow token read-only; Actions cannot create or approve PRs — verified 2026-08-15 (maintainer `--check`)
- [x] Actions allowlist: GitHub-owned + verified + explicit patterns only (`--allowed-actions`) — verified 2026-08-15 (`zizmorcore/* pnpm/* codecov/* cloudflare/* dtolnay/* Swatinem/* taiki-e/*`)
- [x] Secret scanning + push protection enabled *(plan-gated on private repos)* — verified 2026-08-15 (maintainer `--check`)
- [x] Private vulnerability reporting enabled *(public repos only)* — verified 2026-08-15
- [x] Dependabot alerts enabled — verified 2026-08-15 (maintainer `--check`)
- [ ] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts (manual)
- [ ] Recovery codes stored offline in a password manager (manual)

## 3. Dependencies (pnpm)

- [x] `packageManager: pnpm@11.x` pinned in `package.json` — verified 2026-08-15 (`pnpm@11.21.0`)
- [x] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false` — PR #506
- [x] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline — PR #506 (default-deny; reviewed exceptions for `esbuild` and `unrs-resolver`)
- [x] `blockExoticSubdeps: true` — PR #506
- [x] Lockfile committed; CI installs with `pnpm install --frozen-lockfile` — PR #506
- [x] Dependency-update tooling opens PRs only — never auto-merge — verified 2026-08-15 (Dependabot Updates active; no auto-merge config in-repo)
- [x] New direct dependencies get human review; prefer `~` ranges over `^` — PR #506

## 4. GitHub Actions

- [x] `permissions: contents: read` (or `{}` + per-job grants) on every workflow — PR #506
- [x] Every action pinned to a full commit SHA (`npx actions-up`) — verified 2026-08-15
- [x] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR — PR #506
- [x] `persist-credentials: false` on checkouts that don't push — PR #506
- [x] No `pull_request_target` on workflows that run untrusted PR code — verified 2026-08-15
- [x] No npm tokens (or other registry credentials) in Actions secrets — verified 2026-08-15 (no workflow references `NPM_TOKEN` / `NODE_AUTH_TOKEN`; publish uses OIDC provenance)

## 5. npm publishing — npm libraries only

- [x] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live — verified 2026-08-15 (maintainer)
- [x] Staged publishing: CI runs `npm stage publish`; a maintainer promotes with 2FA — PR #507
- [x] Drydock connected — staged releases reviewed before promotion — verified 2026-08-15 (maintainer)
- [x] No direct publish rights: package requires 2FA and disallows tokens — verified 2026-08-15 (maintainer)
- [x] `package.json` `repository.url` accurate so provenance maps to this repo — verified 2026-08-15

## 6. Security tooling

- [x] Aikido runs on every build — verified 2026-08-15 (GitHub check "Aikido Security: check code" passed on PR #506)
- [x] Aikido release gate: the release workflow's stage-publish job `needs:` a passing `scan-release` — PR #506
- [x] Socket reviews every PR that changes dependencies — verified 2026-08-15 (GitHub checks "Socket Security: Pull Request Alerts" and "Project Report" on PR #506)
