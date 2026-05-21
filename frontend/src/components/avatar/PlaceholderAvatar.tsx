import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

import type { AvatarState } from "./ConciergeAvatar";

/** ARIA brand palette — the "AI accent" glow shifts with the state. */
const ACCENT: Record<AvatarState, string> = {
  idle: "#4FC3F7", // light blue
  listening: "#4FC3F7",
  thinking: "#D4AF37", // gold
  speaking: "#4FC3F7",
};

const SUIT = "#1B263B"; // navy
const SHIRT = "#F7F7F7"; // off-white

/**
 * A lightweight 3D stand-in shown while no real .glb avatar is installed
 * (or while one is loading). Gently bobs and sways, and its accent glow
 * reflects the conversational state — so the scene is never empty.
 */
export function PlaceholderAvatar({
  state = "idle",
  loading = false,
}: {
  state?: AvatarState;
  loading?: boolean;
}) {
  const group = useRef<Group>(null);
  const accent = ACCENT[state];

  useFrame((s) => {
    if (!group.current) return;
    const t = s.clock.elapsedTime;
    // Idle breathing + a subtle look-around sway.
    group.current.position.y = -1.05 + Math.sin(t * 1.4) * 0.04;
    group.current.rotation.y = Math.sin(t * 0.5) * 0.25;
    // Spin a touch faster while loading, as a "working" cue.
    if (loading) group.current.rotation.y = t * 0.8;
  });

  return (
    <group ref={group}>
      {/* head */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color={SHIRT} roughness={0.5} metalness={0.05} />
      </mesh>
      {/* torso / suit */}
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.34, 0.78, 8, 24]} />
        <meshStandardMaterial color={SUIT} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* AI accent — the glowing "smart badge" cue */}
      <mesh position={[0.18, 0.42, 0.3]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
