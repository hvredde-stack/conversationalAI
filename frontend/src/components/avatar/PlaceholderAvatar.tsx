import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

import type { AvatarState } from "./ConciergeAvatar";

/** The "AI accent" glow shifts with the conversational state. */
const ACCENT: Record<AvatarState, string> = {
  idle: "#4FC3F7", // light blue
  listening: "#4FC3F7",
  thinking: "#D4AF37", // gold
  speaking: "#4FC3F7",
};

const SKIN = "#f1c9a5";
const HAIR = "#2e2018";
const SUIT = "#1b263b"; // navy
const SHIRT = "#f7f7f7";
const BLUSH = "#e8a07e";
const MOUTH = "#7a4a3a";

/**
 * A friendly, cartoon-style 3D character shown while no real .glb avatar is
 * installed (or while one is loading): a round face with hair, big eyes that
 * blink and glance around, rosy cheeks, a smile, and a navy concierge suit.
 * Its glowing "smart badge" reflects the conversational state.
 *
 * This is procedural geometry — a stand-in. For a production-grade avatar,
 * install a modelled .glb (see public/models/README.md).
 */
export function PlaceholderAvatar({
  state = "idle",
  loading = false,
}: {
  state?: AvatarState;
  loading?: boolean;
}) {
  const group = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const pupils = useRef<Group>(null);
  const accent = ACCENT[state];

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (group.current) {
      // Idle breathing bob + a gentle look-around sway.
      group.current.position.y = Math.sin(t * 1.4) * 0.04;
      group.current.rotation.y = loading ? t * 0.8 : Math.sin(t * 0.5) * 0.22;
    }
    if (eyes.current) {
      // Blink: a quick vertical squash near the end of every ~4s cycle.
      eyes.current.scale.y = t % 4 > 3.85 ? 0.12 : 1;
    }
    if (pupils.current) {
      // Pupils drift so the gaze feels alive.
      pupils.current.position.x = Math.sin(t * 0.7) * 0.035;
      pupils.current.position.y = Math.sin(t * 1.1) * 0.02;
    }
  });

  return (
    <group ref={group}>
      {/* shoulders / suit */}
      <mesh position={[0, -0.62, 0]}>
        <capsuleGeometry args={[0.4, 0.5, 8, 24]} />
        <meshStandardMaterial color={SUIT} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* shirt collar */}
      <mesh position={[0, -0.18, 0.12]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial color={SHIRT} roughness={0.5} />
      </mesh>

      {/* head */}
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.5, 48, 48]} />
        <meshStandardMaterial color={SKIN} roughness={0.55} metalness={0.02} />
      </mesh>
      {/* hair */}
      <mesh position={[0, 0.6, -0.06]} scale={[1.06, 0.92, 1.04]}>
        <sphereGeometry args={[0.5, 40, 40]} />
        <meshStandardMaterial color={HAIR} roughness={0.75} />
      </mesh>

      {/* eyes — the group is squashed vertically to blink */}
      <group ref={eyes} position={[0, 0.45, 0]}>
        <mesh position={[-0.17, 0, 0.4]}>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshStandardMaterial color="#ffffff" roughness={0.25} />
        </mesh>
        <mesh position={[0.17, 0, 0.4]}>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshStandardMaterial color="#ffffff" roughness={0.25} />
        </mesh>
        {/* pupils — drift inside the eyes for a living gaze */}
        <group ref={pupils}>
          <mesh position={[-0.17, 0, 0.47]}>
            <sphereGeometry args={[0.05, 20, 20]} />
            <meshStandardMaterial color="#241c2e" roughness={0.2} />
          </mesh>
          <mesh position={[0.17, 0, 0.47]}>
            <sphereGeometry args={[0.05, 20, 20]} />
            <meshStandardMaterial color="#241c2e" roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* cheeks */}
      <mesh position={[-0.3, 0.3, 0.34]} scale={[1, 1, 0.4]}>
        <sphereGeometry args={[0.075, 20, 20]} />
        <meshStandardMaterial color={BLUSH} roughness={0.8} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0.3, 0.3, 0.34]} scale={[1, 1, 0.4]}>
        <sphereGeometry args={[0.075, 20, 20]} />
        <meshStandardMaterial color={BLUSH} roughness={0.8} transparent opacity={0.55} />
      </mesh>

      {/* smile — a half-torus, opening upward */}
      <mesh position={[0, 0.26, 0.44]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.15, 0.032, 16, 32, Math.PI]} />
        <meshStandardMaterial color={MOUTH} roughness={0.5} />
      </mesh>

      {/* AI accent — the glowing "smart badge" cue */}
      <mesh position={[0.16, -0.12, 0.3]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
