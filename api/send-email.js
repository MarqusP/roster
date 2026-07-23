// Vercel Serverless Function.
// Sends an outreach email on the member's behalf via Resend, so a resume can
// be attached as a real file -- something a mailto: link can never do.

import { verifyFirebaseToken, makeRateLimiter } from "./_lib/verify.js";
import { validateEmailFields, buildAttachments, sendViaResend } from "./_lib/resend.js";

const RATE_LIMIT_MAX_PER_HOUR = 30;
const isRateLimited = makeRateLimiter(RATE_LIMIT_MAX_PER_HOUR, 60 * 60 * 1000);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const uid = await verifyFirebaseToken(req.headers.authorization);
  if (!uid) {
    return res.status(401).json({ error: "Sign in to send email." });
  }

  if (isRateLimited(uid)) {
    return res.status(429).json({ error: "You've hit the sending limit for this hour — try again later." });
  }

  const { to, subject, body, replyTo, attachResume, resumeData, resumeFilename } = req.body || {};

  try {
    validateEmailFields({ to, subject, body });
    const attachments = buildAttachments({ attachResume, resumeData, resumeFilename });
    await sendViaResend({ to, subject, body, replyTo, attachments });
    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error("send-email error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Couldn't send the email." });
  }
}
