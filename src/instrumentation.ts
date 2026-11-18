export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { BalePoller } = await import("@/services/BalePoller");
    BalePoller.ensureStarted();
  }
}
