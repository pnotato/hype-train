# CLAUDE.md

Guidance for coding agents working in this repo. **Read `docs/STYLE_GUIDE.md` before writing code and `docs/agents/PLAN.md` before starting a milestone.** `docs/PLAN.md`, `docs/GAME LOOP.md` and `docs/BLOBS.md` are the user's human-written design docs: terse, their voice. They win over agent docs. Edit them only when asked, and keep the edits short and in their style.

> Status: Milestone 0 (scaffold) done. Every design choice is a draft until the upcoming design review. If a doc and the user disagree, the user wins; update the doc in the same change.
>
> **Direction change (15 Nov 2026, pending design review):** the player runs a fictional tech company announcing features, trying to keep trust high while the stock price rises. Blobs are shapes again (shape = culture, size = age/family), not vegetables. Each blob has `perception` and `interest` scores, 0–100; there's no win or lose, and the player aims for both high at the end. Current decisions and open questions are in `docs/agents/PLAN.md` §1–2; how they were reached is in `HISTORY.md`. Until the review, the text below describes the original premise.

## What this is

**Hype Train** is a small simulated town where LLM agents pass around a real news story and distort it, one round at a time. You can click any resident to see why they said what they said. A **Go** backend runs the simulation and makes the model calls. A **React + TypeScript** client (Vite, React Three Fiber (Three.js) 3D scene) plays back the recorded event log.

Inspired by Nicky Case's *We Become What We Behold* (Unlicense code / CC0 art). Credit it in the app's About screen and in the README.

## Hard rules

1. **No API keys in the browser.** Only the Go server reads secrets, from the environment. The client never calls a model.
2. **Stub brain by default.** Dev, tests, and CI run on the deterministic stub provider and cost $0. A real model call needs `BRAIN=anthropic` set explicitly.
3. **Everything generated is labelled SIMULATED.** Real people in a seed get fictional names before anything reaches a prompt.
4. **The sim is the source of truth; the UI only replays it.** The Go server runs every round and logs it. The client renders the `RunLog` and sends one thing back: the player's story choice (`POST /api/runs/{id}/story`). It never decides who talks to whom or what anyone believes.
5. **One module maps state to looks.** Blob state is `perception` and `interest`, 0–100 (this replaced the old `calm | unsure | worried | panicked` belief words on 15 Nov 2026). Colour and facial expression are derived from it in one client module, and expression is always shown so colour is never the only cue.
6. **Reference repo `leakyhose/agent-economy`: architecture reference only.** It has no license and nobody has confirmed who owns it. Don't copy code from it until the user confirms.
7. **Cap spend.** Every real run has a hard ceiling on rounds and agents (config), and the server refuses to start a run past it.

## Layout

```
cmd/server/        HTTP server entrypoint (serves /api, plus web/dist when built)
cmd/sim/           (M1) headless CLI: run a seed → runs/<id>.json
internal/sim/      Pure, deterministic simulation: blobs and town (town.go), round loop and RunLog (game.go). No I/O.
internal/server/   HTTP routes (/api/runs …); thin, calls into sim + providers
internal/provider/ (M3) model providers: stub, anthropic
web/               React + Vite + TS client (own package.json)
web/src/town/      3D scene (R3F): floor, camera, residents (one body shape per community)
seeds/             Seed stories (JSON)
runs/              Recorded RunLogs. Curated demo runs are committed; runs/scratch/ is gitignored.
docs/              Human design docs (PLAN.md, GAME LOOP.md, BLOBS.md = master blob spec), STYLE_GUIDE.md, RESEARCH.md (findings + IEEE refs)
docs/agents/       Agent-facing docs: PLAN.md (implementation plan, decisions, open questions)
HISTORY.md         Decision log: rejected/overridden AI suggestions, caught AI errors, direction changes
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
- **Log AI decisions in `HISTORY.md`, in the same change.** Add an entry whenever the user rejects, overrides or corrects one of your suggestions; when you or the user catch an error in your output (wrong fact, bad citation, broken code you claimed worked); or when a human decision changes direction. Format: what the AI proposed → decision → why, quoting the user's reason where they gave one and writing *no reason recorded* otherwise. Record it honestly. Don't soften your errors or credit yourself with the user's ideas.
- Commits are authored by the repo's git user (Nicholas Chan) only. Don't add `Co-Authored-By: Claude` or any other Claude or AI attribution, trailer or "Generated with" line to commit messages or PR descriptions.
