// Vercel Serverless Function.
// Schedules an outreach email for a future professional-hours time using
// Upstash QStash (which holds the full payload and delivers it directly to
// send-scheduled-email.js at the target time -- this endpoint never polls
// for "what's due"). A lightweight Firestore doc is also written purely for
// the in-app "Scheduled" list/cancel UI.

import { randomUUID } from "node:crypto";
import { verifyFirebaseToken, makeRateLimiter } from "./_lib/verify.js";
import { validateEmailFields, buildAttachments } from "./_lib/resend.js";
import { publishToQstash } from "./_lib/qstash.js";
import { isWithinProfessionalHours } from "./_lib/businessHours.js";

const RATE_LIMIT_MAX_PER_HOUR = 30;
const isRateLimited = makeRateLimiter(RATE_LIMIT_MAX_PER_HOUR, 60 * 60 * 1000);

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

function firestoreCreateUrl(collection, id) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${id}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const uid = await verifyFirebaseToken(authHeader);
  if (!uid) {
    return res.status(401).json({ error: "Sign in to schedule email." });
  }

  if (isRateLimited(uid)) {
    return res.status(429).json({ error: "You've hit the scheduling limit for this hour — try again later." });
  }

  const appUrl = process.env.PUBLIC_APP_URL;
  if (!appUrl || !process.env.QSTASH_TOKEN) {
    return res.status(500).json({ error: "Scheduled sending isn't configured on the server yet." });
  }

  const { to, subject, body, replyTo, attachResume, resumeData, resumeFilename, scheduledFor, alumName } =
    req.body || {};

  try {
    validateEmailFields({ to, subject, body });
    buildAttachments({ attachResume, resumeData, resumeFilename }); // validates size/presence only
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const scheduledDate = new Date(scheduledFor);
  if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
    return res.status(400).json({ error: "Pick a valid future date and time." });
  }
  if (!isWithinProfessionalHours(scheduledDate)) {
    return res.status(400).json({ error: "Scheduled time must be a weekday between 9am and 5pm Pacific." });
  }

  const id = randomUUID();
  const hasResume = Boolean(attachResume && resumeData);

  let messageId;
  try {
    const result = await publishToQstash({
      url: `${appUrl}/api/send-scheduled-email`,
      body: {
        docId: id,
        to,
        subject,
        body,
        replyTo,
        attachResume: hasResume,
        resumeData: hasResume ? resumeData : undefined,
        resumeFilename: hasResume ? resumeFilename : undefined,
      },
      notBeforeSeconds: Math.floor(scheduledDate.getTime() / 1000),
    });
    messageId = result.messageId;
  } catch (err) {
    console.error("QStash schedule error:", err);
    return res.status(502).json({ error: "Couldn't schedule the email — try again." });
  }

  try {
    const docRes = await fetch(firestoreCreateUrl("scheduledEmails", id), {
      method: "POST",
      headers: { Authorization: authHeader, "content-type": "application/json" },
      body: JSON.stringify({
        fields: {
          uid: { stringValue: uid },
          to: { stringValue: to },
          subject: { stringValue: subject },
          alumName: { stringValue: alumName || "" },
          scheduledFor: { timestampValue: scheduledDate.toISOString() },
          status: { stringValue: "pending" },
          qstashMessageId: { stringValue: messageId },
          hasResumeAttached: { booleanValue: hasResume },
          createdAt: { timestampValue: new Date().toISOString() },
        },
      }),
    });
    if (!docRes.ok) {
      console.error("Firestore scheduledEmails write failed:", await docRes.text());
    }
  } catch (err) {
    // The send is already scheduled with QStash regardless -- losing this
    // metadata write only means it won't show in the in-app "Scheduled" list.
    console.error("Firestore scheduledEmails write error:", err);
  }

  return res.status(200).json({ scheduled: true, scheduledFor: scheduledDate.toISOString() });
}
