import type { Rng } from "./sim.ts";

// Town life between the sim's conversations: residents wander, and free pairs
// meet for a friendly chat that changes nobody's mood. Pure and seeded; one
// call is one tick (about a second). Moods only ever change in sim.ts.
// ponytail: ambience in the browser prototype; once the Go sim exists, who
// meets whom belongs in the RunLog (CLAUDE.md rule 4).

export type Vec = [number, number, number];

export type Chat = { with: number; start: number; until: number; first: boolean };

export type Wanderer = { pos: Vec; yaw: number; walking: boolean; chat: Chat | null };

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

export const startLife = (homes: Vec[]): Life => ({
  tick: 0,
  people: homes.map((pos) => ({ pos, yaw: 0, walking: false, chat: null })),
});

// Is this resident talking in their chat right now? Partners take turns,
// starting the tick after they meet (the first tick is the walk over).
export function chatting(life: Life, i: number) {
  const c = life.people[i]?.chat;
  if (!c || life.tick === c.start) return false;
  return (life.tick - c.start) % 2 === (c.first ? 1 : 0);
}

// One tick. `busy` residents are in a sim conversation and hold still.
// `wander` picks a new spot for resident i.
export function lifeStep(
  life: Life,
  busy: ReadonlySet<number>,
  wander: (i: number) => Vec,
  rng: Rng,
): Life {
  const tick = life.tick + 1;
  const people = life.people.map((w, i): Wanderer => {
    if (busy.has(i)) return { ...w, walking: false, chat: null };
    if (w.chat && tick < w.chat.until && !busy.has(w.chat.with)) return { ...w, walking: false };
    if (rng() >= wanderChance) return { ...w, walking: false, chat: null };
    const pos = wander(i);
    return { pos, yaw: yawTo(w.pos, pos), walking: true, chat: null };
  });

  const free = people.map((_, i) => i).filter((i) => !busy.has(i) && !people[i]!.chat);
  if (free.length >= 2 && rng() < chatChance) {
    const a = free.splice(Math.floor(rng() * free.length), 1)[0]!;
    const b = free[Math.floor(rng() * free.length)]!;
    const pa = people[a]!.pos;
    const pb = people[b]!.pos;
    const mid: Vec = [(pa[0] + pb[0]) / 2, 0, (pa[2] + pb[2]) / 2];
    const until = tick + chatTicks[0]! + Math.floor(rng() * (chatTicks[1]! - chatTicks[0]! + 1));
    const meet = (me: number, other: number, from: Vec, first: boolean) => {
      const pos = towards(mid, from, chatGap);
      const otherPos = towards(mid, people[other]!.pos, chatGap);
      people[me] = {
        pos,
        yaw: yawTo(pos, otherPos),
        walking: true,
        chat: { with: other, start: tick, until, first },
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
