# CLAUDE.md

Guidance for coding agents working in this repo. **Read `docs/STYLE_GUIDE.md` before writing code and `docs/PLAN.md` before starting a milestone.**

> Status: Milestone 0 (scaffold) done. Every design choice is a draft until the upcoming design review. If a doc and the user disagree, the user wins; update the doc in the same change.

## What this is

**Hype Train** is a small simulated town where LLM agents pass around a real news story and distort it, one round at a time. You can click any resident to see why they said what they said. A **Go** backend runs the simulation and makes the model calls. A **React + TypeScript** client (Vite, React Three Fiber (Three.js) 3D scene) plays back the recorded event log.

Inspired by Nicky Case's *We Become What We Behold* (Unlicense code / CC0 art). Credit it in the app's About screen and in the README.

## Hard rules

1. **No API keys in the browser.** Only the Go server reads secrets, from the environment. The client never calls a model.
2. **Stub brain by default.** Dev, tests, and CI run on the deterministic stub provider and cost $0. A real model call needs `BRAIN=anthropic` set explicitly.
3. **Everything generated is labelled SIMULATED.** Real people in a seed get fictional names before anything reaches a prompt.
4. **The sim is the source of truth; the UI only replays it.** The client renders a `RunLog`. It never decides who talks to whom or what anyone believes.
5. **Belief is a word, not a number.** `calm | unsure | worried | panicked`. Colour and facial expression are derived from it in one client module, and expression is always shown so colour is never the only cue.
6. **Reference repo `leakyhose/agent-economy`: architecture reference only.** It has no license and nobody has confirmed who owns it. Don't copy code from it until the user confirms.
7. **Cap spend.** Every real run has a hard ceiling on rounds and agents (config), and the server refuses to start a run past it.

## Layout

```
cmd/server/        HTTP server entrypoint (serves /api, plus web/dist when built)
cmd/sim/           (M1) headless CLI: run a seed → runs/<id>.json
internal/sim/      Pure, deterministic simulation: types, round loop, agents, belief, stub brain. No I/O.
internal/server/   HTTP routes; thin, calls into sim + providers
internal/provider/ (M3) model providers: stub, anthropic
web/               React + Vite + TS client (own package.json)
web/src/town/      3D scene (R3F): floor, camera, later the residents (one body shape per archetype)
seeds/             Seed stories (JSON)
runs/              Recorded RunLogs. Curated demo runs are committed; runs/scratch/ is gitignored.
docs/              PLAN.md, STYLE_GUIDE.md
```

Dependency direction: `cmd → internal/server → internal/sim`, with `internal/provider` implementing an interface that `sim` defines. `internal/sim` imports nothing else from this repo and only the standard library.

**The `RunLog` JSON is the contract between Go and TS.** The Go structs in `internal/sim` are the source of truth. TS types in `web/src/sim-types.ts` are generated from them (M1, `tygo`), never hand-edited.

## Commands

```
make dev     # Go server on :8080 + Vite on :5173 (proxies /api). Open http://localhost:5173
make check   # gofmt, go vet, go test, tsc, oxlint, prettier. Must pass before a change is done.
make fmt     # gofmt -w + prettier --write
make test    # go test ./...
make build   # web/dist + bin/server; then ./bin/server serves everything on :8080
```

`make` loads `.env` (copy from `.env.example`) automatically. Go 1.26, Node 26.

## Model calls (server only, M3)

- Model: `claude-haiku-5-5` via the official Go SDK `github.com/anthropics/anthropic-sdk-go`. Each agent gets one stateless request per round, and the agent acts through tools (`tell`, `post`, `ignore`). Decode tool inputs with `encoding/json` into structs and validate them. Never string-match.
- Prompt order for caching: tools → shared system block (world rules + seed article) → `cache_control` breakpoint → persona → per-round context. Never put per-round content before the breakpoint. Minimum cacheable prefix is 512 tokens; the TTL is 5 minutes. Check that `usage.cache_read_input_tokens` > 0 from round 2 on.
- Make agent calls in parallel with a bounded semaphore (goroutines plus a buffered channel or `errgroup.SetLimit`).
- Prompts live as template files (`internal/provider/prompts/*.md`, embedded with `go:embed`) and are kept under version control.
- Handle `stop_reason` (`refusal`, `max_tokens`) before reading content. Any failed or invalid agent turn becomes an `ignore` event with `error` set. Never crash the run over it.

## Working agreements

- Small, reviewable changes. One milestone task per commit where you can.
- Write the test first for sim logic (round loop, belief transitions, chain of custody, log round-trip).
- Don't add a dependency without saying why in the commit message. Prefer the Go standard library.
- For UI work, also run `make dev` and look at it.
- Commit and push every change to GitHub (`origin`) as soon as `make check` passes. Stage only the files you changed; leave other people's uncommitted work alone.
- Commits are authored by the repo's git user (Nicholas Chan) only. Don't add `Co-Authored-By: Claude` or any other Claude or AI attribution, trailer or "Generated with" line to commit messages or PR descriptions.
