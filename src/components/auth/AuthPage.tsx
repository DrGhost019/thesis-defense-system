"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from "@/lib/validations";
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
  Info,
  Sun,
  Moon,
  Globe,
} from "lucide-react";

export function AuthPage() {
  const { login, lang, setLang, theme, toggleTheme } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login form
  const loginForm = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleLoginSubmit = async (values: any) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(
          data.message ||
            (lang === "fa"
              ? "نام کاربری یا رمز عبور اشتباه است"
              : "Invalid username or password")
        );
      } else {
        login(data.accessToken, data.user);
      }
    } catch {
      setServerError(
        lang === "fa"
          ? "خطای شبکه در ارتباط با سرور"
          : "Network connection error with server"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickDemoLogin = async (username: string, pass: string) => {
    loginForm.setValue("username", username);
    loginForm.setValue("password", pass);
    await handleLoginSubmit({ username, password: pass });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative">
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
        <div className="inline-flex p-3 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 mb-4 animate-in fade-in zoom-in duration-300">
          <img
            src="/assets/uni.png"
            alt="University Logo"
            className="w-16 h-16 object-contain drop-shadow"
          />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {lang === "fa" ? "سامانه زمان‌بندی جلسات دفاع" : "Thesis Defense Scheduling System"}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {lang === "fa"
            ? "پرتال یکپارچه ورود اعضای دانشگاه (دانشجویان، اساتید و کارکنان)"
            : "University Single Sign-On Portal (Students, Faculty & Staff)"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors duration-200">
          {/* Header Title */}
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              {lang === "fa" ? "ورود به حساب کاربری دانشگاهی" : "University Account Login"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === "fa"
                ? "اطلاعات کاربری از سامانه جامع آموزش دانشگاه فراخوانی می‌شود"
                : "Credentials are authenticated via the university identity system"}
            </p>
          </div>

          {/* Info notice about pre-existing accounts */}
          <div className="mb-5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 flex items-start gap-2.5 text-xs leading-relaxed">
            <Info className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              {lang === "fa"
                ? "کلیه حساب‌های کاربری اساتید و دانشجویان از قبل در پایگاه داده دانشگاه فعال هستند. نیازی به ثبت‌نام مجدد نبوده و ورود صرفاً با نام کاربری سازمانی امکان‌پذیر است."
                : "All student and faculty accounts are pre-authenticated via the university database. Direct registration is disabled."}
            </div>
          </div>

          {serverError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-start gap-2.5 text-xs sm:text-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
              <div>{serverError}</div>
            </div>
          )}

          <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === "fa" ? "نام کاربری دانشگاهی" : "Username"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 rtl:right-0 ltr:right-auto ltr:left-0 pr-3 ltr:pr-0 ltr:pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  {...loginForm.register("username")}
                  className="w-full rtl:pr-10 rtl:pl-3 ltr:pl-10 ltr:pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder={lang === "fa" ? "مثال: admin یا student.alavi" : "e.g. admin or student.alavi"}
                  dir="ltr"
                />
              </div>
              {loginForm.formState.errors.username && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {loginForm.formState.errors.username.message as string}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === "fa" ? "رمز عبور" : "Password"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 rtl:right-0 ltr:right-auto ltr:left-0 pr-3 ltr:pr-0 ltr:pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  {...loginForm.register("password")}
                  className="w-full rtl:pr-10 rtl:pl-3 ltr:pl-10 ltr:pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
              {loginForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {loginForm.formState.errors.password.message as string}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl text-white font-bold bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition shadow-md shadow-blue-500/20 disabled:opacity-60 text-sm flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <span>{lang === "fa" ? "در حال احراز هویت..." : "Authenticating..."}</span>
              ) : (
                <>
                  <span>{lang === "fa" ? "ورود به سامانه" : "Sign In"}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </>
              )}
            </button>

            {/* Fast 1-Click Demo Accounts for easy testing */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {lang === "fa"
                    ? "ورود سریع با حساب‌های آزمایشی دانشگاه:"
                    : "Quick Demo Accounts:"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => quickDemoLogin("admin", "admin123456")}
                  className="p-2 rtl:text-right ltr:text-left rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 transition flex items-center justify-between group"
                >
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-900 dark:group-hover:text-purple-300">
                      {lang === "fa" ? "مدیر آموزش" : "Admin"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">admin</div>
                  </div>
                  <Shield className="w-4 h-4 text-purple-600 flex-shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => quickDemoLogin("prof.ahmadi", "pass123456")}
                  className="p-2 rtl:text-right ltr:text-left rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 transition flex items-center justify-between group"
                >
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-900 dark:group-hover:text-emerald-300">
                      {lang === "fa" ? "دکتر احمدی (استاد)" : "Dr. Ahmadi"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">prof.ahmadi</div>
                  </div>
                  <BookOpen className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => quickDemoLogin("prof.hosseini", "pass123456")}
                  className="p-2 rtl:text-right ltr:text-left rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300 transition flex items-center justify-between group"
                >
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-teal-900 dark:group-hover:text-teal-300">
                      {lang === "fa" ? "دکتر حسینی (استاد)" : "Dr. Hosseini"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">prof.hosseini</div>
                  </div>
                  <UserCheck className="w-4 h-4 text-teal-600 flex-shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => quickDemoLogin("student.alavi", "pass123456")}
                  className="p-2 rtl:text-right ltr:text-left rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 transition flex items-center justify-between group"
                >
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-900 dark:group-hover:text-blue-300">
                      {lang === "fa" ? "علی علوی (دانشجو)" : "Ali Alavi"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">student.alavi</div>
                  </div>
                  <GraduationCap className="w-4 h-4 text-blue-600 flex-shrink-0" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
