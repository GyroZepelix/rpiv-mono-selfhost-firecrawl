---
schema_version: 1
episode_id: "2026-11-22-1326-gamemaster-checkpoint-261122-1316-make-fork-installable-on-termux-android-direct"
timestamp: "2026-11-22T13:26:30+01:00"
summary: "rpiv-voice's decibri and sherpa-onnx-node moved to optionalDependencies so the fork's root npm install passes on Termux (android); verified by a spoofed-platform install, npm ci, tests, and a passing review, then archived as completed (uncommitted, phone check pending a push)."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261122-1316-make-fork-installable-on-termux-android"
current: "direct"
topics: ["rpiv-voice","termux-install"]
---

# Gamemaster checkpoint: 261122-1316-make-fork-installable-on-termux-android/direct

Date: 2026-11-22
Work item: 261122-1316-make-fork-installable-on-termux-android
Status: shipped
In one line: rpiv-voice's decibri and sherpa-onnx-node moved to optionalDependencies so the fork's root npm install passes on Termux (android); verified by a spoofed-platform install, npm ci, tests, and a passing review, then archived as completed (uncommitted, phone check pending a push).

## Goal

Make `pi install` / `pi update --extensions` of the fork succeed on Termux (Android, arm64) so rpiv-web-tools loads on the phone, without changing macOS behavior.

## How we approached it

The plan (quick-plan, low assurance) came from a phone-session handoff. Pi's root `npm install --omit=dev --legacy-peer-deps` installs every workspace's dependencies, and rpiv-voice's hard `decibri` dependency declares `os: [win32, darwin, linux]`, so npm aborted with `EBADPLATFORM` on `os: android`. Implement reproduced the failure in a fresh `/tmp` clone of `HEAD` using a node preload that spoofs `process.platform`/`process.arch`, moved `decibri` and `sherpa-onnx-node` into `optionalDependencies` (T01), regenerated the lockfile on Lunar, re-ran the spoofed install in a fresh clone of the changed tree (126 packages, decibri skipped), then ran `npm ci`, `npm test`, and `npm run check`. T02 added the keep-list bullet to the upstream-sync workflow page and a wiki log entry. One independent completion review passed. Gamemaster relayed terminal approval to archive now, with the phone check recorded as residual risk.

## Key decisions

- **Move both native modules, not only decibri** - chose both because the user's rule is that voice native modules may be absent; rejected decibri-only.
- **Commit the regenerated lockfile including pre-existing drift** - an unchanged `HEAD` clone produced the identical 240-line `dev`/`devOptional` drift (including removal of the nested astro typescript entry), so only the two `optional` flags and the rpiv-voice block are fix-specific.
- **Archive before the phone check** - the user chose option (a) over holding the item; R2 and acceptance criterion 4 are recorded as unverified residual risk, and a phone failure becomes a new item.
- **Not adopted** - removing rpiv-voice from workspaces, a phone-only `--force` install, and splitting rpiv-web-tools.

## What did not work

- **`npm install --os=android --cpu=arm64`** - did not reproduce the failure on npm 11.20.0 (decibri installed anyway), contradicting the handoff's verification step; the node preload spoof was used instead.
- **Plan step 2's `git diff --quiet -- package-lock.json`** - cannot pass before the change is committed; a `cmp` against the lock copied right before `npm ci` was used as the equivalent.

## Current state and where we left off

- Shipped/verified: item archived at `spec/archive/261122-1316-make-fork-installable-on-termux-android/` with status completed; changes in `packages/rpiv-voice/package.json`, `package-lock.json`, `wiki/workflows/upstream-sync.md`, `wiki/log.md` are unstaged and uncommitted.
- Pending: user-controlled commit and push to `main`, then `pi update --extensions` on the phone and a `web_search` availability check; Gamemaster's backlog selection for C1 (voice on Android) and C2 (spoofed-android install in the upstream-sync checklist).

## Source of truth

- `spec/archive/261122-1316-make-fork-installable-on-termux-android/plan.md`: requirements, decisions D1-D2, verification plan.
- `spec/archive/261122-1316-make-fork-installable-on-termux-android/verification.md`: commands, results, review verdict.
- `spec/archive/261122-1316-make-fork-installable-on-termux-android/outcome.md`: residual risk and backlog candidates.

## Verification

- Done: spoofed-android install fails before and passes after; `npm ci` keeps the lock byte-identical with both modules present; `npm test` 7137 passed; `npm run check` passed; `git diff --check` clean; completion review PASS with 0 retries; archive evidence proven.
- Not verified yet: real Termux install and web tools load on the phone.
- Remaining gate violations: none.

## Open questions, blockers, next safe action

- Open/blocked: phone check waits on the user's push; backlog selection for C1 and C2 waits on the user via Gamemaster.
- Next safe action: the user reviews and commits the four changed paths plus the archived item, pushes to `main`, and runs `pi update --extensions` on the phone.

## Dynamic knowledge trail

- wiki/observations.md: Observation (Termux install checks).
