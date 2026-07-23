// Vercel Serverless Function.
// Sends an outreach email on the member's behalf via Resend, so a resume can
// be attached as a real file -- something a mailto: link can never do.

import { verifyFirebaseToken, makeRateLimiter } from "./_lib/verify.js";

const RATE_LIMIT_MAX_PER_HOUR = 30;
const isRateLimited = makeRateLimiter(RATE_LIMIT_MAX_PER_HOUR, 60 * 60 * 1000);

const MAX_ATTACHMENT_BYTES = 1024 * 1024; // matches the Firestore-backed resume size cap
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Email sending isn't configured on the server yet." });
  }

  const { to, subject, body, replyTo, attachResume, resumeData, resumeFilename } = req.body || {};
  if (!to || !EMAIL_RE.test(to)) {
    return res.status(400).json({ error: "Missing or invalid recipient email." });
  }
  if (!subject || !body) {
    return res.status(400).json({ error: "Missing subject or body." });
  }

  let attachments;
  if (attachResume) {
    if (!resumeData) {
      return res.status(400).json({ error: "No resume on file to attach — add one in My Info first." });
    }
    if (Buffer.byteLength(resumeData, "base64") > MAX_ATTACHMENT_BYTES) {
      return res.status(400).json({ error: "Resume file is too large to attach." });
    }
    attachments = [{ filename: resumeFilename || "resume.pdf", content: resumeData }];
  }

  const payload = {
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to,
    subject,
    text: body,
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(attachments ? { attachments } : {}),
  };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Resend API error:", response.status, errText);
      return res.status(502).json({ error: "Couldn't send the email right now — try again." });
    }

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error("send-email error:", err);
    return res.status(500).json({ error: "Couldn't send the email." });
  }
}
