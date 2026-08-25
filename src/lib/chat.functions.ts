import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts: Json;
  createdAt: string;
};

const threadTitle = z.object({ title: z.string().min(1).max(120) });
const threadId = z.object({ id: z.string().uuid() });
const threadMessage = z.object({
  threadId: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().default(""),
  parts: z.any().optional(),
});


export function topicFromMessage(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const firstSentence = (cleaned.split(/(?<=[.?!])\s/)[0] ?? cleaned).replace(/[?.,!;:]+$/, "").trim();

  // Drop leading question words and common auxiliary phrases so the title reads like a topic
  let topic = firstSentence
    .replace(/^(?:what|how|why|when|where|who|which|can|could|should|would|will|do|does|did|is|are|was|were|am|have|has|had)\s+/i, "")
    .replace(/\b(?:i|you|we|they|he|she|it)\s+(?:have|has|had|been|do|does|did|should|would|could|can|will|shall|may|might|must|want|need|like|prefer)\s+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Fallback to the cleaned first sentence if stripping removed too much
  if (topic.length < 4) topic = firstSentence;

  topic = topic.charAt(0).toUpperCase() + topic.slice(1);

  if (topic.length > 60) {
    topic = `${topic.slice(0, 57).trimEnd()}...`;
  }

  return topic;
}

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const id = crypto.randomUUID();
    const { error } = await context.supabase.from("threads").insert({
      id,
      user_id: context.userId,
      title: "New chat",
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id, title, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { threads: (data ?? []) as { id: string; title: string; created_at: string; updated_at: string }[] };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => threadId.parse(input))
  .handler(async ({ data, context }) => {
    const { data: thread, error: threadError } = await context.supabase
      .from("threads")
      .select("id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (threadError || !thread) throw new Error("Thread not found");

    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, role, content, parts, created_at")
      .eq("thread_id", data.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const messages: ChatMessage[] = (rows ?? []).map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant" | "system",
      content: row.content ?? "",
      parts: (row.parts ?? null) as Json,
      createdAt: row.created_at,
    }));
    return { messages };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => threadTitle.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ title: data.title, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => threadId.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveUserMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => threadMessage.parse(input))
  .handler(async ({ data, context }) => {
    const parts = data.parts ?? [{ type: "text", text: data.content }];
    const { error } = await context.supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: context.userId,
      role: data.role,
      content: data.content,
      parts: parts as Json,
    });
    if (error) throw new Error(error.message);

    // Auto-name the thread after the topic of the first user message.
    if (data.role === "user" && data.content.trim()) {
      const { data: thread } = await context.supabase
        .from("threads")
        .select("id, title")
        .eq("id", data.threadId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (thread && (!thread.title || thread.title === "New chat")) {
        await context.supabase
          .from("threads")
          .update({ title: topicFromMessage(data.content) })
          .eq("id", data.threadId)
          .eq("user_id", context.userId);
      }
    }
    return { ok: true };
  });

export const saveAssistantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ threadId: z.string().uuid(), message: z.any() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { threadId, message } = data;
    const { error } = await context.supabase.from("messages").insert({
      thread_id: threadId,
      user_id: context.userId,
      role: message.role,
      content: message.content ?? "",
      parts: message.parts as Json,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
