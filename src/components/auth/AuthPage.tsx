"use client";

import React, { useState, useRef } from "react";
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
  Sun,
  Moon,
  Globe,
  CheckCircle2,
} from "lucide-react";
export function AuthPage() {
  const { login, lang, setLang, theme, toggleTheme } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  // Login form
  const loginForm = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

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
    setServerError(null);
  };

  const handleLoginSubmit = async (values: any) => {
    if (!values.username || !values.password) {
      setServerError(
        lang === "fa"
          ? "لطفاً نام کاربری و رمز عبور را وارد فرمایید یا یکی از حساب‌های آزمایشی را انتخاب کنید."
          : "Please enter username and password or select a trial account."
      );
      return;
    }

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

          {serverError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-start gap-2.5 text-xs sm:text-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
              <div>{serverError}</div>
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
                    {...loginForm.register("username")}
                    className="w-full rtl:pr-10 rtl:pl-3 ltr:pl-10 ltr:pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "fa" ? "رمز عبور" : "Password"}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 rtl:right-0 ltr:right-auto ltr:left-0 pr-3 ltr:pr-0 ltr:pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    {...loginForm.register("password")}
                    className="w-full rtl:pr-10 rtl:pl-3 ltr:pl-10 ltr:pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
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
            </div>

            {/* 2. Sign In Button */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl text-white font-bold bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition shadow-md shadow-blue-500/20 disabled:opacity-60 text-xs sm:text-sm flex items-center justify-center gap-2 mt-1"
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
