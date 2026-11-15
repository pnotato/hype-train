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

## Residents

Each resident has one **age group**, one **archetype**, and six **trait words**. The archetype sets the default traits and the body shape; behaviour code reads only the traits, so adding an archetype means adding a row (`internal/sim/persona.go`). Evidence for every axis is in **Persona evidence** at the end.

| Field | Values | Drives |
|---|---|---|
| `ageGroup` | `young` (18–29) · `adult` (30–49) · `middle` (50–64) · `senior` (65+) | source diet, preferred channel, voice in the prompt |
| `credulity` | `low` · `mid` · `high` | how easily a message moves belief up a step |
| `broadcast` | `low` · `mid` · `high` | how often they `post` rather than `tell` or `ignore` |
| `reactivity` | `low` · `mid` · `high` | 1- or 2-step belief jumps on a scary message; fear in the retelling |
| `sociability` | `low` · `mid` · `high` | neighbours in the graph (1–2 / 3–5 / 8+). Graph only, not in the prompt |
| `distortion` | `level` · `sharpen` · `assimilate` | how they rewrite the story; feeds the M4 mutation tags |
| `motive` | `inform` · `warn` · `clout` | why they share; goes into the persona prompt |

| Archetype | Share /100 | credulity | broadcast | reactivity | sociability | distortion | motive | shape |
|---|---|---|---|---|---|---|---|---|
| Regular | 35 | mid | mid | mid | mid | level | inform | capsule (the jellybean) |
| Connector | 15 | mid | low | mid | **high** | assimilate | inform | sphere |
| Worrier | 15 | high | low | **high** | mid | sharpen | warn | star |
| Skeptic | 15 | **low** | mid | low | mid | level | inform | cube |
| Clout-chaser | 10 | *variant* | **high** | mid | mid | sharpen | clout | cone, point up |
| Hermit | 10 | mid | low | low | **low** | level | inform | teardrop |

- **Regular is the largest group on purpose:** real spreading is concentrated in a small minority. A town of strong archetypes would spread far more than a real population.
- **Clout-chasers split evenly by variant:** **True Believer** (`credulity: high`, believes and posts, expected worst spreader) and **Cynic** (`credulity: low`, posts for reactions).
- **Counts are exact:** largest-remainder apportionment of the shares for any roster size, then shuffled with the run's RNG.
- **Jitter:** each ordinal trait has a 20% chance to move one step from the default. The **bold** (defining) traits and the variant's credulity never jitter, so every resident still reads as their archetype. `distortion` and `motive` are categorical and don't jitter.
- **Age** is apportioned independently (20 young / 33 adult / 25 middle / 22 senior, roughly US adults) and is **not** linked to credulity. It sets the source diet: `young` follows the clickbait site, `adult` both, `middle`/`senior` the paper. Residents with `sociability: low` follow no outlet and hear only from their neighbours.
- Names are drawn from fictional first/last lists; IDs are `res-001`….
- **Shape** is client-only (`src/visual/personality.ts`, keyed by `archetype`) and isn't in the RunLog. Each archetype has a distinct silhouette, so character reads without colour. Belief still sets colour and expression on every shape. The star is an extruded `THREE.Shape` and the teardrop (sphere base rising to a point) a lathe; the rest are three.js primitives. True Believer and Cynic share the cone and are told apart by a badge.

## Milestone 0: Scaffold ✅

Go module `hypetrain` (`cmd/server`, `internal/server`, `internal/sim`), a Vite + React + TS client in `web/` with `/api` proxied to `:8080`, and a Makefile (`dev`, `check`, `fmt`, `build`). `make check` is green.

## Milestone 1: Headless sim with the stub brain (2 days)

- Seeded RNG and roster builder: about 100 residents plus the outlets, using the persona model in **Residents** below. ✅ `sim.BuildRoster` (types, shares, jitter, graph) is in. Social graph: a fixed adjacency whose degree comes from each resident's `sociability`, so there's no pathfinding.
- Round loop: each agent gets an inbox (messages received last round plus the outlets they follow), calls `brain.decide`, gets back `tell | post | ignore` plus a belief word, and the loop emits events.
- Stub brain: rule-based on **trait words**, never archetype names (low `credulity` resists, high `reactivity` jumps two steps, high `broadcast` posts, `sharpen` exaggerates, and so on), with canned phrase templates, so drift is visible at $0. Age changes channel: `young`/`adult` lean to `post`, `middle`/`senior` to `tell`.
- CLI: `go run ./cmd/sim -seed seeds/x.json` writes `runs/<id>.json`.
- Set up `tygo` type generation (`make types`) and add a check that the generated TS file is up to date.
- Tests: determinism (same seed, same log), every `sourceEventIds` entry resolves, belief changes only through `belief` events, and the log round-trips through JSON unchanged (golden test).
- **Done when:** a stub run of 8 rounds produces a valid RunLog with visible belief spread, and the 100-resident roster shows: archetype and age counts match the shares; clout-chasers produce most `post` events; Worriers reach `panicked` first; Hermits change last.

## Milestone 2: Playback UI (3 days)

- Town view in 3D (React Three Fiber): characters at fixed home positions on the floor, each with its archetype's body shape (see **Residents**; Regulars are the capsule jellybean) from `src/visual/personality.ts`, with a small badge to tell a True Believer from a Cynic; belief sets colour and expression.
- Playback: a timeline cursor with play, pause, step, and speed controls. A `tell` animates (in `useFrame`) as a hop toward the target with a speech bubble. A `post` shows a headline card above the outlet.
- Inspector: click a character to see its belief history, last thought, and chain of custody back to the seed.
- Loads RunLogs from `runs/` (served statically) or by drag-and-drop.
- 3D via R3F; characters are simple meshes, one shape per archetype; use instancing per shape if the count grows.
- **Done when:** a stub run plays end to end and you can click through to any message's origin.

