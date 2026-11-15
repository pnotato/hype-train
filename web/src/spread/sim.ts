import { archetypes, type Archetype } from "../visual/personality.ts";
import { drawNames } from "./names.ts";
import { archetypeShare, traitsFor, type Level, type Traits, type Variant } from "./traits.ts";

// Browser prototype of mood contagion: one angry resident tries to make happy
// residents angry, one conversation per turn. Pure and seeded, so a seed always
// plays out the same way. Outcomes are weighted by the listener's trait words,
// never their archetype name, so the rules can move into the Go stub brain.

export type Mood = "happy" | "neutral" | "upset" | "angry";
export const moods: readonly Mood[] = ["happy", "neutral", "upset", "angry"]; // happiest first

export type Person = {
  id: string;
  name: string; // first name, used in the log
  fullName: string;
  archetype: Archetype;
  variant?: Variant;
  traits: Traits;
  mood: Mood;
  spreader: boolean; // the one who started angry
};

export type Outcome = "shrug" | "avoid" | "annoyed" | "blow-up" | "calmed";
export const outcomes: readonly Outcome[] = ["shrug", "avoid", "annoyed", "blow-up", "calmed"];

// The possible interactions when an angry resident confronts someone.
export const interactions: Record<
  Outcome,
  { label: string; effect: string; favouredBy: string; weight: string }
> = {
  shrug: {
    label: "Shrugs it off",
    effect: "No change.",
    favouredBy: "low credulity",
    weight: "1 + (2 − credulity)",
  },
  avoid: {
    label: "Walks away",
    effect: "No change; the listener steps away.",
    favouredBy: "low sociability",
    weight: "(2 − sociability)²",
  },
  annoyed: {
    label: "Gets annoyed",
    effect: "Listener drops one mood level.",
    favouredBy: "high credulity and reactivity",
    weight: "1 + credulity + reactivity (halved if the speaker is only upset)",
  },
  "blow-up": {
    label: "Blows up",
    effect: "Listener drops two mood levels and yells back.",
    favouredBy: "high reactivity",
    weight: "reactivity² (halved if the speaker is only upset)",
  },
  calmed: {
    label: "Calms them down",
    effect: "Speaker rises one mood level.",
    favouredBy: "low credulity and reactivity",
    weight: "max(0, 3 − credulity − reactivity)",
  },
};

const lv = (l: Level) => (l === "low" ? 0 : l === "mid" ? 1 : 2);

// Outcome weights for a listener confronted by a speaker in a given mood.
export function weights(listener: Traits, speakerMood: Mood): Record<Outcome, number> {
  const cred = lv(listener.credulity);
  const react = lv(listener.reactivity);
  const soc = lv(listener.sociability);
  const heat = speakerMood === "angry" ? 1 : 0.5;
  return {
    shrug: 1 + (2 - cred),
    avoid: (2 - soc) ** 2,
    annoyed: (1 + cred + react) * heat,
    "blow-up": react ** 2 * heat,
    calmed: Math.max(0, 3 - cred - react),
  };
}

export function probabilities(w: Record<Outcome, number>): Record<Outcome, number> {
  const total = outcomes.reduce((s, o) => s + w[o], 0);
  return Object.fromEntries(outcomes.map((o) => [o, total ? w[o] / total : 0])) as Record<
    Outcome,
    number
  >;
}

// Seeded PRNG (mulberry32): returns a function giving floats in [0, 1).
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

// Weighted random pick: each key is chosen with chance weight / total.
export function pickWeighted<K extends string>(keys: readonly K[], w: Record<K, number>, rng: Rng) {
  const total = keys.reduce((s, k) => s + w[k], 0);
  let r = rng() * total;
  for (const k of keys) {
    r -= w[k];
    if (r < 0) return k;
  }
  return keys[keys.length - 1]!;
}

const shift = (m: Mood, steps: number) =>
  moods[Math.min(moods.length - 1, Math.max(0, moods.indexOf(m) + steps))]!;

export type Turn = {
  turn: number;
  speaker: number; // index into people
  listener: number;
  outcome: Outcome;
  odds: Record<Outcome, number>;
  speakerMood: [Mood, Mood]; // before, after
  listenerMood: [Mood, Mood];
};

// Parent → child: on this turn, `parent` made `child`'s mood worse. Following
// a child's latest link back, then the parent's latest link before that, and
// so on, gives the chain of people that led to their mood.
export type Link = { turn: number; parent: number; child: number; from: Mood; to: Mood };

export type SimState = { people: Person[]; turns: Turn[]; links: Link[]; done: string | null };

export type Options = { contagion: boolean; maxTurns: number };

const residents = 10; // happy ones, plus the angry spreader

