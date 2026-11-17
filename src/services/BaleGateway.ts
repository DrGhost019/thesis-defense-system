import logger from "@/lib/logger";
import { AuthService } from "./AuthService";

export interface BaleSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export interface BaleBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

export interface BaleUpdate {
  update_id: number;
  message?: {
    message_id?: number;
    chat?: { id: number | string; type?: string };
    from?: { id: number | string; first_name?: string; last_name?: string; username?: string };
    text?: string;
    date?: number;
  };
  channel_post?: {
    message_id?: number;
    chat?: { id: number | string; type?: string };
    from?: { id: number | string; first_name?: string };
    text?: string;
  };
}

export interface BaleHandleUpdateResult {
  status: "linked" | "link_failed" | "welcome" | "help" | "status" | "ignored_no_message" | "ignored_empty";
  userId?: number;
  chatId?: string;
  reason?: string;
  reasonEn?: string;
}

export type BaleSendStub = (chatId: string, text: string) => Promise<BaleSendResult> | BaleSendResult;

export class BaleGateway {
  private static readonly BASE_URL = "https://tapi.bale.ai/bot";
  private static testStub: BaleSendStub | null = null;

  /**
   * Injects a stub send handler for automated integration tests (T25–T30).
   * Pass null to restore normal behavior.
   */
  public static setTestStub(stub: BaleSendStub | null): void {
    this.testStub = stub;
  }

  private static getToken(): string {
    return (process.env.BALE_BOT_TOKEN || "").trim();
  }

  public static getBotUsername(): string {
    return (process.env.NEXT_PUBLIC_BALE_BOT_USERNAME || "ArakU_TDSS_bot").replace(/^@/, "");
  }

  public static getBotUrl(): string {
    return process.env.NEXT_PUBLIC_BALE_BOT_URL || `https://ble.ir/${this.getBotUsername()}`;
  }

  public static isStubMode(): boolean {
    if (this.testStub) return true;
    if (process.env.BALE_TEST_MODE === "true") return true;
    const token = this.getToken();
    return !token || token === "test_token" || token.startsWith("test_");
  }

  private static buildApiUrl(method: string): string {
    const token = this.getToken();
    return `${this.BASE_URL}${token}/${method}`;
  }

