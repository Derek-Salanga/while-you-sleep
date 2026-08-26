---
name: commit-push-pr
description: Stage the current changes, write a Conventional Commits message, push to a feature branch, and open a PR with gh pr create. Use when the user asks to commit and push work, or open a PR, for this repo. Never merges the PR — that stays the user's call.
---

# commit-push-pr

Automates this repo's Git workflow (see "Git workflow" in `CLAUDE.md`):
feature branch -> conventional commit -> push -> PR. Never commits
directly to `main`, and never merges the PR it opens.

## Steps

1. **Check branch.** Run `git status`. If the current branch is `main`,
   create a new branch before doing anything else — never commit to
   `main` directly.

2. **Name the branch.** Use `type/short-description`, where `type`
   matches the commit type in step 4 (e.g. `fix/upload-clock-skew`,
   `docs/git-workflow`). Base it on `main`:
   ```bash
   git checkout main && git pull
   git checkout -b <type>/<short-description>
   ```
   Skip the checkout/pull if already on a suitable non-`main` feature
   branch with the intended changes.

3. **Review and stage.** Run `git status` and `git diff` to see what
   changed. Stage specific files by name (`git add <path> ...`) — never
   `git add -A` or `git add .`, to avoid sweeping in unrelated or
   sensitive files (`.env`, credentials, stray build output).

4. **Write a Conventional Commit message.** Format:
   `type(optional scope): summary`, where `type` is one of `feat`,
   `fix`, `docs`, `refactor`, `chore`, `test`, `ci`. Summary is
   imperative mood, no trailing period. Focus the body (if needed) on
   *why*, not a restatement of the diff. Pass the message via a HEREDOC
   so multi-line bodies format correctly:
   ```bash
   git commit -m "$(cat <<'EOF'
   fix: retry profile upsert on transient clock-skew error

   PostgREST briefly rejects a valid JWT on Supabase cold-start; retry
   instead of failing silently.
   EOF
   )"
   ```

5. **Push the branch.**
   ```bash
   git push -u origin <branch-name>
   ```

6. **Open the PR.** Use `gh pr create` with a HEREDOC body (title under
   70 chars, body has a Summary and, where relevant, a Test plan):
   ```bash
   gh pr create --title "fix: retry profile upsert on clock-skew error" --body "$(cat <<'EOF'
   ## Summary
   - Retry the profiles upsert / pair lookup on transient PostgREST
     "JWT issued at future" errors instead of failing silently.

   ## Test plan
   - [ ] Confirm profile row is created after a cold Supabase start
   EOF
   )"
   ```
   Do **not** pass `--merge` or otherwise merge the PR. Report the PR
   URL back to the user and stop — merging is their decision.

## Guardrails

- Never force-push, never skip hooks (`--no-verify`), never amend an
  existing commit unless the user explicitly asks.
- If `gh` isn't installed or isn't authenticated, say so and stop
  rather than working around it (e.g. don't fall back to manually
  hitting the GitHub API).
- If there's nothing staged to commit, say so instead of creating an
  empty commit.