// 10 happy residents with archetypes in their town shares (largest remainder),
// plus one angry spreader of the chosen archetype at index 0.
export function initialState(spreader: Archetype, rng: Rng): SimState {
  const n = residents;
  const counts = archetypes.map((a) => Math.floor((n * archetypeShare[a]) / 100));
  const order = archetypes
    .map((a, i) => ({ i, rem: (n * archetypeShare[a]) % 100 }))
    .sort((x, y) => y.rem - x.rem || x.i - y.i);
  for (let k = 0, left = n - counts.reduce((s, c) => s + c, 0); k < left; k++)
    counts[order[k]!.i]!++;
  const pool = archetypes.flatMap((a, i) => Array<Archetype>(counts[i]!).fill(a));
  const variant = (a: Archetype): Variant | undefined =>
    a === "clout-chaser" ? (rng() < 0.5 ? "true-believer" : "cynic") : undefined;

  const names = drawNames(rng, n + 1);
  const make = (a: Archetype, i: number, mood: Mood): Person => {
    const v = variant(a);
    return {
      id: `p${i}`,
      name: names[i]!.first,
      fullName: `${names[i]!.first} ${names[i]!.last}`,
      archetype: a,
      variant: v,
      traits: traitsFor(a, v),
      mood,
      spreader: mood === "angry",
    };
  };
  return {
    people: [make(spreader, 0, "angry"), ...pool.map((a, i) => make(a, i + 1, "happy"))],
    turns: [],
    links: [],
    done: null,
  };
}

// Who can start a conversation: the original spreader while still upset or
// angry, plus (with contagion) anyone else who is angry.
function speakers(s: SimState, opts: Options) {
  return s.people
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        (p.spreader && (p.mood === "angry" || p.mood === "upset")) ||
        (opts.contagion && p.mood === "angry"),
    )
    .map(({ i }) => i);
}

// One conversation. Returns the next state; never mutates the input.
export function step(s: SimState, rng: Rng, opts: Options): SimState {
  if (s.done) return s;
  if (s.turns.length >= opts.maxTurns)
    return { ...s, done: `Stopped after ${opts.maxTurns} turns.` };
  const from = speakers(s, opts);
  if (from.length === 0) return { ...s, done: "Nobody is angry enough to keep going." };

  const speaker = from[Math.floor(rng() * from.length)]!;
  const targets = s.people
    .map((_, i) => i)
    .filter((i) => i !== speaker && s.people[i]!.mood !== "angry");
  if (targets.length === 0) return { ...s, done: "Everyone is angry." };

  // Sociable residents get approached more often.
  const reach = Object.fromEntries(
    targets.map((i) => [String(i), 1 + lv(s.people[i]!.traits.sociability)]),
  ) as Record<string, number>;
  const listener = Number(pickWeighted(targets.map(String), reach, rng));

  const sp = s.people[speaker]!;
  const li = s.people[listener]!;
  const w = weights(li.traits, sp.mood);
  const outcome = pickWeighted(outcomes, w, rng);

  const speakerAfter = outcome === "calmed" ? shift(sp.mood, -1) : sp.mood;
  const listenerAfter =
    outcome === "annoyed" ? shift(li.mood, 1) : outcome === "blow-up" ? shift(li.mood, 2) : li.mood;

  const people = s.people.map((p, i) =>
    i === speaker
      ? { ...p, mood: speakerAfter }
      : i === listener
        ? { ...p, mood: listenerAfter }
        : p,
  );
  const turn: Turn = {
    turn: s.turns.length + 1,
    speaker,
    listener,
    outcome,
    odds: probabilities(w),
    speakerMood: [sp.mood, speakerAfter],
    listenerMood: [li.mood, listenerAfter],
  };
  const worse = moods.indexOf(listenerAfter) > moods.indexOf(li.mood);
  const links = worse
    ? [
        ...s.links,
        { turn: turn.turn, parent: speaker, child: listener, from: li.mood, to: listenerAfter },
      ]
    : s.links;
  return { people, turns: [...s.turns, turn], links, done: null };
}

// The chain that led to `child`'s mood, root first: who worsened them last,
// who worsened that person before then, and so on. Only links before turn
// `upTo` count, so an unfinished conversation isn't shown early.
export function causeChain(links: readonly Link[], child: number, upTo = Infinity): Link[] {
  const chain: Link[] = [];
  let who = child;
  let before = upTo;
  for (;;) {
    const link = links.findLast((l) => l.child === who && l.turn < before);
    if (!link) return chain.reverse();
    chain.push(link);
    who = link.parent;
    before = link.turn;
  }
}

// Every mood change for person i before turn `upTo`, oldest first.
export type MoodChange = { turn: number; from: Mood; to: Mood; by: number; outcome: Outcome };

export function moodHistory(turns: readonly Turn[], i: number, upTo = Infinity): MoodChange[] {
  return turns.flatMap((t): MoodChange[] => {
    if (t.turn >= upTo) return [];
    const [from, to] =
      t.listener === i ? t.listenerMood : t.speaker === i ? t.speakerMood : [null, null];
    if (from === null || from === to) return [];
    return [
      { turn: t.turn, from, to, by: t.listener === i ? t.speaker : t.listener, outcome: t.outcome },
    ];
  });
}
