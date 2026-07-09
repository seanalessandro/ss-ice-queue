import { NextResponse } from "next/server";
import { tick } from "@/lib/queue-engine";

// Optional hook for an external scheduler (cron, uptime pinger, etc). The app
// already runs the same tick() on every GET /api/status, so this is only
// useful if you want auto-skip/auto-available to fire even while nobody has
// the dashboard open.
export async function POST() {
  await tick();
  return NextResponse.json({ ok: true });
}
