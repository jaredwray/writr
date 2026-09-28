#!/bin/bash
# SessionStart hook for Claude Code on the web: bootstrap Aikido Safe Chain and
# install dependencies through its shims, as .devcontainer and .cursor do.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
	exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Hook stdout becomes session context; keep the install log on stderr.
bash ./scripts/setup-cloud-environment.sh >&2

# Bash tool shells do not re-read ~/.bashrc, so persist the shims for them.
if [ -n "${CLAUDE_ENV_FILE:-}" ] && ! grep -qsF ".safe-chain/shims" "$CLAUDE_ENV_FILE"; then
	echo 'export PATH="$HOME/.safe-chain/shims:$HOME/.safe-chain/bin:$PATH"' >>"$CLAUDE_ENV_FILE"
fi
