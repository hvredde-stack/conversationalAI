import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendered if the model fails to load (e.g. the .glb is missing). */
  fallback: ReactNode;
}

/**
 * Catches errors thrown while loading the .glb avatar — most commonly a
 * missing file — and renders the placeholder instead, so a missing model
 * never crashes the page.
 */
export class AvatarErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Intentionally quiet: a missing model is an expected state until the
    // .glb is installed. The placeholder avatar is shown in its place.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
