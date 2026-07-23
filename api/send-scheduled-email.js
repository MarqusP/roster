// Vercel Serverless Function -- QStash delivery target.
// Uses the Web Standard `fetch(request)` handler (not the (req, res) helper
// style used elsewhere in api/) specifically so `request.text()` gives the
// exact raw body bytes QStash signed -- required for signature verification.

import { verifyQstashSignature } from "./_lib/qstash.js";
import { buildAttachments, sendViaResend } from "./_lib/resend.js";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

function firestoreDocUrl(id) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/scheduledEmails/${id}`;
}

// Unauthenticated update, limited by firestore.rules to exactly these fields
// -- this endpoint has no user session (it's called by QStash), so it can't
// write with a Firebase ID token. See firestore.rules for the narrow rule.
async function markStatus(docId, fields) {
  if (!docId) return;
  const fieldPaths = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${k}`)
    .join("&");
  try {
    const res = await fetch(`${firestoreDocUrl(docId)}?${fieldPaths}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) console.error("scheduledEmails status update failed:", await res.text());
  } catch (err) {
    console.error("scheduledEmails status update error:", err);
  }
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("upstash-signature");
    const appUrl = process.env.PUBLIC_APP_URL;
    const destinationUrl = `${appUrl}/api/send-scheduled-email`;

    const valid = await verifyQstashSignature({ signature, rawBody, url: destinationUrl });
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400 });
    }

    const { to, subject, body, replyTo, attachResume, resumeData, resumeFilename, docId } = payload;

    try {
      const attachments = buildAttachments({ attachResume, resumeData, resumeFilename });
      await sendViaResend({ to, subject, body, replyTo, attachments });
      await markStatus(docId, {
        status: { stringValue: "sent" },
        sentAt: { timestampValue: new Date().toISOString() },
      });
      return new Response(JSON.stringify({ sent: true }), { status: 200 });
    } catch (err) {
      console.error("send-scheduled-email error:", err);
      await markStatus(docId, {
        status: { stringValue: "failed" },
        error: { stringValue: String(err.message || "send failed").slice(0, 500) },
      });
      // Non-2xx tells QStash to retry per its own backoff/DLQ policy.
      return new Response(JSON.stringify({ error: "Send failed" }), { status: err.status || 500 });
    }
  },
};
