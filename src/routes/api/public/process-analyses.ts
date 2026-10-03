import { createFileRoute } from "@tanstack/react-router";

// Background worker hit every minute by the database scheduler, so analyses
// finish (and notifications go out) even when the app is closed.
export const Route = createFileRoute("/api/public/process-analyses")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        if (!key || key !== process.env["SUPABASE_PUBLISHABLE_KEY"]) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { processPending } = await import("@/lib/analysis-worker.server");
        const results = await processPending(5);
        return Response.json({ processed: results.length });
      },
    },
  },
});
