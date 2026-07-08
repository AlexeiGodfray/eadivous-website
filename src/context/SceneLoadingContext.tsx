import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const SCENE_IDS = ['drone', 'globe'] as const;

export type SceneId = (typeof SCENE_IDS)[number];

type SceneLoadingContextValue = {
  markSceneReady: (id: SceneId) => void;
  allScenesReady: boolean;
};

const SceneLoadingContext = createContext<SceneLoadingContextValue | null>(null);

export function SceneLoadingProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState<Record<SceneId, boolean>>({
    drone: false,
    globe: false,
  });

  const markSceneReady = useCallback((id: SceneId) => {
    setReady((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const allScenesReady = SCENE_IDS.every((id) => ready[id]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setReady((prev) => ({
        ...prev,
        drone: true,
        globe: true,
      }));
    }, 5_000);
    return () => window.clearTimeout(id);
  }, []);

  const value = useMemo(
    () => ({ markSceneReady, allScenesReady }),
    [markSceneReady, allScenesReady],
  );

  return (
    <SceneLoadingContext.Provider value={value}>{children}</SceneLoadingContext.Provider>
  );
}

export function useSceneLoading() {
  const ctx = useContext(SceneLoadingContext);
  if (!ctx) {
    throw new Error('useSceneLoading must be used within SceneLoadingProvider');
  }
  return ctx;
}

export function useMarkSceneReady(id: SceneId) {
  const { markSceneReady } = useSceneLoading();
  return useCallback(() => markSceneReady(id), [markSceneReady, id]);
}
