const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

/**
 * Watchdog Scheduler Cloud Function
 * Runs every 6 hours to scan active projects for inactivity (> 48 hours)
 * and trigger the Watchdog Agent nudge flow.
 */
exports.watchdogCron = onSchedule({
  schedule: "every 6 hours",
  timeoutSeconds: 300, // Allow ample time for Gemini responses
  memory: "256MiB",
  // Ensure we can access process.env values configured in Google Cloud
}, async (event) => {
  logger.info("Watchdog scheduler CRON execution started.");

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!appUrl) {
    logger.error("APP_URL or NEXT_PUBLIC_APP_URL environment variable is not set. Cannot ping Next.js server.");
    return;
  }

  if (!cronSecret) {
    logger.error("CRON_SECRET environment variable is not set. API request will be unauthorized.");
    return;
  }

  const targetUrl = `${appUrl.replace(/\/$/, "")}/api/watchdog`;
  logger.info(`Pinging API endpoint: ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorResponse = await response.text();
      logger.error(`Watchdog trigger failed with status ${response.status}: ${errorResponse}`);
      throw new Error(`Failed to trigger watchdog scan: ${response.status}`);
    }

    const data = await response.json();
    logger.info("Watchdog scheduler execution completed successfully.", data);
  } catch (error) {
    logger.error("Error encountered during Watchdog scheduler execution:", error);
    throw error;
  }
});
