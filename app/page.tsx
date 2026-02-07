"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* ───────────────────── Types ───────────────────── */

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
type ViewMode = "timeline" | "grid";

/* ───────────────────── Helpers ───────────────────── */

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function dateRange(photos: Photo[]): string {
  if (photos.length === 0) return "";
  const dates = photos.map((p) => new Date(p.takenAt).getTime());
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  const fmt = (d: Date) =>
    d.toLocaleDateString("he-IL", { year: "numeric", month: "short" });
  return fmt(min) === fmt(max) ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

/* ───────────────────── Skeleton ───────────────────── */

function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-8">
      {[0, 1].map((g) => (
        <div key={g}>
          <div className="mb-3 h-6 w-32 animate-pulse rounded bg-gray-200" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Array.from({ length: count / 2 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────── Thumbnail Card ───────────────────── */

function PhotoCard({ photo, onClick }: { photo: Photo; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-gray-200 ring-0 ring-white/0 transition-all duration-300 hover:ring-4 hover:ring-blue-400/40 hover:shadow-lg hover:scale-[1.02]"
    >
      <img
        src={photo.url}
        alt={photo.description || ""}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 translate-y-2 px-2.5 pb-2.5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="text-xs font-medium text-white/90">
          {formatDate(photo.takenAt)}
        </p>
        {photo.description && (
          <p className="mt-0.5 truncate text-xs text-white/70">{photo.description}</p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */

export default function TimelinePage() {
  /* ── Data state ── */
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  /* ── UI state ── */
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("timeline");

  /* ── Lightbox state ── */
  const [selected, setSelected] = useState<Photo | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTakenAt, setEditTakenAt] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const stripRef = useRef<HTMLDivElement>(null);

  /* ── Filtered & grouped data ── */
  const filtered = useMemo(() => {
    if (!search.trim()) return photos;
    const q = search.trim().toLowerCase();
    return photos.filter((p) => p.description?.toLowerCase().includes(q));
  }, [photos, search]);

  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  /* ── Lightbox nav helpers ── */
  const selectedIdx = selected ? filtered.findIndex((p) => p.id === selected.id) : -1;
  const hasPrev = selectedIdx > 0;
  const hasNext = selectedIdx >= 0 && selectedIdx < filtered.length - 1;

  function navigate(dir: -1 | 1) {
    if (editing || modalBusy) return;
    const next = filtered[selectedIdx + dir];
    if (next) { setSelected(next); setModalError(""); }
  }

  /* ── Lightbox open/close ── */
  function openLightbox(photo: Photo) {
    setSelected(photo);
    setEditing(false);
    setModalError("");
  }

  function closeLightbox() {
    if (modalBusy) return;
    setSelected(null);
    setEditing(false);
    setModalError("");
  }

  /* ── Edit / Delete ── */
  function startEdit() {
    if (!selected) return;
    setEditTakenAt(new Date(selected.takenAt).toISOString().split("T")[0]);
    setEditDesc(selected.description || "");
    setEditing(true);
    setModalError("");
  }

  async function handleSave() {
    if (!selected) return;
    setModalBusy(true);
    setModalError("");
    try {
      const res = await fetch(`/api/photos/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takenAt: editTakenAt, description: editDesc || null }),
      });
      if (!res.ok) throw new Error("שמירה נכשלה");
      const updated: Photo = await res.json();
      setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSelected(updated);
      setEditing(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error");
    } finally {
      setModalBusy(false);
    }
  }

  async function handleDelete() {
    if (!selected || !confirm("למחוק את התמונה?")) return;
    setModalBusy(true);
    setModalError("");
    try {
      const res = await fetch(`/api/photos/${selected.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("מחיקה נכשלה");
      setPhotos((prev) => prev.filter((p) => p.id !== selected.id));
      closeLightbox();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error");
    } finally {
      setModalBusy(false);
    }
  }

  /* ── Keyboard: ESC / arrows + scroll lock ── */
  useEffect(() => {
    if (!selected) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !modalBusy) closeLightbox();
      if (e.key === "ArrowRight" && hasPrev) navigate(-1);
      if (e.key === "ArrowLeft" && hasNext) navigate(1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [selected, modalBusy, selectedIdx]);

  /* ── Scroll thumbnail strip into view ── */
  useEffect(() => {
    if (!selected || !stripRef.current) return;
    const active = stripRef.current.querySelector("[data-active='true']") as HTMLElement;
    if (active) active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selected]);

  /* ── Fetch ── */
  const fetchPhotos = useCallback(async (cursorParam?: string) => {
    const isFirst = !cursorParam;
    if (isFirst) setLoading(true); else setLoadingMore(true);
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

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  /* ═══════════════════ RENDER ═══════════════════ */

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-10 flex flex-col items-center gap-2">
          <div className="h-10 w-56 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
        </div>
        <SkeletonGrid />
      </div>
    );
  }

  /* ── Error ── */
  if (error && photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <p className="text-red-500">{error}</p>
        <button onClick={() => fetchPhotos()} className="rounded-lg bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700">
          נסה שוב
        </button>
      </div>
    );
  }

  /* ── Empty ── */
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
        <div className="text-6xl">📷</div>
        <h1 className="text-3xl font-bold text-gray-800">המשפחה שלנו</h1>
        <p className="text-gray-500">הטיימליין ריק — בואו נתחיל למלא אותו!</p>
        <a href="/upload" className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition">
          העלאת תמונות ראשונות →
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">

      {/* ════════ Hero ════════ */}
      <header className="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-bl from-blue-600 via-indigo-600 to-purple-700 px-6 py-10 text-center text-white shadow-xl sm:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
        <h1 className="relative text-4xl font-extrabold tracking-tight sm:text-5xl">
          המשפחה שלנו
        </h1>
        <p className="relative mt-2 text-sm text-white/70 sm:text-base">
          {photos.length} תמונות &middot; {dateRange(photos)}
        </p>
        <a
          href="/upload"
          className="relative mt-5 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-indigo-700 shadow-lg transition hover:shadow-xl hover:scale-105 active:scale-100"
        >
          + העלאת תמונות
        </a>
      </header>

      {/* ════════ Controls ════════ */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="חיפוש לפי תיאור…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-10 pl-4 text-sm shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm self-start">
          {(["timeline", "grid"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                view === v
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {v === "timeline" ? "📅 טיימליין" : "⊞ גריד"}
            </button>
          ))}
        </div>
      </div>

      {/* ════════ No results ════════ */}
      {filtered.length === 0 && (
        <p className="py-16 text-center text-gray-400">
          לא נמצאו תמונות עבור &ldquo;{search}&rdquo;
        </p>
      )}

      {/* ════════ Timeline view ════════ */}
      {view === "timeline" && groups.map((group) => (
        <section key={group.key} className="mb-12">
          <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-gray-100 bg-gray-50/90 px-4 py-3 backdrop-blur-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-700 sm:text-lg">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm text-blue-700">
                {group.photos.length}
              </span>
              {group.label}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {group.photos.map((photo) => (
              <PhotoCard key={photo.id} photo={photo} onClick={() => openLightbox(photo)} />
            ))}
          </div>
        </section>
      ))}

      {/* ════════ Grid view ════════ */}
      {view === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} onClick={() => openLightbox(photo)} />
          ))}
        </div>
      )}

      {/* ════════ Load more ════════ */}
      {cursor && (
        <div className="mt-10 text-center">
          {loadingMore ? (
            <div className="inline-flex items-center gap-2 text-sm text-gray-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              טוען עוד…
            </div>
          ) : (
            <button
              onClick={() => fetchPhotos(cursor)}
              className="rounded-full border border-gray-200 bg-white px-8 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition hover:border-blue-300 hover:text-blue-600 hover:shadow"
            >
              טען עוד תמונות
            </button>
          )}
        </div>
      )}

      {error && photos.length > 0 && (
        <p className="mt-4 text-center text-sm text-red-500">{error}</p>
      )}

      {/* ════════ Lightbox ════════ */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6"
          onClick={closeLightbox}
        >
          <div
            className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-gray-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="text-xs text-gray-400">
                {selectedIdx + 1} / {filtered.length}
              </span>
              <button
                onClick={closeLightbox}
                disabled={modalBusy}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Main image area */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black/50 px-4 py-4 min-h-0">
              {/* Prev */}
              {hasPrev && !editing && (
                <button
                  onClick={() => navigate(-1)}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-xl text-white/80 transition hover:bg-black/60 hover:text-white sm:right-4 sm:p-3"
                >
                  ›
                </button>
              )}

              <img
                src={selected.url}
                alt={selected.description || ""}
                className="max-h-[55vh] max-w-full rounded-lg object-contain transition-opacity duration-200"
              />

              {/* Next */}
              {hasNext && !editing && (
                <button
                  onClick={() => navigate(1)}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-xl text-white/80 transition hover:bg-black/60 hover:text-white sm:left-4 sm:p-3"
                >
                  ‹
                </button>
              )}
            </div>

            {/* Info / Edit panel */}
            <div className="border-t border-white/10 px-5 py-4">
              {modalError && (
                <p className="mb-2 text-center text-sm text-red-400">{modalError}</p>
              )}

              {!editing ? (
                <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-right">
                  <div className="text-white">
                    <p className="text-sm text-gray-400">{formatDate(selected.takenAt)}</p>
                    {selected.description && (
                      <p className="mt-0.5 text-sm">{selected.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={startEdit}
                      disabled={modalBusy}
                      className="rounded-lg bg-white/10 px-4 py-1.5 text-sm text-white transition hover:bg-white/20 disabled:opacity-50"
                    >
                      ✏️ עריכה
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={modalBusy}
                      className="rounded-lg bg-red-500/20 px-4 py-1.5 text-sm text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {modalBusy ? "מוחק…" : "🗑 מחיקה"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex max-w-sm flex-col gap-2">
                  <input
                    type="date"
                    value={editTakenAt}
                    onChange={(e) => setEditTakenAt(e.target.value)}
                    disabled={modalBusy}
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
                  />
                  <textarea
                    placeholder="תיאור (אופציונלי)"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    disabled={modalBusy}
                    rows={2}
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white resize-none placeholder:text-gray-500"
                  />
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={modalBusy || !editTakenAt}
                      className="rounded-lg bg-blue-600 px-5 py-1.5 text-sm text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {modalBusy ? "שומר…" : "שמור"}
                    </button>
                    <button
                      onClick={() => { setEditing(false); setModalError(""); }}
                      disabled={modalBusy}
                      className="rounded-lg bg-white/10 px-5 py-1.5 text-sm text-white transition hover:bg-white/20 disabled:opacity-50"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            <div
              ref={stripRef}
              className="flex gap-1.5 overflow-x-auto border-t border-white/10 bg-black/40 px-3 py-2.5 scrollbar-hide"
            >
              {filtered.map((p) => (
                <img
                  key={p.id}
                  data-active={p.id === selected.id}
                  src={p.url}
                  alt=""
                  onClick={() => { if (!editing && !modalBusy) { setSelected(p); setModalError(""); } }}
                  className={`h-12 w-12 flex-shrink-0 cursor-pointer rounded-lg object-cover transition sm:h-14 sm:w-14 ${
                    p.id === selected.id
                      ? "ring-2 ring-blue-400 opacity-100"
                      : "opacity-40 hover:opacity-80"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}