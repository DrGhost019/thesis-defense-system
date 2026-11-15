"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  siteKey?: string;
  theme?: "light" | "dark";
  lang?: "fa" | "en";
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (err?: any) => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          language?: string;
          retry?: "auto" | "never";
          "refresh-expired"?: "auto" | "manual" | "never";
          callback?: (token: string) => void;
          "error-callback"?: (error?: any) => void;
          "expired-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget(
    {
      siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      theme = "light",
      lang = "fa",
      onVerify,
      onExpire,
      onError,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [isScriptReady, setIsScriptReady] = useState(false);

    // Keep callback functions in refs so parent re-renders NEVER recreate or tear down the Turnstile widget
    const onVerifyRef = useRef(onVerify);
    onVerifyRef.current = onVerify;

    const onExpireRef = useRef(onExpire);
    onExpireRef.current = onExpire;

    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    // Allow parent to reset widget when needed (e.g. after invalid login attempt)
    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {
            // ignore
          }
        }
      },
    }));

    // 1. Inject Cloudflare Turnstile explicit script once
    useEffect(() => {
      if (!siteKey) return;

      if (window.turnstile) {
        setIsScriptReady(true);
        return;
      }

      const SCRIPT_ID = "cloudflare-turnstile-script";
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          setIsScriptReady(true);
        };
        script.onerror = (e) => {
          console.error("Failed to load Cloudflare Turnstile script:", e);
        };
        document.head.appendChild(script);
      } else {
        script.addEventListener("load", () => setIsScriptReady(true));
      }
    }, [siteKey]);

    // 2. Render widget ONLY once, and re-render only when siteKey, theme, or lang strictly change
    useEffect(() => {
      if (!isScriptReady || !containerRef.current || !siteKey || !window.turnstile) {
        return;
      }

      // If a widget was previously mounted (e.g., language or theme toggled), clean it up first
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: theme,
          language: lang === "fa" ? "fa" : "en",
          retry: "never",
          "refresh-expired": "auto",
          callback: (token: string) => {
            if (onVerifyRef.current) {
              onVerifyRef.current(token);
            }
          },
          "expired-callback": () => {
            if (onExpireRef.current) {
              onExpireRef.current();
            }
          },
          "error-callback": (err: any) => {
            console.warn("Turnstile error-callback:", err);
            if (onErrorRef.current) {
              onErrorRef.current(err);
            }
          },
        });
        widgetIdRef.current = id;
      } catch (e) {
        console.error("Turnstile render error:", e);
      }

      return () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }
      };
    }, [isScriptReady, siteKey, theme, lang]);

    if (!siteKey) {
      return null;
    }

    return (
      <div className="flex flex-col items-center justify-center my-3" dir="ltr">
        <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
        {!isScriptReady && (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>
              {lang === "fa" ? "در حال بارگذاری کپچای امنیتی..." : "Loading security CAPTCHA..."}
            </span>
          </div>
        )}
      </div>
    );
  }
);
