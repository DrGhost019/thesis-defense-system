import { loadEnvFile } from "./load-env";
loadEnvFile();

import { BaleGateway } from "../src/services/BaleGateway";
import { NotificationService } from "../src/services/NotificationService";
import { toTehranDateString } from "../src/lib/date-utils";
import logger from "../src/lib/logger";
import prisma from "../src/lib/prisma";

let isShuttingDown = false;
let lastReminderDateTehran: string | null = null;
let currentPollOffset: number | undefined = undefined;
let lastAckedOffset: number | undefined = undefined;

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

async function runSchedulerTick(): Promise<void> {
  if (isShuttingDown) return;

  try {
    // 1. Outcome sender & retry worker (every 1 minute, Appendix F.2)
    const retryRes = await NotificationService.processPendingAndRetries({ forceImmediate: false });
    if (retryRes.sent > 0 || retryRes.failed > 0 || retryRes.skipped > 0) {
      logger.info(retryRes, "BaleWorker: processed pending/retry notifications");
    }

    // 2. Daily reminder scheduler at REMINDER_TIME (default 09:00 Asia/Tehran, Decision D-03, Edge Case #14)
    const reminderTime = (process.env.REMINDER_TIME || "09:00").trim();
    const now = new Date();
    const todayTehran = toTehranDateString(now);
    const currentHHMM = getTehranTimeHHMM(now);

    if (currentHHMM >= reminderTime && lastReminderDateTehran !== todayTehran) {
      logger.info(
        { todayTehran, currentHHMM, reminderTime },
        "BaleWorker: running daily reminder job for tomorrow's confirmed sessions"
      );
      const reminderRes = await NotificationService.runDailyReminders();
      lastReminderDateTehran = todayTehran;
      logger.info(reminderRes, "BaleWorker: daily reminder job finished");
    }
  } catch (err: any) {
    logger.error({ err: err?.message }, "BaleWorker: scheduler tick error");
  }
}

async function startPollingLoop(): Promise<void> {
  logger.info("BaleBot: starting long-polling loop (getUpdates)...");

  while (!isShuttingDown) {
    try {
      const res = await BaleGateway.getUpdates(currentPollOffset, 25);
      if (!res.ok) {
        logger.warn({ error: res.error }, "BaleBot: getUpdates failed; retrying in 5s");
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      lastAckedOffset = currentPollOffset;

      for (const update of res.updates) {
        if (typeof update.update_id === "number") {
          currentPollOffset = update.update_id + 1;
        }
        try {
          const outcome = await BaleGateway.handleUpdate(update);
          logger.info(
            { updateId: update.update_id, status: outcome.status, userId: outcome.userId },
            "BaleBot: handled incoming update"
          );
        } catch (err: any) {
          logger.error(
            { updateId: update.update_id, err: err?.message },
            "BaleBot: error handling update"
          );
        }
      }
    } catch (err: any) {
      if (!isShuttingDown) {
        logger.error({ err: err?.message }, "BaleBot: polling loop error; retrying in 5s");
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
}

async function main(): Promise<void> {
  if (BaleGateway.isStubMode()) {
    logger.error("BaleBot: BALE_BOT_TOKEN is missing or in test/stub mode. Set a real token in .env.");
    process.exit(1);
  }

  const me = await BaleGateway.getMe();
  if (!me.ok || !me.bot) {
    logger.error({ error: me.error }, "BaleBot: failed to verify bot token with getMe");
    process.exit(1);
  }

  logger.info(
    {
      botId: me.bot.id,
      botName: me.bot.first_name,
      username: `@${me.bot.username}`,
      url: BaleGateway.getBotUrl(),
    },
    "BaleBot: connected successfully"
  );

  // Check webhook status; delete webhook if --force-polling is passed
  const webhookInfo = await BaleGateway.getWebhookInfo();
  if (webhookInfo.ok && webhookInfo.info?.url) {
    if (process.argv.includes("--force-polling")) {
      logger.warn({ url: webhookInfo.info.url }, "BaleBot: deleting existing webhook for polling mode");
      await BaleGateway.deleteWebhook();
    } else {
      logger.warn(
        { url: webhookInfo.info.url },
        "BaleBot: a webhook is currently set. Run with --force-polling or `npm run bot:webhook -- delete` if polling does not receive updates."
      );
    }
  }

  // Run initial scheduler tick (covers Edge Case #14 catch-up on startup) and schedule every 60s
  await runSchedulerTick();
  const schedulerInterval = setInterval(() => {
    void runSchedulerTick();
  }, 60 * 1000);

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "BaleBot: shutting down gracefully...");
    clearInterval(schedulerInterval);
    // Acknowledge latest processed update offset so Bale will not redeliver on next restart
    if (currentPollOffset !== undefined && currentPollOffset !== lastAckedOffset) {
      await BaleGateway.getUpdates(currentPollOffset, 0).catch(() => {});
    }
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await startPollingLoop();
}

main().catch(async (err) => {
  logger.error({ err: err?.message }, "BaleBot: fatal error");
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
