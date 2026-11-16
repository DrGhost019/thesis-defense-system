"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../providers";
import {
  Lock,
  User,
  Shield,
  BookOpen,
  UserCheck,
  GraduationCap,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Sun,
  Moon,
  Globe,
  CheckCircle2,
  X,
} from "lucide-react";
import { TurnstileWidget, TurnstileWidgetHandle } from "./TurnstileWidget";

export function AuthPage() {
  const { login, lang, setLang, theme, toggleTheme } = useAuth();
  const isEn = lang === "en";

  const [authError, setAuthError] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  // Auto-dismiss CAPTCHA notification error after 5 seconds (does not apply to username/password errors)
  useEffect(() => {
    if (captchaError) {
      const timer = setTimeout(() => {
        setCaptchaError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [captchaError]);

  // Dynamic schema guaranteeing strictly localized validation messages
  const loginSchema = useMemo(() => {
    return z.object({
      username: z
        .string()
        .min(1, isEn ? "Username is required" : "ورود نام کاربری الزامی است")
        .min(3, isEn ? "Username must be at least 3 characters" : "نام کاربری باید حداقل ۳ کاراکتر باشد")
        .max(50, isEn ? "Username must be at most 50 characters" : "نام کاربری حداکثر ۵۰ کاراکتر است")
        .regex(
          /^[a-zA-Z0-9._-]+$/,
          isEn
            ? "Username can only contain letters, numbers, dots, underscores, and hyphens"
            : "نام کاربری فقط می‌تواند شامل حروف، ارقام، نقطه، زیرخط و خط تیره باشد"
        ),
      password: z
        .string()
        .min(1, isEn ? "Password is required" : "ورود رمز عبور الزامی است")
        .min(8, isEn ? "Password must be at least 8 characters" : "رمز عبور باید حداقل ۸ کاراکتر باشد"),
    });
  }, [isEn]);

  // Login form
  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const getLocalizedFieldError = (field: "username" | "password") => {
    const err = loginForm.formState.errors[field];
    if (!err?.message) return null;
    const msg = String(err.message);

    if (field === "username") {
      if (msg.includes("الزامی") || msg.includes("required")) {
        return isEn ? "Username is required" : "ورود نام کاربری الزامی است";
      }
      if (msg.includes("حداقل") || msg.includes("least 3")) {
        return isEn
          ? "Username must be at least 3 characters"
          : "نام کاربری باید حداقل ۳ کاراکتر باشد";
      }
      if (msg.includes("حداکثر") || msg.includes("most 50")) {
        return isEn
          ? "Username must be at most 50 characters"
          : "نام کاربری حداکثر ۵۰ کاراکتر است";
      }
      if (msg.includes("فقط") || msg.includes("regex") || msg.includes("letters")) {
        return isEn
          ? "Username can only contain letters, numbers, dots, underscores, and hyphens"
          : "نام کاربری فقط می‌تواند شامل حروف، ارقام، نقطه، زیرخط و خط تیره باشد";
      }
      return isEn ? "Invalid username" : msg;
    }

    if (field === "password") {
      if (msg.includes("الزامی") || msg.includes("required")) {
        return isEn ? "Password is required" : "ورود رمز عبور الزامی است";
      }
      if (msg.includes("حداقل") || msg.includes("least 8")) {
        return isEn
          ? "Password must be at least 8 characters"
          : "رمز عبور باید حداقل ۸ کاراکتر باشد";
      }
      return isEn ? "Invalid password" : msg;
    }

    return msg;
  };

  const getLocalizedAuthError = (raw: string | null) => {
    if (!raw) return null;
    if (
      raw.includes("نام کاربری یا رمز عبور اشتباه است") ||
      raw.includes("Invalid username or password") ||
      raw.includes("UNAUTHENTICATED")
    ) {
      return isEn
        ? "Invalid username or password"
        : "نام کاربری یا رمز عبور اشتباه است";
    }
    if (
      raw.includes("غیرفعال") ||
      raw.includes("deactivated") ||
      raw.includes("disabled")
    ) {
      return isEn
        ? "Your account is deactivated. Please contact the administrator"
        : "حساب کاربری شما غیرفعال شده است. لطفاً با مدیر آموزش تماس بگیرید";
    }
    if (
      raw.includes("لطفاً نام کاربری و رمز عبور را وارد") ||
      raw.includes("Please enter username and password") ||
      raw.includes("Please enter your username")
    ) {
      return isEn
        ? "Please enter username and password or select a trial account."
        : "لطفاً نام کاربری و رمز عبور را وارد فرمایید یا یکی از حساب‌های آزمایشی را انتخاب کنید.";
    }
    if (raw.includes("خطای شبکه") || raw.includes("Network")) {
      return isEn
        ? "Network connection error with server"
        : "خطای شبکه در ارتباط با سرور";
    }
    if (isEn && /[\u0600-\u06FF]/.test(raw)) {
      return "Authentication failed. Please verify your credentials";
    }
    return raw;
  };

  const demoAccounts = [
    {
      id: "admin",
      username: "admin",
      password: "admin123456",
      titleFa: "مدیر آموزش",
      titleEn: "Academic Admin",
      badgeFa: "اداره آموزش",
      badgeEn: "Admin",
      icon: Shield,
      borderColor: "border-purple-300 dark:border-purple-800",
      activeBg: "bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 dark:border-purple-500 ring-2 ring-purple-400",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      id: "prof.ahmadi",
      username: "prof.ahmadi",
      password: "pass123456",
      titleFa: "دکتر احمدی (استاد)",
      titleEn: "Dr. Ahmadi",
      badgeFa: "عضو هیئت علمی",
      badgeEn: "Faculty",
      icon: BookOpen,
      borderColor: "border-emerald-300 dark:border-emerald-800",
      activeBg: "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-400",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "prof.hosseini",
      username: "prof.hosseini",
      password: "pass123456",
      titleFa: "دکتر حسینی (استاد)",
      titleEn: "Dr. Hosseini",
      badgeFa: "هیئت داوران",
      badgeEn: "Committee",
      icon: UserCheck,
      borderColor: "border-teal-300 dark:border-teal-800",
      activeBg: "bg-teal-50/80 dark:bg-teal-950/40 border-teal-500 dark:border-teal-500 ring-2 ring-teal-400",
      iconColor: "text-teal-600 dark:text-teal-400",
    },
    {
      id: "student.alavi",
      username: "student.alavi",
      password: "pass123456",
      titleFa: "علی علوی (دانشجو)",
      titleEn: "Ali Alavi",
      badgeFa: "دانشجو",
      badgeEn: "Student",
      icon: GraduationCap,
      borderColor: "border-blue-300 dark:border-blue-800",
      activeBg: "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 ring-2 ring-blue-400",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
  ];

  // Selecting a demo account automatically populates the username and password fields
  const handleSelectAccount = (username: string, pass: string) => {
    setSelectedAccount(username);
    loginForm.setValue("username", username, { shouldValidate: true });
    loginForm.setValue("password", pass, { shouldValidate: true });
    setAuthError(null);
  };

  const handleLoginSubmit = async (values: any) => {
    if (!values.username || !values.password) {
      setAuthError(
        isEn
          ? "Please enter username and password or select a trial account."
          : "لطفاً نام کاربری و رمز عبور را وارد فرمایید یا یکی از حساب‌های آزمایشی را انتخاب کنید."
      );
      return;
    }

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      setCaptchaError(
        isEn
          ? "Please complete the security CAPTCHA verification before signing in."
          : "لطفاً ابتدا تأیید امنیتی کپچا را انجام دهید."
      );
      return;
    }

    setAuthError(null);
    setCaptchaError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": lang,
        },
        body: JSON.stringify({
          ...values,
          captcha_token: captchaToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        turnstileRef.current?.reset();
        setCaptchaToken(null);
        if (
          data.message?.includes("کپچا") ||
          data.message?.includes("CAPTCHA")
        ) {
          setCaptchaError(
            isEn
              ? "Please complete the security CAPTCHA verification before signing in."
              : "لطفاً ابتدا تأیید امنیتی کپچا را انجام دهید."
          );
        } else {
          setAuthError(
            data.message ||
              (isEn
                ? "Invalid username or password"
                : "نام کاربری یا رمز عبور اشتباه است")
          );
        }
      } else {
        login(data.accessToken, data.user);
      }
    } catch {
      setAuthError(
        isEn
          ? "Network connection error with server"
          : "خطای شبکه در ارتباط با سرور"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans relative">
      {/* Top Controls: Language & Theme Toggle */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <button
          onClick={() => setLang(lang === "fa" ? "en" : "fa")}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur border border-white/20 transition shadow-sm text-xs font-semibold flex items-center gap-1.5"
          title="Toggle Language"
        >
          <Globe className="w-3.5 h-3.5 text-blue-300" />
          <span>{lang === "fa" ? "English" : "فارسی"}</span>
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur border border-white/20 transition shadow-sm"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-200" />
          )}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* University Logo */}
        <div className="inline-flex p-3 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 mb-3 animate-in fade-in zoom-in duration-300">
          <img
            src="/assets/uni.png"
            alt="University Logo"
            className="w-14 h-14 object-contain drop-shadow"
          />
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          {lang === "fa" ? "سامانه زمان‌بندی جلسات دفاع" : "Thesis Defense Scheduling System"}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-300">
          {lang === "fa"
            ? "پرتال یکپارچه ورود اعضای دانشگاه (دانشجویان، اساتید و کارکنان)"
            : "University Single Sign-On Portal (Students, Faculty & Staff)"}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white dark:bg-slate-900 py-7 px-5 sm:px-8 shadow-2xl rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors duration-200">
          {/* Header Title */}
          <div className="text-center mb-5">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
              {lang === "fa" ? "ورود به حساب کاربری دانشگاهی" : "University Account Login"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === "fa"
                ? "اطلاعات کاربری از سامانه جامع آموزش دانشگاه فراخوانی می‌شود"
                : "Credentials are authenticated via the university identity system"}
            </p>
          </div>

          {/* CAPTCHA Error Notification Banner (Auto-dismisses after 5 seconds) */}
          {captchaError && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2.5 text-xs sm:text-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{captchaError}</span>
              </div>
              <button
                type="button"
                onClick={() => setCaptchaError(null)}
                className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 p-0.5 rounded transition"
                title={lang === "fa" ? "بستن" : "Close"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Username / Password / Server Error Notification (Does NOT auto-dismiss) */}
          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-start justify-between gap-2.5 text-xs sm:text-sm animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
                <div>{getLocalizedAuthError(authError)}</div>
              </div>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 p-0.5 rounded transition"
                title={lang === "fa" ? "بستن" : "Close"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
            {/* 1. User Profile (Username & Password) */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "fa" ? "نام کاربری دانشگاهی" : "University Username"}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 rtl:right-0 ltr:right-auto ltr:left-0 pr-3 ltr:pr-0 ltr:pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    {...loginForm.register("username", {
                      onChange: () => {
                        if (authError) setAuthError(null);
                      },
                    })}
                    className="w-full rtl:pr-10 rtl:pl-3 ltr:pl-10 ltr:pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
                    placeholder={lang === "fa" ? "مثال: admin یا student.alavi" : "e.g. admin or student.alavi"}
                    dir="ltr"
                  />
                </div>
                {getLocalizedFieldError("username") && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {getLocalizedFieldError("username")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "fa" ? "رمز عبور" : "Password"}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 rtl:right-0 ltr:right-auto ltr:left-0 pr-3 ltr:pr-0 ltr:pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    {...loginForm.register("password", {
                      onChange: () => {
                        if (authError) setAuthError(null);
                      },
                    })}
                    className="w-full rtl:pr-10 rtl:pl-3 ltr:pl-10 ltr:pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
                    placeholder="••••••••"
                    dir="ltr"
                  />
                </div>
                {getLocalizedFieldError("password") && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {getLocalizedFieldError("password")}
                  </p>
                )}
              </div>
            </div>

            {/* 2. CAPTCHA Verification & Sign In Button */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="relative">
                <TurnstileWidget
                  ref={turnstileRef}
                  theme={theme}
                  lang={lang}
                  onVerify={(token) => {
                    setCaptchaToken(token);
                    setCaptchaError(null);
                  }}
                  onExpire={() => {
                    setCaptchaToken(null);
                  }}
                  onError={(err) => {
                    console.warn("Turnstile error:", err);
                    setCaptchaToken(null);
                  }}
                />

                {captchaToken && (
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>
                      {lang === "fa"
                        ? "تأیید امنیتی با موفقیت انجام شد"
                        : "Security verification completed"}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl text-white font-bold bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition shadow-md shadow-blue-500/20 disabled:opacity-60 text-xs sm:text-sm flex items-center justify-center gap-2 mt-3"
              >
                {isSubmitting ? (
                  <span>{lang === "fa" ? "در حال احراز هویت..." : "Authenticating..."}</span>
                ) : (
                  <>
                    <span>{lang === "fa" ? "ورود به سامانه" : "Sign In to Account"}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>
            </div>

            {/* Separator */}
            <div className="relative pt-3 pb-1">
              <div className="absolute inset-0 flex items-center pt-2">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-slate-900 px-3 text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {lang === "fa" ? "حساب‌های کاربری آزمایشی" : "Trial User Accounts"}
                  </span>
                </span>
              </div>
            </div>

            {/* 3. Trial User Accounts */}
            <div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {demoAccounts.map((acc) => {
                  const Icon = acc.icon;
                  const isSelected = selectedAccount === acc.username;

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleSelectAccount(acc.username, acc.password)}
                      className={`p-2.5 rounded-xl border transition-all text-right rtl:text-right ltr:text-left flex items-center justify-between group ${
                        isSelected
                          ? acc.activeBg
                          : `bg-slate-50 dark:bg-slate-800/80 ${acc.borderColor} hover:bg-slate-100 dark:hover:bg-slate-800`
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1">
                          <span>{lang === "fa" ? acc.titleFa : acc.titleEn}</span>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5" dir="ltr">
                          {acc.username}
                        </div>
                      </div>
                      <div className={`p-1.5 rounded-lg bg-white dark:bg-slate-700/60 shadow-2xs ${acc.iconColor}`}>
                        <Icon className="w-4 h-4 flex-shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
