import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { AvatarErrorBoundary } from "./AvatarErrorBoundary";
import { AvatarModel } from "./AvatarModel";
import { PlaceholderAvatar } from "./PlaceholderAvatar";

/**
 * Conversational states the avatar can reflect. Wire these to the chat
 * lifecycle (e.g. "thinking" while waiting on the model, "speaking" while
 * tokens stream in).
 */
export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

interface ConciergeAvatarProps {
  /** Drives idle vs. thinking vs. speaking animation. Defaults to "idle". */
  state?: AvatarState;
  /** Tailwind sizing for the wrapper. Defaults to filling its parent. */
  className?: string;
  /** Allow drag-to-rotate. Off by default for an embedded concierge. */
  interactive?: boolean;
}

/**
 * 3D concierge avatar (ARIA).
 *
 * Renders a real .glb model when one is present at `public/models/aria.glb`
 * (see that folder's README), and falls back to an animated placeholder
 * figure while the model is missing or still loading — so the app always
 * builds and renders.
 */
export function ConciergeAvatar({
  state = "idle",
  className = "h-full w-full",
  interactive = false,
}: ConciergeAvatarProps) {
  return (
    <div className={className}>
      <Canvas
        // Transparent background so the avatar sits on any page surface.
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        camera={{ position: [0, 1.5, 2.6], fov: 30 }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 3]} intensity={1.3} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />

        <AvatarErrorBoundary fallback={<PlaceholderAvatar state={state} />}>
          <Suspense fallback={<PlaceholderAvatar state={state} loading />}>
            <AvatarModel state={state} />
          </Suspense>
        </AvatarErrorBoundary>

        {interactive && (
          <OrbitControls enablePan={false} enableZoom={false} />
        )}
      </Canvas>
    </div>
  );
}
