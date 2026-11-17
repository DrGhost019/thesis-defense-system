import { loadEnvFile } from "./load-env";
loadEnvFile();

import { NotificationService } from "../src/services/NotificationService";
import logger from "../src/lib/logger";
import prisma from "../src/lib/prisma";

async function main() {
  logger.info("Executing daily reminder cron job at 09:00 Asia/Tehran...");
  try {
    const result = await NotificationService.runDailyReminders();
    logger.info(result, "Daily reminders run completed");

    // Also process pending outcomes and due retries (Appendix F.2)
    const retryResult = await NotificationService.processPendingAndRetries({ forceImmediate: false });
    logger.info(retryResult, "Pending & retry notifications run completed");
  } catch (err: any) {
    logger.error({ err: err.message }, "Error during daily reminders cron job");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
