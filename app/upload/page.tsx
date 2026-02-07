"use client";

import { useState, useEffect, useCallback } from "react";

interface Photo {
  id: string;
  url: string;
  takenAt: string;
  description: string | null;
  cloudinaryPublicId: string;
}

interface ApiResponse {
  items: Photo[];
  nextCursor: string | null;
}

type MonthGroup = { key: string; label: string; photos: Photo[] };

const MONTH_NAMES = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function groupByMonth(photos: Photo[]): MonthGroup[] {
  const map = new Map<string, Photo[]>();

  for (const photo of photos) {
    const d = new Date(photo.takenAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(photo);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, photos]) => {
      const [year, month] = key.split("-");
      return { key, label: `${MONTH_NAMES[Number(month) - 1]} ${year}`, photos };
    });
}

export default function TimelinePage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Photo | null>(null);

  // Close lightbox on ESC + prevent background scroll
  useEffect(() => {
    if (!selected) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  const fetchPhotos = useCallback(async (cursorParam?: string) => {
    const isFirst = !cursorParam;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursorParam) params.set("cursor", cursorParam);

      const res = await fetch(`/api/photos?${params}`);
      if (!res.ok) throw new Error("Failed to load photos");

      const data: ApiResponse = await res.json();
      setPhotos((prev) => (isFirst ? data.items : [...prev, ...data.items]));
      setCursor(data.nextCursor);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const groups = groupByMonth(photos);

  // --- loading state ---
  if (loading) {
    return <p className="py-20 text-center text-gray-400">טוען תמונות…</p>;
  }

  // --- error state ---
  if (error && photos.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-red-600 mb-2">{error}</p>
        <button onClick={() => fetchPhotos()} className="text-sm text-blue-600 hover:underline">
          נסה שוב
        </button>
      </div>
    );
  }

  // --- empty state ---
  if (photos.length === 0) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">🏠 Family Timeline</h1>
        <p className="text-gray-500">אין תמונות עדיין. לכו להעלות!</p>
        <a href="/upload" className="mt-3 inline-block text-blue-600 hover:underline">
          העלאת תמונות →
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">🏠 Family Timeline</h1>
        <a href="/upload" className="text-sm text-blue-600 hover:underline">
          + העלאה
        </a>
      </div>

      {/* Month groups */}
      {groups.map((group) => (
        <section key={group.key} className="mb-10">
          <h2 className="text-lg font-semibold mb-3 sticky top-0 bg-gray-50 py-2 z-10">
            {group.label}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {group.photos.map((photo) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded bg-gray-200 cursor-pointer" onClick={() => setSelected(photo)}>
                <img
                  src={photo.url}
                  alt={photo.description || ""}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {photo.description && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Load more */}
      {cursor && (
        <div className="text-center py-6">
          <button
            onClick={() => fetchPhotos(cursor)}
            disabled={loadingMore}
            className="rounded bg-gray-200 px-6 py-2 text-sm hover:bg-gray-300 disabled:opacity-50"
          >
            {loadingMore ? "טוען…" : "טען עוד"}
          </button>
        </div>
      )}

      {/* Error on load-more */}
      {error && photos.length > 0 && (
        <p className="text-center text-sm text-red-600 py-2">{error}</p>
      )}

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-2 -left-2 z-10 rounded-full bg-white/90 px-2.5 py-1 text-sm font-bold text-gray-700 hover:bg-white"
            >
              ✕
            </button>
            <img
              src={selected.url}
              alt={selected.description || ""}
              className="max-h-[75vh] w-auto rounded object-contain"
            />
            <div className="mt-3 text-center text-white">
              <p className="text-sm text-gray-300">
                {new Date(selected.takenAt).toLocaleDateString("he-IL", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {selected.description && (
                <p className="mt-1 text-base">{selected.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}