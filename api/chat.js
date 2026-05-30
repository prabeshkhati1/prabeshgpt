// api/chat.js — Vercel serverless function
//
// CHANGED: API keys are no longer accepted from the request body.
// They are read from Vercel environment variables instead:
//   DOUBLEWORD_KEY  → for all doubleword.ai models
//   FREEMODEL_KEY   → for all freemodel.dev models
//
// To set these up:
//   Vercel Dashboard → Your Project → Settings → Environment Variables
//   Add: DOUBLEWORD_KEY = <your doubleword key>
//   Add: FREEMODEL_KEY  = <your freemodel key>
//   Then redeploy.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // CHANGED: removed apiKey from destructure — no longer sent by frontend
  const { model, messages, baseURL, temperature, max_tokens } = req.body;

  if (!model) {
    return res.status(400).json({ error: "Missing model" });
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing or invalid messages" });
  }
  if (!baseURL) {
    return res.status(400).json({ error: "Missing baseURL" });
  }

  // CHANGED: pick the correct API key from env vars based on which
  // provider's baseURL was sent by the frontend.
  const isFreeModel = baseURL.includes("freemodel.dev");
  const apiKey = isFreeModel
    ? process.env.FREEMODEL_KEY
    : process.env.DOUBLEWORD_KEY;

  // Guard: if the env var isn't set, fail clearly rather than
  // sending an empty Authorization header to the provider.
  if (!apiKey) {
    const missing = isFreeModel ? "FREEMODEL_KEY" : "DOUBLEWORD_KEY";
    console.error(`[api/chat.js] Missing environment variable: ${missing}`);
    return res.status(500).json({
      error: `Server misconfiguration: ${missing} environment variable is not set.`,
    });
  }

  // Use values from request body; fall back to safe defaults
  const TEMPERATURE = typeof temperature === "number" ? temperature : 0.7;
  const MAX_TOKENS  = typeof max_tokens  === "number" ? max_tokens  : 1024;

  // Detect Anthropic-native endpoint (Claude models via FreeModel cc subdomain)
  const isAnthropic = baseURL.includes("cc.freemodel.dev");

  try {
    let response;

    if (isAnthropic) {
      // ── Anthropic native format ──────────────────────────────
      // Anthropic separates the system prompt from the message
      // list and uses x-api-key instead of Authorization: Bearer.
      const systemMsg     = messages.find((m) => m.role === "system");
      const nonSystemMsgs = messages.filter((m) => m.role !== "system");

      const body = {
        model,
        max_tokens:  MAX_TOKENS,
        temperature: TEMPERATURE,
        messages:    nonSystemMsgs,
        ...(systemMsg && { system: systemMsg.content }),
      };

      response = await fetch(`${baseURL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(response.status).json({ error: text });
      }

      if (!response.ok) {
        console.error("[api/chat.js] Anthropic error:", data);
        return res.status(response.status).json({ error: data });
      }

      // Normalise to OpenAI shape so frontend works unchanged
      return res.status(200).json({
        choices: [
          { message: { content: data.content?.[0]?.text ?? "" } },
        ],
        usage: {
          total_tokens:
            (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      });

    } else {
      // ── OpenAI-compatible format (DoubleWord + FreeModel GPT) ─
      const endpoint = `${baseURL}/chat/completions`;

      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: TEMPERATURE,
          max_tokens:  MAX_TOKENS,
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(response.status).json({ error: text });
      }

      if (!response.ok) {
        console.error("[api/chat.js] Provider error:", data);
        return res.status(response.status).json({ error: data });
      }

      return res.status(200).json(data);
    }

  } catch (err) {
    console.error("[api/chat.js] Unhandled error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
