# Implementation plan (for agents)

Agent-facing plan. The human docs are `docs/PLAN.md`, `docs/GAME LOOP.md` and `docs/BLOBS.md`; when they disagree with this file, **they win**, so update this file. Coding only: course deliverables live elsewhere. Anything marked **[review]** is open.

Sections 1–2 are the current direction (15 Nov 2026). Sections 3+ are the original plan (watch-only replay of a news story), kept because the architecture, contract and milestone shape still apply. Each original section has a **Status** line saying what changed.

## 1. Current direction

| Topic | Decision | Source |
|---|---|---|
| Premise | Player runs the newsroom of a fictional AI company. Bold claims raise interest; failing to deliver costs perception later. | `docs/PLAN.md` |
| Population | ~100 blobs, representative of **Canada** | `docs/PLAN.md`, `docs/BLOBS.md` |
| Blob model | **`docs/BLOBS.md` is the master spec** (properties, age, traits, shapes, interactions, cited) | `docs/BLOBS.md` |
| Channels | Word of mouth and social media; blobs can also idle | `docs/PLAN.md`, `docs/GAME LOOP.md` |
| Length | 50 rounds; a news story (player choice) every 10, so 5 decisions | `docs/GAME LOOP.md` |
| Meters | Each blob has **perception** and **interest**, each a score **0–100**. The town averages are plotted per round. | user, 15 Nov |
| Win / lose | **None.** The player wants both averages high near the end. | user, 15 Nov |
| Bodies | Abstract shapes (shape = culture, size = age/family). Not vegetables. | `HISTORY.md` |
| Evidence | `docs/RESEARCH.md` (IEEE refs, ✓ = checked online) | — |

## 2. Open questions [review]

1. **Product reality model.** What each announced feature actually does, and when blobs find out it underdelivered. Without this, "bold claims backfire" has nothing to compare against.
2. **Player choices.** How many options per story, and what each one moves (perception, interest, which blobs hear it first).
3. **LLM role and cost.** "100 small LLMs" live = 100 calls × 50 rounds ≈ 5,000 calls per playthrough. That's minutes per run with Haiku, hours with a local model. Proposal: rules decide every number; the LLM writes only displayed text (retellings, the click-panel reason), keyed by announcement × traits × mood and pregenerated offline, then reviewed. Needs the user's decision.
4. **Who talks to whom.** *Draft in code (`internal/sim/game.go`):* each round every blob rolls to share (socialness + interest, more if its perception is extreme); sharers talk or post. Talkers are chosen first, then each picks one free listener weighted by family (×4), home distance (1/(1+d)) and the listener's socialness. Nobody is in two talks a round. Recluses only post; under-13s only talk.
5. **Social-media reach.** *Draft:* a leader's post reaches everyone of their shape; anyone else reaches 3 random blobs (+3 charismatic, +3 chatty), recluses twice as likely to be among them.
6. ~~**Hard rules.**~~ **Decided (user, 15 Nov):** the Go backend runs and logs every round. The client sends a story choice and gets the next 10 rounds back. No database: a run is ~300 KB of JSON, kept in memory and written to `runs/scratch/<id>.json`. API: `POST /api/runs` → blobs + options; `POST /api/runs/{id}/story {"story"}` → 10 rounds + next options; `GET /api/runs/{id}` → full `RunLog`.
7. **BLOBS.md drafts.** Tag names, Triangle/Tear rules, starting scores and trait shares are marked *(design)* in `docs/BLOBS.md`; confirm with the user before relying on them.

## 3. Core contract: the log

**Status:** replaced by `RunLog` v2 in `internal/sim/game.go`: blobs, stories, choices, and per round the events (`story | talk | post`, each with the scores after it for every blob it reached) plus every blob's scores and the town averages. Still to do: product-reality record, `tygo`-generated TS types, retelling text. The original shape is kept below for reference.

```ts
type Belief = "calm" | "unsure" | "worried" | "panicked"; // superseded by perception/interest 0–100

type RunLog = {
  version: 1;
  id: string;
  seed: Seed;
  config: RunConfig;             // rounds, roster, brain, rng seed, model id
  agents: AgentProfile[];
  rounds: Round[];
  analysis?: MutationTag[];
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; costUsd: number };
};

type Round = { index: number; events: SimEvent[]; beliefs: Record<AgentId, Belief> };

type SimEvent =
  | { kind: "tell";   id: EventId; from: AgentId; to: AgentId; message: string; thought: string; sourceEventIds: EventId[] }
  | { kind: "post";   id: EventId; from: AgentId; headline: string; body: string; thought: string; sourceEventIds: EventId[] }
  | { kind: "ignore"; id: EventId; from: AgentId; thought: string; error?: string }
  | { kind: "belief"; id: EventId; agent: AgentId; from: Belief; to: Belief; causeEventId?: EventId };

type MutationTag = { eventId: EventId; type: MutationType; note: string };
// MutationType: dropped-context | exaggeration | vague-source | fake-firsthand | certainty-creep | emotional-framing
```

