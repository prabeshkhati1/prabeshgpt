// api/chat.js — Vercel serverless function
//
// Reads API keys from Vercel environment variables — never from
// the request body. Set these in:
//   Vercel Dashboard → Project → Settings → Environment Variables
//
//   DOUBLEWORD_KEY  = your DoubleWord API key
//   FREEMODEL_KEY   = your FreeModel API key
//
// Then redeploy for the variables to take effect.

export default async function handler(req, res) {
  // Only POST is accepted
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Destructure everything except apiKey — keys come from env vars only
  const { model, messages, baseURL, temperature, max_tokens } = req.body;

  // Validate required fields
  if (!model) {
    return res.status(400).json({ error: "Missing model" });
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing or invalid messages" });
  }
  if (!baseURL) {
    return res.status(400).json({ error: "Missing baseURL" });
  }

  // Pick the correct API key based on which provider's baseURL was sent
  const isFreeModel = baseURL.includes("freemodel.dev");
  const apiKey = isFreeModel
    ? process.env.FREEMODEL_KEY
    : process.env.DOUBLEWORD_KEY;

  // Guard: fail clearly if the env var is missing rather than
  // sending an empty Authorization header to the provider
  if (!apiKey) {
    const missing = isFreeModel ? "FREEMODEL_KEY" : "DOUBLEWORD_KEY";
    console.error(`[api/chat.js] Missing environment variable: ${missing}`);
    return res.status(500).json({
      error: `Server misconfiguration: ${missing} is not set in Vercel environment variables.`,
    });
  }

  // Use temperature/max_tokens from request body (set by CONFIG in app.js)
  // Fall back to safe defaults in case they're missing
  const TEMPERATURE = typeof temperature === "number" ? temperature : 0.7;
  const MAX_TOKENS  = typeof max_tokens  === "number" ? max_tokens  : 1024;

  // Detect Anthropic-native endpoint (Claude via FreeModel cc subdomain)
  const isAnthropic = baseURL.includes("cc.freemodel.dev");

  try {
    let response;

    if (isAnthropic) {
      // ── Anthropic native format ──────────────────────────────
      // Anthropic API requires:
      //   - system prompt as a top-level field, not in messages[]
      //   - x-api-key header instead of Authorization: Bearer
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
        method:  "POST",
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

      // Normalise Anthropic response → OpenAI shape so app.js
      // can use data.choices[0].message.content uniformly
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
        method:  "POST",
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
