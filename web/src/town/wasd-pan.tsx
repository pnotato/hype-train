import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { Vector3 } from "three";
import { clampToFloor, type Controls } from "./camera.ts";
import { panSpeed } from "./world.ts";

const keys = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);
const up = new Vector3(0, 1, 0);
const forward = new Vector3();
const right = new Vector3();
const move = new Vector3();

// WASD slides the camera across the floor, relative to the way it faces.
// Speed scales with zoom so it feels the same close up and far out.
export default function WasdPan({ controls }: { controls: RefObject<Controls | null> }) {
  const held = useRef(new Set<string>());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!keys.has(e.code) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      held.current.add(e.code);
    };
    const release = (e: KeyboardEvent) => held.current.delete(e.code);
    const clear = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", clear);
    };
  }, []);

  useFrame((_, delta) => {
    const c = controls.current;
    const k = held.current;
    if (!c || k.size === 0) return;

    c.object.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, up);

    move.set(0, 0, 0);
    if (k.has("KeyW")) move.add(forward);
    if (k.has("KeyS")) move.sub(forward);
    if (k.has("KeyD")) move.add(right);
    if (k.has("KeyA")) move.sub(right);
    if (move.lengthSq() === 0) return;

    const distance = c.object.position.distanceTo(c.target);
    move.normalize().multiplyScalar(distance * panSpeed * Math.min(delta, 0.1));
    c.target.add(move);
    c.object.position.add(move);
    clampToFloor(c);
    c.update();
  });

  return null;
}
