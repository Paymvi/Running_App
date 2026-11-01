import { useEffect, useState } from "react";
import { getPhoto } from "../utils/media";

const cache = new Map(); // photoId -> data URL (photo ids are never reused)

// Loads an activity photo from IndexedDB. error: "missing" | "unavailable" | null.
export default function usePhoto(photoId) {
  const [loaded, setLoaded] = useState({ id: null, src: null, error: null });

  useEffect(() => {
    if (!photoId || cache.has(photoId)) return;
    let cancelled = false;
    getPhoto(photoId)
      .then((src) => {
        if (src) cache.set(photoId, src);
        if (!cancelled) setLoaded({ id: photoId, src, error: src ? null : "missing" });
      })
      .catch(() => !cancelled && setLoaded({ id: photoId, src: null, error: "unavailable" }));
    return () => {
      cancelled = true;
    };
  }, [photoId]);

  if (!photoId) return { src: null, error: null };
  if (cache.has(photoId)) return { src: cache.get(photoId), error: null };
  return loaded.id === photoId ? loaded : { src: null, error: null, loading: true };
}

export const photoErrorText = (error) =>
  error === "missing"
    ? "Photo not found in this browser (restore a backup to recover it)."
    : "Photo couldn't be loaded: browser photo storage is unavailable.";
