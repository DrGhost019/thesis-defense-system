import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "سامانه زمان‌بندی جلسات دفاع پایان‌نامه",
  description: "سامانه جامع مدیریت و هماهنگی زمان‌بندی جلسات دفاع تحصیلات تکمیلی دانشگاه",
  icons: {
    icon: "/assets/uni.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="icon" href="/assets/uni.png" type="image/png" />
      </head>
      <body className="antialiased selection:bg-blue-100 selection:text-blue-900 bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
