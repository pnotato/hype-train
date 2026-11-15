import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import AnimatedResident from "./animated-resident.tsx";
import Resident from "./resident.tsx";
import ResidentDock from "./resident-dock.tsx";
import ScenarioView from "./scenario-view.tsx";
import { faceColour, type FaceStyle } from "./faces.ts";
import { scenarios, type Beat, type Scenario } from "./scenarios.ts";
import { actorId, actorItems, rows, type SandboxItem } from "./sandbox-rows.ts";
import SandboxCanvas from "./sandbox-canvas.tsx";
import Selectable from "./selectable.tsx";

// Sandbox: a copy of the town scene to judge the looks up close. One row per
// entry in sandbox-rows.ts, first row nearest the camera. The panel toggles
// rows and characters; clicking a character shows it in the bottom dock. Two looping
// scenarios (scenarios.ts) play in front. Open with ?shapes.
const spacing = 1.8;
const rowSpacing = 2.6;
const cameraStart: [number, number, number] = [0, 12, 19];

const x = (i: number, n: number) => (i - (n - 1) / 2) * spacing;
const z = (r: number) => ((rows.length - 1) / 2 - r) * rowSpacing;

// Scenarios sit in front of the first row, side by side.
const scenarioZ = z(0) + rowSpacing * 1.3;
const scenarioX = (i: number) => (i - (scenarios.length - 1) / 2) * 5;

const allItems = [...rows.flatMap((r) => r.items), ...actorItems];
const itemById = (id: string | null | undefined) => allItems.find((i) => i.id === id);

type CharacterProps = {
  item: SandboxItem;
  position: [number, number, number];
  selected: boolean;
  onSelect: () => void;
};

function Character({ item, position, selected, onSelect }: CharacterProps) {
  const look = { shape: item.shape, colour: item.colour, face: item.face };
  return (
    <Selectable
      position={position}
      ringRadius={0.6 * item.scale}
      selected={selected}
      onSelect={onSelect}
    >
      <group scale={item.scale}>
        {item.animated ? <AnimatedResident {...look} /> : <Resident {...look} />}
      </group>
    </Selectable>
  );
}

function toggle(set: Dispatch<SetStateAction<Set<string>>>, id: string) {
  set((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });
}

export default function ShapeSandbox() {
  const [hiddenRows, setHiddenRows] = useState(() => new Set<string>());
  const [hiddenItems, setHiddenItems] = useState(() => new Set<string>());
  const [selected, setSelected] = useState<string | null>(null);
  // Scenario actors' current faces, so the portrait shows what the scene shows.
  const [liveFaces, setLiveFaces] = useState<Record<string, FaceStyle>>({});
  const onBeat = useCallback(
    (sc: Scenario, beat: Beat) =>
      setLiveFaces((prev) => ({
        ...prev,
        [actorId(sc, "a")]: beat.a.face,
        [actorId(sc, "b")]: beat.b.face,
      })),
    [],
  );
  const live = (item: SandboxItem | undefined) => {
    const face = item && liveFaces[item.id];
    return face ? { ...item, face, colour: faceColour[face] } : item;
  };
  const selectedItem = live(itemById(selected));

  return (
    <>
      <SandboxCanvas cameraStart={cameraStart} onPointerMissed={() => setSelected(null)}>
        {rows.map((row, r) =>
          hiddenRows.has(row.id)
            ? null
            : row.items.map((item, i) =>
                hiddenItems.has(item.id) ? null : (
                  <Character
                    key={item.id}
                    item={item}
                    position={[x(i, row.items.length), 0, z(r)]}
                    selected={item.id === selected}
                    onSelect={() => setSelected(item.id)}
                  />
                ),
              ),
        )}
        {!hiddenRows.has("scenarios") &&
          scenarios.map((sc, i) =>
            hiddenItems.has(sc.id) ? null : (
              <ScenarioView
                key={sc.id}
                scenario={sc}
                position={[scenarioX(i), 0, scenarioZ]}
                selected={selected}
                onSelect={setSelected}
                onBeat={onBeat}
              />
            ),
          )}
      </SandboxCanvas>

      <aside className="sandbox-panel" aria-label="Sandbox controls">
        {!selectedItem && <p className="hint">Click a character to see its traits.</p>}

        <fieldset>
          <legend>
            <label>
              <input
                type="checkbox"
                checked={!hiddenRows.has("scenarios")}
                onChange={() => toggle(setHiddenRows, "scenarios")}
              />{" "}
              Scenarios (looping)
            </label>
          </legend>
          <ul>
            {scenarios.map((sc) => (
              <li key={sc.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!hiddenItems.has(sc.id)}
                    disabled={hiddenRows.has("scenarios")}
                    onChange={() => toggle(setHiddenItems, sc.id)}
                  />{" "}
                  {sc.label}
                </label>
                {(["a", "b"] as const).map((side) => {
                  const id = actorId(sc, side);
                  return (
                    <button
                      key={side}
                      type="button"
                      aria-pressed={id === selected}
                      onClick={() => setSelected(id)}
                    >
                      {itemById(id)?.name}
                    </button>
                  );
                })}
              </li>
            ))}
          </ul>
        </fieldset>

        {rows.map((row) => {
          const rowHidden = hiddenRows.has(row.id);
          return (
            <fieldset key={row.id}>
              <legend>
                <label>
                  <input
                    type="checkbox"
                    checked={!rowHidden}
                    onChange={() => toggle(setHiddenRows, row.id)}
                  />{" "}
                  {row.label}
                </label>
              </legend>
              <ul>
                {row.items.map((item) => (
                  <li key={item.id}>
                    <input
                      type="checkbox"
                      aria-label={`Show ${item.name} (${row.label})`}
                      checked={!hiddenItems.has(item.id)}
                      disabled={rowHidden}
                      onChange={() => toggle(setHiddenItems, item.id)}
                    />
                    <button
                      type="button"
                      aria-pressed={item.id === selected}
                      onClick={() => setSelected(item.id)}
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </aside>

      <ResidentDock
        item={selectedItem}
        partner={live(itemById(selectedItem?.talkingTo))}
        onSelect={setSelected}
      />
    </>
  );
}
