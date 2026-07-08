import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import globeMapUrl from '../assets/globe-specular.jpg';
import {
  useConnectivityTransition,
  type ConnectivityMode,
  type ConnectivityTransition,
} from '../hooks/useConnectivityTransition';
import { useHubScreenHover } from '../hooks/useHubScreenHover';
import { useMarkSceneReady } from '../context/SceneLoadingContext';

export type { ConnectivityMode } from '../hooks/useConnectivityTransition';

const RADIUS = 2;
const DOT_COUNT = 36000;
const LAND_THRESHOLD = 70;
const TRAIL_COLOR = '#e5484d';
const SATELLITE_COLOR = '#7a7a76';
const TRAIL_SPEED = 0.42;
const TRAIL_LENGTH = 0.18;
const STARLINK_MID_RADIUS = RADIUS * 1.48;

/** Let hub markers receive pointer events through the land-point cloud. */
const disableRaycast: THREE.Object3D['raycast'] = () => undefined;

type StarlinkShellConfig = {
  radius: number;
  inclination: number;
  count: number;
  phase: number;
  spin: number;
};

/** Multi-shell inclined constellation — Starlink-style LEO mesh. */
const STARLINK_SHELLS: StarlinkShellConfig[] = [
  { radius: RADIUS * 1.36, inclination: 0.92, count: 16, phase: 0, spin: 0.11 },
  { radius: RADIUS * 1.48, inclination: 0.92, count: 22, phase: 1.15, spin: 0.085 },
  { radius: RADIUS * 1.6, inclination: 0.78, count: 28, phase: 2.35, spin: 0.065 },
];

type LatLon = { lat: number; lon: number };

type HubNetwork = {
  id: string;
  hub: LatLon;
  nodes: LatLon[];
};

const NETWORKS: HubNetwork[] = [
  {
    id: 'us',
    hub: { lat: 37.7749, lon: -122.4194 }, // San Francisco
    nodes: [
      { lat: 47.6062, lon: -122.3321 }, // Seattle
      { lat: 34.0522, lon: -118.2437 }, // Los Angeles
      { lat: 39.7392, lon: -104.9903 }, // Denver
      { lat: 32.7767, lon: -96.797 }, // Dallas
      { lat: 41.8781, lon: -87.6298 }, // Chicago
      { lat: 40.7128, lon: -74.006 }, // New York
      { lat: 25.7617, lon: -80.1918 }, // Miami
    ],
  },
  {
    id: 'france',
    hub: { lat: 48.8566, lon: 2.3522 }, // Paris
    nodes: [
      { lat: 45.764, lon: 4.8357 }, // Lyon
      { lat: 43.2965, lon: 5.3698 }, // Marseille
      { lat: 44.8378, lon: -0.5792 }, // Bordeaux
      { lat: 47.2184, lon: -1.5536 }, // Nantes
      { lat: 43.6047, lon: 1.4442 }, // Toulouse
    ],
  },
  {
    id: 'australia',
    hub: { lat: -33.8688, lon: 151.2093 }, // Sydney
    nodes: [
      { lat: -37.8136, lon: 144.9631 }, // Melbourne
      { lat: -27.4698, lon: 153.0251 }, // Brisbane
      { lat: -31.9505, lon: 115.8605 }, // Perth
      { lat: -34.9285, lon: 138.6007 }, // Adelaide
      { lat: -12.4634, lon: 130.8456 }, // Darwin
    ],
  },
  {
    id: 'india',
    hub: { lat: 19.076, lon: 72.8777 }, // Mumbai
    nodes: [
      { lat: 28.6139, lon: 77.209 }, // Delhi
      { lat: 12.9716, lon: 77.5946 }, // Bangalore
      { lat: 13.0827, lon: 80.2707 }, // Chennai
      { lat: 22.5726, lon: 88.3639 }, // Kolkata
      { lat: 18.5204, lon: 73.8567 }, // Pune
      { lat: 17.385, lon: 78.4867 }, // Hyderabad
    ],
  },
];

const HUB_LABELS: Record<string, string> = {
  us: 'San Francisco',
  france: 'Paris',
  australia: 'Sydney',
  india: 'Mumbai',
};

