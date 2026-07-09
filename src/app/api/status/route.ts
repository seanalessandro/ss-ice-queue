import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/queue-engine";
import { handleError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const snapshot = await getSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    return handleError(err);
  }
}
