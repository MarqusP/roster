import { jwtVerify } from "jose";
import { createHash } from "node:crypto";

const QSTASH_BASE_URL = "https://qstash.upstash.io/v2";

// Schedules `body` to be POSTed to `url` at `notBeforeSeconds` (unix seconds).
export async function publishToQstash({ url, body, notBeforeSeconds }) {
  const token = process.env.QSTASH_TOKEN;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (notBeforeSeconds) headers["Upstash-Not-Before"] = String(notBeforeSeconds);

  const res = await fetch(`${QSTASH_BASE_URL}/publish/${url}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QStash publish failed: ${res.status} ${text}`);
  }
  return res.json(); // { messageId }
}

// Cancels a not-yet-delivered scheduled message. A 404 means it already
// delivered (or never existed) -- nothing left to cancel, treat as success.
export async function cancelQstashMessage(messageId) {
  const token = process.env.QSTASH_TOKEN;
  const res = await fetch(`${QSTASH_BASE_URL}/messages/${messageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`QStash cancel failed: ${res.status} ${text}`);
  }
}

function stripPadding(s) {
  return s.replace(/=+$/, "");
}

// Mirrors @upstash/qstash's Receiver.verify(): the Upstash-Signature header is
// a JWT (HS256, symmetric) signed with the current or next signing key
// (rotation support). Its `sub` claim must equal the exact destination URL we
// published to, and its `body` claim is a base64url SHA-256 hash of the exact
// raw request body -- both are checked here the same way the official SDK does.
export async function verifyQstashSignature({ signature, rawBody, url }) {
  if (!signature) return false;
  const keys = [process.env.QSTASH_CURRENT_SIGNING_KEY, process.env.QSTASH_NEXT_SIGNING_KEY].filter(Boolean);

  let payload = null;
  for (const key of keys) {
    try {
      const { payload: verified } = await jwtVerify(signature, new TextEncoder().encode(key), {
        issuer: "Upstash",
      });
      payload = verified;
      break;
    } catch {
      // try the next signing key
    }
  }
  if (!payload) return false;
  if (payload.sub !== url) return false;

  const bodyHash = createHash("sha256").update(rawBody).digest("base64url");
  if (stripPadding(String(payload.body)) !== stripPadding(bodyHash)) return false;

  return true;
}
