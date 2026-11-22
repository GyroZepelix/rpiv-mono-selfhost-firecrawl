# Plan: Make fork installable on Termux (Android)

Work item: `261122-1316-make-fork-installable-on-termux-android`
Status: Planned
Created: 2026-11-22
Updated: 2026-11-22

Assurance: low - one manifest field change plus the regenerated lockfile, easy to revert. A local reproduction already proves the fix. Supported desktop platforms keep installing both packages, so runtime behavior there is unchanged.

## Goal

Make `pi install` / `pi update --extensions` of `git:git@github.com:GyroZepelix/rpiv-mono-selfhost-firecrawl@main` succeed on Termux (Android, arm64), so that rpiv-web-tools loads on the phone. Lunar (macOS) must stay green.

## Context

- Pi runs `npm install --omit=dev --legacy-peer-deps --no-audit --no-fund` at the repo root. Root `workspaces: ["packages/*"]` pulls in every workspace's dependencies. `packages/rpiv-voice/package.json` hard-depends on `decibri`, which declares `os: [win32, darwin, linux]`. npm reports Termux as `os: android` and aborts with `EBADPLATFORM` (Fact, reproduced at `05228c1b`).
- Both native modules are already lazy-loaded: `packages/rpiv-voice/audio/mic-source.ts:84` (`await import("decibri")`) and `audio/stt-engine.ts:117` (`await import("sherpa-onnx-node")`). `stt-engine.ts` also has a type-only import, and the package ships `audio/sherpa-onnx-node.d.ts`.
- rpiv-voice is not in the root `pi.extensions`, so the phone never loads it.
- `scripts/check-host-provided-deps.mjs` restricts only Pi host packages in `optionalDependencies`, so neither module is affected.
- A plain `npm install` on an unchanged clone already rewrites about 240 lines of `package-lock.json`, mostly `dev`/`devOptional` flags. That drift is pre-existing and unrelated to this fix.
- Local reproduction: `npm install ... --os=android --cpu=arm64` does not reproduce the failure on npm 11.20.0, because it installs decibri anyway. Spoof the platform with a node preload instead (see Verification plan).
- Spike in a throwaway clone: with `decibri` and `sherpa-onnx-node` moved to `optionalDependencies`, the spoofed-android `--omit=dev` install succeeds (126 packages). This also shows that no transitive dependency blocks the install.

Handoff intake: the table below. `handoff.md` is unverified source material and does not override this plan.

| Line | Kind | Check | User verdict |
| --- | --- | --- | --- |
| C7 | Claim (`--os=android --cpu=arm64` reproduces) | contradicted: npm 11.20.0 install succeeds with those flags | - |
| S1 | Suggestion (optionalDependencies) | - | adopted as D1, changed to include `sherpa-onnx-node` |
| S2 | Suggestion (drop rpiv-voice workspace) | - | not adopted |
| S3 | Suggestion (phone-only `--force` install) | - | not adopted |
| S4 | Suggestion (split rpiv-web-tools) | - | not adopted |

## Requirements

- R1: The root `npm install --omit=dev --legacy-peer-deps --no-audit --no-fund` succeeds on android/arm64.
- R2: After the user pushes to `main`, `pi update --extensions` on the phone installs the package and rpiv-web-tools loads.
- R3: `npm test` and `npm run check` still pass on Lunar (macOS), and macOS still installs `decibri` and `sherpa-onnx-node`.
- R4: `wiki/workflows/upstream-sync.md` lists this change as a fork customization to preserve.

## Out of scope

- Any rpiv-voice runtime change, including a friendlier error when decibri is missing (user chose to leave it as is).
- Removing rpiv-voice from `workspaces`, the phone-only `--force` workaround, and splitting rpiv-web-tools (S2-S4).
- Making voice work on Android.
- Cleaning up the pre-existing lockfile drift beyond what the regenerated install produces.
- Changes in `~/.dotfiles` or on the phone.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D1 | `packages/rpiv-voice/package.json` | Move `decibri` and `sherpa-onnx-node` from `dependencies` to `optionalDependencies` with unchanged ranges. | This is the smallest fix: npm skips platform-mismatched optional packages instead of failing. Moving sherpa as well matches "voice native modules may be absent" (user choice). | Spike: the spoofed-android install passes. Both imports are already lazy. | Upstream changes rpiv-voice dependencies, or the phone later needs voice. |
| D2 | `package-lock.json` | Regenerate with a normal `npm install` on Lunar and commit the result, including the pre-existing flag drift. | The lockfile must mark both packages `optional: true`, or npm will still apply the platform check from the lock. A hand-edited lock is more fragile. | The spike's lock diff adds `optional` to both entries. | `npm ci` on a fresh clone changes the lock again. |

