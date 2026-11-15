"use client";

import React from "react";
import { useAuth } from "../providers";
import { toPersianDigits } from "@/lib/date-utils";
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Clock,
  CheckSquare,
  MessageSquare,
  Users,
  UserCog,
  BellRing,
  User,
} from "lucide-react";

export type TabId =
  | "dashboard"
  | "schedule"
  | "my-request"
  | "my-slots"
  | "assigned-defenses"
  | "messages"
  | "requests"
  | "committees"
  | "accounts"
  | "reports"
  | "profile";

interface NavItem {
  id: TabId;
  labelFa: string;
  labelEn: string;
  icon: any;
  badge?: number;
}

export function Navigation({
  activeTab,
  onSelectTab,
  pendingCounts,
}: {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  pendingCounts?: { pendingDefenses?: number; pendingRequests?: number; failedNotifications?: number };
}) {
  const { user, lang } = useAuth();
  if (!user) return null;

  const role = user.role;

  let items: NavItem[] = [];

  if (role === "student") {
    items = [
      { id: "dashboard", labelFa: "داشبورد", labelEn: "Dashboard", icon: LayoutDashboard },
      { id: "schedule", labelFa: "برنامه هفتگی", labelEn: "Weekly Schedule", icon: CalendarDays },
      { id: "my-request", labelFa: "درخواست دفاع من", labelEn: "My Request", icon: FileText },
      { id: "messages", labelFa: "پیام‌ها", labelEn: "Messages", icon: MessageSquare },
      { id: "profile", labelFa: "پروفایل و اتصال بله", labelEn: "Profile & Bale", icon: User },
    ];
  } else if (role === "professor" || role === "higher_education_staff") {
    items = [
      { id: "dashboard", labelFa: "داشبورد", labelEn: "Dashboard", icon: LayoutDashboard },
      { id: "schedule", labelFa: "برنامه هفتگی", labelEn: "Weekly Schedule", icon: CalendarDays },
      { id: "my-slots", labelFa: "بازه‌های حضور من", labelEn: "My Slots", icon: Clock },
      {
        id: "assigned-defenses",
        labelFa: "جلسات محول‌شده",
        labelEn: "Assigned Defenses",
        icon: CheckSquare,
        badge: pendingCounts?.pendingDefenses,
      },
      { id: "messages", labelFa: "پیام‌ها", labelEn: "Messages", icon: MessageSquare },
      { id: "profile", labelFa: "پروفایل و اتصال بله", labelEn: "Profile & Bale", icon: User },
    ];
  } else if (role === "admin") {
    items = [
      { id: "dashboard", labelFa: "داشبورد", labelEn: "Dashboard", icon: LayoutDashboard },
      {
        id: "requests",
        labelFa: "درخواست‌های دفاع و تخصیص",
        labelEn: "Defense Requests",
        icon: FileText,
        badge: pendingCounts?.pendingRequests,
      },
      { id: "schedule", labelFa: "برنامه هفتگی", labelEn: "Weekly Schedule", icon: CalendarDays },
      { id: "committees", labelFa: "هیئت‌های داوران", labelEn: "Committees", icon: Users },
      { id: "accounts", labelFa: "مدیریت کاربران", labelEn: "User Accounts", icon: UserCog },
      {
        id: "reports",
        labelFa: "گزارش بله و اعلان‌ها",
        labelEn: "Bale Reports",
        icon: BellRing,
        badge: pendingCounts?.failedNotifications,
      },
      { id: "profile", labelFa: "تنظیمات حساب", labelEn: "Account Settings", icon: User },
    ];
  }

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-16 z-30 shadow-sm overflow-x-auto no-scrollbar transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 py-2 sm:gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm font-semibold"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                <span>{lang === "fa" ? item.labelFa : item.labelEn}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? "bg-white text-blue-700" : "bg-red-500 text-white animate-pulse"
                    }`}
                  >
                    {lang === "fa" ? toPersianDigits(item.badge) : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