## Milestone 3: Real model provider (2 days)

- `internal/provider/anthropic.go` (official Go SDK): one request per agent per round, made in parallel with goroutines and a concurrency limit, using `claude-haiku-5-5`, tools `tell`/`post`/`ignore` with `strict: true`, and a low `effort`.
- Prompt layout for caching: tools → shared system block (rules plus seed article) marked `cache_control` → persona → per-round inbox. Verify cache hits in `usage`.
- Persona prompt template reads the trait words, `motive` and `distortion` (not the archetype name) and the age group for voice. `sociability` is graph-only and stays out of the prompt.
- Cost at ~100 residents: one call per resident per round, so 6 rounds is about 600 resident calls plus a few dozen outlet calls. At Haiku 5.5 rates ($0.10 / $0.50 per MTok input/output) and roughly 1K uncached input + ~500 output tokens per call (the shared prefix is cached), that's on the order of $0.25 per run; budget $1 to cover thinking and longer inboxes. Re-check against the real `usage` after the first run.
- Spend guard: estimate the cost before a run starts, refuse anything over the cap, and record actual usage in `RunLog.usage`.
- Error handling: refusal, max_tokens, invalid input, or a network failure each become an `ignore` event with `error`, and there's one retry for 429/5xx (the SDK default).
- Server endpoint `POST /api/runs` (seed id plus config) streams progress (SSE), then saves the RunLog.
- **Done when:** the demo-size real run (100 residents + the outlets, 6 rounds) completes under the cost cap and replays in the UI. Default caps **[review]**: 120 residents, 10 rounds, $2 per run.

## Milestone 4: Debrief (2 days)

- Mutation tagging pass: a single call to a stronger model over the whole chain, with the seed's ground-truth claims as reference, writes `analysis`. It has a stub too.
- Corkboard view: the seed card on one side and the final most-shared rumour on the other, joined by red string along `sourceEventIds`, with each hop labelled by its mutation tag.
- Panic-over-time chart: counts of each belief per round (stacked area). Use the dataviz skill when you build it.
- **Done when:** the corkboard and chart render for both a stub run and a real run.

## Milestone 5: Demo polish (rest of the time)

- Seed picker (2–3 curated seeds) and a "replay demo run" button that uses committed runs, so the demo needs no network.
- About screen: the WBWWB credit, the SIMULATED disclaimer, and the caveat that agent thoughts are a model, not psychology.
- QA harness: `go run ./cmd/qa`, a script that runs over N recorded runs and reports whether the Skeptic ever resists (sycophancy check), how many messages contain claims not in the seed (hallucination check), the share of mutation tags by type, and whether True Believers cause more downstream `belief` changes than Cynics (the "gullible + attention seeking is the worst spreader" hypothesis, which no single study tests directly). This gives the final report its evidence.

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
- Rounds for the final demo, and whether ~100 residents stays readable in the 3D view (cost is no longer the constraint, see M3).

## Persona evidence

- **Credulity is its own trait.** Teunisse et al. (2020), *Development of a Self-Report Measure of Gullibility*, PSPB 46(3): a validated gullibility scale, distinct from trust. Pennycook & Rand (2019), *Lazy, not biased*, Cognition 188: falling for fake headlines tracks low analytic thinking.
- **Sharing is not believing.** Pennycook et al. (2021), Nature 592: truth barely affects sharing intent but strongly affects accuracy judgments, so `credulity` and `broadcast` are separate. Ren, Dimant & Schweitzer (2023), JESP 104: people knowingly share conspiracy theories they don't believe for likes (the Cynic).
- **Attention seeking.** Narcissism predicted both believing and sharing misinformation in 7 of 8 countries (*Scientific Reports*, 2023) (the True Believer). Ceylan, Anderson & Wood (2023), PNAS: the 15% most habitual sharers produced 30–40% of false news shared (a 2025 replication review questions Study 2). Grinberg et al. (2019), Science: ~0.1% of users made ~80% of fake-news shares.
- **Gullible + attention seeking.** No study tests the interaction directly. Buchanan (2020), PLOS ONE: sharing intent is highest when people think the material is true; combined with the above, a True Believer gets both effects. The M5 QA harness checks this in the sim.
- **Reactivity.** Freiling et al. (2023), New Media & Society 25(1): induced anxiety raised belief in and sharing of claims of any accuracy. Martel, Pennycook & Rand (2020), CRPI: reliance on emotion promotes belief in fake news. Vosoughi, Roy & Aral (2018), Science: false news spreads faster, driven by fear and surprise.
- **Sociability.** Long-term loneliness predicted conspiracy views in a 28-year Norwegian cohort (Nature Communications, 2024), so the Hermit is not a natural skeptic: `credulity: mid`. Cascades run through well-connected nodes (Grinberg; Vosoughi) (the Connector).
- **Motive.** Apuke & Omar (2021), Telematics & Informatics 56: altruism was the strongest predictor of sharing COVID fake news (`motive: warn`). Petersen, Osmundsen & Arceneaux (2023), APSR 117(4), "need for chaos": left out for now (political and hostile); a possible 7th archetype.
- **Age.** Guess, Nagler & Tucker (2019), Science Advances: over-65s shared ~7× more fake-news links than 18–29s. Brashier & Schacter (2020), CDPS 29(3): not explained by cognitive decline, but by social goals, source memory and digital literacy. Buchanan (2020) found younger people more likely to share. Mixed evidence, so age changes channel and source diet, not credulity.
- **Distortion.** Allport & Postman (1947), *The Psychology of Rumor*: levelling, sharpening, assimilation.
