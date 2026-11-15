import type { MapControls } from "@react-three/drei";
import type { ComponentRef } from "react";
import { floorSize } from "./world.ts";

export type Controls = ComponentRef<typeof MapControls>;

const half = floorSize / 2;

// Keep the orbit target over the floor. Moving the camera by the same amount
// preserves the view angle, so the clamp reads as hitting an edge, not a jump.
export function clampToFloor(controls: Controls) {
  const { target, object: camera } = controls;
  const dx = Math.min(half, Math.max(-half, target.x)) - target.x;
  const dz = Math.min(half, Math.max(-half, target.z)) - target.z;
  if (dx === 0 && dz === 0) return;
  target.x += dx;
  target.z += dz;
  camera.position.x += dx;
  camera.position.z += dz;
}