## Work breakdown

- [x] T01: Make the native voice modules optional.
  - Depends on: none
  - Scope: in `packages/rpiv-voice/package.json`, add an `optionalDependencies` block holding `decibri` and `sherpa-onnx-node` with their current ranges, and remove both from `dependencies`. Keep `@juicesharp/rpiv-config` in `dependencies`. Run `npm install --legacy-peer-deps --no-audit --no-fund` on Lunar to regenerate `package-lock.json`.
  - Expected areas: `packages/rpiv-voice/package.json`, `package-lock.json`
  - Acceptance: the lock entries `node_modules/decibri` and `node_modules/sherpa-onnx-node` carry `"optional": true`, and both modules still exist in `node_modules` on Lunar.
  - Verification: Verification plan steps 1-3.
- [x] T02: Record the fork customization.
  - Depends on: T01
  - Scope: add one bullet under "Fork customizations to preserve" in `wiki/workflows/upstream-sync.md`. It says that rpiv-voice keeps `decibri` and `sherpa-onnx-node` in `optionalDependencies` so that the fork installs on Termux (npm `os: android`), and that the lockfile must keep them `optional`. Append the `wiki/log.md` entry required by `wiki/AGENTS.md`.
  - Expected areas: `wiki/workflows/upstream-sync.md`, `wiki/log.md`
  - Acceptance: the bullet exists and names the revert condition (upstream makes them optional or drops them).
  - Verification: `git diff --check -- wiki`

## Acceptance criteria

- The spoofed-android `--omit=dev` install succeeds in a fresh clone of the changed tree.
- On Lunar, `npm ci` succeeds and leaves `package-lock.json` unchanged. `node_modules/decibri` and `node_modules/sherpa-onnx-node` exist.
- `npm test` and `npm run check` pass.
- After the user pushes, `pi update --extensions` on the phone succeeds and the web tools load.

## Verification plan

1. Before/after reproduction in a fresh clone of the working tree (for example, commit to a scratch branch or copy the two changed files into `git clone -q . /tmp/rpiv-android-repro`):
   ```sh
   echo "Object.defineProperty(process,'platform',{value:'android'});Object.defineProperty(process,'arch',{value:'arm64'});" > /tmp/fake-android.cjs
   NPMCLI="$(dirname "$(readlink -f "$(which npm)")")/npm-cli.js"
   node -r /tmp/fake-android.cjs "$NPMCLI" install --omit=dev --legacy-peer-deps --no-audit --no-fund
   ```
   Before the fix it reports `EBADPLATFORM ... decibri@3.4.2`. After the fix it succeeds.
2. On Lunar: `npm ci && git diff --quiet -- package-lock.json && ls -d node_modules/decibri node_modules/sherpa-onnx-node`
3. `npm test` and `npm run check`
4. Manual, after the user approves and pushes to `main`: on the phone run `pi update --extensions`, then confirm that `web_search` is available in a Pi session.

## Risks and blockers

- Pushing to `main` is an external write and needs explicit user approval. R2 cannot be verified until then.
- If the phone install fails on a different native module after this fix, stop and report it. Do not widen scope without approval.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01, T02). See `verification.md`.
- [x] Verification steps 1-3 passed and the completion review passed. Step 4 (phone check, R2) is pending the user's push to `main`.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/261122-1316-make-fork-installable-on-termux-android/plan.md and item.yaml completely, plus wiki/AGENTS.md.
Assurance is low: implement only T01 and T02, preserving Requirements, Out of scope, and the Decision Log.
Run Verification plan steps 1-3 and record only verified results, failures, and skipped checks in Progress.
Stop and ask before any commit, push, new dependency, or scope expansion. Step 4 needs the user's push first.
```
