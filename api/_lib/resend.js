export const MAX_ATTACHMENT_BYTES = 1024 * 1024; // matches the Firestore-backed resume size cap
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ResendError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Validates the common send fields and builds the Resend attachment array.
// Throws a ResendError (with a user-facing message + HTTP status) on bad input.
export function buildAttachments({ attachResume, resumeData, resumeFilename }) {
  if (!attachResume) return undefined;
  if (!resumeData) {
    throw new ResendError("No resume on file to attach — add one in My Info first.", 400);
  }
  if (Buffer.byteLength(resumeData, "base64") > MAX_ATTACHMENT_BYTES) {
    throw new ResendError("Resume file is too large to attach.", 400);
  }
  return [{ filename: resumeFilename || "resume.pdf", content: resumeData }];
}

export function validateEmailFields({ to, subject, body }) {
  if (!to || !EMAIL_RE.test(to)) {
    throw new ResendError("Missing or invalid recipient email.", 400);
  }
  if (!subject || !body) {
    throw new ResendError("Missing subject or body.", 400);
  }
}

// Sends via the Resend API. Throws a ResendError with a friendly message and
// status on failure; callers turn that into an HTTP response.
export async function sendViaResend({ to, subject, body, replyTo, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new ResendError("Email sending isn't configured on the server yet.", 500);
  }

  const payload = {
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to,
    subject,
    text: body,
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(attachments ? { attachments } : {}),
  };

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
    throw new ResendError("Couldn't send the email right now — try again.", 502);
  }
}
