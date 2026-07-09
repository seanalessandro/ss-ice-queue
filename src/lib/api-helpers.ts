import { NextResponse } from "next/server";
import { QueueError } from "@/lib/queue-engine";

export function handleError(err: unknown) {
  if (err instanceof QueueError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Terjadi kesalahan di server." }, { status: 500 });
}

export async function readName(request: Request): Promise<string> {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new QueueError("Nama wajib diisi.");
  return name;
}
