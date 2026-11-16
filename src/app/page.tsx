"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { AuthPage } from "@/components/auth/AuthPage";
import { Navbar } from "@/components/layout/Navbar";
import { Navigation, TabId } from "@/components/layout/Navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { WeeklyScheduleView } from "@/components/schedule/WeeklyScheduleView";
import { MyRequestView } from "@/components/student/MyRequestView";
import { MySlotsView } from "@/components/professor/MySlotsView";
import { AssignedDefensesView } from "@/components/professor/AssignedDefensesView";
import { MessagesView } from "@/components/chat/MessagesView";
import { RequestsView } from "@/components/admin/RequestsView";
import { CommitteesView } from "@/components/admin/CommitteesView";
import { AccountsView } from "@/components/admin/AccountsView";
import { ReportsView } from "@/components/admin/ReportsView";
import { ProfileView } from "@/components/profile/ProfileView";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, isLoading, lang } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [selectedSessionIdForChat, setSelectedSessionIdForChat] = useState<number | undefined>(undefined);

  // Requirement 5: Ensure that when a user logs in, they are immediately directed to the dashboard
  useEffect(() => {
    if (user?.userId) {
      setActiveTab("dashboard");
    }
  }, [user?.userId]);

  // Fetch dashboard summary for badge counts
  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const res = await fetch("/api/v1/me/dashboard");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // 1. Loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/assets/uni.png"
            alt="University Logo"
            className="w-16 h-16 object-contain animate-pulse"
          />
          <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>{lang === "fa" ? "در حال بارگذاری سامانه..." : "Loading system..."}</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Force user to encounter Login / Sign-up page
  if (!user) {
    return <AuthPage />;
  }

  // Pending counts for navigation badges
  const pendingCounts = {
    pendingDefenses: dashboardData?.pendingSeatsCount,
    pendingRequests: dashboardData?.pendingRequestsCount,
    failedNotifications: dashboardData?.failedNotificationsCount,
  };

  const handleNavigate = (tab: TabId) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNavigateToMessages = (sessionId: number) => {
    setSelectedSessionIdForChat(sessionId);
    setActiveTab("messages");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header Navbar */}
      <Navbar />

      {/* Role-specific Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={handleNavigate}
        pendingCounts={pendingCounts}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === "dashboard" && <DashboardView onNavigate={handleNavigate} />}

        {activeTab === "schedule" && <WeeklyScheduleView />}

        {/* Student-specific tabs */}
        {activeTab === "my-request" && user.role === "student" && (
          <MyRequestView onNavigateToMessages={handleNavigateToMessages} />
        )}

        {/* Professor / Staff-specific tabs */}
        {activeTab === "my-slots" &&
          (user.role === "professor" || user.role === "higher_education_staff") && (
            <MySlotsView />
          )}

        {activeTab === "assigned-defenses" &&
          (user.role === "professor" || user.role === "higher_education_staff") && (
            <AssignedDefensesView />
          )}

        {/* Messaging (student & professor in confirmed sessions) */}
        {activeTab === "messages" && (
          <MessagesView initialSessionId={selectedSessionIdForChat} />
        )}

        {/* Admin-specific tabs */}
        {activeTab === "requests" && user.role === "admin" && <RequestsView />}

        {activeTab === "committees" && user.role === "admin" && <CommitteesView />}

        {activeTab === "accounts" && user.role === "admin" && <AccountsView />}

        {activeTab === "reports" && user.role === "admin" && <ReportsView />}

        {/* Common Profile & Bale Tab */}
        {activeTab === "profile" && <ProfileView />}
      </main>

      {/* University Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400 mt-auto transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/assets/uni.png" alt="Logo" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {lang === "fa"
                ? "سامانه جامع زمان‌بندی دفاع پایان‌نامه‌ها و رساله‌ها"
                : "Comprehensive Thesis Defense Scheduling System"}
            </span>
          </div>
          <div>
            <span>
              {lang === "fa"
                ? "سال تحصیلی ۱۴۰۵-۱۴۰۶ • کلیه حقوق محفوظ است."
                : "Academic Year 2026-2027 • All Rights Reserved."}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
