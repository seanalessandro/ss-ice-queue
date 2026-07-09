import { NextResponse } from "next/server";
import { completeTurn } from "@/lib/queue-engine";
import { handleError, readName } from "@/lib/api-helpers";

export async function POST(request: Request) {
  try {
    const name = await readName(request);
    const snapshot = await completeTurn(name);
    return NextResponse.json(snapshot);
  } catch (err) {
    return handleError(err);
  }
}
