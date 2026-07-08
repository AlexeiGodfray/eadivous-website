import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bounds, Center, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import droneGlbUrl from '../assets/drone.glb?url';
import { useMarkSceneReady } from '../context/SceneLoadingContext';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 7, 4]} intensity={1.15} />
      <directionalLight position={[-4, 3, -3]} intensity={0.4} />
      <hemisphereLight args={['#ffffff', '#1a1a1a', 0.35]} />
    </>
  );
}

// Procedural studio reflections (no external HDR fetch) so the metal/plastic
// surfaces read as real material instead of flat gray.
function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer
        intensity={2.2}
        form="rect"
        position={[2, 3, 2]}
        scale={[4, 4, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        intensity={1.1}
        form="rect"
        position={[-3, 1, -2]}
        scale={[5, 3, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        intensity={0.6}
        form="circle"
        position={[0, -2, 3]}
        scale={[3, 3, 1]}
        target={[0, 0, 0]}
      />
    </Environment>
  );
}

function DroneModel() {
  const { scene } = useGLTF(droneGlbUrl);
  const groupRef = useRef<THREE.Group>(null);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }, [scene]);

  useFrame((_, delta) => {
    if (!groupRef.current || reducedMotion) return;
    groupRef.current.rotation.y += delta * 0.12;
  });

  return (
    <Bounds fit clip margin={0.77}>
      <group ref={groupRef} rotation={[0, 0.55, 0]}>
        <Center>
          <group rotation={[Math.PI, 0, 0]}>
            <primitive object={scene} />
          </group>
        </Center>
      </group>
    </Bounds>
  );
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return null;
}

export function DroneScene() {
  const [ready, setReady] = useState(false);
  const markSceneReady = useMarkSceneReady('drone');

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
        camera={{ fov: 30, near: 0.01, far: 100, position: [0, 0, 7] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <SceneLights />
        <Suspense fallback={null}>
          <StudioEnvironment />
          <DroneModel />
          <ReadySignal onReady={() => setReady(true)} />
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          enableDamping
          rotateSpeed={0.7}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(droneGlbUrl);
