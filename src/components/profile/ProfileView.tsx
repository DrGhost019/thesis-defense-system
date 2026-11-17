"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { getTranslations } from "@/lib/translations";
import {
  User,
  Shield,
  KeyRound,
  CheckCircle,
  Copy,
  Clock,
  Send,
  Unlink,
  AlertCircle,
  Smartphone,
  ExternalLink,
  X,
} from "lucide-react";

export function ProfileView() {
  const { user, refetchUser, lang } = useAuth();
  const t = getTranslations(lang);
  const queryClient = useQueryClient();

  const [copied, setCopied] = useState(false);
  const [testChatId, setTestChatId] = useState("12345678");
  const [showSimulator, setShowSimulator] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (webhookMessage) {
      const timer = setTimeout(() => {
        setWebhookMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [webhookMessage]);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const { data: baleData, refetch: refetchBale } = useQuery({
    queryKey: ["bale-status"],
    queryFn: async () => {
      const res = await fetch("/api/v1/me/bale", {
        headers: { "Accept-Language": lang },
      });
      if (!res.ok) throw new Error("Failed to load Bale status");
      return res.json();
    },
    refetchInterval: (query) => {
      const d = query.state.data as any;
      return d && !d.linked && d.hasActiveCode ? 4000 : false;
    },
  });

  useEffect(() => {
    if (baleData?.linked && !user?.baleLinked) {
      refetchUser();
      setStatusMessage({
        type: "success",
        text:
          lang === "fa"
            ? "حساب پیام‌رسان بله شما با موفقیت متصل شد."
            : "Your Bale Messenger account has been linked successfully.",
      });
    }
  }, [baleData?.linked, user?.baleLinked, lang, refetchUser]);

  const requestLinkCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/me/bale/link-code", {
        method: "POST",
        headers: { "Accept-Language": lang },
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.message ||
            (lang === "fa" ? "خطا در صدور کد اتصال" : "Failed to issue link code.")
        );
      return data;
    },
    onSuccess: () => {
      setStatusMessage({
        type: "success",
        text:
          lang === "fa"
            ? "کد اتصال ۸ کاراکتری صادر شد. لطفاً آن را به ربات بله ارسال کنید."
            : "8-character linking code generated. Please send it to the Bale bot.",
      });
      refetchBale();
      refetchUser();
    },
    onError: (err: any) => {
      setStatusMessage({
        type: "error",
        text: err.message || (lang === "fa" ? "خطا در صدور کد اتصال" : "Failed to issue link code."),
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/me/bale", {
        method: "DELETE",
        headers: { "Accept-Language": lang },
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.message ||
            (lang === "fa" ? "خطا در لغو اتصال" : "Failed to unlink account.")
        );
      return data;
    },
    onSuccess: () => {
      setStatusMessage({
        type: "success",
        text:
          lang === "fa"
            ? "اتصال حساب بله شما با موفقیت قطع شد."
            : "Your Bale Messenger account has been unlinked.",
      });
      refetchBale();
      refetchUser();
    },
    onError: (err: any) => {
      setStatusMessage({
        type: "error",
        text: err.message || (lang === "fa" ? "خطا در لغو اتصال" : "Failed to unlink account."),
      });
    },
  });

  // Simulator for webhook
  const testWebhookMutation = useMutation({
    mutationFn: async ({ code, chatId }: { code: string; chatId: string }) => {
      const res = await fetch("/api/v1/integrations/bale/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": lang,
        },
        body: JSON.stringify({
          update_id: Date.now(),
          message: {
            message_id: 1,
            chat: { id: chatId },
            from: { id: chatId, first_name: user?.fullName },
            text: code,
          },
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.status === "linked") {
        setWebhookMessage(
          lang === "fa"
            ? "شبیه‌سازی وب‌هوک با موفقیت انجام شد و حساب متصل گردید!"
            : "Webhook simulation succeeded: Bale account linked!"
        );
      } else {
        let outputData = data;
        if (lang === "en" && typeof data === "object" && data !== null) {
          let localizedMessage = data.message;
          let localizedReason = data.reason;

          if (data.message === "توکن محرمانه نامعتبر است" || data.code === "FORBIDDEN") {
            localizedMessage = "Invalid secret token";
          } else if (data.message === "بدنه درخواست نامعتبر است") {
            localizedMessage = "Invalid request body";
          }

          if (data.reason?.includes("کد اتصال نامعتبر یا منقضی شده است")) {
            localizedReason = "Link code is invalid or expired";
          }

          outputData = {
            ...data,
            ...(localizedMessage ? { message: localizedMessage } : {}),
            ...(localizedReason ? { reason: localizedReason } : {}),
          };
        }

        setWebhookMessage(
          `${lang === "fa" ? "پاسخ وب‌هوک:" : "Webhook response:"} ${
            outputData.reason && !outputData.code ? outputData.reason : JSON.stringify(outputData)
          }`
        );
      }
      refetchBale();
      refetchUser();
    },
    onError: (err: any) => {
      setWebhookMessage(
        `${lang === "fa" ? "خطا:" : "Error:"} ${err.message}`
      );
    },
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLinked = baleData ? baleData.linked : !!user?.baleLinked;
  const linkCode = baleData?.code;
  const hasActiveCode = baleData?.hasActiveCode;
  const botUsername =
    baleData?.botUsername ||
    process.env.NEXT_PUBLIC_BALE_BOT_USERNAME ||
    "ArakU_TDSS_bot";
  const botUrl =
    baleData?.botUrl ||
    process.env.NEXT_PUBLIC_BALE_BOT_URL ||
    `https://ble.ir/${botUsername}`;

  return (
    <div className="space-y-6">
      {/* User Information Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors duration-200">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-2xl">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {user?.fullName}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
              {lang === "fa" ? "نام کاربری:" : "Username:"} @{user?.username}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-400 dark:text-slate-400 block text-[11px]">
              {lang === "fa" ? "نقش سیستمی" : "System Role"}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {user?.role === "admin"
                ? lang === "fa"
                  ? "مدیر آموزش"
                  : "Academic Admin"
                : user?.role === "student"
                ? lang === "fa"
                  ? "دانشجو"
                  : "Student"
                : lang === "fa"
                ? "عضو هیئت علمی / استاد"
                : "Faculty Member / Professor"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-400 dark:text-slate-400 block text-[11px]">
              {lang === "fa" ? "پست الکترونیکی" : "Email"}
            </span>
            <span
              className="font-semibold text-slate-800 dark:text-slate-200 font-mono"
              dir="ltr"
            >
              {user?.email || (lang === "fa" ? "ثبت‌نشده" : "Not registered")}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-400 dark:text-slate-400 block text-[11px]">
              {lang === "fa" ? "وضعیت حساب کاربری" : "Account Status"}
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {lang === "fa" ? "فعال" : "Active"}
            </span>
          </div>

          {user?.student && (
            <>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 block text-[11px]">
                  {lang === "fa" ? "شماره دانشجویی" : "Student ID"}
                </span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {user.student.student_number}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 block text-[11px]">
                  {lang === "fa" ? "مقطع تحصیلی" : "Degree Level"}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {user.student.degree_level === "phd"
                    ? lang === "fa"
                      ? "دکتری (PhD)"
                      : "Doctor of Philosophy (PhD)"
                    : lang === "fa"
                    ? "کارشناسی ارشد (Master)"
                    : "Master of Science (MSc)"}
                </span>
              </div>
              <div className="sm:col-span-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 block text-[11px]">
                  {lang === "fa" ? "عنوان رساله / پایان‌نامه" : "Thesis / Dissertation Title"}
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {user.student.thesis_title}
                </span>
              </div>
            </>
          )}

          {user?.professor && (
            <>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 block text-[11px]">
                  {lang === "fa" ? "دانشکده / گروه" : "Department"}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {user.professor.department}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 block text-[11px]">
                  {lang === "fa" ? "مرتبه علمی" : "Academic Title"}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {user.professor.academic_title}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 block text-[11px]">
                  {lang === "fa" ? "اتاق / محل کار" : "Office Location"}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {user.professor.office_location ||
                    (lang === "fa" ? "تعیین نشده" : "Not specified")}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bale Messenger Integration Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded-2xl">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === "fa"
                  ? "اتصال به پیام‌رسان بله (Bale Messenger)"
                  : "Bale Messenger Integration"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === "fa"
                  ? "دریافت اعلان‌های تغییر وضعیت درخواست دفاع و یادآوری ۱ روز قبل از دفاع در پیام‌رسان بله"
                  : "Receive status updates and 1-day reminders on Bale Messenger"}
              </p>
            </div>
          </div>

          <div>
            {isLinked ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-bold border border-emerald-300 dark:border-emerald-700">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{lang === "fa" ? "متصل به بله" : "Bale Connected"}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-700">
                <span>{lang === "fa" ? "متصل‌نشده (اختیاری)" : "Not Connected (Optional)"}</span>
              </span>
            )}
          </div>
        </div>

        {statusMessage && (
          <div
            dir={lang === "fa" ? "rtl" : "ltr"}
            className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-2 animate-in fade-in text-left rtl:text-right ${
              statusMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === "success" ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              )}
              <span className="text-left rtl:text-right">{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="p-0.5 opacity-70 hover:opacity-100 flex-shrink-0"
              title={t.datepicker.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isLinked ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 space-y-1">
              <p className="font-bold">
                {lang === "fa"
                  ? "حساب پیام‌رسان بله شما متصل و فعال است."
                  : "Your Bale Messenger account is active and connected."}
              </p>
              <p className="text-emerald-700 dark:text-emerald-400 text-xs">
                {lang === "fa"
                  ? "تمامی اعلان‌های نهایی‌سازی، رد درخواست و یادآوری یک روز قبل از جلسه به حساب بله شما ارسال خواهد شد."
                  : "All defense session updates, rejections, and 1-day reminders will be sent to your Bale account."}
              </p>
            </div>

            <button
              onClick={() => {
                const promptMsg =
                  lang === "fa"
                    ? "آیا از لغو اتصال حساب بله خود اطمینان دارید؟"
                    : "Are you sure you want to unlink your Bale account?";
                if (confirm(promptMsg)) {
                  unlinkMutation.mutate();
                }
              }}
              disabled={unlinkMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-xs font-semibold transition"
            >
              <Unlink className="w-4 h-4" />
              <span>{lang === "fa" ? "قطع اتصال بله" : "Unlink Bale"}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === "fa"
                ? "برای دریافت اعلان‌های فوری در پیام‌رسان بله، ابتدا یک کد اتصال یک‌بار مصرف ۸ کاراکتری دریافت کنید و سپس آن را در بات بله دانشگاه وارد نمایید."
                : "To receive instant notifications on Bale Messenger, generate an 8-character one-time linking code and submit it to the university Bale bot."}
            </p>

            {hasActiveCode && linkCode ? (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-blue-800 dark:text-blue-300 block">
                      {lang === "fa"
                        ? "کد یک‌بار مصرف اتصال شما (اعتبار: ۱۰ دقیقه):"
                        : "Your one-time linking code (Valid for 10 minutes):"}
                    </span>
                    <div
                      className="text-2xl font-black font-mono tracking-widest text-blue-900 dark:text-blue-200 mt-1 select-all"
                      dir="ltr"
                    >
                      {linkCode}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyCode(linkCode)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Copy className="w-4 h-4" />
                    <span>
                      {copied
                        ? lang === "fa"
                          ? "کپی شد!"
                          : "Copied!"
                        : lang === "fa"
                        ? "کپی کد"
                        : "Copy Code"}
                    </span>
                  </button>
                </div>

                <div className="text-xs text-blue-900/90 dark:text-blue-300 pt-2 border-t border-blue-200/60 dark:border-blue-800/60 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">
                      {lang === "fa" ? "راهنمای اتصال در پیام‌رسان بله:" : "Instructions for Bale Messenger:"}
                    </span>
                    <a
                      href={botUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span dir="ltr">@{botUsername}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-800 dark:text-blue-300">
                    <li>
                      {lang === "fa" ? (
                        <>
                          ربات رسمی سامانه (<span dir="ltr" className="font-mono font-bold">@{botUsername}</span>) را در پیام‌رسان بله باز کنید.
                        </>
                      ) : (
                        <>
                          Open the official defense bot (<span dir="ltr" className="font-mono font-bold">@{botUsername}</span>) in Bale Messenger.
                        </>
                      )}
                    </li>
                    <li>
                      {lang === "fa"
                        ? "کد ۸ کاراکتری بالا را کپی کرده و در چت ربات ارسال نمایید."
                        : "Copy the 8-character code above and send it to the bot."}
                    </li>
                    <li>
                      {lang === "fa"
                        ? "به‌محض ارسال، حساب شما به‌صورت خودکار تأیید و این صفحه به‌روزرسانی می‌شود."
                        : "Your account will be verified immediately and this page will update automatically."}
                    </li>
                  </ol>
                </div>

                {/* Collapsible Webhook Simulator Tool for Local Testing */}
                <div className="pt-2 border-t border-blue-200/60 dark:border-blue-800/60">
                  <button
                    type="button"
                    onClick={() => setShowSimulator((v) => !v)}
                    className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    {showSimulator
                      ? lang === "fa"
                        ? "بستن ابزار تست محلی وب‌هوک"
                        : "Hide local webhook test tool"
                      : lang === "fa"
                      ? "ابزار تست محلی وب‌هوک (برای توسعه‌دهندگان)"
                      : "Local webhook simulator (for testing)"}
                  </button>

                  {showSimulator && (
                    <div className="mt-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-700 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <span>
                          {lang === "fa"
                            ? "شبیه‌سازی دریافت پیام توسط ربات:"
                            : "Simulate incoming bot message:"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={testChatId}
                          onChange={(e) => setTestChatId(e.target.value)}
                          placeholder={lang === "fa" ? "شناسه چت تست (Chat ID)" : "Test Chat ID"}
                          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white font-mono"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            testWebhookMutation.mutate({ code: linkCode, chatId: testChatId })
                          }
                          disabled={testWebhookMutation.isPending}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                        >
                          {testWebhookMutation.isPending
                            ? lang === "fa"
                              ? "در حال ارسال..."
                              : "Sending..."
                            : lang === "fa"
                            ? "شبیه‌سازی ارسال"
                            : "Simulate Send"}
                        </button>
                      </div>
                      {webhookMessage && (
                        <div
                          dir={lang === "fa" ? "rtl" : "ltr"}
                          className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs flex items-center justify-between gap-2 animate-in fade-in text-left rtl:text-right"
                        >
                          <span className="font-medium text-left rtl:text-right">{webhookMessage}</span>
                          <button
                            type="button"
                            onClick={() => setWebhookMessage(null)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => requestLinkCodeMutation.mutate()}
                  disabled={requestLinkCodeMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {requestLinkCodeMutation.isPending
                      ? lang === "fa"
                        ? "در حال صدور کد..."
                        : "Generating Code..."
                      : lang === "fa"
                      ? "دریافت کد اتصال بله (۸ کاراکتر)"
                      : "Generate Bale Link Code (8 characters)"}
                  </span>
                </button>

                <a
                  href={botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-xl text-xs sm:text-sm font-bold transition"
                >
                  <Send className="w-4 h-4" />
                  <span dir="ltr">@{botUsername}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
