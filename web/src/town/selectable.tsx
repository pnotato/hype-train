import type { ReactNode } from "react";

// Wraps a character so clicking it selects it: pointer cursor on hover and a
// white ring on the floor while selected.

type Props = {
  position: [number, number, number];
  ringRadius?: number;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
};

export default function Selectable({
  position,
  ringRadius = 0.6,
  selected,
  onSelect,
  children,
}: Props) {
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      {children}
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[ringRadius, ringRadius + 0.1, 48]} />
          <meshBasicMaterial color="white" />
        </mesh>
      )}
    </group>
  );
}
