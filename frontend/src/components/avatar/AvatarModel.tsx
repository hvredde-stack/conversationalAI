import { useEffect, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import type { Group } from "three";

import type { AvatarState } from "./ConciergeAvatar";

/**
 * Path to the rigged avatar model. Drop a .glb here — see
 * `public/models/README.md` for how to produce one.
 */
const MODEL_URL = "/models/aria.glb";

/**
 * Maps a conversational state to an animation clip name inside the .glb.
 * Rename the right-hand values to match the clips your exported model
 * actually ships with (check them in https://gltf.report or Blender).
 */
const STATE_TO_CLIP: Record<AvatarState, string> = {
  idle: "Idle",
  listening: "Idle",
  thinking: "Thinking",
  speaking: "Talking",
};

/**
 * Loads and renders the real .glb avatar, cross-fading between animation
 * clips as the conversational `state` changes. If the file is absent this
 * throws during load and `AvatarErrorBoundary` swaps in the placeholder.
 */
export function AvatarModel({ state }: { state: AvatarState }) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // Prefer the clip mapped to this state; fall back to the first clip.
    const clip = STATE_TO_CLIP[state];
    const action = actions[clip] ?? Object.values(actions)[0];
    action?.reset().fadeIn(0.3).play();
    return () => {
      action?.fadeOut(0.3);
    };
  }, [actions, state]);

  return (
    <group ref={group} position={[0, -1.5, 0]}>
      <primitive object={scene} />
    </group>
  );
}
