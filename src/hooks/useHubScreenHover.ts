import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const HIT_PX = 36;
const LEAVE_DEBOUNCE_MS = 120;

export type HubScreenPosition = { id: string; pos: THREE.Vector3 };

export function useHubScreenHover(
  hubPositions: HubScreenPosition[],
  groupRef: RefObject<THREE.Group | null>,
  trackOnFrame = false,
) {
  const { camera, gl } = useThree();
  const [hoveredHub, setHoveredHub] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef({ x: 0, y: 0, inside: false });
  const worldPos = useRef(new THREE.Vector3());
  const ndc = useRef(new THREE.Vector3());
  const hubNormal = useRef(new THREE.Vector3());
  const camDir = useRef(new THREE.Vector3());

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const scheduleLeave = useCallback(() => {
    if (leaveTimer.current) return;
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      hoveredRef.current = null;
      setHoveredHub(null);
    }, LEAVE_DEBOUNCE_MS);
  }, []);

  const applyHover = useCallback((hit: string | null) => {
    if (hit === hoveredRef.current) return;
    hoveredRef.current = hit;
    setHoveredHub(hit);
  }, []);

  const findHoveredHub = useCallback(
    (clientX: number, clientY: number): string | null => {
      if (!groupRef.current) return null;

      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      camDir.current.copy(camera.position).normalize();

      let closestId: string | null = null;
      let closestDist = HIT_PX;

      for (const hub of hubPositions) {
        worldPos.current.copy(hub.pos);
        groupRef.current.localToWorld(worldPos.current);

        hubNormal.current.copy(worldPos.current).normalize();
        if (hubNormal.current.dot(camDir.current) <= 0.02) continue;

        ndc.current.copy(worldPos.current).project(camera);
        const screenX = (ndc.current.x * 0.5 + 0.5) * rect.width;
        const screenY = (-ndc.current.y * 0.5 + 0.5) * rect.height;

        const dist = Math.hypot(screenX - x, screenY - y);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = hub.id;
        }
      }

      return closestId;
    },
    [camera, gl.domElement, groupRef, hubPositions],
  );

  const updateHover = useCallback(() => {
    if (!pointer.current.inside) return;

    const hit = findHoveredHub(pointer.current.x, pointer.current.y);
    if (hit) {
      clearLeaveTimer();
      applyHover(hit);
      return;
    }

    if (hoveredRef.current !== null) {
      scheduleLeave();
    }
  }, [applyHover, clearLeaveTimer, findHoveredHub, scheduleLeave]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerMove = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY, inside: true };
      updateHover();
    };

    const onPointerLeave = () => {
      pointer.current.inside = false;
      scheduleLeave();
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      clearLeaveTimer();
    };
  }, [clearLeaveTimer, gl.domElement, scheduleLeave, updateHover]);

  useFrame(() => {
    if (!trackOnFrame || !pointer.current.inside || hoveredRef.current !== null) return;
    updateHover();
  });

  return hoveredHub;
}
