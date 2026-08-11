import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createChatTools } from "@/lib/chat-tools.server";
import { saveUserMessage, saveAssistantMessage } from "@/lib/chat.functions";

const SYSTEM_PROMPT = `You are Rink IQ Coach — an AI assistant for a hockey video analysis platform.
You help players, coaches, and parents with three things:

1. Player & video analysis data — look up any player, their grades, skill radar, game log, and video analysis reports.
2. Nutrition — calculate daily calories, protein/carbs/fat, water, and meal timing for hockey players.
3. Gear fitting — recommend kick point, stick length, flex, blade pattern, and lie based on height, weight, stance, position, and shot style.
4. Drills — suggest specific on-ice drills to improve a player based on the weakest areas from a video analysis.

Keep answers concise, practical, and hockey-focused. When you use a tool, summarize the result in plain language. If a user asks about something outside these domains, answer briefly and offer to help with one of these areas instead.`;

async function getUserFromRequest(request: Request) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "");
  if (!token) return null;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init?: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    console.error("[chat] auth error", error.message);
    return null;
  }
  return { userId: data.user?.id, supabase };
}

function textFromUIMessage(message: UIMessage) {
  return (message as any).content ?? message.parts.map((p: any) => (p.type === "text" ? p.text : "")).join("");
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, id } = (await request.json()) as { messages?: unknown; id?: string };
        if (!Array.isArray(messages) || !id || typeof id !== "string") {
          return new Response("Messages and thread id are required", { status: 400 });
        }

        const session = await getUserFromRequest(request);
        if (!session?.userId) return new Response("Unauthorized", { status: 401 });

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const uiMessages = messages as UIMessage[];
        const lastUserMessage = uiMessages[uiMessages.length - 1];

        if (lastUserMessage?.role === "user") {
          await saveUserMessage({
            data: {
              threadId: id,
              role: "user",
              content: textFromUIMessage(lastUserMessage),
              parts: (lastUserMessage as any).parts,
            },
          });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3.6-flash");
        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(uiMessages),
          tools: createChatTools(),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async (event) => {
            const assistant = event.responseMessage as any;
            if (!assistant || assistant.role !== "assistant") return;
            await saveAssistantMessage({
              data: {
                threadId: id,
                message: {
                  id: assistant.id,
                  role: "assistant",
                  content: assistant.content ?? "",
                  parts: assistant.parts,
                },
              },
            });
          },
        });
      },
    },
  },
});
