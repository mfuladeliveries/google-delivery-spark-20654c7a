import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ChatRole = "customer" | "driver";

interface OrderChatProps {
  orderId: string;
  /** Current user's ID (auth.uid()). */
  userId: string;
  /** Current user's role in this order. Drives canned messages and message alignment. */
  role: ChatRole;
  /** Display label for the other party (e.g. "Driver" or "Customer"). */
  counterpartyLabel?: string;
}

interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: ChatRole;
  message: string;
  read_at: string | null;
  created_at: string;
}

const CUSTOMER_QUICK = [
  "I'm at the gate",
  "Leave at the door",
  "Please call when you arrive",
  "Use the side entrance",
];

const DRIVER_QUICK = [
  "On my way",
  "I'm outside",
  "Can't find the address — please share landmark",
  "Restaurant is delayed, sorry",
];

const MAX_LEN = 500;

export const OrderChat = ({ orderId, userId, role, counterpartyLabel }: OrderChatProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quick = role === "customer" ? CUSTOMER_QUICK : DRIVER_QUICK;
  const otherLabel = counterpartyLabel || (role === "customer" ? "Driver" : "Customer");

  // Load + realtime subscribe
  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (active && data) {
        setMessages(data as Message[]);
        const unread = (data as Message[]).filter((m) => m.sender_id !== userId && !m.read_at).length;
        setUnreadCount(unread);
      }
    };
    load();

    const channel = supabase
      .channel(`order-chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_id !== userId) {
            setUnreadCount((c) => c + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [orderId, userId]);

  // Auto-scroll on new message when open
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Mark incoming as read when opened
  useEffect(() => {
    if (!open || unreadCount === 0) return;
    const unreadIds = messages.filter((m) => m.sender_id !== userId && !m.read_at).map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase
      .from("order_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(() => setUnreadCount(0));
  }, [open, messages, userId, unreadCount]);

  const send = async (text: string) => {
    const trimmed = text.trim().slice(0, MAX_LEN);
    if (!trimmed || sending) return;
    setSending(true);
    const { error } = await supabase.from("order_messages").insert({
      order_id: orderId,
      sender_id: userId,
      sender_role: role,
      message: trimmed,
    });
    setSending(false);
    if (error) {
      toast.error("Couldn't send message");
      return;
    }
    setDraft("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors w-full justify-center"
      >
        <MessageCircle className="h-4 w-4" />
        <span>Chat with {otherLabel}</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[85vh] sm:h-[600px] w-full sm:max-w-md flex-col rounded-t-2xl sm:rounded-2xl bg-card shadow-card border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="font-bold text-foreground">Chat with {otherLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  <p>No messages yet.<br />Send a quick note below to get started.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === userId;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-card ${
                          mine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-secondary text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.message}</p>
                        <div
                          className={`mt-0.5 flex items-center gap-1 text-[10px] ${
                            mine ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"
                          }`}
                        >
                          <span>
                            {new Date(m.created_at).toLocaleTimeString("en-ZA", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {mine && (m.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick replies */}
            <div className="border-t border-border px-3 py-2">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {quick.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={sending}
                    onClick={() => send(q)}
                    className="flex-shrink-0 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="flex items-center gap-2 border-t border-border p-3"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
                placeholder="Type a message…"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={MAX_LEN}
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:scale-105 transition-transform"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default OrderChat;
