import { Grid, MapControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Fog, MOUSE, Vector3 } from "three";
import { useRef } from "react";
import { clampToFloor, type Controls } from "./camera.ts";
import WasdPan from "./wasd-pan.tsx";
import {
  cameraStart,
  floorColour,
  floorSize,
  maxPolarAngle,
  maxZoomDistance,
  minZoomDistance,
  skyColour,
} from "./world.ts";

const half = floorSize / 2;

// Fog that scales with zoom, so the floor's far edge always fades out but the
// spot the camera looks at stays clear.
function ZoomFog() {
  useFrame(({ scene, camera, controls }) => {
    if (!(scene.fog instanceof Fog)) return;
    if (!controls || !("target" in controls) || !(controls.target instanceof Vector3)) return;
    const distance = camera.position.distanceTo(controls.target);
    scene.fog.near = distance;
    scene.fog.far = distance * 2;
  });
  return null;
}

export default function TownScene() {
  const controls = useRef<Controls>(null);

  return (
    <Canvas shadows camera={{ position: cameraStart, fov: 45, far: 1000 }}>
      <color attach="background" args={[skyColour]} />
      <fog attach="fog" args={[skyColour, 100, 200]} />
      <ZoomFog />

      <ambientLight intensity={0.6} />
      <directionalLight
        castShadow
        position={[50, 100, 40]}
        intensity={1.6}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-far={300}
      />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[floorSize, floorSize]} />
        <meshStandardMaterial color={floorColour} />
      </mesh>

      <Grid
        position-y={0.01}
        args={[floorSize, floorSize]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#8fae86"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#6f8f67"
        fadeDistance={250}
        fadeStrength={1.5}
      />

      <MapControls
        ref={controls}
        makeDefault
        enableDamping
        minDistance={minZoomDistance}
        maxDistance={maxZoomDistance}
        maxPolarAngle={maxPolarAngle}
        // Left-drag pans, middle-drag rotates. Right-drag also rotates, since
        // trackpads have no middle button. Scroll zooms.
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.ROTATE, RIGHT: MOUSE.ROTATE }}
        onChange={() => {
          if (controls.current) clampToFloor(controls.current);
        }}
      />
      <WasdPan controls={controls} />
    </Canvas>
  );
}
