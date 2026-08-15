# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: npm library · public

## 1. Security docs

- [ ] `SECURITY.md` present — contact info + "How this repository is secured" summary (PR #506 pending)
- [ ] `DEFENSE_IN_DEPTH.md` present (this file) (PR #506 pending)

## 2. Repository lockdown

- [ ] Lockdown script run; `lockdown-repo.sh --check` passes clean
- [ ] Pull requests required on the default branch; force pushes and deletion blocked
- [ ] Merges blocked unless required status checks pass (`--required-checks "<repo's CI jobs>"`)
- [ ] Tag ruleset "Tags only by admins" active
- [ ] Workflow runs from all outside collaborators require approval
- [ ] Default workflow token read-only; Actions cannot create or approve PRs
- [ ] Actions allowlist: GitHub-owned + verified + explicit patterns only (`--allowed-actions`)
- [ ] Secret scanning + push protection enabled *(plan-gated on private repos)*
- [x] Private vulnerability reporting enabled *(public repos only)* — verified 2026-08-15
- [ ] Dependabot alerts enabled
- [ ] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts (manual)
- [ ] Recovery codes stored offline in a password manager (manual)
- [ ] Dev/release VM network egress filtered by a firewall (e.g. PMG) (manual)

## 3. Dependencies (pnpm)

- [x] `packageManager: pnpm@11.x` pinned in `package.json` — verified 2026-08-15 (`pnpm@11.21.0`)
- [ ] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false` (PR #506 pending)
- [ ] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline (PR #506 pending)
- [ ] `blockExoticSubdeps: true` (PR #506 pending)
- [ ] Lockfile committed; CI installs with `pnpm install --frozen-lockfile` (PR #506 pending)
- [x] Dependency-update tooling opens PRs only — never auto-merge — verified 2026-08-15 (Dependabot Updates active; no auto-merge config in-repo)
- [ ] New direct dependencies get human review; prefer `~` ranges over `^` (PR #506 pending)

## 4. GitHub Actions

- [ ] `permissions: contents: read` (or `{}` + per-job grants) on every workflow (PR #506 pending)
- [x] Every action pinned to a full commit SHA (`npx actions-up`) — verified 2026-08-15
- [ ] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR (PR #506 pending)
- [ ] `persist-credentials: false` on checkouts that don't push (PR #506 pending)
- [x] No `pull_request_target` on workflows that run untrusted PR code — verified 2026-08-15
- [x] No npm tokens (or other registry credentials) in Actions secrets — verified 2026-08-15 (no workflow references `NPM_TOKEN` / `NODE_AUTH_TOKEN`; publish uses OIDC provenance)

## 5. npm publishing — npm libraries only

- [ ] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live (manual)
- [ ] Staged publishing: CI runs `npm stage publish`; a maintainer promotes with 2FA (manual)
- [ ] Drydock connected — staged releases reviewed before promotion (manual)
- [ ] No direct publish rights: package requires 2FA and disallows tokens (manual)
- [x] `package.json` `repository.url` accurate so provenance maps to this repo — verified 2026-08-15

## 6. Security tooling

- [ ] Aikido runs on every build
- [ ] Aikido release gate: the release workflow's stage-publish job `needs:` a passing `scan-release` (PR #506 pending)
- [ ] Socket reviews every PR that changes dependencies
