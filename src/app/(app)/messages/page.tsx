"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Plus, Search, Send, ArrowRight, X } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  apiListConversations,
  apiListMessages,
  apiMarkConversationRead,
  apiOpenConversation,
  apiSendMessage,
} from "@/lib/api/messages";
import type { ConversationSummary, Message, User } from "@/lib/types";
import { Avatar, EmptyState } from "@/components/ui";
import { fmtRelative, fmtDateTime } from "@/lib/arabic";
import { cn } from "@/lib/utils";

const CONVERSATION_POLL_MS = 15000;
const MESSAGE_POLL_MS = 4000;

export default function MessagesPage() {
  const { currentUser, data } = useWorkspace();
  const params = useSearchParams();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");

  const selectedIdRef = useRef<string | null>(null);
  const sinceRef = useRef<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const actorId = currentUser?.id ?? "";
  const usersById = useMemo(() => new Map(data.users.map((u) => [u.id, u])), [data.users]);

  const otherParticipant = useCallback(
    (conversation: { participantIds: string[] }): User | undefined => {
      const otherId = conversation.participantIds.find((id) => id !== actorId);
      return otherId ? usersById.get(otherId) : undefined;
    },
    [actorId, usersById]
  );

  const refreshConversations = useCallback(async () => {
    if (!actorId) return;
    try {
      setConversations(await apiListConversations(actorId));
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  }, [actorId]);

  // Initial load + conversation list polling.
  useEffect(() => {
    if (!actorId) return;
    void refreshConversations();
    const timer = setInterval(refreshConversations, CONVERSATION_POLL_MS);
    return () => clearInterval(timer);
  }, [actorId, refreshConversations]);

  const openConversationWith = useCallback(
    async (targetUserId: string) => {
      if (!actorId) return;
      try {
        const conversation = await apiOpenConversation(targetUserId, actorId);
        setSelectedId(conversation.id);
        setPickerOpen(false);
        await refreshConversations();
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر فتح المحادثة.");
      }
    },
    [actorId, refreshConversations]
  );

  // Deep link: /messages?to=<userId> opens that conversation directly.
  useEffect(() => {
    const to = params.get("to");
    if (to && actorId && to !== actorId) void openConversationWith(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, actorId]);

  const markRead = useCallback(
    async (conversationId: string) => {
      if (!actorId) return;
      try {
        await apiMarkConversationRead(conversationId, actorId);
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
        );
      } catch (err) {
        console.error("Failed to mark read", err);
      }
    },
    [actorId]
  );

  // Load thread + poll for new messages while a conversation is open.
  useEffect(() => {
    selectedIdRef.current = selectedId;
    sinceRef.current = undefined;
    setMessages([]);
    if (!selectedId || !actorId) return;

    let cancelled = false;
    const conversationId = selectedId;

    const apply = (incoming: Message[]) => {
      if (cancelled || !incoming.length) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
        sinceRef.current = merged[merged.length - 1]?.createdAt;
        return merged;
      });
      const last = incoming[incoming.length - 1];
      if (last && last.senderId !== actorId) void markRead(conversationId);
    };

    (async () => {
      try {
        const initial = await apiListMessages(conversationId, actorId);
        if (cancelled) return;
        setMessages(initial);
        sinceRef.current = initial[initial.length - 1]?.createdAt;
        await markRead(conversationId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل الرسائل.");
      }
    })();

    const timer = setInterval(async () => {
      if (selectedIdRef.current !== conversationId) return;
      try {
        apply(await apiListMessages(conversationId, actorId, sinceRef.current));
      } catch (err) {
        console.error("Failed to poll messages", err);
      }
    }, MESSAGE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedId, actorId, markRead]);

  // Keep the latest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || !selectedId || !actorId || sending) return;
    setSending(true);
    setError("");
    try {
      const message = await apiSendMessage(selectedId, body, actorId);
      setDraft("");
      setMessages((prev) => {
        const merged = prev.some((m) => m.id === message.id) ? prev : [...prev, message];
        sinceRef.current = merged[merged.length - 1]?.createdAt;
        return merged;
      });
      void refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إرسال الرسالة.");
    } finally {
      setSending(false);
    }
  }, [draft, selectedId, actorId, sending, refreshConversations]);

  if (!currentUser) return null;

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const selectedOther = selected ? otherParticipant(selected) : undefined;

  // People available to start a new chat with (active members, excluding self).
  const contactable = data.users.filter(
    (u) => u.id !== currentUser.id && u.accountStatus === "active"
  );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">المحادثات</h1>
        <p className="meta mt-1">راسل أعضاء الفريق مباشرة داخل المنصة</p>
      </header>

      {error && (
        <div className="card card-pad border-error/40 bg-error/5 text-sm text-error">{error}</div>
      )}

      <div className="grid h-[calc(100vh-13rem)] grid-cols-1 gap-4 md:grid-cols-[20rem_1fr]">
        {/* Conversation list */}
        <aside
          className={cn(
            "card flex min-h-0 flex-col overflow-hidden",
            selectedId && "hidden md:flex"
          )}
        >
          <div className="flex items-center justify-between border-b border-outline-variant/60 p-3">
            <span className="text-sm font-semibold text-on-surface">الرسائل</span>
            <button onClick={() => setPickerOpen(true)} className="btn-primary gap-1 px-2.5 py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> جديدة
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-4">
                <EmptyState title="لا توجد محادثات بعد" hint="ابدأ محادثة جديدة مع أحد الأعضاء." icon={MessageSquare} />
              </div>
            ) : (
              conversations.map((conversation) => {
                const other = otherParticipant(conversation);
                const active = conversation.id === selectedId;
                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedId(conversation.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-outline-variant/40 p-3 text-right transition hover:bg-surface-container-low/60",
                      active && "bg-surface-container-low"
                    )}
                  >
                    <Avatar name={other?.name ?? "؟"} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-on-surface">{other?.name ?? "عضو غير معروف"}</p>
                        {conversation.unreadCount > 0 && (
                          <span className="badge bg-error text-white">{conversation.unreadCount}</span>
                        )}
                      </div>
                      <p className="truncate text-xs text-on-surface-variant">
                        {conversation.lastMessagePreview || "لا رسائل بعد"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={cn("card flex min-h-0 flex-col overflow-hidden", !selectedId && "hidden md:flex")}>
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState title="اختر محادثة" hint="اختر محادثة من القائمة أو ابدأ واحدة جديدة." icon={MessageSquare} />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 border-b border-outline-variant/60 p-3">
                <button onClick={() => setSelectedId(null)} className="btn-ghost p-1.5 md:hidden" aria-label="رجوع">
                  <ArrowRight className="h-5 w-5" />
                </button>
                <Avatar name={selectedOther?.name ?? "؟"} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-on-surface">{selectedOther?.name ?? "عضو غير معروف"}</p>
                  {selectedOther?.email && <p className="meta truncate" dir="ltr">{selectedOther.email}</p>}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-surface-container-lowest/40 p-4">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-on-surface-variant">لا توجد رسائل بعد. ابدأ المحادثة.</p>
                ) : (
                  messages.map((message) => {
                    const mine = message.senderId === currentUser.id;
                    return (
                      <div key={message.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
                        <div
                          className={cn(
                            "max-w-[75%] rounded-card px-3 py-2 text-sm",
                            mine ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          <p className={cn("mt-1 text-[10px]", mine ? "text-on-primary/70" : "text-on-surface-variant")} title={fmtDateTime(message.createdAt)}>
                            {fmtRelative(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form
                className="flex items-end gap-2 border-t border-outline-variant/60 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <textarea
                  className="input min-h-[42px] max-h-32 flex-1 resize-none py-2"
                  placeholder="اكتب رسالة…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                />
                <button type="submit" disabled={!draft.trim() || sending} className="btn-primary px-3 disabled:opacity-50" aria-label="إرسال">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {pickerOpen && (
        <NewConversationDialog
          users={contactable}
          onClose={() => setPickerOpen(false)}
          onPick={(userId) => void openConversationWith(userId)}
        />
      )}
    </div>
  );
}

function NewConversationDialog({
  users,
  onClose,
  onPick,
}: {
  users: User[];
  onClose: () => void;
  onPick: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = users.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-card bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-on-surface">
            <MessageSquare className="h-5 w-5 text-primary" /> محادثة جديدة
          </h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            className="input pr-9"
            placeholder="ابحث عن عضو…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">لا يوجد أعضاء مطابقون.</p>
          ) : (
            filtered.map((user) => (
              <button
                key={user.id}
                onClick={() => onPick(user.id)}
                className="flex w-full items-center gap-3 rounded-card p-2 text-right transition hover:bg-surface-container-low"
              >
                <Avatar name={user.name} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-on-surface">{user.name}</p>
                  <p className="meta truncate" dir="ltr">{user.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
