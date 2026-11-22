# Verification: Make fork installable on Termux (Android)

Work item: `261122-1316-make-fork-installable-on-termux-android`
Date: 2026-11-22

## Environment

- Lunar (macOS arm64), Node v26.13.0, npm 11.20.0.
- Mode: direct. Assurance: low (inherited from `plan.md`).
- Starting `HEAD`: `05228c1b1f68c2244dacab0f99733a1418a2b183`. All work is unstaged and uncommitted.
- Changed paths: `packages/rpiv-voice/package.json`, `package-lock.json`, `wiki/workflows/upstream-sync.md`, `wiki/log.md`. The workflow-owned `spec/index.md` row and this item directory are planning artifacts.
- Android spoof: `/tmp/fake-android.cjs` sets `process.platform` to `android` and `process.arch` to `arm64`. It is loaded with `node -r` in front of `/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js`. Temp clones under `/tmp` were removed after use.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Step 1 before: fresh clone of `HEAD`, spoofed `install --omit=dev --legacy-peer-deps --no-audit --no-fund` | Fails as expected | `EBADPLATFORM ... decibri@3.4.2 ... current: {"os":"android","cpu":"arm64"}`, exit 1 |
| T01: `npm install --legacy-peer-deps --no-audit --no-fund` on Lunar after the manifest edit | Pass | Lock entries `node_modules/decibri` and `node_modules/sherpa-onnx-node` carry `"optional": true`. The `packages/rpiv-voice` block lists both under `optionalDependencies`. Both modules exist in `node_modules`. |
| Lock drift attribution: `npm install --package-lock-only --legacy-peer-deps` on an unchanged `HEAD` clone | Pre-existing drift confirmed | The unchanged tree also produces 240 lines (205 `+"dev": true`, 20 `-"devOptional": true`, removal of `node_modules/astro/node_modules/typescript`). The only fix-specific lock changes are the two `optional` flags and the rpiv-voice block. D2 accepts the drift. |
| Step 1 after: fresh clone plus both changed files, same spoofed install | Pass | exit 0, `added 126 packages`, `decibri` skipped, `sherpa-onnx-node` and `@juicesharp/rpiv-web-tools` present, lock byte-identical after the install |
| Step 2: `npm ci` on Lunar, then `cmp` of the lock against its pre-`ci` copy, then `ls -d node_modules/decibri node_modules/sherpa-onnx-node` | Pass | exit 0, 596 packages, lock unchanged, both directories present |
| Step 3: `npm test` | Pass | 312 files and 7137 tests passed |
| Step 3: `npm run check` | Pass | exit 0, `No fixes applied`, no new working-tree changes |
| T02: `git diff --check -- wiki`, plus the same check on the source paths | Pass | clean |
| Wiki stale-status sweep (`measure-wiki-quality.py --stale-status`) | Pass | 0 hits |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1: root `--omit=dev` install succeeds on android/arm64 | Step 1 before/after | Met (spoofed platform) |
| R2: phone `pi update --extensions` installs and rpiv-web-tools loads | Needs a push to `main`, which is not authorized in this run | Pending user push (Verification step 4) |
| R3: `npm test` and `npm run check` pass on Lunar, and macOS still installs both modules | Steps 2-3 | Met |
| R4: wiki keep-list entry | `wiki/workflows/upstream-sync.md` "Optional voice native modules" bullet with the revert condition. Entry added to `wiki/log.md`. | Met |

## Review findings

- Completion review (low assurance, one gate): PASS. 0 blockers, 0 retries.
- Non-blocking: the `wiki/log.md` entry cited `verification.md` before it existed. This file now exists, so the note is resolved.

## Failures and skipped checks

- The plan's step 2 command, `git diff --quiet -- package-lock.json`, compares against `HEAD`, so it cannot pass before the change is committed. An equivalent check was used instead: `cmp` against the lock copied right before `npm ci`.
- Step 4 (phone check) was not run. It needs the user to approve and push to `main`.

## Unverified areas

- Real Termux behavior. The spoof covers npm's platform check only. It does not cover other Termux-specific install differences, which only the phone check (step 4) can confirm.
