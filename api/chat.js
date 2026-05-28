// api/chat.js — Vercel Serverless Proxy for Doubleword API
// This file MUST live at /api/chat.js in your repo root.
// It forwards browser requests to Doubleword server-side,
// which fixes the "Failed to fetch" CORS error.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { model, messages, temperature, max_tokens, apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: "Missing API key" });
  }

  try {
    const response = await fetch("https://api.doubleword.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: parseFloat(temperature) || 0.7,
        max_tokens: parseInt(max_tokens) || 1024,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
