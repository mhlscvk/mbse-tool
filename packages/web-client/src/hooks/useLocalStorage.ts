import { useState, useEffect, useRef } from 'react';

/**
 * Like useState but backed by localStorage.
 * Serializes Maps as [[key,value],...] entries arrays.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [value, setInner] = useState<T>(() => {
    if (!key) return initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw);
      // Rehydrate Map
      if (initial instanceof Map) return new Map(parsed) as unknown as T;
      // Rehydrate Set
      if (initial instanceof Set) return new Set(parsed) as unknown as T;
      return parsed as T;
    } catch {
      return initial;
    }
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  const setValue = (val: T | ((prev: T) => T)) => {
    setInner((prev) => {
      const next = typeof val === 'function' ? (val as (p: T) => T)(prev) : val;
      try {
        let serialized: unknown = next;
        if (next instanceof Map) serialized = Array.from((next as Map<unknown, unknown>).entries());
        if (next instanceof Set) serialized = Array.from((next as Set<unknown>).values());
        localStorage.setItem(keyRef.current, JSON.stringify(serialized));
      } catch { /* quota exceeded or SSR */ }
      return next;
    });
  };

  // Re-load when key changes (different file opened)
  const prevKey = useRef(key);
  useEffect(() => {
    if (prevKey.current === key) return;
    prevKey.current = key;
    if (!key) { setInner(initial); return; }
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) { setInner(initial); return; }
      const parsed = JSON.parse(raw);
      if (initial instanceof Map) setInner(new Map(parsed) as unknown as T);
      else if (initial instanceof Set) setInner(new Set(parsed) as unknown as T);
      else setInner(parsed as T);
    } catch {
      setInner(initial);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue];
}
