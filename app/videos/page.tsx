"use client";

import { useState, useEffect, useRef } from "react";

type Status = "pending" | "processing" | "done" | "failed";

interface VideoJob {
  id: string;
  status: Status;
  outputUrl: string | null;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
}

const STATUS_MAP: Record<Status, { label: string; color: string }> = {
  pending:    { label: "ממתין…",    color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  processing: { label: "מעבד…",    color: "text-blue-600 bg-blue-50 border-blue-200" },
  done:       { label: "הושלם ✓",  color: "text-green-600 bg-green-50 border-green-200" },
  failed:     { label: "נכשל ✗",   color: "text-red-600 bg-red-50 border-red-200" },
};

export default function VideoCreatorPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<VideoJob | null>(null);  
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  function startPolling(jobId: string) {
  stopPolling();

  let delay = 2000;          // מתחילים ב-2 שניות
  const maxDelay = 15000;    // לא עוברים 15 שניות

  async function poll() {
    try {
      console.log("Polling at:", new Date().toLocaleTimeString());
      
      const res = await fetch(`/api/videos/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch status");

      const data: VideoJob = await res.json();
      setJob(data);

      if (data.status === "done" || data.status === "failed") {
        stopPolling();
        return;
      }

      // Backoff: מגדילים דיליי כל סבב      
      delay = Math.min(delay * 1.5, maxDelay);
      const jitter = Math.floor(Math.random() * 500); // עד חצי שניה
      intervalRef.current = setTimeout(poll, delay + jitter);

    } catch {
      // במקרה שגיאת רשת – ננסה שוב עם אותו delay
      intervalRef.current = setTimeout(poll, delay);
    }
  }

  poll();
}

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => {
    return () => stopPolling();
  }, []);

  // --- Create job ---
  async function handleCreate() {
    setCreating(true);
    setError("");
    setJob(null);

    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom, dateTo }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "יצירת הוידאו נכשלה");
      }

      const { id } = await res.json();

      // Set initial state and start polling
      setJob({ id, status: "pending", outputUrl: null, dateFrom, dateTo, createdAt: new Date().toISOString() });
      startPolling(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  // --- Reset ---
  function handleReset() {
    stopPolling();
    setJob(null);
    setError("");
  }

  const canCreate = dateFrom && dateTo && !creating && !job;
  const statusInfo = job ? STATUS_MAP[job.status as Status] : null;
  const isPolling = job && (job.status === "pending" || job.status === "processing");

  return (
    <div className="mx-auto max-w-lg py-10 px-4">
      <h1 className="mb-2 text-2xl font-bold">🎬 יצירת וידאו משפחתי</h1>
      <p className="mb-8 text-sm text-gray-500">
        בחרו טווח תאריכים ותמונות מהתקופה יורכבו לסרטון
      </p>

      {/* Date inputs */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-gray-700">מתאריך</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            disabled={!!job}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:bg-gray-100"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-gray-700">עד תאריך</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            disabled={!!job}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:bg-gray-100"
          />
        </label>
      </div>

      {/* Error */}
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Create button */}
      {!job && (
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "יוצר…" : "צור וידאו"}
        </button>
      )}

      {/* Job status card */}
      {job && statusInfo && (
        <div className={`mt-2 rounded-lg border p-5 ${statusInfo.color}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">{statusInfo.label}</span>
            {isPolling && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
          </div>

          <div className="text-xs opacity-70 space-y-1">
            <p>מזהה: {job.id}</p>
            <p>
              טווח:{" "}
              {new Date(job.dateFrom).toLocaleDateString("he-IL")}
              {" – "}
              {new Date(job.dateTo).toLocaleDateString("he-IL")}
            </p>
          </div>

          {/* Download button */}
          {job.status === "done" && job.outputUrl && (
            <a
              href={job.outputUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white shadow transition hover:bg-green-700"
            >
              ⬇ הורדת הסרטון
            </a>
          )}

          {/* Done / failed → new video */}
          {(job.status === "done" || job.status === "failed") && (
            <button
              onClick={handleReset}
              className="mt-3 block text-sm underline opacity-70 hover:opacity-100"
            >
              צור וידאו חדש
            </button>
          )}
        </div>
      )}
    </div>
  );
}