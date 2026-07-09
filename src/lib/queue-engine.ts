import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/notify";

export const GRACE_PERIOD_MS = 3 * 60 * 1000; // 3 minutes to claim a call before auto-skip
export const DEFAULT_ESTIMATE_MINUTES = 15;

const MACHINE_ID = "machine";

class QueueError extends Error {}

async function ensureMachine() {
  return prisma.machineStatus.upsert({
    where: { id: MACHINE_ID },
    update: {},
    create: { id: MACHINE_ID, currentStatus: "available" },
  });
}

async function getOrCreateUser(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new QueueError("Nama tidak boleh kosong.");
  return prisma.user.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed },
  });
}

// Calls the earliest waiting entry if the machine has ice and nobody is
// currently "called". Safe to call repeatedly (no-op if not applicable).
async function callNextIfIdle() {
  const machine = await prisma.machineStatus.findUniqueOrThrow({
    where: { id: MACHINE_ID },
  });
  if (machine.currentStatus !== "available") return;

  const alreadyCalled = await prisma.queueEntry.findFirst({
    where: { status: "called" },
  });
  if (alreadyCalled) return;

  const next = await prisma.queueEntry.findFirst({
    where: { status: "waiting" },
    orderBy: { joinedAt: "asc" },
    include: { user: true },
  });
  if (!next) return;

  await prisma.queueEntry.update({
    where: { id: next.id },
    data: { status: "called", calledAt: new Date() },
  });

  await notifyUser(
    next.user.name,
    `Es batu sudah siap! Kamu punya ${GRACE_PERIOD_MS / 60000} menit untuk mengambilnya sebelum giliranmu dilewati.`
  );
}

// Time-based transitions: brew timer elapsing, and grace-period auto-skip.
// Called at the top of every read/write so the app stays correct without a
// dedicated always-on cron process (see /api/cron/tick for an optional
// external scheduler hook).
export async function tick() {
  const machine = await ensureMachine();
  const now = new Date();

  if (
    machine.currentStatus === "processing" &&
    machine.estimatedReadyAt &&
    machine.estimatedReadyAt <= now
  ) {
    await prisma.machineStatus.update({
      where: { id: MACHINE_ID },
      data: { currentStatus: "available", estimatedReadyAt: null },
    });
  }

  const expiredCalls = await prisma.queueEntry.findMany({
    where: {
      status: "called",
      calledAt: { lte: new Date(now.getTime() - GRACE_PERIOD_MS) },
    },
  });
  for (const entry of expiredCalls) {
    await prisma.queueEntry.update({
      where: { id: entry.id },
      data: { status: "skipped" },
    });
  }

  await callNextIfIdle();
}

export async function getSnapshot() {
  await tick();

  const machine = await prisma.machineStatus.findUniqueOrThrow({
    where: { id: MACHINE_ID },
  });
  const queue = await prisma.queueEntry.findMany({
    where: { status: { in: ["waiting", "called"] } },
    orderBy: { joinedAt: "asc" },
    include: { user: true },
  });

  return {
    machine: {
      status: machine.currentStatus,
      estimatedReadyAt: machine.estimatedReadyAt,
      lastUpdated: machine.lastUpdated,
    },
    queue: queue.map((entry) => ({
      id: entry.id,
      name: entry.user.name,
      status: entry.status,
      joinedAt: entry.joinedAt,
      calledAt: entry.calledAt,
      graceExpiresAt:
        entry.status === "called" && entry.calledAt
          ? new Date(entry.calledAt.getTime() + GRACE_PERIOD_MS)
          : null,
    })),
  };
}

export async function reportEmpty(name: string, minutes = DEFAULT_ESTIMATE_MINUTES) {
  const user = await getOrCreateUser(name);
  await ensureMachine();

  const estimatedReadyAt = new Date(Date.now() + minutes * 60 * 1000);
  await prisma.machineStatus.update({
    where: { id: MACHINE_ID },
    data: {
      currentStatus: "processing",
      estimatedReadyAt,
      lastReportedBy: user.name,
    },
  });

  return getSnapshot();
}

export async function markAvailable(name: string) {
  await getOrCreateUser(name);
  await ensureMachine();

  await prisma.machineStatus.update({
    where: { id: MACHINE_ID },
    data: { currentStatus: "available", estimatedReadyAt: null },
  });

  return getSnapshot();
}

export async function joinQueue(name: string) {
  const user = await getOrCreateUser(name);

  const existing = await prisma.queueEntry.findFirst({
    where: { userId: user.id, status: { in: ["waiting", "called"] } },
  });
  if (existing) {
    throw new QueueError("Kamu sudah ada di dalam antrean.");
  }

  await prisma.queueEntry.create({
    data: { userId: user.id, status: "waiting" },
  });

  return getSnapshot();
}

export async function completeTurn(name: string) {
  const user = await getOrCreateUser(name);

  const entry = await prisma.queueEntry.findFirst({
    where: { userId: user.id, status: "called" },
  });
  if (!entry) {
    throw new QueueError("Kamu tidak sedang dipanggil saat ini.");
  }

  await prisma.queueEntry.update({
    where: { id: entry.id },
    data: { status: "completed", completedAt: new Date() },
  });

  return getSnapshot();
}

export async function leaveQueue(name: string) {
  const user = await getOrCreateUser(name);

  const entry = await prisma.queueEntry.findFirst({
    where: { userId: user.id, status: { in: ["waiting", "called"] } },
  });
  if (!entry) return getSnapshot();

  await prisma.queueEntry.update({
    where: { id: entry.id },
    data: { status: "skipped" },
  });

  return getSnapshot();
}

export { QueueError };
