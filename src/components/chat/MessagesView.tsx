"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { getTranslations } from "@/lib/translations";
import {
  MessageSquare,
  Send,
  Lock,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";

export function MessagesView({ initialSessionId }: { initialSessionId?: number }) {
  const { user, lang } = useAuth();
  const t = getTranslations(lang);
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState<number | null>(initialSessionId || null);
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-dismiss error notifications after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const parseErrorMessage = (err: any): string => {
    const raw = String(err?.message || "");
    if (raw.includes("قطعی") || raw.includes("confirmed")) {
      return t.messages.onlyConfirmedSessionError;
    }
    if (raw.includes("تنها اعضای این جلسه") || raw.includes("members")) {
      return t.messages.forbiddenMessageError;
    }
    if (raw.includes("یافت نشد") || raw.includes("not found")) {
      return t.messages.sessionNotFoundError;
    }
    if (raw.includes("دسترسی به پیام‌های این جلسه را ندارید") || raw.includes("access")) {
      return t.messages.noAccessError;
    }
    return raw || (lang === "fa" ? "خطایی رخ داد" : "An error occurred");
  };

  // Fetch list of confirmed sessions the user belongs to
  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/v1/me/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
  });

  // Extract available sessions for messaging
  const activeSession = dashboardData?.activeSession;
  const upcomingSessions = dashboardData?.upcomingSessions?.map((s: any) => s.session) || [];
  const selectableSessions = [];

  if (activeSession && activeSession.status === "confirmed") {
    selectableSessions.push(activeSession);
  }
  for (const s of upcomingSessions) {
    if (!selectableSessions.some((item) => item.session_id === s.session_id)) {
      selectableSessions.push(s);
    }
  }

  // If no sessionId chosen yet, pick the first confirmed session
  const effectiveSessionId = sessionId || selectableSessions[0]?.session_id;

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ["session-messages", effectiveSessionId],
    queryFn: async () => {
      if (!effectiveSessionId) return null;
      const res = await fetch(`/api/v1/sessions/${effectiveSessionId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!effectiveSessionId,
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/v1/sessions/${effectiveSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send message");
      return data;
    },
    onSuccess: () => {
      setContent("");
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["session-messages", effectiveSessionId] });
    },
    onError: (err: any) => {
      setErrorMessage(parseErrorMessage(err));
    },
  });

  const messages: any[] = threadData?.messages || [];
  const isReadOnly = threadData?.isReadOnly ?? false;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <span>{t.messages.title}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.messages.desc}
          </p>
        </div>

        {selectableSessions.length > 1 && (
          <select
            value={effectiveSessionId || ""}
            onChange={(e) => setSessionId(parseInt(e.target.value, 10))}
            className="p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            {selectableSessions.map((s: any) => (
              <option key={s.session_id} value={s.session_id}>
                #{s.session_id} - {s.scheduled_date?.slice(0, 10)}
              </option>
            ))}
          </select>
        )}
      </div>

      {!effectiveSessionId ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 space-y-3">
          <Lock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {lang === "fa" ? "امکان گفتگو فعال نیست" : "Session Thread Unavailable"}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
            {t.messages.noActiveSessionNotice}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[550px]">
          {/* Thread Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/60 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg">
                <MessageSquare className="w-4 h-4" />
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                {lang === "fa" ? `گفتگوی جلسه دفاع #${effectiveSessionId}` : `Session Discussion #${effectiveSessionId}`}
              </span>
            </div>

            {isReadOnly && (
              <span className="text-xs bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-full font-semibold">
                {lang === "fa" ? "فقط خواندنی (جلسه لغو شده)" : "Read-only (Session Cancelled)"}
              </span>
            )}
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
            {threadLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
                <span>{t.messages.emptyChat}</span>
              </div>
            ) : (
              messages.map((msg: any) => {
                const isMine = msg.sender_user_id === user?.userId;
                return (
                  <div
                    key={msg.message_id}
                    className={`flex flex-col ${isMine ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-3.5 shadow-sm text-xs space-y-1.5 ${
                        isMine
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[10px] opacity-80 font-semibold border-b pb-1 border-white/20">
                        <span>{msg.sender.full_name}</span>
                        <span>•</span>
                        <span>
                          {msg.sender.role === "student"
                            ? t.navbar.student
                            : t.navbar.professor}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <div className="text-[9px] opacity-70 text-left font-mono" dir="ltr">
                        {new Date(msg.sent_at).toLocaleTimeString(lang === "fa" ? "fa-IR" : "en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message Input Box */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl">
            {errorMessage && (
              <div className="p-3 mb-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isReadOnly ? (
              <p className="text-center text-xs text-slate-400 py-2">
                {lang === "fa"
                  ? "این جلسه لغو گردیده و امکان ارسال پیام جدید وجود ندارد."
                  : "This session is cancelled; no new messages can be posted."}
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (content.trim()) {
                    sendMutation.mutate(content);
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t.messages.typeMessagePlaceholder}
                  maxLength={2000}
                  className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={sendMutation.isPending || !content.trim()}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-50"
                  title={t.messages.sendBtn}
                >
                  <Send className="w-5 h-5 rtl:rotate-180" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
