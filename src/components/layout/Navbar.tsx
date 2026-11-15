"use client";

import React from "react";
import { useAuth } from "../providers";
import {
  LogOut,
  Globe,
  UserCheck,
  Shield,
  GraduationCap,
  BookOpen,
  Sun,
  Moon,
} from "lucide-react";

export function Navbar() {
  const { user, lang, setLang, theme, toggleTheme, logout } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "admin":
        return {
          label: lang === "fa" ? "مدیر آموزش" : "Administrator",
          icon: Shield,
          color:
            "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
        };
      case "professor":
      case "higher_education_staff":
        return {
          label: lang === "fa" ? "استاد / داور" : "Professor",
          icon: BookOpen,
          color:
            "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
        };
      case "student":
        return {
          label: lang === "fa" ? "دانشجو" : "Student",
          icon: GraduationCap,
          color:
            "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
        };
      default:
        return {
          label: lang === "fa" ? "کاربر" : "User",
          icon: UserCheck,
          color:
            "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        };
    }
  };

  const roleInfo = getRoleBadge(user?.role);
  const RoleIcon = roleInfo.icon;

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"
        dir="ltr"
      >
        {/* ================= FAR LEFT ELEMENTS ================= */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "fa" ? "en" : "fa")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{lang === "fa" ? "English" : "فارسی"}</span>
          </button>

          {user && (
            <>
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:block" />

              <span
                className={`hidden md:inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${roleInfo.color}`}
              >
                <RoleIcon className="w-3 h-3" />
                {roleInfo.label}
              </span>

              <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 max-w-[110px] sm:max-w-[180px] truncate">
                {user.fullName}
              </span>
            </>
          )}

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Dark / Light mode toggle icon (Placed next to logout button) */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center"
            title={
              theme === "dark"
                ? lang === "fa"
                  ? "تغییر به حالت روشن"
                  : "Switch to Light Mode"
                : lang === "fa"
                ? "تغییر به حالت تاریک"
                : "Switch to Dark Mode"
            }
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-200" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300 animate-in spin-in-180 duration-200" />
            )}
          </button>

          {/* Logout button */}
          {user && (
            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
              title={lang === "fa" ? "خروج از حساب" : "Logout"}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ================= FAR RIGHT: BRAND TITLE & UNIVERSITY LOGO ================= */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {lang === "fa"
                ? "سامانه زمان‌بندی جلسات دفاع"
                : "Thesis Defense Scheduling System"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {lang === "fa"
                ? "معاونت آموزشی و تحصیلات تکمیلی"
                : "Graduate Studies & Academic Affairs"}
            </p>
          </div>
          <img
            src="/assets/uni.png"
            alt="University Logo"
            className="w-10 h-10 object-contain drop-shadow-sm"
          />
        </div>
      </div>
    </header>
  );
}
