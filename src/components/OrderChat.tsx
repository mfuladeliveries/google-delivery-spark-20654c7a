import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Check, CheckCheck, Paperclip, Mic, Square, Loader2, Play, Pause } from "lucide-react";
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
  message: string | null;
  attachment_url: string | null;
  attachment_type: "image" | "audio" | null;
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
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VOICE_SECONDS = 60;

const AudioPlayer = ({ src }: { src: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-background/30 hover:bg-background/50 transition-colors"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <span className="text-xs opacity-80">Voice note</span>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        preload="metadata"
      />
    </div>
  );
};

export const OrderChat = ({ orderId, userId, role, counterpartyLabel }: OrderChatProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

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
        setMessages(data as unknown as Message[]);
        const unread = (data as unknown as Message[]).filter((m) => m.sender_id !== userId && !m.read_at).length;
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
          const msg = payload.new as unknown as Message;
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
          const msg = payload.new as unknown as Message;
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

  // Cleanup recorder on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") {
        mr.stop();
        mr.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const insertMessage = async (payload: {
    message?: string;
    attachment_url?: string;
    attachment_type?: "image" | "audio";
  }) => {
    const { error } = await supabase.from("order_messages").insert({
      order_id: orderId,
      sender_id: userId,
      sender_role: role,
      message: payload.message ?? null,
      attachment_url: payload.attachment_url ?? null,
      attachment_type: payload.attachment_type ?? null,
    });
    if (error) {
      toast.error("Couldn't send message");
      return false;
    }
    return true;
  };

  const send = async (text: string) => {
    const trimmed = text.trim().slice(0, MAX_LEN);
    if (!trimmed || sending) return;
    setSending(true);
    const ok = await insertMessage({ message: trimmed });
    setSending(false);
    if (ok) setDraft("");
  };

  const uploadAttachment = async (blob: Blob, kind: "image" | "audio", ext: string) => {
    if (blob.size > MAX_FILE_BYTES) {
      toast.error("File is too large (max 8 MB)");
      return;
    }
    setUploading(true);
    const path = `${orderId}/${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-attachments")
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (upErr) {
      setUploading(false);
      toast.error("Upload failed");
      return;
    }
    const { data: signed, error: signErr } = await supabase.storage
      .from("chat-attachments")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
    if (signErr || !signed?.signedUrl) {
      setUploading(false);
      toast.error("Couldn't share file");
      return;
    }
    await insertMessage({ attachment_url: signed.signedUrl, attachment_type: kind });
    setUploading(false);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    await uploadAttachment(file, "image", ext);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    if (recording || uploading) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording isn't supported on this device");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const ext = (mr.mimeType || "audio/webm").includes("webm") ? "webm" : "ogg";
        if (blob.size > 0) await uploadAttachment(blob, "audio", ext);
      };
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_VOICE_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      toast.error("Microphone permission denied");
    }
  };

  const stopRecording = (cancel = false) => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      if (cancel) {
        mr.ondataavailable = null;
        mr.onstop = () => mr.stream.getTracks().forEach((t) => t.stop());
      }
      mr.stop();
    }
    setRecording(false);
    setRecordSeconds(0);
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
                  <p>No messages yet.<br />Send a quick note, photo, or voice note below.</p>
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
                        {m.attachment_url && m.attachment_type === "image" && (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mb-1"
                          >
                            <img
                              src={m.attachment_url}
                              alt="Attachment"
                              className="rounded-lg max-h-64 object-cover"
                              loading="lazy"
                            />
                          </a>
                        )}
                        {m.attachment_url && m.attachment_type === "audio" && (
                          <div className="mb-1">
                            <AudioPlayer src={m.attachment_url} />
                          </div>
                        )}
                        {m.message && (
                          <p className="whitespace-pre-wrap break-words">{m.message}</p>
                        )}
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
                    disabled={sending || uploading || recording}
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
              {recording ? (
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                  <span className="text-foreground font-medium">
                    Recording… {recordSeconds}s
                  </span>
                  <button
                    type="button"
                    onClick={() => stopRecording(true)}
                    className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-secondary"
                    aria-label="Cancel recording"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stopRecording(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:scale-105 transition-transform"
                    aria-label="Send voice note"
                  >
                    <Square className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || sending}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors disabled:opacity-50"
                    aria-label="Send a photo"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={uploading || sending}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors disabled:opacity-50"
                    aria-label="Record a voice note"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
                    placeholder="Type a message…"
                    className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    maxLength={MAX_LEN}
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:scale-105 transition-transform"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default OrderChat;