`sourceEventIds` is the chain of custody: each message points to the messages the agent had seen when writing it. Keep it; it powers "why did they say that".

## 4. Residents (original persona model)

**Status:** superseded by `docs/BLOBS.md`. Removed from the Go code on 15 Nov; `internal/sim/town.go` now implements BLOBS.md. The browser prototypes in `web/src/spread/` still use it. Mapping to the new model: `credulity` → Credulity, `broadcast`/`sociability` → Socialness, Hermit → Recluse. New: Persuasiveness, shape-as-culture, families, Leader. Dropped: archetypes, `reactivity`, `distortion`, `motive`, Cynic/True Believer variants. Age changes from 4 US brackets to an exact age with a Canadian distribution.

Original model, kept for reference:
- 6 archetypes with shares per 100: Regular 35, Connector 15, Worrier 15, Skeptic 15, Clout-chaser 10 (split True Believer / Cynic), Hermit 10.
- Ordinal traits `low|mid|high`: credulity, broadcast, reactivity, sociability. Categorical: distortion `level|sharpen|assimilate`, motive `inform|warn|clout`.
- Counts by largest-remainder apportionment, then shuffled with the run RNG. 20% jitter on non-defining traits.
- Age groups (Pew): young 20 / adult 33 / middle 25 / senior 22. Age set source diet, not credulity.
- Sociability set graph degree (1–2 / 3–5 / 8+). Low-sociability residents followed no outlet.
- Behaviour code reads traits, never archetype names. **Keep this rule** for the new model: behaviour reads trait categories, never shape names, except the shape trust rules in BLOBS.md.

## 5. Milestones

**Status:** M0 done. M1 roster done for the old model. M2's town, hex grid, hops and inspector exist in `web/` for the old model. Milestones below are the original; re-plan them after the open questions in §2 are answered. Deadline is **11 Dec 2026**; cut from the bottom.

### M0: Scaffold ✅
Go module `hypetrain`, Vite + React + TS client, Makefile (`dev`, `check`, `fmt`, `build`).

### M1: Headless sim, stub brain
- Seeded RNG + roster (~100). ✅ for the old model.
- Round loop: inbox → `brain.decide` → `tell | post | ignore` + state change → events.
- Stub brain: rule-based on trait words, canned phrase templates, $0.
- CLI: `go run ./cmd/sim -seed seeds/x.json` → `runs/<id>.json`.
- `tygo` generation (`make types`) and a check that it's up to date.
- Tests: determinism, every `sourceEventIds` resolves, state changes only via events, JSON round-trip golden test.

### M2: Playback UI
- R3F town; shape per blob, expression always shown so colour isn't the only cue.
- Timeline: play, pause, step, speed. `tell` = hop + speech bubble; `post` = headline card.
- Inspector: click a blob → history, last thought, chain of custody.

### M3: Real model provider
- `internal/provider/anthropic.go`, official Go SDK, `claude-haiku-5-5` ($0.10 / $0.50 per MTok in/out). Tools `tell`/`post`/`ignore`, `strict: true`, low effort.
- Prompt order for caching: tools → shared system block → `cache_control` → persona → per-round context.
- Spend guard: estimate before a run, refuse over the cap, record `usage`.
- Failures become `ignore` with `error`; never crash a run.
- **Status:** see §2 item 3. If text is pregenerated, this becomes an offline generation script plus a review step, not a live provider.

### M4: Debrief
- Mutation tagging pass (stub too). Corkboard: seed → most-shared retelling along `sourceEventIds`.
- Chart over rounds: now **perception and interest averages** (use the dataviz skill).

### M5: Polish
- About screen: WBWWB credit, SIMULATED label, "thoughts are a model, not psychology".
- QA harness `go run ./cmd/qa`: skeptics resist; count claims not in the source (hallucination); compare spread by trait.

### Cut list (in order)
1. Drag-and-drop log loading
2. Live streaming progress
3. Extra outlets
4. Squash-and-stretch polish
5. The chart (keep the corkboard / click-to-explain)

## 6. Evidence

All citations: `docs/RESEARCH.md`. The original plan's evidence section is folded in there, except the 2023 *Scientific Reports* narcissism study (authors unconfirmed).
