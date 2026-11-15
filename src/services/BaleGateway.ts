import logger from "@/lib/logger";

export interface BaleSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export class BaleGateway {
  private static token = process.env.BALE_BOT_TOKEN || "test_token";
  private static baseUrl = "https://tapi.bale.ai/bot";

  /**
   * Sends a message to a Bale chat ID.
   * If in test mode or invalid token, records a simulated delivery.
   */
  public static async send(chatId: string, text: string): Promise<BaleSendResult> {
    logger.info({ chatId, textLength: text.length }, "BaleGateway: sending message");

    if (!chatId) {
      return { ok: false, error: "Recipient has no chat_id" };
    }

    if (this.token === "test_token" || this.token.startsWith("test_")) {
      logger.info({ chatId }, "BaleGateway: test token active, simulated successful delivery");
      return { ok: true, messageId: `mock_${Date.now()}` };
    }

    try {
      const url = `${this.baseUrl}${this.token}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        return { ok: true, messageId: String(data.result?.message_id || "") };
      }

      const err = data?.description || `HTTP ${res.status}: ${res.statusText}`;
      logger.error({ chatId, err }, "BaleGateway: failed to send");
      return { ok: false, error: err };
    } catch (err: any) {
      logger.error({ chatId, err: err.message }, "BaleGateway: network error");
      return { ok: false, error: err.message || "Network error" };
    }
  }
}
