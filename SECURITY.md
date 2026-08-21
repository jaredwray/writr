# Security Policy

We take security seriously and work to keep this project up to date. If you discover a security vulnerability, please report it **privately** so we can investigate and ship a fix before the issue becomes public.

## Reporting a vulnerability

Please use one of the following private channels — **do not open a public issue, pull request, or discussion** for security concerns:

1. **Preferred:** open a private report via GitHub's [Privately reporting a security vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) flow on this repository's **Security** tab.
2. **Email:** send the details to me@jaredwray.com. If the issue is urgent, include `[SECURITY]` in the subject line and we will respond as soon as possible.

When reporting, please include as much of the following as you can:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a proof-of-concept.
- The affected version(s) and platform.
- Any suggested remediation, if you have one.

We will acknowledge receipt, work with you on a coordinated disclosure timeline, and credit you in the advisory once a fix is published unless you ask to remain anonymous.

## How this repository is secured

This repository follows the [defense-in-depth](https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md) hardening checklist; progress is tracked in [DEFENSE_IN_DEPTH.md](./DEFENSE_IN_DEPTH.md). Measures currently in place:

- All changes land through pull requests. Direct pushes to `main` are blocked; merging requires the `tests (22)`, `tests (24)`, `tests (26)`, and `zizmor` checks. Tags (releases) can only be created by repository admins.
- CI runs with a read-only default workflow token; Actions cannot create or approve PRs. Workflow runs from outside collaborators require owner approval. Only GitHub-owned, verified, and allowlisted third-party actions can run.
- Every action is pinned to a full commit SHA and workflows are security-linted with zizmor on every PR. Secret scanning with push protection is enabled.
- Dependencies install through pnpm with a 7-day cooldown on new versions, and lifecycle scripts are blocked by default. CI installs with a frozen lockfile. Socket reviews every dependency change; Aikido scans every build.
- npm releases are staged, never published directly: CI authenticates with **stage-only** OIDC trusted publishing (`npm stage publish` with provenance). Drydock reviews the staged artifact; a maintainer promotes with 2FA. The package requires 2FA and disallows tokens.