/** Remote field sites — satellite-only backhaul (no terrestrial arc to hub). */
const REMOTE_NODES = [
  { lat: -12.4634, lon: 130.8456, label: 'Darwin' },
  { lat: -31.9505, lon: 115.8605, label: 'Perth' },
] as const;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function latLonToVec3(latDeg: number, lonDeg: number, radius: number): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.cos(lon),
  ).multiplyScalar(radius);
}

function makeArcCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const chord = from.distanceTo(to);
  const lift = RADIUS * (1.18 + chord * 0.08);
  const mid = from.clone().add(to).multiplyScalar(0.5).setLength(lift);
  return new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
}

function makeSatelliteArcCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const chord = from.distanceTo(to);
  const lift = RADIUS * (2.05 + chord * 0.18);
  const mid = from.clone().add(to).multiplyScalar(0.5).setLength(lift);
  return new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
}

function pointOnInclinedOrbit(angle: number, radius: number, inclination: number): THREE.Vector3 {
  const u = Math.cos(angle) * radius;
  const v = Math.sin(angle) * radius;
  return new THREE.Vector3(u, v * Math.sin(inclination), v * Math.cos(inclination));
}

function satelliteAbovePoint(surfacePos: THREE.Vector3): THREE.Vector3 {
  return surfacePos.clone().normalize().multiplyScalar(STARLINK_MID_RADIUS);
}

function makeDotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function useLandPoints(): Float32Array | null {
  const [positions, setPositions] = useState<Float32Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = globeMapUrl;
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;

      const pts: number[] = [];
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < DOT_COUNT; i++) {
        const y = 1 - (i / (DOT_COUNT - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = golden * i;
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;

        const lat = Math.asin(y);
        const lon = Math.atan2(x, z);
        const u = (lon + Math.PI) / (2 * Math.PI);
        const v = (Math.PI / 2 - lat) / Math.PI;
        const px = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
        const py = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
        const idx = (py * w + px) * 4;
        const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        if (lum < LAND_THRESHOLD) {
          pts.push(x * RADIUS, y * RADIUS, z * RADIUS);
        }
      }

      if (!cancelled) setPositions(new Float32Array(pts));
    };

    return () => {
      cancelled = true;
    };
  }, []);

  return positions;
}

