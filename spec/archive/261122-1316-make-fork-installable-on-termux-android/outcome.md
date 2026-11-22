# Outcome: Make fork installable on Termux (Android)

Work item: `261122-1316-make-fork-installable-on-termux-android`
Disposition: completed
Date: 2026-11-22

## Delivered scope

- T01 (D1): `packages/rpiv-voice/package.json` moves `decibri` and `sherpa-onnx-node` from `dependencies` to `optionalDependencies`, with unchanged ranges. `@juicesharp/rpiv-config` stays in `dependencies`.
- T01 (D2): `package-lock.json` was regenerated with `npm install` on Lunar. Both lock entries carry `"optional": true`. The regenerated lock also includes the pre-existing `dev`/`devOptional` flag drift, which an unchanged `HEAD` produces too, and D2 accepts it.
- T02: `wiki/workflows/upstream-sync.md` lists the optional voice native modules as a fork customization to preserve, with the revert condition. An entry was added to `wiki/log.md`.

## Deviations from plan

- In Verification step 2, `git diff --quiet -- package-lock.json` compares against `HEAD`, so it cannot pass before a commit. An equivalent check was used: `cmp` against the lock copied right before `npm ci`.

## Verification summary

See `verification.md`.
- Spoofed android/arm64 `--omit=dev` install: `EBADPLATFORM` (decibri) before the fix, success with 126 packages after it.
- Lunar `npm ci`: the lock is unchanged, and both modules are installed.
- `npm test`: 7137 tests passed. `npm run check`: passed.
- `git diff --check`: clean.
- Completion review: PASS, 0 retries.

## Retained, reverted, or transferred work

- All changes are retained in the working tree, unstaged and uncommitted, pending a user-controlled commit and push.

## Residual risks

- R2 and acceptance criterion 4 are unverified: the phone's `pi update --extensions` run and the `web_search` load on real Termux. Both wait on the user's push to `main` and a check on the phone. The spoof covers npm's platform check only. If the phone check fails, that becomes a new item.

## Follow-up work items

Backlog candidates (not added):

- C1: Make voice work on Android. rpiv-voice cannot capture audio or run speech-to-text on Termux, because decibri does not support `android` and sherpa-onnx-node ships no Android binaries. Origin: deferred by you in planning.
  - Decision: dropped by user
- C2: Add a spoofed-android install check to upstream sync. Add the spoofed-android `--omit=dev` install to the verification checklist in `wiki/workflows/upstream-sync.md`, so that an upstream change that adds a platform-restricted hard dependency is caught before a push. Origin: found by the agent.
  - Decision: dropped by user

## Source references

- `spec/archive/261122-1316-make-fork-installable-on-termux-android/plan.md`
- `spec/archive/261122-1316-make-fork-installable-on-termux-android/verification.md`
- `packages/rpiv-voice/package.json`, `package-lock.json`

## Wiki updates

- `wiki/workflows/upstream-sync.md`: new bullet "Optional voice native modules" under "Fork customizations to preserve".
- `wiki/log.md`: entry dated 2026-11-22.
- Stale-status sweep: 0 hits, so no fixes were needed.
