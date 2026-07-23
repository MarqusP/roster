// Vercel Serverless Function.
// Proxies a request to the Anthropic API to draft a personalized outreach
// email, keeping the Anthropic API key on the server (never sent to the browser).

import { verifyFirebaseToken, makeRateLimiter } from "./_lib/verify.js";

const RATE_LIMIT_MAX_PER_HOUR = 20;
const isRateLimited = makeRateLimiter(RATE_LIMIT_MAX_PER_HOUR, 60 * 60 * 1000);

function resumeAsDocumentBlock(resume) {
  if (!resume?.data) return null;
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: resume.data },
    // The same resume is reused across many drafts for this user -- cache it
    // so repeat requests don't re-process the PDF at full price.
    cache_control: { type: "ephemeral" },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const uid = await verifyFirebaseToken(req.headers.authorization);
  if (!uid) {
    return res.status(401).json({ error: "Sign in to use the draft assistant." });
  }

  if (isRateLimited(uid)) {
    return res.status(429).json({ error: "You've hit the draft limit for this hour — try again later." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }

  const { alum, purpose, context, myInfo, chapterName } = req.body || {};
  if (!alum || !alum.name) {
    return res.status(400).json({ error: "Missing alum details." });
  }

  const purposeText =
    {
      informational: "a brief informational interview to learn about their career path",
      referral: "advice or a possible referral for a job opportunity",
      "breaking-in": "advice on how to break into their industry",
      general: "general networking and staying connected as fellow chapter alumni",
    }[purpose] || "general networking";

  const fromBits = [];
  if (myInfo?.gradYear) fromBits.push(`class of ${myInfo.gradYear}`);
  if (myInfo?.major) fromBits.push(`studying ${myInfo.major}`);

  const resumeBlock = resumeAsDocumentBlock(myInfo?.resume);

  const prompt = [
    "Write a short, warm, professional networking email.",
    `From: ${myInfo?.name || "a chapter member"}${fromBits.length ? ", " + fromBits.join(", ") : ""}, a current member of ${chapterName || "the chapter"}.`,
    `To: ${alum.name}, who works as ${alum.title || "a professional"} at ${alum.company || "their company"}${alum.industry ? " in " + alum.industry : ""}.`,
    `Purpose: requesting ${purposeText}.`,
    context ? `Additional context from the sender: ${context}` : "",
    resumeBlock
      ? "The sender's resume is attached. Where it's genuinely relevant, you may reference a specific, concrete detail from it (a role, skill, or project) to make the ask more credible -- don't just summarize the resume."
      : "",
    "Requirements: 120-180 words, genuine and specific rather than generic, naturally mention the shared fraternity/chapter connection, reference something concrete about the recipient's role or industry, include exactly one clear low-pressure ask, and sign off with the sender's first name only (no bracket placeholders).",
    'Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape: {"subject": "...", "body": "..."}',
  ]
    .filter(Boolean)
    .join("\n");

  const userContent = resumeBlock ? [resumeBlock, { type: "text", text: prompt }] : prompt;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return res.status(502).json({ error: "The draft assistant is unavailable right now." });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ subject: parsed.subject || "", body: parsed.body || "" });
  } catch (err) {
    console.error("draft-email error:", err);
    return res.status(500).json({ error: "Could not generate a draft." });
  }
}
