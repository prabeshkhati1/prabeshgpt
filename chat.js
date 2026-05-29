// api/chat.js  — Vercel serverless function
//
// This is the backend proxy that forwards requests to the AI provider.
// It keeps the API key out of CORS-visible client requests.
//
// FIX: temperature and max_tokens were hardcoded here AND in app.js,
// creating two conflicting sources of truth. Now they come from the
// request body (set once in app.js CONFIG), and this file simply
// forwards them. If they are missing from the body, safe defaults
// are used as a fallback.

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // FIX: destructure temperature and max_tokens from the request body
  // so app.js CONFIG values flow all the way through to the provider.
  const { model, messages, apiKey, baseURL, temperature, max_tokens } = req.body;

  // Validate required fields
  if (!apiKey) {
    return res.status(400).json({ error: "Missing API key" });
  }
  if (!model) {
    return res.status(400).json({ error: "Missing model" });
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing or invalid messages" });
  }

  // FIX: use values from the request body; fall back to safe defaults
  // only if the client didn't send them (shouldn't happen with the
  // fixed app.js, but defensive programming is good).
  const TEMPERATURE = typeof temperature === "number" ? temperature : 0.7;
  const MAX_TOKENS  = typeof max_tokens  === "number" ? max_tokens  : 1024;

  // Detect Anthropic-native endpoint (Claude models via FreeModel)
  const isAnthropic = baseURL && baseURL.includes("cc.freemodel.dev");

  try {
    let response;

    if (isAnthropic) {
      // ── Anthropic native format ──────────────────────────────────
      // The Anthropic API separates the system prompt from messages
      // and uses a different auth header scheme.
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
        return res.status(response.status).json({ error: data });
      }

      // Normalise Anthropic response → OpenAI-compatible shape so
      // app.js can use data.choices[0].message.content uniformly.
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
      // ── OpenAI-compatible format (DoubleWord + FreeModel GPT) ───
      const endpoint = `${baseURL || "https://api.doubleword.ai/v1"}/chat/completions`;

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
        return res.status(response.status).json({ error: data });
      }

      return res.status(200).json(data);
    }

  } catch (err) {
    // FIX: log the full error server-side for easier debugging in
    // Vercel function logs.
    console.error("[api/chat.js error]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
