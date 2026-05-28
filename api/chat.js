export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { model, messages, apiKey, baseURL } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: "Missing API key" });
  }

  if (!model) {
    return res.status(400).json({ error: "Missing model" });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing or invalid messages" });
  }

  // ── Hardcoded parameters ──
  const TEMPERATURE = 0.7;
  const MAX_TOKENS = 2000;

  const isAnthropic = baseURL && baseURL.includes("cc.freemodel.dev");

  try {
    let response;

    if (isAnthropic) {
      // ── Anthropic native format (Claude models via FreeModel) ──
      const systemMsg = messages.find(m => m.role === "system");
      const nonSystemMsgs = messages.filter(m => m.role !== "system");

      const body = {
        model,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        messages: nonSystemMsgs,
        ...(systemMsg && { system: systemMsg.content }),
      };

      response = await fetch(`${baseURL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
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

      // Convert Anthropic response → OpenAI format so frontend works unchanged
      return res.status(200).json({
        choices: [{ message: { content: data.content?.[0]?.text ?? "" } }],
        usage: {
          total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      });

    } else {
      // ── OpenAI-compatible format (Doubleword + FreeModel GPT) ──
      const endpoint = `${baseURL || "https://api.doubleword.ai/v1"}/chat/completions`;

      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
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
    console.error("[chat.js error]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
