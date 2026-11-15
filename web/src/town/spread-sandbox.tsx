import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  causeChain,
  initialState,
  interactions,
  makeRng,
  moodHistory,
  moods,
  outcomes,
  probabilities,
  step,
  weights,
  type Mood,
  type Outcome,
  type Person,
  type SimState,
  type Turn,
} from "../spread/sim.ts";
import {
  chatting,
  inDisc,
  lifeStep,
  startLife,
  towards,
  yawTo,
  type Life,
  type Vec,
} from "../spread/life.ts";
import { archetypeLabel, archetypes, shapeFor, type Archetype } from "../visual/personality.ts";
import type { Object3D } from "three";
import CauseLinks from "./cause-links.tsx";
import { faceColour, type FaceStyle } from "./faces.ts";
import MoodActor, { type Pose } from "./mood-actor.tsx";
import ResidentDock from "./resident-dock.tsx";
import SandboxCanvas from "./sandbox-canvas.tsx";
import type { SandboxItem } from "./sandbox-rows.ts";

// Third sandbox (?spread): 10 happy residents and one angry one, who
// walks up to people and tries to make them angry. Each conversation's outcome
// is a weighted random pick from the listener's traits (src/spread/sim.ts).
// Between conversations everyone wanders and free pairs stop for a friendly
// chat (src/spread/life.ts); only the sim changes moods.
// The same sim also drives the town page, which swaps in a different layout
// (where everyone lives) and scenery.
// ponytail: a browser-side prototype; the real sim runs in Go and the UI only
// replays its log (CLAUDE.md rule 4).

const approach = 1.1; // how close the speaker stands to the listener
const seconds = { walk: 1, talk: 1.2, react: 1.3 };
const maxTurns = 60;

type Phase = "idle" | "walk" | "talk" | "react";
export type { Vec };

// Where everyone lives and what surrounds them.
export type SpreadLayout = {
  title: string;
  cameraStart: Vec;
  // Home spot for each of n people. Conversations happen on the side of the
  // listener's home facing the origin, so keep the space between homes clear.
  homes: (n: number) => Vec[];
  wanderRadius: number; // residents roam a disc this big around the origin
  scenery?: (people: Person[]) => ReactNode;
  grid?: boolean;
  shadowExtent?: number; // half-width of the area that casts sharp shadows
};

const moodFace: Record<Mood, FaceStyle> = {
  happy: "smile",
  neutral: "flat",
  upset: "frown",
  angry: "angry",
};

// The angry one (index 0) lives in the middle; everyone else on a circle around them.
const circle: SpreadLayout = {
  title: "Angry spreader",
  cameraStart: [0, 11, 14],
  homes: (n) =>
    Array.from({ length: n }, (_, i): Vec => {
      if (i === 0) return [0, 0, 0];
      const a = ((i - 1) / (n - 1)) * Math.PI * 2;
      return [4.5 * Math.sin(a), 0, 4.5 * Math.cos(a)];
    }),
  wanderRadius: 5.5,
};

type Stage = {
  position: Vec;
  yaw: number;
  mood: Mood;
  pose: Pose;
  talking: boolean;
  walking: boolean;
};