  /**
   * Verifies bot token and retrieves bot identity from Bale Bot API (Decision D-15).
   */
  public static async getMe(): Promise<{ ok: boolean; bot?: BaleBotInfo; error?: string }> {
    if (this.isStubMode()) {
      return {
        ok: true,
        bot: {
          id: 0,
          is_bot: true,
          first_name: "Thesis Defense Scheduling System (Stub)",
          username: this.getBotUsername(),
        },
      };
    }

    try {
      const res = await fetch(this.buildApiUrl("getMe"), {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.result) {
        return { ok: true, bot: data.result as BaleBotInfo };
      }
      return { ok: false, error: data?.description || `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Network error" };
    }
  }

  /**
   * Sends a text message to a Bale chat ID via Bale Bot API (sendMessage).
   * Never logs the bot token. Falls back to stub mode in automated tests.
   */
  public static async send(chatId: string, text: string): Promise<BaleSendResult> {
    const normalizedChatId = String(chatId || "").trim();
    logger.info({ chatId: normalizedChatId, textLength: text.length }, "BaleGateway: sending message");

    if (!normalizedChatId) {
      return { ok: false, error: "Recipient has no chat_id" };
    }

    if (this.testStub) {
      return await this.testStub(normalizedChatId, text);
    }

    if (this.isStubMode()) {
      logger.info({ chatId: normalizedChatId }, "BaleGateway: stub mode active, simulated successful delivery");
      return { ok: true, messageId: `mock_${Date.now()}` };
    }

    try {
      const res = await fetch(this.buildApiUrl("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: normalizedChatId,
          text,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        return { ok: true, messageId: String(data.result?.message_id || "") };
      }

      const err = String(data?.description || `HTTP ${res.status}: ${res.statusText}`).slice(0, 200);
      logger.error({ chatId: normalizedChatId, status: res.status, err }, "BaleGateway: failed to send");
      return { ok: false, error: err };
    } catch (err: any) {
      const errMsg = String(err?.message || "Network error").slice(0, 200);
      logger.error({ chatId: normalizedChatId, err: errMsg }, "BaleGateway: network error");
      return { ok: false, error: errMsg };
    }
  }

  /**
   * Fetches incoming updates using Bale long polling (getUpdates).
   * Used in local/development mode when no public HTTPS webhook is registered (Section 11.2).
   */
  public static async getUpdates(
    offset?: number,
    timeoutSeconds: number = 25
  ): Promise<{ ok: boolean; updates: BaleUpdate[]; error?: string }> {
    if (this.isStubMode()) {
      return { ok: true, updates: [] };
    }

    try {
      const params = new URLSearchParams();
      if (typeof offset === "number") {
        params.set("offset", String(offset));
      }
      params.set("timeout", String(timeoutSeconds));
      params.set("limit", "50");

      const res = await fetch(`${this.buildApiUrl("getUpdates")}?${params.toString()}`, {
        method: "GET",
        signal: AbortSignal.timeout((timeoutSeconds + 10) * 1000),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && Array.isArray(data.result)) {
        return { ok: true, updates: data.result as BaleUpdate[] };
      }
      return {
        ok: false,
        updates: [],
        error: data?.description || `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return { ok: false, updates: [], error: err?.message || "Network error" };
    }
  }

  /**
   * Registers a webhook URL with Bale Bot API (Section 11.2 Step 4).
   */
  public static async setWebhook(
    url: string,
    secretToken?: string
  ): Promise<{ ok: boolean; description?: string; error?: string }> {
    if (this.isStubMode()) {
      return { ok: true, description: "Stub webhook set" };
    }

    try {
      const payload: Record<string, string> = { url };
      if (secretToken) {
        payload.secret_token = secretToken;
      }

      const res = await fetch(this.buildApiUrl("setWebhook"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        return { ok: true, description: data.description || "Webhook registered" };
      }
      return { ok: false, error: data?.description || `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Network error" };
    }
  }

  /**
   * Removes the active webhook so getUpdates polling can run cleanly.
   */
  public static async deleteWebhook(): Promise<{ ok: boolean; description?: string; error?: string }> {
    if (this.isStubMode()) {
      return { ok: true, description: "Stub webhook deleted" };
    }

    try {
      const res = await fetch(this.buildApiUrl("deleteWebhook"), {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        return { ok: true, description: data.description || "Webhook deleted" };
      }
      return { ok: false, error: data?.description || `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Network error" };
    }
  }

  /**
   * Retrieves current webhook registration status from Bale Bot API.
   */
  public static async getWebhookInfo(): Promise<{ ok: boolean; info?: any; error?: string }> {
    if (this.isStubMode()) {
      return { ok: true, info: { url: "", pending_update_count: 0 } };
    }

    try {
      const res = await fetch(this.buildApiUrl("getWebhookInfo"), {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        return { ok: true, info: data.result };
      }
      return { ok: false, error: data?.description || `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Network error" };
    }
  }

  /**
   * Handles an incoming Bale update from either webhook or polling (UML S2, Process 1.0).
   * Bot replies for linking/commands are direct replies and are NOT logged in Notification (Appendix F.1).
   */
  public static async handleUpdate(update: BaleUpdate): Promise<BaleHandleUpdateResult> {
    const message = update?.message || update?.channel_post;
    if (!message || typeof message.text !== "string") {
      return { status: "ignored_no_message" };
    }

    const chatId = String(message.chat?.id ?? message.from?.id ?? "").trim();
    const rawText = message.text.trim();

    if (!chatId || !rawText) {
      return { status: "ignored_empty", chatId };
    }

    const lowerText = rawText.toLowerCase();

    // 1. /start (without linking code) -> Welcome & linking instructions
    if (lowerText === "/start") {
      const linkedUser = await AuthService.findUserByBaleChatId(chatId);
      if (linkedUser) {
        const isEn = linkedUser.preferred_lang === "en";
        await this.send(
          chatId,
          isEn
            ? `Hello ${linkedUser.full_name}!\nYour Bale account is already linked to the Thesis Defense Scheduling System.\n\nUse /status to check your link status or /help for instructions.`
            : `سلام ${linkedUser.full_name} عزیز؛\nحساب پیام‌رسان بله شما هم‌اکنون به سامانه زمان‌بندی جلسات دفاع پایان‌نامه متصل است.\n\nبرای بررسی وضعیت از دستور /status و برای راهنما از /help استفاده کنید.`
        );
      } else {
        await this.send(
          chatId,
          `به ربات سامانه زمان‌بندی جلسات دفاع پایان‌نامه دانشگاه اراک خوش آمدید!\n\nبرای اتصال حساب کاربری خود:\n۱. وارد سامانه شده و به بخش «پروفایل و اتصال بله» بروید.\n۲. روی دکمه «دریافت کد اتصال بله» کلیک کنید.\n۳. کد ۸ کاراکتری دریافت‌شده را همین‌جا ارسال کنید.\n\nWelcome to the Arak University Thesis Defense Scheduling Bot!\nTo link your account, generate an 8-character linking code from your Profile page in the web portal and send it here.`
        );
      }
      return { status: "welcome", chatId };
    }

    // 2. /help -> Usage guide
    if (lowerText === "/help") {
      await this.send(
        chatId,
        `راهنمای ربات سامانه دفاع پایان‌نامه:\n• برای اتصال حساب: کد ۸ کاراکتری دریافت‌شده از پروفایل سامانه را ارسال کنید.\n• بررسی وضعیت اتصال: /status\n• لغو اتصال: از بخش «پروفایل و اتصال بله» در سامانه اقدام نمایید.\n\nاین ربات نتایج نهایی درخواست دفاع (تأیید یا رد) و یادآوری یک روز قبل از جلسه دفاع را ارسال می‌کند.\n\n---\nHelp:\n• Send your 8-character Profile linking code here to connect.\n• /status — Check your account link status.\n• To unlink, use the Profile page in the web app.`
      );
      return { status: "help", chatId };
    }

    // 3. /status -> Check if this Bale chat is linked
    if (lowerText === "/status") {
      const linkedUser = await AuthService.findUserByBaleChatId(chatId);
      if (linkedUser) {
        const isEn = linkedUser.preferred_lang === "en";
        const roleLabelFa =
          linkedUser.role === "admin"
            ? "مدیر آموزش"
            : linkedUser.role === "student"
            ? "دانشجو"
            : "استاد / عضو هیئت علمی";
        const roleLabelEn =
          linkedUser.role === "admin"
            ? "Administrator"
            : linkedUser.role === "student"
            ? "Student"
            : "Professor";

        await this.send(
          chatId,
          isEn
            ? `Status: Linked\nName: ${linkedUser.full_name}\nUsername: @${linkedUser.username}\nRole: ${roleLabelEn}`
            : `وضعیت اتصال: متصل ✅\nنام: ${linkedUser.full_name}\nنام کاربری: @${linkedUser.username}\nنقش: ${roleLabelFa}`
        );
      } else {
        await this.send(
          chatId,
          `این حساب بله هنوز به هیچ کاربری در سامانه متصل نشده است.\nلطفاً کد اتصال ۸ کاراکتری خود را از بخش پروفایل دریافت و ارسال کنید.\n\nThis Bale chat is not linked to any account yet. Send your 8-character code from your Profile page.`
        );
      }
      return { status: "status", chatId };
    }

    // 4. Extract potential link code from "/start CODE" or direct message text
    let code = rawText;
    if (lowerText.startsWith("/start ")) {
      code = rawText.substring(7).trim();
    } else if (lowerText.startsWith("/link ")) {
      code = rawText.substring(6).trim();
    }

    if (!code) {
      return { status: "ignored_empty", chatId };
    }

    const linkResult = await AuthService.completeBaleLink(code, chatId);
    if (linkResult.success) {
      const isEn = linkResult.preferredLang === "en";
      await this.send(
        chatId,
        isEn
          ? `Hello ${linkResult.fullName},\nYour Bale Messenger account has been successfully linked to the Thesis Defense Scheduling System. You will now receive defense outcome notifications and one-day reminders here.`
          : `سلام ${linkResult.fullName} عزیز؛\nحساب پیام‌رسان بله شما با موفقیت به سامانه زمان‌بندی جلسات دفاع پایان‌نامه متصل شد. از این پس اعلان‌های نتیجه درخواست دفاع و یادآوری یک روز قبل از جلسه برای شما ارسال خواهد شد.`
      );
      return { status: "linked", userId: linkResult.userId, chatId };
    } else {
      await this.send(
        chatId,
        `خطا در اتصال حساب کاربری:\n${linkResult.message}\n\n${linkResult.messageEn || "Account linking failed. Please request a new code."}`
      );
      return {
        status: "link_failed",
        chatId,
        reason: linkResult.message,
        reasonEn: linkResult.messageEn,
      };
    }
  }
}
