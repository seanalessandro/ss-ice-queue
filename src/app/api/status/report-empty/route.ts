import { NextResponse } from "next/server";
import { reportEmpty, DEFAULT_ESTIMATE_MINUTES, QueueError } from "@/lib/queue-engine";
import { handleError } from "@/lib/api-helpers";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new QueueError("Nama wajib diisi.");

    const minutes =
      typeof body.minutes === "number" && body.minutes > 0
        ? body.minutes
        : DEFAULT_ESTIMATE_MINUTES;

    const snapshot = await reportEmpty(name, minutes);
    return NextResponse.json(snapshot);
  } catch (err) {
    return handleError(err);
  }
}
