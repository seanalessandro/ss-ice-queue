import { getSnapshot } from "@/lib/queue-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const POLL_INTERVAL_MS = 1000;
const HEARTBEAT_EVERY_MS = 15_000;
const MAX_STREAM_MS = 8_000;

export async function GET() {
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const heartbeat = () => controller.enqueue(encoder.encode(`: hb\n\n`));

      controller.enqueue(encoder.encode(`retry: 1000\n\n`));

      let lastSerialized = "";
      let lastSentAt = Date.now();
      const startedAt = Date.now();

      try {
        while (!cancelled && Date.now() - startedAt < MAX_STREAM_MS) {
          const snapshot = await getSnapshot();
          const serialized = JSON.stringify(snapshot);
          if (serialized !== lastSerialized) {
            send("snapshot", snapshot);
            lastSerialized = serialized;
            lastSentAt = Date.now();
          } else if (Date.now() - lastSentAt > HEARTBEAT_EVERY_MS) {
            heartbeat();
            lastSentAt = Date.now();
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
