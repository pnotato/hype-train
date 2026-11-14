# Implementation Plan (draft)

This covers coding work only. Course deliverables (proposal, Discord, report) are tracked elsewhere. The whole plan is open to change at the design review; anything marked **[review]** is an open question for that session.

Budget: about 3 weeks. Milestones are ordered so there's a demoable build after each one. If time runs short, cut from the bottom.

## Core contract: `RunLog`

Everything flows through one JSON document. Get it right first, because the UI, recorder, and debrief all depend on it. It's sketched here in TS for readability; the real definition is Go structs in `internal/sim`, and TS types are generated from them with `tygo` into `web/src/sim-types.ts`.

```ts
type Belief = "calm" | "unsure" | "worried" | "panicked";

type RunLog = {
  version: 1;
  id: string;                    // "2026-11-20-solar-flare-01"
  seed: Seed;                    // summary, link, groundTruth claims, name substitutions
  config: RunConfig;             // rounds, agent roster, brain, rng seed, model id
  agents: AgentProfile[];        // id, name, kind ("resident" | "outlet"), personality, start belief
  rounds: Round[];
  analysis?: MutationTag[];      // end-of-run tagging pass
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

`sourceEventIds` is the chain of custody: each message points to the messages the agent had seen when it wrote this one. The corkboard and the "trace back to the original" view follow these links back to the seed.

## Milestone 0: Scaffold ✅

Go module `hypetrain` (`cmd/server`, `internal/server`, `internal/sim`), a Vite + React + TS client in `web/` with `/api` proxied to `:8080`, and a Makefile (`dev`, `check`, `fmt`, `build`). `make check` is green.

## Milestone 1: Headless sim with the stub brain (2 days)

- Seeded RNG and roster builder (about 12 residents with 5 personalities, plus 4 outlets). Social graph: a fixed neighbourhood adjacency, so there's no pathfinding.
- Round loop: each agent gets an inbox (messages received last round plus the outlets they follow), calls `brain.decide`, gets back `tell | post | ignore` plus a belief word, and the loop emits events.
- Stub brain: rule-based by personality (the Skeptic downgrades certainty, the Clout-chaser exaggerates, and so on) with canned phrase templates, so drift is visible at $0.
- CLI: `go run ./cmd/sim -seed seeds/x.json` writes `runs/<id>.json`.
- Set up `tygo` type generation (`make types`) and add a check that the generated TS file is up to date.
- Tests: determinism (same seed, same log), every `sourceEventIds` entry resolves, belief changes only through `belief` events, and the log round-trips through JSON unchanged (golden test).
- **Done when:** a stub run of 8 rounds produces a valid RunLog with visible belief spread.

## Milestone 2: Playback UI (3 days)

- Town view in SVG: shape characters at fixed home positions. Each personality has its own shape and accessory; belief sets colour and expression.
- Playback: a timeline cursor with play, pause, step, and speed controls. A `tell` animates as a hop toward the target with squash and stretch and a speech bubble. A `post` shows a headline card above the outlet.
- Inspector: click a character to see its belief history, last thought, and chain of custody back to the seed.
- Loads RunLogs from `runs/` (served statically) or by drag-and-drop.
- **[review]** SVG or PixiJS. The default is SVG: 16 sprites is fine for SVG, and you get DOM events and accessibility for free. Switch only if animation performance actually suffers.
- **Done when:** a stub run plays end to end and you can click through to any message's origin.

## Milestone 3: Real model provider (2 days)

- `internal/provider/anthropic.go` (official Go SDK): one request per agent per round, made in parallel with goroutines and a concurrency limit, using `claude-haiku-5-5`, tools `tell`/`post`/`ignore` with `strict: true`, and a low `effort`.
- Prompt layout for caching: tools → shared system block (rules plus seed article) marked `cache_control` → persona → per-round inbox. Verify cache hits in `usage`.
- Spend guard: estimate the cost before a run starts, refuse anything over the cap, and record actual usage in `RunLog.usage`.
- Error handling: refusal, max_tokens, invalid input, or a network failure each become an `ignore` event with `error`, and there's one retry for 429/5xx (the SDK default).
- Server endpoint `POST /api/runs` (seed id plus config) streams progress (SSE), then saves the RunLog.
- **Done when:** a 12+4 agent, 6-round real run completes under the cost cap and replays in the UI.

## Milestone 4: Debrief (2 days)

- Mutation tagging pass: a single call to a stronger model over the whole chain, with the seed's ground-truth claims as reference, writes `analysis`. It has a stub too.
- Corkboard view: the seed card on one side and the final most-shared rumour on the other, joined by red string along `sourceEventIds`, with each hop labelled by its mutation tag.
- Panic-over-time chart: counts of each belief per round (stacked area). Use the dataviz skill when you build it.
- **Done when:** the corkboard and chart render for both a stub run and a real run.

## Milestone 5: Demo polish (rest of the time)

- Seed picker (2–3 curated seeds) and a "replay demo run" button that uses committed runs, so the demo needs no network.
- About screen: the WBWWB credit, the SIMULATED disclaimer, and the caveat that agent thoughts are a model, not psychology.
- QA harness: `go run ./cmd/qa`, a script that runs over N recorded runs and reports whether the Skeptic ever resists (sycophancy check), how many messages contain claims not in the seed (hallucination check), and the share of mutation tags by type. This gives the final report its evidence.

## Cut list (in order, if behind)

1. Drag-and-drop log loading (keep only the committed runs).
2. Live streaming progress (just wait, then load).
3. Influencer and group-admin outlets (keep the paper and the clickbait site).
4. Squash-and-stretch polish (plain tweened hops are enough).
5. The panic chart (the corkboard is the important view).

## Open questions [review]

- Are outlets driven by the LLM, or by rules with an LLM writing the headlines?
- Does the stub brain stay in the shipped app as an "offline mode"?
- Can the player intervene (inject a correction, fact-check an outlet), or is it watch-only?
- Should agents get memory across rounds (a summary of what they've heard), or only the current inbox?
- Which model does the tagging pass, and does it run per run or only on curated demos?
- Rounds and roster size for the final demo (cost versus readability).
