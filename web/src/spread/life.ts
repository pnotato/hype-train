import { pickWeighted, type Rng } from "./sim.ts";
import type { Level } from "./traits.ts";

// Town life between the sim's conversations: residents wander, and free pairs
// meet for a friendly chat that changes nobody's mood, and anyone free may stop
// to check their phone instead (introverts more often). Pure and seeded; one
// call is one tick (about a second). Moods only ever change in sim.ts.
// ponytail: ambience in the browser prototype; once the Go sim exists, who
// meets whom belongs in the RunLog (CLAUDE.md rule 4).

export type Vec = [number, number, number];

export type Chat = { with: number; start: number; until: number; first: boolean };

export type Wanderer = {
  pos: Vec;
  yaw: number;
  walking: boolean;
  chat: Chat | null;
  phone: number | null; // on their phone until this tick
};

export type Life = { tick: number; people: Wanderer[] };

export function towards(from: Vec, to: Vec, dist: number): Vec {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz) || 1;
  return [from[0] + (dx / len) * dist, 0, from[2] + (dz / len) * dist];
}

export const yawTo = (from: Vec, to: Vec) => Math.atan2(to[0] - from[0], to[2] - from[2]);

const wanderChance = 0.25; // per free resident per tick
const chatChance = 0.35; // per tick, that one new pair meets
const chatGap = 0.55; // each side's distance from the meeting point
const chatTicks = [4, 7]; // how long a chat lasts, min and max
const phoneTicks = [3, 6]; // how long a phone check lasts, min and max

// Per free resident per tick: the chance they pull out their phone, and how
// keen they are to be picked for a chat. Introverts (low sociability) reach for
// the phone far more often and are rarely the ones who start talking.
export const phoneChance: Record<Level, number> = { low: 0.3, mid: 0.1, high: 0.03 };
const chatPull: Record<Level, number> = { low: 0.3, mid: 1, high: 2 };

const between = ([lo, hi]: number[], rng: Rng) => lo! + Math.floor(rng() * (hi! - lo! + 1));

export const startLife = (homes: Vec[]): Life => ({
  tick: 0,
  people: homes.map((pos) => ({ pos, yaw: 0, walking: false, chat: null, phone: null })),
});

// Is this resident talking in their chat right now? Partners take turns,
// starting the tick after they meet (the first tick is the walk over).
export function chatting(life: Life, i: number) {
  const c = life.people[i]?.chat;
  if (!c || life.tick === c.start) return false;
  return (life.tick - c.start) % 2 === (c.first ? 1 : 0);
}

// One tick. `busy` residents are in a sim conversation and hold still (and
// put their phone away). `wander` picks a new spot for resident i.
export function lifeStep(
  life: Life,
  busy: ReadonlySet<number>,
  wander: (i: number) => Vec,
  sociability: (i: number) => Level,
  rng: Rng,
): Life {
  const tick = life.tick + 1;
  const people = life.people.map((w, i): Wanderer => {
    const still = { ...w, walking: false };
    if (busy.has(i)) return { ...still, chat: null, phone: null };
    if (w.chat && tick < w.chat.until && !busy.has(w.chat.with)) return still;
    if (w.phone !== null && tick < w.phone) return still;
    const idle = { ...still, chat: null, phone: null };
    if (rng() < phoneChance[sociability(i)])
      return { ...idle, phone: tick + between(phoneTicks, rng) };
    if (rng() >= wanderChance) return idle;
    const pos = wander(i);
    return { ...idle, pos, yaw: yawTo(w.pos, pos), walking: true };
  });

  // Anyone not busy, chatting or on their phone can meet; sociable ones get picked more.
  const free = people
    .map((_, i) => i)
    .filter((i) => !busy.has(i) && !people[i]!.chat && people[i]!.phone === null);
  const pick = () => {
    const w = Object.fromEntries(free.map((i) => [i, chatPull[sociability(i)]]));
    const i = Number(pickWeighted(free.map(String), w, rng));
    free.splice(free.indexOf(i), 1);
    return i;
  };
  if (free.length >= 2 && rng() < chatChance) {
    const a = pick();
    const b = pick();
    const pa = people[a]!.pos;
    const pb = people[b]!.pos;
    const mid: Vec = [(pa[0] + pb[0]) / 2, 0, (pa[2] + pb[2]) / 2];
    const until = tick + between(chatTicks, rng);
    const meet = (me: number, other: number, from: Vec, first: boolean) => {
      const pos = towards(mid, from, chatGap);
      const otherPos = towards(mid, people[other]!.pos, chatGap);
      people[me] = {
        pos,
        yaw: yawTo(pos, otherPos),
        walking: true,
        chat: { with: other, start: tick, until, first },
        phone: null,
      };
    };
    meet(a, b, pa, true);
    meet(b, a, pb, false);
  }
  return { tick, people };
}

// Random point in a disc of radius r around the origin, evenly spread.
export function inDisc(r: number, rng: Rng): Vec {
  const d = r * Math.sqrt(rng());
  const a = rng() * Math.PI * 2;
  return [d * Math.sin(a), 0, d * Math.cos(a)];
}