function Marker({ position, color, size }: { position: THREE.Vector3; color: string; size: number }) {
  return (
    <mesh position={position} raycast={disableRaycast}>
      <sphereGeometry args={[size, 24, 24]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function HubMarker({ position, highlighted }: { position: THREE.Vector3; highlighted: boolean }) {
  const VISIBLE_RADIUS = 0.058;

  return (
    <mesh position={position} raycast={disableRaycast}>
      <sphereGeometry args={[VISIBLE_RADIUS, 24, 24]} />
      <meshBasicMaterial
        color={TRAIL_COLOR}
        toneMapped={false}
        transparent
        opacity={highlighted ? 1 : 0.88}
      />
    </mesh>
  );
}

function GlobeHubLabel({
  label,
  hubPos,
  groupRef,
  visible,
}: {
  label: string;
  hubPos: THREE.Vector3 | undefined;
  groupRef: RefObject<THREE.Group | null>;
  visible: boolean;
}) {
  const { camera, gl } = useThree();
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const worldPos = useRef(new THREE.Vector3());
  const ndc = useRef(new THREE.Vector3());
  const hubNormal = useRef(new THREE.Vector3());
  const camDir = useRef(new THREE.Vector3());
  const layout = useRef({
    canvasLeft: 0,
    canvasTop: 0,
    width: 0,
    height: 0,
    sceneLeft: 0,
    sceneTop: 0,
  });

  const refreshLayout = useCallback(() => {
    const canvas = gl.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;
    const canvasRect = canvas.getBoundingClientRect();
    const sceneRect = parent.getBoundingClientRect();
    layout.current = {
      canvasLeft: canvasRect.left,
      canvasTop: canvasRect.top,
      width: canvasRect.width,
      height: canvasRect.height,
      sceneLeft: sceneRect.left,
      sceneTop: sceneRect.top,
    };
  }, [gl.domElement]);

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;

    const el = document.createElement('span');
    el.className = 'globe-hub-label globe-hub-label--overlay';
    parent.appendChild(el);
    labelRef.current = el;
    refreshLayout();

    const canvas = gl.domElement;
    const resizeObserver = new ResizeObserver(refreshLayout);
    resizeObserver.observe(canvas);
    resizeObserver.observe(parent);
    window.addEventListener('scroll', refreshLayout, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', refreshLayout);
      el.remove();
      labelRef.current = null;
    };
  }, [gl.domElement, refreshLayout]);

  useEffect(() => {
    if (labelRef.current) labelRef.current.textContent = label;
  }, [label]);

  useFrame(() => {
    const el = labelRef.current;
    if (!el || !visible || !hubPos || !groupRef.current) {
      if (el) el.style.opacity = '0';
      return;
    }

    worldPos.current.copy(hubPos);
    groupRef.current.localToWorld(worldPos.current);

    camDir.current.copy(camera.position).normalize();
    hubNormal.current.copy(worldPos.current).normalize();
    if (hubNormal.current.dot(camDir.current) <= 0.02) {
      el.style.opacity = '0';
      return;
    }

    ndc.current.copy(worldPos.current).project(camera);
    if (ndc.current.z > 1) {
      el.style.opacity = '0';
      return;
    }

    const { width, height, canvasLeft, canvasTop, sceneLeft, sceneTop } = layout.current;
    const x = (ndc.current.x * 0.5 + 0.5) * width + canvasLeft - sceneLeft;
    const y = (-ndc.current.y * 0.5 + 0.5) * height + canvasTop - sceneTop;

    el.style.opacity = '1';
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, calc(-100% - 8px))`;
  });

  return null;
}

function RemoteNodeMarker({
  position,
  active,
  opacity = 1,
}: {
  position: THREE.Vector3;
  active: boolean;
  opacity?: number;
}) {
  if (!active || opacity <= 0.02) return null;

  return (
    <group position={position} scale={[opacity, opacity, opacity]}>
      <mesh raycast={disableRaycast}>
        <sphereGeometry args={[0.042, 16, 16]} />
        <meshBasicMaterial color="#141414" transparent opacity={opacity} toneMapped={false} />
      </mesh>
    </group>
  );
}

function StaticArc({
  from,
  to,
  highlighted,
  dimmed,
  arcScale = 1,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  highlighted?: boolean;
  dimmed?: boolean;
  arcScale?: number;
}) {
  const points = useMemo(() => {
    const curve = makeArcCurve(from, to);
    return curve.getPoints(48);
  }, [from, to]);

  const base = dimmed ? 0.05 : highlighted ? 0.48 : 0.14;
  const opacity = base * arcScale;

  return (
    <Line
      raycast={disableRaycast}
      points={points}
      color={TRAIL_COLOR}
      transparent
      opacity={opacity}
      toneMapped={false}
    />
  );
}

function SatelliteDownlink({
  from,
  to,
  opacity = 0.62,
  reveal = 1,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  opacity?: number;
  reveal?: number;
}) {
  const points = useMemo(() => {
    const curve = makeSatelliteArcCurve(from, to);
    return curve.getPoints(56);
  }, [from, to]);

  const visiblePoints = useMemo(() => {
    const count = Math.max(2, Math.ceil(reveal * points.length));
    return points.slice(0, count);
  }, [points, reveal]);

  if (opacity <= 0.01 || visiblePoints.length < 2) return null;

  return (
    <Line
      raycast={disableRaycast}
      points={visiblePoints}
      color={SATELLITE_COLOR}
      transparent
      opacity={opacity}
      dashed
      dashSize={0.1}
      gapSize={0.07}
      toneMapped={false}
    />
  );
}

function AnimatedSatellitePulse({
  from,
  to,
  onComplete,
  speed = 0.5,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  onComplete: () => void;
  speed?: number;
}) {
  const progress = useRef(0);
  const finished = useRef(false);
  const curve = useMemo(() => makeSatelliteArcCurve(from, to), [from, to]);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const headRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (finished.current) return;

    progress.current += delta * speed;
    const t = progress.current;
    const t0 = Math.max(0, t - TRAIL_LENGTH);
    const t1 = Math.min(1, t);

    if (t0 >= 1) {
      finished.current = true;
      onComplete();
      return;
    }

    const segments = 24;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const u = t0 + ((t1 - t0) * i) / segments;
      points.push(curve.getPoint(u));
    }
    geometry.setFromPoints(points);
    geometry.attributes.position.needsUpdate = true;

    if (headRef.current && t1 < 1) {
      headRef.current.position.copy(curve.getPoint(t1));
      headRef.current.visible = true;
    } else if (headRef.current) {
      headRef.current.visible = false;
    }
  });

  return (
    <>
      <line>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial color={SATELLITE_COLOR} transparent opacity={0.9} toneMapped={false} />
      </line>
      <mesh ref={headRef} raycast={disableRaycast}>
        <sphereGeometry args={[0.024, 12, 12]} />
        <meshBasicMaterial color={SATELLITE_COLOR} toneMapped={false} />
      </mesh>
    </>
  );
}

function AnimatedTrail({
  from,
  to,
  onComplete,
  speed = TRAIL_SPEED,
  color = TRAIL_COLOR,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  onComplete: () => void;
  speed?: number;
  color?: string;
}) {
  const progress = useRef(0);
  const finished = useRef(false);
  const curve = useMemo(() => makeArcCurve(from, to), [from, to]);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const headRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (finished.current) return;

    progress.current += delta * speed;
    const t = progress.current;
    const t0 = Math.max(0, t - TRAIL_LENGTH);
    const t1 = Math.min(1, t);

    if (t0 >= 1) {
      finished.current = true;
      onComplete();
      return;
    }

    const segments = 20;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const u = t0 + ((t1 - t0) * i) / segments;
      points.push(curve.getPoint(u));
    }
    geometry.setFromPoints(points);
    geometry.attributes.position.needsUpdate = true;

    if (headRef.current && t1 < 1) {
      headRef.current.position.copy(curve.getPoint(t1));
      headRef.current.visible = true;
    } else if (headRef.current) {
      headRef.current.visible = false;
    }
  });

  return (
    <>
      <line>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial color={color} transparent opacity={0.95} toneMapped={false} />
      </line>
      <mesh ref={headRef} raycast={disableRaycast}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </>
  );
}

function HubTrailEmitter({
  hubPos,
  nodePositions,
  outboundEnabled,
  inboundEnabled = false,
  staggerMs = 0,
  fast = false,
}: {
  hubPos: THREE.Vector3;
  nodePositions: THREE.Vector3[];
  outboundEnabled: boolean;
  inboundEnabled?: boolean;
  staggerMs?: number;
  fast?: boolean;
}) {
  const [outTrails, setOutTrails] = useState<{ id: number; targetIdx: number }[]>([]);
  const [inTrails, setInTrails] = useState<{ id: number; sourceIdx: number }[]>([]);
  const nextOutId = useRef(0);
  const nextInId = useRef(0);

  const bidirectional = inboundEnabled;
  const maxOut = fast && bidirectional ? 4 : fast ? 3 : 2;
  const maxIn = inboundEnabled ? 4 : 0;
  const trailSpeed = fast ? 0.58 : TRAIL_SPEED;

  const removeOutTrail = useCallback((id: number) => {
    setOutTrails((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const removeInTrail = useCallback((id: number) => {
    setInTrails((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!outboundEnabled || nodePositions.length === 0) {
      setOutTrails([]);
      return;
    }

    const emitOut = () => {
      const targetIdx = Math.floor(Math.random() * nodePositions.length);
      const id = nextOutId.current++;
      setOutTrails((prev) => (prev.length >= maxOut ? prev : [...prev, { id, targetIdx }]));
    };

    let outIntervalId = 0;
    const outDelay = window.setTimeout(() => {
      emitOut();
      outIntervalId = window.setInterval(emitOut, fast ? 420 : 1100);
    }, staggerMs);

    return () => {
      window.clearTimeout(outDelay);
      if (outIntervalId) window.clearInterval(outIntervalId);
    };
  }, [outboundEnabled, nodePositions.length, staggerMs, fast, bidirectional, maxOut]);

  useEffect(() => {
    if (!inboundEnabled || nodePositions.length === 0) {
      setInTrails([]);
      return;
    }

    const emitIn = () => {
      const sourceIdx = Math.floor(Math.random() * nodePositions.length);
      const id = nextInId.current++;
      setInTrails((prev) => (prev.length >= maxIn ? prev : [...prev, { id, sourceIdx }]));
    };

    let inIntervalId = 0;
    const inDelay = window.setTimeout(() => {
      emitIn();
      inIntervalId = window.setInterval(emitIn, fast ? 480 : 1100);
    }, staggerMs + 400);

    return () => {
      window.clearTimeout(inDelay);
      if (inIntervalId) window.clearInterval(inIntervalId);
    };
  }, [inboundEnabled, nodePositions.length, staggerMs, maxIn, fast]);

  return (
    <>
      {outTrails.map(({ id, targetIdx }) => (
        <AnimatedTrail
          key={`out-${id}`}
          from={hubPos}
          to={nodePositions[targetIdx]}
          speed={trailSpeed}
          onComplete={() => removeOutTrail(id)}
        />
      ))}
      {inTrails.map(({ id, sourceIdx }) => (
        <AnimatedTrail
          key={`in-${id}`}
          from={nodePositions[sourceIdx]}
          to={hubPos}
          speed={trailSpeed}
          color="#141414"
          onComplete={() => removeInTrail(id)}
        />
      ))}
    </>
  );
}

const HUB_STAGGER: Record<string, number> = {
  us: 0,
  france: 400,
  australia: 800,
  india: 1200,
};

function isRemoteNode(lat: number, lon: number): boolean {
  return REMOTE_NODES.some((node) => node.lat === lat && node.lon === lon);
}

function smoothstepLocal(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function StarlinkShellGroup({
  shell,
  shellIndex,
  animate,
  showMesh,
  transition,
}: {
  shell: StarlinkShellConfig;
  shellIndex: number;
  animate: boolean;
  showMesh: boolean;
  transition: ConnectivityTransition;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const satPositions = useMemo(
    () =>
      Array.from({ length: shell.count }, (_, i) =>
        pointOnInclinedOrbit((i / shell.count) * Math.PI * 2 + shell.phase, shell.radius, shell.inclination),
      ),
    [shell],
  );

  const ringPoints = useMemo(() => {
    const segments = shell.count * 3;
    const ringReveal = smoothstepLocal(0.32 + shellIndex * 0.1, 0.52 + shellIndex * 0.1, transition.progress);
    const count = Math.max(2, Math.ceil(ringReveal * (segments + 1)));
    return Array.from({ length: count }, (_, i) =>
      pointOnInclinedOrbit((i / segments) * Math.PI * 2 + shell.phase, shell.radius, shell.inclination),
    );
  }, [shell, shellIndex, transition.progress]);

  const meshLinks = useMemo(() => {
    if (!showMesh) return [] as [THREE.Vector3, THREE.Vector3][];
    const links: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < shell.count; i++) {
      const a = satPositions[i];
      links.push([a, satPositions[(i + 1) % shell.count]]);
      if (i % 3 === 0) {
        links.push([a, satPositions[(i + Math.floor(shell.count / 3)) % shell.count]]);
      }
    }
    return links;
  }, [satPositions, shell.count, showMesh]);

  useFrame((_, delta) => {
    if (!groupRef.current || !animate) return;
    groupRef.current.rotation.y += delta * shell.spin;
  });

  const ringOp = transition.ringOpacity * smoothstepLocal(0.32 + shellIndex * 0.1, 0.5 + shellIndex * 0.1, transition.progress);

  return (
    <group ref={groupRef}>
      {ringPoints.length >= 2 && ringOp > 0.01 && (
        <Line
          raycast={disableRaycast}
          points={ringPoints}
          color={SATELLITE_COLOR}
          transparent
          opacity={ringOp}
          toneMapped={false}
        />
      )}
      {meshLinks.map(([a, b], i) => {
        const linkOp = transition.meshLinkOpacity(i, meshLinks.length);
        if (linkOp <= 0.01) return null;
        return (
          <Line
            key={`mesh-${i}`}
            raycast={disableRaycast}
            points={[a, b]}
            color={SATELLITE_COLOR}
            transparent
            opacity={linkOp}
            toneMapped={false}
          />
        );
      })}
      {satPositions.map((pos, i) => {
        const scale = transition.satScale(shellIndex, i, shell.count);
        if (scale <= 0.02) return null;
        return (
          <mesh key={`sat-${i}`} position={pos} scale={[scale, scale, scale]} raycast={disableRaycast}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color={SATELLITE_COLOR} transparent opacity={scale} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function StarlinkConstellation({
  transition,
  animate,
}: {
  transition: ConnectivityTransition;
  animate: boolean;
}) {
  if (!transition.starlinkVisible) return null;

  return (
    <group>
      {STARLINK_SHELLS.map((shell, i) => (
        <StarlinkShellGroup
          key={`shell-${i}`}
          shell={shell}
          shellIndex={i}
          animate={animate}
          showMesh={transition.starlinkDenseMesh || i > 0}
          transition={transition}
        />
      ))}
    </group>
  );
}

function FieldReturnEmitter({
  from,
  to,
  enabled,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  enabled: boolean;
}) {
  const [trails, setTrails] = useState<number[]>([]);
  const nextId = useRef(0);

  const removeTrail = useCallback((id: number) => {
    setTrails((prev) => prev.filter((t) => t !== id));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const emit = () => {
      const id = nextId.current++;
      setTrails((prev) => (prev.length >= 2 ? prev : [...prev, id]));
    };

    emit();
    const intervalId = window.setInterval(emit, 520);
    return () => window.clearInterval(intervalId);
  }, [enabled]);

  return (
    <>
      {trails.map((id) => (
        <AnimatedTrail
          key={id}
          from={from}
          to={to}
          speed={0.55}
          color="#141414"
          onComplete={() => removeTrail(id)}
        />
      ))}
    </>
  );
}

function RemoteFieldReturns({ transition }: { transition: ConnectivityTransition }) {
  const sydneyHub = latLonToVec3(
    NETWORKS.find((n) => n.id === 'australia')!.hub.lat,
    NETWORKS.find((n) => n.id === 'australia')!.hub.lon,
    RADIUS * 1.012,
  );

  return (
    <>
      {REMOTE_NODES.map((node) => (
        <FieldReturnEmitter
          key={`return-${node.label}`}
          from={latLonToVec3(node.lat, node.lon, RADIUS * 1.012)}
          to={sydneyHub}
          enabled={transition.canEmitFieldReturns}
        />
      ))}
    </>
  );
}

function SatelliteDownlinkEmitter({
  from,
  to,
  pulseEnabled,
  downlinkOpacity,
  downlinkReveal,
  fast = false,
  continuous = false,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  pulseEnabled: boolean;
  downlinkOpacity: number;
  downlinkReveal: number;
  fast?: boolean;
  continuous?: boolean;
}) {
  const [pulses, setPulses] = useState<number[]>([]);
  const nextId = useRef(0);

  const removePulse = useCallback((id: number) => {
    setPulses((prev) => prev.filter((p) => p !== id));
  }, []);

  useEffect(() => {
    if (!pulseEnabled) {
      setPulses([]);
      return;
    }

    const maxPulses = continuous ? 2 : 1;

    const emit = () => {
      const id = nextId.current++;
      setPulses((prev) => (prev.length >= maxPulses ? prev : [...prev, id]));
    };

    emit();
    const intervalId = window.setInterval(
      emit,
      fast ? 450 + Math.random() * 350 : 1400 + Math.random() * 900,
    );
    return () => window.clearInterval(intervalId);
  }, [pulseEnabled, fast, continuous]);

  return (
    <>
      <SatelliteDownlink from={from} to={to} opacity={downlinkOpacity} reveal={downlinkReveal} />
      {pulseEnabled &&
        pulses.map((id) => (
          <AnimatedSatellitePulse
            key={id}
            from={from}
            to={to}
            speed={fast ? 0.68 : 0.48}
            onComplete={() => removePulse(id)}
          />
        ))}
    </>
  );
}

function SatelliteConnectivityLayer({
  transition,
  hubPositions,
  connectivityMode,
}: {
  transition: ConnectivityTransition;
  hubPositions: { id: string; pos: THREE.Vector3 }[];
  connectivityMode: ConnectivityMode;
}) {
  const active = connectivityMode === 'satellite' || connectivityMode === 'stream';
  if (!active) return null;

  const pulse = connectivityMode === 'stream';
  const continuous = connectivityMode === 'stream';
  const reveal = Math.min(1, transition.downlinkOpacity / 0.45);

  return (
    <>
      {hubPositions.map((hub) => (
        <SatelliteDownlinkEmitter
          key={`sat-hub-${hub.id}`}
          from={satelliteAbovePoint(hub.pos)}
          to={hub.pos}
          pulseEnabled={transition.canEmitSatellite}
          downlinkOpacity={transition.downlinkOpacity}
          downlinkReveal={reveal}
          fast={pulse}
          continuous={continuous}
        />
      ))}
      {REMOTE_NODES.map((node) => {
        const pos = latLonToVec3(node.lat, node.lon, RADIUS * 1.012);
        return (
          <SatelliteDownlinkEmitter
            key={`sat-remote-${node.label}`}
            from={satelliteAbovePoint(pos)}
            to={pos}
            pulseEnabled={transition.canEmitSatellite}
            downlinkOpacity={transition.downlinkOpacity}
            downlinkReveal={reveal}
            fast={pulse}
            continuous={continuous}
          />
        );
      })}
    </>
  );
}

function HubNetworkGroup({
  network,
  animate,
  highlighted,
  highTrailActivity,
  connectivityMode,
  transition,
}: {
  network: HubNetwork;
  animate: boolean;
  highlighted: boolean;
  highTrailActivity?: boolean;
  connectivityMode: ConnectivityMode;
  transition: ConnectivityTransition;
}) {
  const hubPos = useMemo(
    () => latLonToVec3(network.hub.lat, network.hub.lon, RADIUS * 1.012),
    [network.hub.lat, network.hub.lon],
  );
  const nodePositions = useMemo(
    () => network.nodes.map((n) => latLonToVec3(n.lat, n.lon, RADIUS * 1.012)),
    [network.nodes],
  );

  const surfaceDimmed = connectivityMode === 'satellite';
  const isStream = connectivityMode === 'stream';
  const arcScale = transition.surfaceArcScale;

  const activeNodePositions = nodePositions.filter(
    (_, i) => connectivityMode === 'fleet' || !isRemoteNode(network.nodes[i].lat, network.nodes[i].lon),
  );

  return (
    <>
      {network.nodes.map((node, i) => {
        if (connectivityMode !== 'fleet' && isRemoteNode(node.lat, node.lon)) return null;
        const pos = nodePositions[i];
        return (
          <StaticArc
            key={`${network.id}-arc-${i}`}
            from={hubPos}
            to={pos}
            highlighted={highlighted && connectivityMode !== 'satellite'}
            dimmed={surfaceDimmed}
            arcScale={arcScale}
          />
        );
      })}

      {animate && (connectivityMode === 'fleet' || connectivityMode === 'stream') && (
        <HubTrailEmitter
          hubPos={hubPos}
          nodePositions={activeNodePositions}
          outboundEnabled={transition.canEmitOutbound}
          inboundEnabled={isStream && transition.canEmitInbound}
          staggerMs={HUB_STAGGER[network.id] ?? 0}
          fast={highTrailActivity}
        />
      )}

      <HubMarker position={hubPos} highlighted={highlighted} />
      {network.nodes.map((node, i) => {
        if (connectivityMode !== 'fleet' && isRemoteNode(node.lat, node.lon)) return null;
        const pos = nodePositions[i];
        return (
          <Marker key={`${network.id}-node-${i}`} position={pos} color="#141414" size={0.038} />
        );
      })}
    </>
  );
}

function Globe({
  focusedHubId = null,
  connectivityMode = 'fleet',
  onReady,
}: {
  focusedHubId?: string | null;
  connectivityMode?: ConnectivityMode;
  onReady?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const readyNotified = useRef(false);
  const positions = useLandPoints();
  const dotTexture = useMemo(makeDotTexture, []);
  const animateMotion = !prefersReducedMotion();
  const transition = useConnectivityTransition(connectivityMode, animateMotion);

  const hubPositions = useMemo(
    () =>
      NETWORKS.map((network) => ({
        id: network.id,
        pos: latLonToVec3(network.hub.lat, network.hub.lon, RADIUS * 1.012),
      })),
    [],
  );

  const hoveredHub = useHubScreenHover(hubPositions, groupRef, animateMotion);

  const labelHubId =
    hoveredHub ?? (connectivityMode === 'fleet' ? focusedHubId : null);

  const activeHubPos = useMemo(
    () => hubPositions.find((hub) => hub.id === labelHubId)?.pos,
    [hubPositions, labelHubId],
  );

  const isHubHighlighted = (networkId: string) => {
    if (hoveredHub !== null) return hoveredHub === networkId;
    if (connectivityMode === 'satellite' || connectivityMode === 'stream') return true;
    if (focusedHubId) return focusedHubId === networkId;
    return false;
  };

  const highTrailActivity = connectivityMode === 'stream';
  const showRemoteNodes =
    transition.remoteNodeOpacity > 0.02 &&
    (connectivityMode === 'satellite' || connectivityMode === 'stream');

  useFrame((_, delta) => {
    if (!groupRef.current || !animateMotion || hoveredHub !== null) return;
    groupRef.current.rotation.y += delta * 0.08;
  });

  const geometry = useMemo(() => {
    if (!positions) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useEffect(() => {
    if (!geometry || readyNotified.current) return;
    readyNotified.current = true;
    onReady?.();
  }, [geometry, onReady]);

  if (!geometry) return null;

  return (
    <>
      <StarlinkConstellation transition={transition} animate={animateMotion} />

      <GlobeHubLabel
        label={labelHubId ? HUB_LABELS[labelHubId] ?? labelHubId : ''}
        hubPos={activeHubPos}
        groupRef={groupRef}
        visible={labelHubId !== null}
      />

      <group ref={groupRef} rotation={[0, 2.137, 0]}>
        <mesh raycast={disableRaycast}>
          <sphereGeometry args={[RADIUS * 0.99, 64, 64]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        <points raycast={disableRaycast}>
          <primitive object={geometry} attach="geometry" />
          <pointsMaterial
            size={0.034}
            map={dotTexture}
            color="#161616"
            transparent
            alphaTest={0.5}
            depthWrite={false}
            sizeAttenuation
            toneMapped={false}
          />
        </points>

        <SatelliteConnectivityLayer
          transition={transition}
          hubPositions={hubPositions}
          connectivityMode={connectivityMode}
        />
        <RemoteFieldReturns transition={transition} />

        {REMOTE_NODES.map((node) => (
          <RemoteNodeMarker
            key={node.label}
            position={latLonToVec3(node.lat, node.lon, RADIUS * 1.012)}
            active={showRemoteNodes}
            opacity={transition.remoteNodeOpacity}
          />
        ))}

        {NETWORKS.map((network) => (
          <HubNetworkGroup
            key={network.id}
            network={network}
            animate={animateMotion}
            highlighted={isHubHighlighted(network.id)}
            highTrailActivity={highTrailActivity}
            connectivityMode={connectivityMode}
            transition={transition}
          />
        ))}
      </group>
    </>
  );
}

export type GlobeSceneProps = {
  focusedHubId?: string | null;
  connectivityMode?: ConnectivityMode;
};

export function GlobeScene({
  focusedHubId = null,
  connectivityMode = 'fleet',
}: GlobeSceneProps = {}) {
  const [ready, setReady] = useState(false);
  const markSceneReady = useMarkSceneReady('globe');

  const handleGlobeReady = useCallback(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    markSceneReady();
  }, [markSceneReady, ready]);

  return (
    <div className={`topology-scene ${ready ? 'topology-scene--ready' : ''}`}>
      <Canvas
        className="topology-scene-canvas"
        dpr={[1, 1.25]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 34, near: 0.01, far: 100, position: [0, 0, 10.75] }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Suspense fallback={null}>
          <Globe
            focusedHubId={focusedHubId}
            connectivityMode={connectivityMode}
            onReady={handleGlobeReady}
          />
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          enableDamping={false}
          rotateSpeed={0.55}
        />
      </Canvas>
    </div>
  );
}
