import { createFileRoute, useParams } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect } from "react";
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
import { PageShell } from "@/components/PageShell";
import { MessageSquare } from "lucide-react";
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
    return { messages: await getThreadMessages({ data: { id: params.threadId } }) };
  },
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { threadId } = useParams({ from: "/chat/$threadId" });

  const { data } = useSuspenseQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => getThreadMessages({ data: { id: threadId } }),
    initialData: Route.useLoaderData(),
  });

  const chat = useChat({
    id: threadId,
    messages: toUIMessages(data.messages),
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    body: { id: threadId },
    sendExtraMessageFields: true,
  });

  useEffect(() => {
    const input = document.querySelector("[data-prompt-input] textarea") as HTMLTextAreaElement | null;
    input?.focus();
  }, [chat.status]);

  const isLoading = chat.status === "submitted" || chat.status === "streaming";

  return (
    <PageShell title="Coach Bot" subtitle="Ask about players, nutrition, gear, or video analysis">
      <div className="flex h-[calc(100vh-220px)] flex-col rounded-lg border border-border/60 bg-card">
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
                <Message key={message.id} message={message}>
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
            onSubmit={(msg) => {
              chat.sendMessage({ text: msg.text });
            }}
            data-prompt-input
          >
            <PromptInputTextarea
              value={chat.input}
              onChange={(e) => chat.setInput(e.target.value)}
              placeholder="Ask the coach anything..."
              rows={2}
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={chat.status} disabled={isLoading || !chat.input.trim()} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </PageShell>
  );
}
