// Vercel Serverless Function.
// Cancels a not-yet-delivered scheduled email: stops the QStash message and
// marks the Firestore metadata doc as canceled.

import { verifyFirebaseToken } from "./_lib/verify.js";
import { cancelQstashMessage } from "./_lib/qstash.js";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

function firestoreDocUrl(id) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/scheduledEmails/${id}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const uid = await verifyFirebaseToken(authHeader);
  if (!uid) {
    return res.status(401).json({ error: "Sign in to cancel a scheduled email." });
  }

  const { docId, qstashMessageId } = req.body || {};
  if (!docId || !qstashMessageId) {
    return res.status(400).json({ error: "Missing scheduled email id." });
  }

  // Application-layer ownership check -- the Firestore rule for status
  // updates is intentionally auth-agnostic (see firestore.rules), so this is
  // the actual gate that stops a member from cancelling someone else's send.
  const getRes = await fetch(firestoreDocUrl(docId), { headers: { Authorization: authHeader } });
  if (!getRes.ok) {
    return res.status(404).json({ error: "Scheduled email not found." });
  }
  const doc = await getRes.json();
  if (doc.fields?.uid?.stringValue !== uid) {
    return res.status(403).json({ error: "You don't own this scheduled email." });
  }

  try {
    await cancelQstashMessage(qstashMessageId);
  } catch (err) {
    console.error("QStash cancel error:", err);
    return res.status(502).json({ error: "Couldn't cancel — try again." });
  }

  const patchRes = await fetch(`${firestoreDocUrl(docId)}?updateMask.fieldPaths=status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields: { status: { stringValue: "canceled" } } }),
  });
  if (!patchRes.ok) {
    console.error("scheduledEmails cancel update failed:", await patchRes.text());
  }

  return res.status(200).json({ canceled: true });
}
