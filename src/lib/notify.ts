// Notification gateway. Swap this out for a real WhatsApp/Slack integration —
// set SLACK_WEBHOOK_URL to post there too. Everything also logs to the
// console so the app works with zero notification config in the office.

export async function notifyUser(name: string, message: string) {
  console.log(`[IceQueue notify -> ${name}] ${message}`);

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*${name}*: ${message}` }),
    });
  } catch (err) {
    console.error("[IceQueue notify] failed to reach Slack webhook", err);
  }
}