// Where each person stands and what they do right now, from town life, the
// sim state, the latest turn and the phase of its animation.
function stage(sim: SimState, turn: Turn | undefined, phase: Phase, life: Life): Stage[] {
  const out: Stage[] = sim.people.map((p, i) => {
    const w = life.people[i]!;
    const talking = chatting(life, i);
    return {
      position: w.pos,
      yaw: w.yaw,
      mood: p.mood,
      pose: w.walking ? "bounce" : talking ? "lean" : "idle",
      talking,
      walking: w.walking,
    };
  });
  if (!turn || phase === "idle") return out;

  const s = out[turn.speaker]!;
  const l = out[turn.listener]!;
  const lHome = life.people[turn.listener]!.pos;
  // Walk up to the listener from wherever the speaker is.
  const spot = towards(lHome, life.people[turn.speaker]!.pos, approach);
  s.position = spot;
  s.yaw = yawTo(spot, lHome);
  s.walking = phase === "walk";
  s.talking = l.talking = false;
  l.pose = s.pose = "idle";
  if (phase !== "walk") l.yaw = yawTo(lHome, spot);
  if (phase !== "react") {
    s.mood = turn.speakerMood[0];
    l.mood = turn.listenerMood[0];
  }

  if (phase === "walk") s.pose = "bounce";
  if (phase === "talk") {
    s.pose = s.mood === "angry" ? "shake" : "lean";
    s.talking = true;
  }
  if (phase === "react") {
    const react: Record<Outcome, () => void> = {
      shrug: () => {},
      avoid: () => {
        l.position = towards(lHome, spot, -1.3);
        l.yaw = yawTo(spot, lHome);
        l.pose = "bounce";
      },
      annoyed: () => {
        l.pose = "recoil";
      },
      "blow-up": () => {
        l.pose = "shake";
        l.talking = true;
      },
      calmed: () => {
        l.pose = "lean";
        l.talking = true;
        s.pose = "slump";
      },
    };
    react[turn.outcome]();
  }
  return out;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const who = (p: Person) =>
  `${p.fullName} (${archetypeLabel[p.archetype]}${p.variant ? `, ${p.variant.replace("-", " ")}` : ""})`;

export default function SpreadSandbox({ layout = circle }: { layout?: SpreadLayout }) {
  const [seed, setSeed] = useState(1);
  const [spreaderType, setSpreaderType] = useState<Archetype>("regular");
  // The RNG and the state it produced live together, so a restart replaces both.
  const [run, setRun] = useState(() => {
    const rng = makeRng(1);
    return { rng, sim: initialState("regular", rng) };
  });
  const sim = run.sim;
  const [phase, setPhase] = useState<Phase>("idle");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [contagion, setContagion] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const homes = layout.homes(sim.people.length);
  const [life, setLife] = useState(() => startLife(homes));
  const lifeRng = useRef(makeRng(2));

  const turn = sim.turns.at(-1);
  const opts = { contagion, maxTurns };

  function reset(nextSeed: number, type: Archetype = spreaderType) {
    const rng = makeRng(nextSeed);
    setSeed(nextSeed);
    setSpreaderType(type);
    setRun({ rng, sim: initialState(type, rng) });
    setPhase("idle");
    setSelected(null);
    lifeRng.current = makeRng(nextSeed + 1);
    setLife(startLife(homes));
  }

  function advance() {
    const next = step(sim, run.rng, opts);
    setRun({ ...run, sim: next });
    return next;
  }

  // Town life ticks about once a second, and keeps going after the sim ends.
  const lifeOn = playing || !!sim.done;
  const busy = new Set(turn && phase !== "idle" ? [turn.speaker, turn.listener] : []);
  useEffect(() => {
    if (!lifeOn) return;
    const id = setTimeout(() => {
      const rng = lifeRng.current;
      const wander = (i: number) => (rng() < 0.3 ? homes[i]! : inDisc(layout.wanderRadius, rng));
      setLife((l) => lifeStep(l, busy, wander, rng));
    }, 1000 / speed);
    return () => clearTimeout(id);
    // busy and homes follow from sim and phase; life covers the tick.
  }, [life, lifeOn, speed, sim, phase]); // oxlint-disable-line react-hooks/exhaustive-deps

  const stages = stage(sim, turn, phase, life);

  // Play loop: idle → (one conversation) → walk → talk → react → idle.
  useEffect(() => {
    if (!playing || sim.done) return;
    const wait = phase === "idle" ? 0.3 : seconds[phase];
    const id = setTimeout(
      () => {
        if (phase === "idle") {
          const next = advance();
          if (next.done) setPlaying(false);
          else setPhase("walk");
        } else if (phase === "react") {
          // Both stay where the conversation left them.
          setLife((l) => ({
            ...l,
            people: l.people.map((w, i) =>
              i === turn?.speaker || i === turn?.listener
                ? { ...w, pos: stages[i]!.position, yaw: stages[i]!.yaw }
                : w,
            ),
          }));
          setPhase("idle");
        } else setPhase(phase === "walk" ? "talk" : "react");
      },
      (wait * 1000) / speed,
    );
    return () => clearTimeout(id);
    // advance reads sim and opts from this render; sim and contagion cover them.
  }, [phase, playing, speed, sim, contagion]); // oxlint-disable-line react-hooks/exhaustive-deps

  const counts = Object.fromEntries(
    moods.map((m) => [m, stages.filter((s) => s.mood === m).length]),
  ) as Record<Mood, number>;
  const person = selected === null ? undefined : sim.people[selected];

  // The selected resident's past: mood changes, and the chain of people whose
  // bad moods led to theirs. A conversation still playing out doesn't count yet.
  const upTo = turn && (phase === "walk" || phase === "talk") ? turn.turn : Infinity;
  const chain = selected === null ? [] : causeChain(sim.links, selected, upTo);
  const inChain = new Set(chain.flatMap((l) => [l.parent, l.child]));
  const history = selected === null ? [] : moodHistory(sim.turns, selected, upTo);
  const anchors = useRef<(Object3D | null)[]>([]);
  const name = (i: number) => (
    <button type="button" className="link" onClick={() => setSelected(i)}>
      {sim.people[i]!.name}
    </button>
  );

  // The shared bottom-left dock shows the selected resident as they look now.
  const dockItem = (i: number | null | undefined): SandboxItem | undefined => {
    if (i === null || i === undefined) return undefined;
    const p = sim.people[i]!;
    const mood = stages[i]!.mood;
    return {
      id: String(i),
      name: who(p),
      shape: shapeFor[p.archetype],
      colour: faceColour[moodFace[mood]],
      face: moodFace[mood],
      scale: 1,
      animated: false,
      details: [["mood", mood], ...Object.entries(p.traits)],
    };
  };
  // Who the selected resident is talking to: their sim conversation, else their chat.
  const partnerOf = (i: number | null) => {
    if (i === null) return undefined;
    if (turn && phase !== "idle") {
      if (i === turn.speaker) return turn.listener;
      if (i === turn.listener) return turn.speaker;
    }
    return life.people[i]?.chat?.with;
  };

  return (
    <>
      <SandboxCanvas
        cameraStart={layout.cameraStart}
        grid={layout.grid}
        shadowExtent={layout.shadowExtent}
        onPointerMissed={() => setSelected(null)}
      >
        {layout.scenery?.(sim.people)}
        <CauseLinks links={chain} anchors={anchors} />
        {sim.people.map((p, i) => {
          const s = stages[i]!;
          return (
            <group
              key={p.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelected(i);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "";
              }}
            >
              <MoodActor
                shape={shapeFor[p.archetype]}
                face={moodFace[s.mood]}
                position={s.position}
                yaw={s.yaw}
                pose={s.pose}
                talking={s.talking}
                // Strolls are slower than walking up to someone.
                walkSpeed={(s.walking && !busy.has(i) ? 2 : 4) * speed}
              >
                {/* The one who started angry wears a red ring. */}
                {p.spreader && (
                  <mesh rotation-x={-Math.PI / 2} position-y={0.015}>
                    <ringGeometry args={[0.5, 0.58, 48]} />
                    <meshBasicMaterial color={faceColour.angry} />
                  </mesh>
                )}
                {/* Selected: white ring. Others in their cause chain: red ring. */}
                {(selected === i || inChain.has(i)) && (
                  <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
                    <ringGeometry args={[0.62, 0.72, 48]} />
                    <meshBasicMaterial color={selected === i ? "white" : faceColour.angry} />
                  </mesh>
                )}
                <group
                  ref={(g) => {
                    anchors.current[i] = g;
                  }}
                />
              </MoodActor>
            </group>
          );
        })}
      </SandboxCanvas>

      <aside className="sandbox-panel" aria-label="Simulation controls">
        <h2>{layout.title}</h2>
        <div className="controls">
          <button type="button" onClick={() => setPlaying(!playing)} disabled={!!sim.done}>
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            disabled={playing || !!sim.done}
            onClick={() => {
              advance();
              setPhase("react");
            }}
          >
            Step
          </button>
          <button type="button" onClick={() => reset(seed)}>
            Restart
          </button>
          <button type="button" onClick={() => reset(Math.floor(Math.random() * 1e6))}>
            New seed
          </button>
        </div>
        <label className="field">
          Speed{" "}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {[0.5, 1, 2, 4].map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {sim.people[0]!.name} (angry) is a{" "}
          <select value={spreaderType} onChange={(e) => reset(seed, e.target.value as Archetype)}>
            {archetypes.map((a) => (
              <option key={a} value={a}>
                {archetypeLabel[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <input type="checkbox" checked={contagion} onChange={() => setContagion(!contagion)} />{" "}
          Contagion: anyone angry spreads it too
        </label>
        <p className="muted">
          Seed {seed} · turn {sim.turns.length}
          {sim.done ? ` · ${sim.done}` : ""}
        </p>

        <ul className="tally" aria-label="Moods">
          {moods.map((m) => (
            <li key={m}>
              <span className="chip" style={{ background: faceColour[moodFace[m]] }} />
              {m} {counts[m]}
            </li>
          ))}
        </ul>

        {person && selected !== null ? (
          <>
            <h3>
              How {person.name} got {stages[selected]!.mood}
            </h3>
            {chain.length ? (
              <ol className="log">
                {chain.map((l) => (
                  <li key={l.turn}>
                    Turn {l.turn}: {name(l.parent)} → {name(l.child)}{" "}
                    <span className="muted">
                      ({l.from} → {l.to})
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                {person.spreader
                  ? "They started it: nobody made them angry."
                  : "Nobody has made their mood worse."}
              </p>
            )}

            <h3>Mood history</h3>
            <ol className="log">
              <li>Started {person.spreader ? "angry" : "happy"}</li>
              {history.map((h) => (
                <li key={h.turn}>
                  Turn {h.turn}: {h.from} → {h.to}, {interactions[h.outcome].label.toLowerCase()}{" "}
                  with {name(h.by)}
                </li>
              ))}
            </ol>

            <h3>If an angry resident confronts {person.name}</h3>
            <ul className="interactions">
              {(() => {
                const odds = probabilities(weights(person.traits, "angry"));
                return outcomes.map((o) => (
                  <li key={o}>
                    {interactions[o].label}: <strong>{pct(odds[o])}</strong>
                  </li>
                ));
              })()}
            </ul>
          </>
        ) : (
          <p className="hint">Click a resident to see their traits and odds.</p>
        )}

        <h3>Possible interactions</h3>
        <ul className="interactions">
          {outcomes.map((o) => (
            <li key={o}>
              <strong>{interactions[o].label}.</strong> {interactions[o].effect} More likely with{" "}
              {interactions[o].favouredBy}.{" "}
              <span className="muted">Weight: {interactions[o].weight}</span>
            </li>
          ))}
        </ul>
        <p className="muted">
          Levels count low 0, mid 1, high 2. Sociable residents are approached more often.
        </p>

        <h3>Log</h3>
        <ol className="log" reversed>
          {sim.turns
            .slice(-15)
            .reverse()
            .map((t) => {
              const shown = t === turn && phase !== "react" && phase !== "idle";
              return (
                <li key={t.turn} value={t.turn}>
                  {sim.people[t.speaker]!.name} → {who(sim.people[t.listener]!)}:{" "}
                  {shown ? (
                    "…"
                  ) : (
                    <>
                      <strong>{interactions[t.outcome].label}</strong>
                      {t.listenerMood[0] !== t.listenerMood[1] &&
                        ` (${t.listenerMood[0]} → ${t.listenerMood[1]})`}
                      {t.speakerMood[0] !== t.speakerMood[1] &&
                        ` (${sim.people[t.speaker]!.name}: ${t.speakerMood[0]} → ${t.speakerMood[1]})`}
                      <br />
                      <span className="muted">
                        {outcomes.map((o) => `${o} ${pct(t.odds[o])}`).join(" · ")}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
        </ol>
      </aside>

      <ResidentDock
        item={dockItem(selected)}
        partner={dockItem(partnerOf(selected))}
        onSelect={(id) => setSelected(Number(id))}
      />
    </>
  );
}
