import { BaleGateway } from "./BaleGateway";
import { NotificationService } from "./NotificationService";
import { toTehranDateString } from "@/lib/date-utils";
import logger from "@/lib/logger";

interface BalePollerState {
  started: boolean;
  stopping: boolean;
  offset?: number;
  lastAckedOffset?: number;
  lastReminderDateTehran: string | null;
  schedulerTimer?: ReturnType<typeof setInterval>;
  webhookModeDetected: boolean;
  signalsRegistered: boolean;
}

const globalForBalePoller = globalThis as unknown as {
  __balePollerState?: BalePollerState;
};

function getState(): BalePollerState {
  if (!globalForBalePoller.__balePollerState) {
    globalForBalePoller.__balePollerState = {
      started: false,
      stopping: false,
      offset: undefined,
      lastAckedOffset: undefined,
      lastReminderDateTehran: null,
      schedulerTimer: undefined,
      webhookModeDetected: false,
      signalsRegistered: false,
    };
  }
  return globalForBalePoller.__balePollerState;
}

function getTehranTimeHHMM(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

async function runSchedulerTick(state: BalePollerState): Promise<void> {
  if (state.stopping) return;

  try {
    const retryRes = await NotificationService.processPendingAndRetries({ forceImmediate: false });
    if (retryRes.sent > 0 || retryRes.failed > 0 || retryRes.skipped > 0) {
      logger.info(retryRes, "BalePoller: processed pending/retry notifications");
    }

    const reminderTime = (process.env.REMINDER_TIME || "09:00").trim();
    const now = new Date();
    const todayTehran = toTehranDateString(now);
    const currentHHMM = getTehranTimeHHMM(now);

    if (currentHHMM >= reminderTime && state.lastReminderDateTehran !== todayTehran) {
      logger.info(
        { todayTehran, currentHHMM, reminderTime },
        "BalePoller: running daily reminder job for tomorrow's confirmed sessions"
      );
      const reminderRes = await NotificationService.runDailyReminders();
      state.lastReminderDateTehran = todayTehran;
      logger.info(reminderRes, "BalePoller: daily reminder job finished");
    }
  } catch (err: any) {
    logger.error({ err: err?.message }, "BalePoller: scheduler tick error");
  }
}

async function pollingLoop(state: BalePollerState): Promise<void> {
  logger.info("BalePoller: starting embedded long-polling loop (getUpdates)...");
  let isFirstBatch = true;
  const ttlMinutes = Math.max(1, parseInt(process.env.LINK_CODE_TTL_MINUTES || "10", 10) || 10);
  const maxStaleAgeSec = Math.max(15, ttlMinutes + 5) * 60;

  while (!state.stopping) {
    try {
      const res = await BaleGateway.getUpdates(state.offset, 20);
      if (!res.ok) {
        const errText = String(res.error || "");
        const isConflict = errText.includes("409") || errText.toLowerCase().includes("conflict");
        const delayMs = isConflict ? 15000 : 5000;
        logger.warn(
          { error: errText, retryInMs: delayMs },
          isConflict
            ? "BalePoller: another Bale poller/webhook appears active; backing off"
            : "BalePoller: getUpdates failed; retrying"
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      state.lastAckedOffset = state.offset;
      const nowSec = Math.floor(Date.now() / 1000);

      for (const update of res.updates) {
        if (typeof update.update_id === "number") {
          state.offset = update.update_id + 1;
        }

        const msgDate = update.message?.date;
        if (isFirstBatch && typeof msgDate === "number" && nowSec - msgDate > maxStaleAgeSec) {
          logger.info(
            { updateId: update.update_id, ageSeconds: nowSec - msgDate },
            "BalePoller: skipping stale offline update from previous session"
          );
          continue;
        }

        try {
          const outcome = await BaleGateway.handleUpdate(update);
          console.log(
            `[BaleBot] Update #${update.update_id} processed -> status: ${outcome.status}${
              outcome.userId ? ` (userId=${outcome.userId})` : ""
            }`
          );
          logger.info(
            { updateId: update.update_id, status: outcome.status, userId: outcome.userId },
            "BalePoller: handled incoming Bale update"
          );
        } catch (err: any) {
          logger.error(
            { updateId: update.update_id, err: err?.message },
            "BalePoller: error handling Bale update"
          );
        }
      }

      isFirstBatch = false;
    } catch (err: any) {
      if (!state.stopping) {
        logger.error({ err: err?.message }, "BalePoller: polling loop error; retrying in 5s");
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
}

async function startInternal(state: BalePollerState): Promise<void> {
  try {
    const me = await BaleGateway.getMe();
    if (!me.ok || !me.bot) {
      logger.warn({ error: me.error }, "BalePoller: failed to verify bot token with getMe; will retry on next request");
      state.started = false;
      return;
    }

    logger.info(
      {
        botId: me.bot.id,
        botName: me.bot.first_name,
        username: `@${me.bot.username}`,
      },
      "BalePoller: connected to Bale Bot API"
    );

    const webhookInfo = await BaleGateway.getWebhookInfo();
    if (webhookInfo.ok && webhookInfo.info?.url) {
      state.webhookModeDetected = true;
      logger.info(
        { url: webhookInfo.info.url },
        "BalePoller: webhook is configured; embedded getUpdates polling disabled (webhook mode active)"
      );
    }

    // Start notification retry + daily reminder scheduler
    await runSchedulerTick(state);
    if (!state.schedulerTimer) {
      state.schedulerTimer = setInterval(() => {
        void runSchedulerTick(state);
      }, 60 * 1000);
      if (typeof state.schedulerTimer.unref === "function") {
        state.schedulerTimer.unref();
      }
    }

    if (!state.signalsRegistered) {
      state.signalsRegistered = true;
      const handleShutdown = () => {
        void BalePoller.stop();
      };
      process.once("SIGINT", handleShutdown);
      process.once("SIGTERM", handleShutdown);
    }

    if (!state.webhookModeDetected) {
      console.log(
        `[BaleBot] Connected as @${me.bot.username} — listening for incoming messages (long-polling)`
      );
      void pollingLoop(state);
    } else {
      console.log(
        `[BaleBot] Connected as @${me.bot.username} — webhook mode active (${webhookInfo.info?.url})`
      );
    }
  } catch (err: any) {
    logger.error({ err: err?.message }, "BalePoller: failed to initialize");
    state.started = false;
  }
}

export class BalePoller {
  /**
   * Ensures the embedded Bale bot poller & notification scheduler is running
   * inside the Next.js Node.js server process. Safe to call repeatedly (idempotent).
   */
  public static ensureStarted(): void {
    if (typeof window !== "undefined") return;
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    if (process.env.NODE_ENV === "test") return;
    if (process.env.BALE_DISABLE_EMBEDDED_BOT === "true") return;
    if (BaleGateway.isStubMode()) return;

    const state = getState();
    if (state.started) return;

    state.started = true;
    state.stopping = false;
    void startInternal(state);
  }

  public static async stop(): Promise<void> {
    const state = getState();
    if (!state.started || state.stopping) return;

    state.stopping = true;
    if (state.schedulerTimer) {
      clearInterval(state.schedulerTimer);
      state.schedulerTimer = undefined;
    }

    if (state.offset !== undefined && state.offset !== state.lastAckedOffset) {
      await BaleGateway.getUpdates(state.offset, 0).catch(() => {});
      state.lastAckedOffset = state.offset;
    }
    state.started = false;
  }
}
