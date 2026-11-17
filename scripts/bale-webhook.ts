import { loadEnvFile } from "./load-env";
loadEnvFile();

import { BaleGateway } from "../src/services/BaleGateway";

async function main() {
  const [, , command = "info", argUrl] = process.argv;

  const me = await BaleGateway.getMe();
  if (!me.ok || !me.bot) {
    console.error("Failed to connect to Bale Bot API:", me.error);
    process.exit(1);
  }

  console.log(`Bot: ${me.bot.first_name} (@${me.bot.username}, id=${me.bot.id})`);

  if (command === "info") {
    const info = await BaleGateway.getWebhookInfo();
    console.log("Webhook Info:", JSON.stringify(info, null, 2));
    return;
  }

  if (command === "set") {
    const baseUrl = (argUrl || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    if (!baseUrl || !baseUrl.startsWith("https://")) {
      console.error(
        "Usage: npm run bot:webhook -- set https://your-public-domain.com/api/v1/integrations/bale/webhook"
      );
      console.error("Note: Bale requires an HTTPS URL for webhooks. For local dev, use `npm run bot:start` (polling).");
      process.exit(1);
    }

    const webhookUrl = baseUrl.endsWith("/api/v1/integrations/bale/webhook")
      ? baseUrl
      : `${baseUrl}/api/v1/integrations/bale/webhook`;
    const secret = process.env.BALE_WEBHOOK_SECRET;

    const res = await BaleGateway.setWebhook(webhookUrl, secret);
    console.log("setWebhook result:", JSON.stringify(res, null, 2));
    if (!res.ok) process.exit(1);
    return;
  }

  if (command === "delete") {
    const res = await BaleGateway.deleteWebhook();
    console.log("deleteWebhook result:", JSON.stringify(res, null, 2));
    if (!res.ok) process.exit(1);
    return;
  }

  console.error("Unknown command. Use: info | set <https-url> | delete");
  process.exit(1);
}

main().catch((err) => {
  console.error("Webhook CLI error:", err);
  process.exit(1);
});
