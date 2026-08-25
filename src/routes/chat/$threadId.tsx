import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageToolbar,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { getThreadMessages, renameThread, topicFromMessage } from "@/lib/chat.functions";
import { AppNav } from "@/components/AppNav";
import coachBot from "@/assets/coach-bot.png";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage } from "@/lib/chat.functions";

const title = "Coach Bot — Hockey Video Analyzer";
const description = "Chat with the Rink IQ Coach about players, nutrition, gear, and video analysis.";

function toUIMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    parts: (m.parts ?? [{ type: "text", text: m.content }]) as any,
    createdAt: new Date(m.createdAt),
  }));
}

function getMessageText(message: UIMessage & { content?: string }) {
  const partText = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");

  return partText || message.content || "";
}

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { threadId } = useParams({ from: "/chat/$threadId" });

  const { data, isPending, error } = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Please sign in to open this conversation.");
      return getThreadMessages({ data: { id: threadId } });
    },
  });

  if (isPending) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppNav />
        <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-5 py-8 text-sm text-muted-foreground">
          Loading conversation…
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppNav />
        <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-5 py-8 text-sm text-destructive">
          {error instanceof Error ? error.message : "Unable to load this conversation."}
        </main>
      </div>
    );
  }

  return <ChatConversation threadId={threadId} initialMessages={data.messages} />;
}

function ChatConversation({ threadId, initialMessages }: { threadId: string; initialMessages: ChatMessage[] }) {

  const [input, setInput] = useState("");

  const queryClient = useQueryClient();

  const chat = useChat({
    id: threadId,
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    messages: toUIMessages(initialMessages),
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async () => {
        const { data: session } = await supabase.auth.getSession();
        return { Authorization: `Bearer ${session.session?.access_token ?? ""}` };
      },
      body: () => ({ id: threadId }),
    }),
  });

  useEffect(() => {
    const input = document.querySelector("[data-prompt-input] textarea") as HTMLTextAreaElement | null;
    input?.focus();
  }, [chat.status]);

  const isLoading = chat.status === "submitted" || chat.status === "streaming";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav />
      <main className="mx-auto w-full max-w-7xl px-5 py-8">
        <h1 className="text-3xl font-bold">Coach Bot</h1>
        <p className="mt-2 text-muted-foreground">Ask about players, nutrition, gear, or video analysis.</p>

        <div className="mt-6 flex h-[calc(100vh-260px)] flex-col rounded-lg border border-border/60 bg-card">
          <Conversation className="flex-1">
            <ConversationContent>
              {chat.messages.length === 0 ? (
                <ConversationEmptyState
                  icon={<img src={coachBot} alt="Rink IQ Coach" className="size-20" loading="lazy" />}
                  title="Ask Rink IQ Coach"
                  description="Try: 'What should a 16-year-old forward eat on game day?' or 'Analyze Elias' latest video.'"
                />
              ) : (
                chat.messages.map((message) => {
                  const text = getMessageText(message);

                  return (
                    <Message key={message.id} from={message.role}>
                      <MessageContent>
                        <MessageResponse>{text}</MessageResponse>
                      </MessageContent>
                      {text ? (
                        <MessageToolbar>
                          <MessageAction
                            label="Copy response"
                            tooltip="Copy response"
                            onClick={() => navigator.clipboard.writeText(text)}
                          >
                            <Copy className="size-4" />
                          </MessageAction>
                        </MessageToolbar>
                      ) : null}
                    </Message>
                  );
                })
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t border-border/60 p-4">
            <PromptInput
              onSubmit={() => {
                if (!input.trim()) return;
                chat.sendMessage({ text: input.trim() });
                setInput("");
              }}
              data-prompt-input
            >
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the coach anything..."
                rows={2}
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={chat.status} disabled={isLoading || !input.trim()} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </main>
    </div>
  );
}
