import { createFileRoute, useParams } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";
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
import { getThreadMessages } from "@/lib/chat.functions";
import { AppNav } from "@/components/AppNav";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage } from "@/lib/chat.functions";

function toUIMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    parts: (m.parts ?? [{ type: "text", text: m.content }]) as any,
    createdAt: new Date(m.createdAt),
  }));
}

export const Route = createFileRoute("/chat/$threadId")({
  loader: async ({ params }) => {
    return getThreadMessages({ data: { id: params.threadId } });
  },
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { threadId } = useParams({ from: "/chat/$threadId" });
  const loaderData = Route.useLoaderData();

  const { data } = useSuspenseQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => getThreadMessages({ data: { id: threadId } }),
    initialData: loaderData,
  });

  const [input, setInput] = useState("");

  const chat = useChat({
    id: threadId,
    messages: toUIMessages(data.messages),
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
                  icon={<MessageSquare className="size-8 text-ice" />}
                  title="Ask Rink IQ Coach"
                  description="Try: 'What should a 16-year-old forward eat on game day?' or 'Analyze Elias' latest video.'"
                />
              ) : (
                chat.messages.map((message) => (
                  <Message key={message.id} from={message.role}>
                    <MessageContent>
                      <MessageResponse>{message.content}</MessageResponse>
                    </MessageContent>
                    <MessageToolbar>
                      <MessageAction label="Copy" onClick={() => navigator.clipboard.writeText(message.content)}>
                        Copy
                      </MessageAction>
                    </MessageToolbar>
                  </Message>
                ))
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
