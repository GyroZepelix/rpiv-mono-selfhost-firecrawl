# Handoff: rpiv-mono-selfhost-firecrawl fails to install on Termux (Android)

Created 2026-11-22 from a Pi session on the phone (Termux, Android, arm64).

## Goal

Make `pi update --extensions` (or `pi install`) succeed on Termux for package
`git:git@github.com:GyroZepelix/rpiv-mono-selfhost-firecrawl@main`, so the phone can load
`packages/rpiv-web-tools/index.ts`. The twin, researcher, worker and twin-powered-up agents in
`~/.dotfiles` (commit `7a75bfa`) now depend on rpiv-web-tools and have pi-codex-search commented out,
so on the phone they currently have no web search.

## Failure (verified)

Pi clones the repo into `~/.pi/agent/git/github.com/GyroZepelix/rpiv-mono-selfhost-firecrawl`
and runs `npm install --omit=dev --legacy-peer-deps --no-audit --no-fund` at the repo root. It fails:

```
npm error code EBADPLATFORM
npm error notsup Unsupported platform for decibri@3.4.2: wanted {"os":"win32,darwin,linux","cpu":"x64,arm64"} (current: {"os":"android","cpu":"arm64"})
Error: npm install --omit=dev --legacy-peer-deps --no-audit --no-fund failed with code 1
```

Pi then removes the clone, so nothing is installed.

## Cause (verified against this repo at 05228c1b)

- Root `package.json` has `"workspaces": ["packages/*"]`, so a root install installs the
  dependencies of every workspace, including ones Pi never loads (`pi.extensions` only lists
  `rpiv-web-tools` and `rpiv-ask-user-question`).
- `packages/rpiv-voice/package.json` has a hard dependency `"decibri": "^3.4.0"`. decibri declares
  `os: [win32, darwin, linux]`, and npm reports Node on Termux as `os: android`, so npm aborts.
- Likely next blocker in the same workspace: `sherpa-onnx-node` (also an rpiv-voice dependency)
  only ships prebuilt optional binaries for darwin, linux and win. It has no `os` field, so it
  probably installs, but it would not load on Android. It only matters if rpiv-voice is ever
  loaded on the phone.
- No other workspace's direct dependency declares `os` or `cpu` restrictions (checked
  in Lunar's node_modules). Transitive dependencies were not checked.

## Options (not decided)

- O1: Move `decibri` (and possibly `sherpa-onnx-node`) in rpiv-voice to `optionalDependencies`.
  npm skips optional packages on unsupported platforms instead of failing. rpiv-voice must then
  handle a missing module at runtime (lazy `import()` with a clear error). Smallest change, but it
  edits an upstream package, so it adds an upstream-sync conflict point
  (see `wiki/workflows/upstream-sync.md`).
- O2: Exclude rpiv-voice from the fork's root `workspaces` (for example list workspaces
  explicitly). Removes voice from the fork's install entirely. Check what else depends on
  rpiv-voice (rpiv-pi siblings, tests, `scripts/check-host-provided-deps.mjs`).
- O3: Phone-only workaround with no repo change: install manually on Termux with
  `npm install --omit=dev --legacy-peer-deps --force` (or `--os=linux`). Fragile, since
  `pi update` reruns the normal install and fails again.
- O4: Split rpiv-web-tools into a standalone package or branch for the phone. Largest change.

## How to verify

1. Reproduce locally without a phone: `npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --os=android --cpu=arm64`
   in a fresh clone (npm 10 supports `--os`/`--cpu` overrides). It should hit the same EBADPLATFORM.
2. After the fix, the same command succeeds, and `npm test` plus `npm run check` still pass on Lunar.
3. Push to `main`, then on the phone run `pi update --extensions` and confirm the web tools load
   (config is already in place at `~/.config/rpiv-web-tools/config.json`, copied from Lunar).

## Phone state at handoff

- `~/.dotfiles` is on `origin/master` (`c1390df`). The local `settings.json` lists the rpiv package
  again (uncommitted, along with other local Termux-only edits).
- `~/.config/rpiv-web-tools/config.json` matches Lunar's byte for byte. SearXNG and Firecrawl endpoints are reachable from the phone.
