# Dream learnings: 261122-1316-make-fork-installable-on-termux-android

Work item: `261122-1316-make-fork-installable-on-termux-android`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261122-1316-make-fork-installable-on-termux-android/direct

Date: 2026-11-22
Dream log: [2026-11-22-1326-gamemaster-checkpoint-261122-1316-make-fork-installable-on-termux-android-direct.md](../2026-11-22-1326-gamemaster-checkpoint-261122-1316-make-fork-installable-on-termux-android-direct.md)
Outcome: retained learning

### Observation: spoof process.platform to reproduce Termux EBADPLATFORM

- **Exact written text:**

```markdown
- **Reproduce Termux's npm `EBADPLATFORM` locally with a `process.platform` preload, not with `npm --os=android`** - May matter when checking whether a dependency change breaks the fork's root `--omit=dev` install on Termux. With the `--os=android --cpu=arm64` flags, npm still installed `decibri` and missed the failure. Running npm's `npm-cli.js` under `node -r <preload>`, where the preload redefines `process.platform` as `android` and `process.arch` as `arm64`, reproduced `EBADPLATFORM` before the fix and passed after it. Whether this spoof matches a real Termux install stays unproven until a check on the phone. Provenance: [Termux install plan](../spec/archive/261122-1316-make-fork-installable-on-termux-android/plan.md), [verification](../spec/archive/261122-1316-make-fork-installable-on-termux-android/verification.md).
```

- **Destination and classification:** `wiki/observations.md` - `Observation` - `ADD`
- **Closest existing guidance:** `wiki/workflows/upstream-sync.md:32` "Optional voice native modules" - that keep-list bullet says which manifest and lockfile state to preserve; it says nothing about how to reproduce or check the Termux install locally.
- **Admission basis:** `observed failure prevention`
- **Session evidence or selection reason:** The handoff's `npm install --os=android --cpu=arm64` reproduction installed decibri and missed the failure on npm 11.20.0 (plan Context, contradicted claim C7). The node preload spoof reproduced `EBADPLATFORM decibri@3.4.2` on an unchanged `HEAD` clone and passed after the fix in a fresh clone of the changed tree.
- **Expected future benefit:** A future agent checking whether a dependency or upstream-sync change breaks the Termux install uses a reproduction that actually fails, instead of a false-negative npm flag.
- **Why this tier:** The technique worked twice in one item, but how often it will be needed and whether it matches a real Termux install (the phone check is still pending) are unproven. Adding it to the upstream-sync checklist is also pending as backlog candidate C2, so it stays an observation rather than workflow guidance.
