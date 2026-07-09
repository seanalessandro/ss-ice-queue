"use client";

import { useCallback, useEffect, useState } from "react";

type MachineState = "available" | "processing" | "empty";
type QueueState = "waiting" | "called" | "completed" | "skipped";

type QueueEntry = {
  id: string;
  name: string;
  status: QueueState;
  joinedAt: string;
  calledAt: string | null;
  graceExpiresAt: string | null;
};

type Snapshot = {
  machine: {
    status: MachineState;
    estimatedReadyAt: string | null;
    lastUpdated: string;
  };
  queue: QueueEntry[];
};

const POLL_MS = 4000;
const NAME_STORAGE_KEY = "iceQueueName";

const STATUS_META: Record<
  MachineState,
  { emoji: string; label: string; badge: string; card: string }
> = {
  available: {
    emoji: "\u{1F7E2}",
    label: "Tersedia",
    badge: "bg-green-100 text-green-800 border-green-300",
    card: "border-green-300 bg-green-50",
  },
  processing: {
    emoji: "\u{1F7E1}",
    label: "Menipis / Sedang Proses",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-300",
    card: "border-yellow-300 bg-yellow-50",
  },
  empty: {
    emoji: "\u{1F534}",
    label: "Habis",
    badge: "bg-red-100 text-red-800 border-red-300",
    card: "border-red-300 bg-red-50",
  },
};

function formatCountdown(target: string | null, now: number) {
  if (!target) return null;
  const diffMs = new Date(target).getTime() - now;
  if (diffMs <= 0) return "00:00";
  const totalSeconds = Math.ceil(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function Home() {
  const [name, setName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const stored = window.localStorage.getItem(NAME_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration-safe read of localStorage
    if (stored) setName(stored);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Gagal memuat status.");
      const data: Snapshot = await res.json();
      setSnapshot(data);
    } catch {
      // Keep last known snapshot on transient network errors.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling: fetch immediately, then on an interval
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function callApi(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Terjadi kesalahan.");
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  function handleSetName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    window.localStorage.setItem(NAME_STORAGE_KEY, trimmed);
    setName(trimmed);
  }

  if (!name) {
    return (
      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-linear-to-br from-sky-100 via-cyan-50 to-blue-100 p-6 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950">
        <span
          aria-hidden
          className="animate-ice-bob pointer-events-none absolute left-[8%] top-[15%] text-5xl opacity-70 [animation-delay:-1s]"
        >
          🧊
        </span>
        <span
          aria-hidden
          className="animate-ice-bob pointer-events-none absolute right-[10%] top-[22%] text-4xl opacity-60 [animation-delay:-3s]"
        >
          ❄️
        </span>
        <span
          aria-hidden
          className="animate-ice-bob pointer-events-none absolute left-[14%] bottom-[18%] text-4xl opacity-60 [animation-delay:-2s]"
        >
          🧊
        </span>
        <span
          aria-hidden
          className="animate-ice-bob pointer-events-none absolute right-[13%] bottom-[12%] text-5xl opacity-70 [animation-delay:-4.5s]"
        >
          ❄️
        </span>

        <form
          onSubmit={handleSetName}
          className="animate-ice-pop relative w-full max-w-sm space-y-5 rounded-3xl border border-white/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
        >
          <div className="text-6xl">🧊</div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-sky-900 dark:text-sky-100">
              IceQueue
            </h1>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Siapa nih yang lagi butuh es? Kenalan dulu, yuk! 😄
            </p>
          </div>
          <input
            autoFocus
            className="w-full rounded-full border-2 border-sky-200 bg-white px-4 py-2.5 text-center text-sm font-medium placeholder:text-black/30 focus:border-sky-400 focus:outline-none dark:border-white/20 dark:bg-transparent dark:placeholder:text-white/30"
            placeholder="Nama kamu siapa?"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <button
            type="submit"
            className="hover:animate-ice-wiggle w-full rounded-full bg-linear-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-500/30 transition-transform hover:scale-105 active:scale-95"
          >
            Gaskeun! 🚀
          </button>
          <p className="text-xs text-black/40 dark:text-white/40">
            Nama kamu cuma disimpan di HP/laptop ini, kok.
          </p>
        </form>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-sm text-black/60 dark:text-white/60">
        Memuat status es batu…
      </main>
    );
  }

  const meta = STATUS_META[snapshot.machine.status];
  const countdown = formatCountdown(snapshot.machine.estimatedReadyAt, now);
  const myEntry = snapshot.queue.find((q) => q.name === name);
  const isAvailable = snapshot.machine.status === "available";
  const canJoin = !isAvailable && !myEntry;
  const waitingList = snapshot.queue.filter((q) => q.status === "waiting" || q.status === "called");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">🧊 IceQueue</h1>
        <button
          className="text-xs text-black/50 underline hover:text-black/80 dark:text-white/50 dark:hover:text-white/80"
          onClick={() => {
            window.localStorage.removeItem(NAME_STORAGE_KEY);
            setName(null);
            setNameInput("");
          }}
        >
          Bukan {name}?
        </button>
      </header>

      <section className={`rounded-xl border p-5 ${meta.card}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.emoji}</span>
          <div>
            <p className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
              {meta.label}
            </p>
            {countdown && (
              <p className="mt-1 text-sm text-black/70 dark:text-white/70">
                Perkiraan siap dalam <span className="font-mono font-semibold">{countdown}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => callApi("/api/status/report-empty")}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:bg-transparent"
          >
            Laporkan Es Habis
          </button>
          {!isAvailable && (
            <button
              disabled={busy}
              onClick={() => callApi("/api/status/mark-available")}
              className="rounded-md border border-green-300 bg-white px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:bg-transparent"
            >
              Tandai Es Sudah Jadi
            </button>
          )}
        </div>
      </section>

      {myEntry?.status === "called" && (
        <section className="rounded-xl border border-blue-300 bg-blue-50 p-5 dark:bg-blue-950/40">
          <p className="font-semibold text-blue-900 dark:text-blue-100">
            Giliranmu! Ambil es batu sekarang.
          </p>
          <p className="text-sm text-blue-800/80 dark:text-blue-100/70">
            Sisa waktu sebelum dilewati:{" "}
            <span className="font-mono font-semibold">
              {formatCountdown(myEntry.graceExpiresAt, now)}
            </span>
          </p>
          <button
            disabled={busy}
            onClick={() => callApi("/api/queue/complete")}
            className="mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Selesai Ambil
          </button>
        </section>
      )}

      {myEntry?.status === "waiting" && (
        <section className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
          Kamu sedang mengantre. Kami akan memberi tahu kamu saat gilirannya tiba.
          <button
            disabled={busy}
            onClick={() => callApi("/api/queue/leave")}
            className="ml-2 text-xs text-red-600 underline"
          >
            Batalkan antrean
          </button>
        </section>
      )}

      {canJoin && (
        <button
          disabled={busy}
          onClick={() => callApi("/api/queue/join")}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Ikut Antrean
        </button>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-black/70 dark:text-white/70">
          Antrean Saat Ini ({waitingList.length})
        </h2>
        {waitingList.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">Belum ada yang mengantre.</p>
        ) : (
          <ol className="space-y-1.5">
            {waitingList.map((entry, idx) => (
              <li
                key={entry.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                  entry.status === "called"
                    ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                <span>
                  {idx + 1}. {entry.name}
                  {entry.name === name && " (kamu)"}
                </span>
                {entry.status === "called" && (
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-200">
                    dipanggil
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
