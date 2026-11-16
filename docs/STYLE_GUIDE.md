# Style Guide

Tools enforce what they can (`gofmt`, `go vet`, `tsc --strict`, oxlint, Prettier), all run by `make check`. This document covers what they can't. When the tools and this guide disagree, the tools win and this file gets fixed.

## Shared

- **Domain words:** use these consistently in both languages: **blob** (a resident; `docs/BLOBS.md`), **outlet**, **agent** (either one), **seed**, **round**, **event**, **perception**, **interest**, **story** (the player's news), **talk**, **post**, **mutation**, **run**, **chain of custody**. Don't introduce synonyms like "npc", "bot", "turn", or "step".
- **IDs** are readable strings (`"res-03"`, `"outlet-clickbait"`), not UUIDs, so logs stay diffable.
- **JSON** field names are camelCase (`sourceEventIds`), set with Go struct tags.
- **Comments** explain *why*, not *what*. Delete commented-out code. Mark a deliberate shortcut with `TODO(scope): reason`.
- A change that alters the architecture also updates `CLAUDE.md` or `PLAN.md` in the same commit.

## Go (`cmd/`, `internal/`)

- Format with `gofmt`. Follow [Effective Go](https://go.dev/doc/effective_go) and the [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments).
- **Standard library first:** `net/http` (1.22+ method routing), `encoding/json`, `log/slog`, `testing`. Each new module needs a reason in the commit message.
- **Naming:** short package names (`sim`, `server`, `provider`); no stutter (`sim.Run`, not `sim.SimRun`); MixedCaps; acronyms stay capitalised (`ID`, `URL`, `JSON`).
- **Errors** are values: return `error`, wrap with `fmt.Errorf("decide %s: %w", id, err)`, and handle each error once. No `panic` outside `main` and impossible states.
- **Enums:** `type Belief string` with named constants, plus a `Valid()` method used when decoding.
- **No global mutable state.** Configuration is read from env once in `main` and passed down as a struct.
- **`context.Context`** is the first argument of anything that does I/O or might be cancelled (model calls, HTTP).
- **Concurrency** lives in the provider and server layers. `internal/sim` stays single-threaded and deterministic.

### `internal/sim`

- Deterministic: the same seed, config, RNG seed, and brain responses produce the same `RunLog`. All randomness comes from an injected `*rand.Rand` (`math/rand/v2` with a fixed seed); no global rand, no `time.Now()`.
- No I/O, and no imports beyond the standard library. The brain is an interface: `Decide(ctx, Input) (Action, error)`.
- Every exported identifier has a doc comment.
- Bad model output never errors the run. It becomes an `ignore` event with `Error` set.

### Tests

- Table-driven tests with `t.Run`, in `*_test.go` next to the code. Use `httptest` for handlers.
- Golden files for RunLogs (`testdata/*.json`), refreshed with a `-update` flag.
- Don't use a mocking framework. Use small fake implementations of interfaces.

## TypeScript / React (`web/`)

- `strict` plus `noUncheckedIndexedAccess`. Prettier: 2 spaces, double quotes, semicolons, trailing commas, 100 columns.
- Don't use `any`. Use `unknown` plus narrowing when loading a RunLog file.
- **Files:** kebab-case (`town-view.tsx`); components PascalCase, one per file; hooks `useX`.
- Function components and hooks only. Local state first; add a store only when prop-drilling actually hurts.
- Rendering reads from the `RunLog` plus a playback cursor (`roundIndex`, `eventIndex`). Animation state is derived, not stored separately.
- 3D scene components live in `src/town/`; world constants (floor size, camera limits) in `src/town/world.ts`.
- Per-frame updates go in `useFrame` and mutate refs. Never set React state every frame.
- Never edit the generated `src/sim-types.ts`. Change the Go struct and regenerate.
- All belief-to-colour and belief-to-expression mapping lives in `src/visual/belief.ts`; archetype-to-shape mapping lives in `src/visual/personality.ts`.
- **Accessibility:** never use colour as the only cue; 3D meshes aren't focusable, so the inspector also offers an HTML list of characters (buttons with accessible names); respect `prefers-reduced-motion`.
- Show the **SIMULATED** label on every screen that displays generated text.
- Tests (Vitest) only for logic such as playback derivation and data transforms, added when that logic exists. Don't snapshot-test the 3D scene.

## Git

- Subjects use a scope prefix: `sim: add belief transitions`, `web: inspector panel`, `server: anthropic provider`, `docs: …`, `chore: …`. Imperative mood, ≤ 72 characters.
- One logical change per commit, with `make check` passing.
- Never commit `.env`, `runs/scratch/`, or anything containing a key.
