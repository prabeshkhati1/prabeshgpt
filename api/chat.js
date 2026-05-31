// api/chat.js — Vercel serverless function
//
// This is the only place API keys live.
// The frontend (app.js) never sees or sends them.

// ═══════════════════════════════════════════════════════════════
// ✏️  PASTE YOUR API KEYS HERE
// ═══════════════════════════════════════════════════════════════

// DoubleWord key — used for ALL models on api.doubleword.ai:
//   ⚡ DeepSeek V4 Flash  (deepseek-ai/DeepSeek-V4-Flash)
//   ⚡ Gemma 4 31B IT     (google/gemma-4-31B-it)
//   💸 DeepSeek V4 Pro    (deepseek-ai/DeepSeek-V4-Pro)
//   💸 Kimi K2.6          (moonshotai/Kimi-K2.6)
// Get / rotate at: https://doubleword.ai/dashboard
const DOUBLEWORD_KEY = "sk-EWEGd-W9NxyI6Y-SSG_klrt3fqx94EPRDd4ubs1QCOY"; //PASTE_YOUR_DOUBLEWORD_KEY_HERE

// FreeModel key — used for ALL models on freemodel.dev:
//   🌩️ GPT-4o Mini        (gpt-4o-mini  via api.freemodel.dev)
//   Any Claude models you add later (via cc.freemodel.dev)
// Get / rotate at: https://freemodel.dev/dashboard
const FREEMODEL_KEY = "fe_oa_6c17153ca42cdf5120eae6137a36f90c2dd818c3c2ac9462"; //PASTE_YOUR_FREEMODEL_KEY_HERE

// ═══════════════════════════════════════════════════════════════
// Adding a new provider?
//   1. Add a new const for its key above.
//   2. Add an `if (baseURL.includes("..."))` branch in
//      resolveApiKey() below to return that key.
//   3. Add the model to MODELS[] in app.js with the right baseURL.
// ═══════════════════════════════════════════════════════════════

function resolveApiKey(baseURL = "") {
  if (baseURL.includes("freemodel.dev")) return FREEMODEL_KEY;   // GPT-4o Mini + Claude (cc subdomain)
  if (baseURL.includes("doubleword.ai")) return DOUBLEWORD_KEY;  // DeepSeek, Gemma, Kimi
  return DOUBLEWORD_KEY; // safe default — update if you add a third provider
}

// ───────────────────────────────────────────────────────────────
// HANDLER
// ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // apiKey is intentionally not accepted from the request body —
  // it is always resolved from the constants above.
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

  const apiKey = resolveApiKey(baseURL);

  // Guard: if someone forgot to paste a key above, fail clearly
  if (!apiKey || apiKey.startsWith("PASTE_YOUR_")) {
    const which = baseURL.includes("freemodel.dev") ? "FREEMODEL_KEY" : "DOUBLEWORD_KEY";
    console.error(`[api/chat.js] ${which} has not been set — paste your key into api/chat.js`);
    return res.status(500).json({
      error: `Server misconfiguration: ${which} is still a placeholder. Open api/chat.js and paste your real key.`,
    });
  }

  const TEMPERATURE = typeof temperature === "number" ? temperature : 0.7;
  const MAX_TOKENS  = typeof max_tokens  === "number" ? max_tokens  : 1024;

  // cc.freemodel.dev = Anthropic-native format (for Claude models)
  // everything else  = OpenAI-compatible format
  const isAnthropic = baseURL.includes("cc.freemodel.dev");

  try {
    let response;

    if (isAnthropic) {
      // ── Anthropic native format ────────────────────────────────
      // Requires the system prompt as a top-level field and uses
      // x-api-key instead of Authorization: Bearer.
      // Key used → FREEMODEL_KEY
      const systemMsg     = messages.find((m) => m.role === "system");
      const nonSystemMsgs = messages.filter((m) => m.role !== "system");

      response = await fetch(`${baseURL}/messages`, {
        method:  "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         apiKey,           // ← FREEMODEL_KEY
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens:  MAX_TOKENS,
          temperature: TEMPERATURE,
          messages:    nonSystemMsgs,
          ...(systemMsg && { system: systemMsg.content }),
        }),
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch { return res.status(response.status).json({ error: text }); }

      if (!response.ok) {
        console.error("[api/chat.js] Anthropic error:", data);
        return res.status(response.status).json({ error: data });
      }

      // Normalise to OpenAI shape so app.js works uniformly
      return res.status(200).json({
        choices: [{ message: { content: data.content?.[0]?.text ?? "" } }],
        usage: {
          total_tokens:
            (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      });

    } else {
      // ── OpenAI-compatible format ───────────────────────────────
      // Used for DoubleWord (DeepSeek, Gemma, Kimi) and
      // FreeModel GPT models (GPT-4o Mini).
      // Key used → DOUBLEWORD_KEY  or  FREEMODEL_KEY
      response = await fetch(`${baseURL}/chat/completions`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${apiKey}`, // ← DOUBLEWORD_KEY or FREEMODEL_KEY
        },
        body: JSON.stringify({ model, messages, temperature: TEMPERATURE, max_tokens: MAX_TOKENS }),
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch { return res.status(response.status).json({ error: text }); }

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
