import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
export type ConnectivityMode = 'fleet' | 'satellite' | 'stream';

export type TransitionPhase = 'idle' | 'exiting' | 'revealing' | 'wiring' | 'flowing';

export type ConnectivityTransition = {
  phase: TransitionPhase;
  progress: number;
  starlinkVisible: boolean;
  starlinkDenseMesh: boolean;
  ringOpacity: number;
  meshOpacity: number;
  downlinkOpacity: number;
  surfaceArcScale: number;
  remoteNodeOpacity: number;
  canEmitOutbound: boolean;
  canEmitInbound: boolean;
  canEmitSatellite: boolean;
  canEmitFieldReturns: boolean;
  satScale: (shellIndex: number, satIndex: number, shellCount: number) => number;
  meshLinkOpacity: (linkIndex: number, totalLinks: number) => number;
};

const SETTLED_FLEET: ConnectivityTransition = {
  phase: 'flowing',
  progress: 1,
  starlinkVisible: false,
  starlinkDenseMesh: false,
  ringOpacity: 0,
  meshOpacity: 0,
  downlinkOpacity: 0,
  surfaceArcScale: 1,
  remoteNodeOpacity: 0,
  canEmitOutbound: true,
  canEmitInbound: false,
  canEmitSatellite: false,
  canEmitFieldReturns: false,
  satScale: () => 0,
  meshLinkOpacity: () => 0,
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function transitionKey(from: ConnectivityMode, to: ConnectivityMode): string {
  return `${from}->${to}`;
}

const DURATION_MS: Record<string, number> = {
  'fleet->satellite': 1300,
  'satellite->stream': 1000,
  'stream->satellite': 800,
  'satellite->fleet': 900,
  'fleet->stream': 1100,
  'stream->fleet': 1000,
};

function durationFor(from: ConnectivityMode, to: ConnectivityMode): number {
  return DURATION_MS[transitionKey(from, to)] ?? 1000;
}

function satRevealProgress(
  t: number,
  shellIndex: number,
  satIndex: number,
  shellCount: number,
  shellCountTotal: number,
): number {
  const shellStart = 0.18 + shellIndex * (0.28 / shellCountTotal);
  const satOffset = (satIndex / shellCount) * 0.07;
  const start = shellStart + satOffset;
  return smoothstep(start, start + 0.055, t);
}

function computeTransition(
  from: ConnectivityMode,
  to: ConnectivityMode,
  t: number,
): ConnectivityTransition {
  const key = transitionKey(from, to);
  const phase: TransitionPhase =
    t < 0.12 ? 'exiting' : t < 0.52 ? 'revealing' : t < 0.82 ? 'wiring' : 'flowing';

  const satScale = (shellIndex: number, satIndex: number, shellCount: number) => {
    if (to === 'fleet') return smoothstep(0.88, 1, 1 - t);
    if (to === 'satellite' || to === 'stream') {
      if (from === 'fleet' || from === 'satellite') {
        return satRevealProgress(t, shellIndex, satIndex, shellCount, 3);
      }
      return 1;
    }
    return 0;
  };

  const meshLinkOpacity = (linkIndex: number, totalLinks: number) => {
    const stagger = (linkIndex / Math.max(1, totalLinks)) * 0.12;
    const start = 0.5 + stagger;
    if (to === 'fleet') {
      const fade = 1 - smoothstep(0.1, 0.35, t);
      return 0.1 * fade;
    }
    if (to === 'satellite' || to === 'stream') {
      return smoothstep(start, start + 0.1, t) * (to === 'stream' ? 0.22 : 0.1);
    }
    return 0;
  };

  // --- fleet → satellite ---
  if (key === 'fleet->satellite') {
    const ringOpacity = smoothstep(0.38, 0.58, t) * 0.22;
    const meshOpacity = smoothstep(0.52, 0.72, t) * 0.1;
    const downlinkOpacity = smoothstep(0.62, 0.8, t) * 0.5;
    return {
      phase,
      progress: t,
      starlinkVisible: t > 0.14,
      starlinkDenseMesh: false,
      ringOpacity,
      meshOpacity,
      downlinkOpacity,
      surfaceArcScale: lerp(1, 0.12, smoothstep(0.1, 0.45, t)),
      remoteNodeOpacity: smoothstep(0.55, 0.72, t),
      canEmitOutbound: false,
      canEmitInbound: false,
      canEmitSatellite: t >= 0.82,
      canEmitFieldReturns: false,
      satScale,
      meshLinkOpacity,
    };
  }

  // --- satellite → stream ---
  if (key === 'satellite->stream') {
    const meshOpacity = lerp(0.1, 0.22, smoothstep(0.15, 0.45, t));
    const downlinkOpacity = lerp(0.5, 0.55, smoothstep(0.4, 0.65, t));
    return {
      phase,
      progress: t,
      starlinkVisible: true,
      starlinkDenseMesh: smoothstep(0.2, 0.55, t) > 0.5,
      ringOpacity: 0.22,
      meshOpacity,
      downlinkOpacity,
      surfaceArcScale: lerp(0.12, 1, smoothstep(0.18, 0.5, t)),
      remoteNodeOpacity: 1,
      canEmitOutbound: t >= 0.68,
      canEmitInbound: t >= 0.84,
      canEmitSatellite: t >= 0.55,
      canEmitFieldReturns: t >= 0.86,
      satScale: () => 1,
      meshLinkOpacity: (i, total) => lerp(0.1, 0.22, smoothstep(0.2 + (i / total) * 0.15, 0.55, t)),
    };
  }

  // --- stream → satellite ---
  if (key === 'stream->satellite') {
    return {
      phase,
      progress: t,
      starlinkVisible: true,
      starlinkDenseMesh: smoothstep(0.1, 0.4, t) < 0.5,
      ringOpacity: 0.22,
      meshOpacity: lerp(0.22, 0.1, smoothstep(0.1, 0.45, t)),
      downlinkOpacity: 0.5,
      surfaceArcScale: lerp(1, 0.12, smoothstep(0.1, 0.5, t)),
      remoteNodeOpacity: 1,
      canEmitOutbound: false,
      canEmitInbound: false,
      canEmitFieldReturns: false,
      canEmitSatellite: t >= 0.7,
      satScale: () => 1,
      meshLinkOpacity: () => lerp(0.22, 0.1, smoothstep(0.1, 0.45, t)),
    };
  }

  // --- satellite → fleet ---
  if (key === 'satellite->fleet') {
    const starlinkFade = 1 - smoothstep(0.12, 0.55, t);
    return {
      phase,
      progress: t,
      starlinkVisible: starlinkFade > 0.02,
      starlinkDenseMesh: false,
      ringOpacity: 0.22 * starlinkFade,
      meshOpacity: 0.1 * starlinkFade,
      downlinkOpacity: 0.5 * (1 - smoothstep(0.05, 0.25, t)),
      surfaceArcScale: lerp(0.12, 1, smoothstep(0.35, 0.7, t)),
      remoteNodeOpacity: 1 - smoothstep(0.1, 0.35, t),
      canEmitOutbound: t >= 0.72,
      canEmitInbound: false,
      canEmitSatellite: t < 0.2,
      canEmitFieldReturns: false,
      satScale: (si, satI, sc) => satRevealProgress(1 - t, si, satI, sc, 3),
      meshLinkOpacity: () => 0.1 * starlinkFade,
    };
  }

  // --- fleet → stream (skip satellite visually but fast constellation) ---
  if (key === 'fleet->stream') {
    const ringOpacity = smoothstep(0.25, 0.5, t) * 0.22;
    const meshOpacity = smoothstep(0.4, 0.65, t) * 0.22;
    const downlinkOpacity = smoothstep(0.55, 0.75, t) * 0.55;
    return {
      phase,
      progress: t,
      starlinkVisible: t > 0.12,
      starlinkDenseMesh: smoothstep(0.45, 0.7, t) > 0.4,
      ringOpacity,
      meshOpacity,
      downlinkOpacity,
      surfaceArcScale: lerp(1, 1, t),
      remoteNodeOpacity: smoothstep(0.5, 0.7, t),
      canEmitOutbound: t >= 0.72,
      canEmitInbound: t >= 0.86,
      canEmitSatellite: t >= 0.78,
      canEmitFieldReturns: t >= 0.88,
      satScale,
      meshLinkOpacity,
    };
  }

  // --- stream → fleet ---
  if (key === 'stream->fleet') {
    const starlinkFade = 1 - smoothstep(0.08, 0.45, t);
    return {
      phase,
      progress: t,
      starlinkVisible: starlinkFade > 0.02,
      starlinkDenseMesh: starlinkFade > 0.5,
      ringOpacity: 0.22 * starlinkFade,
      meshOpacity: 0.22 * starlinkFade,
      downlinkOpacity: 0.55 * (1 - smoothstep(0.05, 0.2, t)),
      surfaceArcScale: 1,
      remoteNodeOpacity: 1 - smoothstep(0.05, 0.3, t),
      canEmitOutbound: t >= 0.65,
      canEmitInbound: false,
      canEmitSatellite: false,
      canEmitFieldReturns: false,
      satScale: (si, satI, sc) => satRevealProgress(1 - t, si, satI, sc, 3),
      meshLinkOpacity: () => 0.22 * starlinkFade,
    };
  }

  // settled per mode (t = 1)
  return settledFor(to);
}

function settledFor(mode: ConnectivityMode): ConnectivityTransition {
  if (mode === 'fleet') return SETTLED_FLEET;
  if (mode === 'satellite') {
    return {
      phase: 'flowing',
      progress: 1,
      starlinkVisible: true,
      starlinkDenseMesh: false,
      ringOpacity: 0.22,
      meshOpacity: 0.1,
      downlinkOpacity: 0.5,
      surfaceArcScale: 0.12,
      remoteNodeOpacity: 1,
      canEmitOutbound: false,
      canEmitInbound: false,
      canEmitSatellite: true,
      canEmitFieldReturns: false,
      satScale: () => 1,
      meshLinkOpacity: () => 0.1,
    };
  }
  return {
    phase: 'flowing',
    progress: 1,
    starlinkVisible: true,
    starlinkDenseMesh: true,
    ringOpacity: 0.22,
    meshOpacity: 0.22,
    downlinkOpacity: 0.55,
    surfaceArcScale: 1,
    remoteNodeOpacity: 1,
    canEmitOutbound: true,
    canEmitInbound: true,
    canEmitSatellite: true,
    canEmitFieldReturns: true,
    satScale: () => 1,
    meshLinkOpacity: () => 0.22,
  };
}

export function useConnectivityTransition(
  mode: ConnectivityMode,
  animate: boolean,
): ConnectivityTransition {
  const [transition, setTransition] = useState<ConnectivityTransition>(() => settledFor(mode));
  const modeRef = useRef(mode);
  const fromRef = useRef(mode);
  const tRef = useRef(1);
  const transitioningRef = useRef(false);

  useEffect(() => {
    if (modeRef.current !== mode) {
      fromRef.current = modeRef.current;
      modeRef.current = mode;
      tRef.current = 0;
      transitioningRef.current = true;
    }
  }, [mode]);

  useFrame((_, delta) => {
    if (!animate) {
      setTransition(settledFor(mode));
      tRef.current = 1;
      transitioningRef.current = false;
      return;
    }

    if (!transitioningRef.current && tRef.current >= 1) return;

    const duration = durationFor(fromRef.current, modeRef.current);
    tRef.current = Math.min(1, tRef.current + (delta * 1000) / duration);

    const next = computeTransition(fromRef.current, modeRef.current, tRef.current);
    setTransition(next);

    if (tRef.current >= 1) {
      transitioningRef.current = false;
      setTransition(settledFor(modeRef.current));
    }
  });

  return transition;
}
