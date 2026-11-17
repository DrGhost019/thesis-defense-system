"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface UserProfile {
  userId: number;
  username: string;
  fullName: string;
  email: string | null;
  role: "student" | "professor" | "higher_education_staff" | "admin";
  isActive: boolean;
  baleLinked: boolean;
  baleLinkedAt?: string | null;
  hasLinkCode?: boolean;
  student?: {
    student_id: number;
    student_number: string;
    degree_level: "master" | "phd";
    thesis_title: string;
  } | null;
  professor?: {
    professor_id: number;
    department: string;
    academic_title: string;
    office_location?: string | null;
  } | null;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  lang: "fa" | "en";
  setLang: (l: "fa" | "en") => void;
  calendarType: "jalali" | "gregorian";
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
  login: (token: string, user: UserProfile) => void;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  lang: "fa",
  setLang: () => {},
  calendarType: "jalali",
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
  login: () => {},
  logout: async () => {},
  refetchUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30, // 30 seconds
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lang, setLangState] = useState<"fa" | "en">("fa");
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  // When language is Persian (fa), calendar is Solar Hijri (jalali).
  // When language is English (en), calendar is Gregorian (gregorian).
  const calendarType: "jalali" | "gregorian" = lang === "fa" ? "jalali" : "gregorian";

  const setTheme = (newTheme: "light" | "dark") => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_theme", newTheme);
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const setLang = (newLang: "fa" | "en") => {
    setLangState(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_lang", newLang);
      document.documentElement.dir = newLang === "fa" ? "rtl" : "ltr";
      document.documentElement.lang = newLang;
      document.body.dir = newLang === "fa" ? "rtl" : "ltr";
      if (user) {
        fetch("/api/v1/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferredLang: newLang }),
        }).catch(() => {});
      }
    }
  };

  const refetchUser = async () => {
    try {
      const res = await fetch("/api/v1/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = (localStorage.getItem("app_lang") as "fa" | "en") || "fa";
      setLangState(savedLang);
      document.documentElement.dir = savedLang === "fa" ? "rtl" : "ltr";
      document.documentElement.lang = savedLang;
      document.body.dir = savedLang === "fa" ? "rtl" : "ltr";

      const savedTheme = (localStorage.getItem("app_theme") as "light" | "dark") || "light";
      setThemeState(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    refetchUser();
  }, []);

  const login = (token: string, userData: UserProfile) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
    setUser(userData);
  };

  const logout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
    setUser(null);
    queryClient.clear();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user,
          isLoading,
          lang,
          setLang,
          calendarType,
          theme,
          setTheme,
          toggleTheme,
          login,
          logout,
          refetchUser,
        }}
      >
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
