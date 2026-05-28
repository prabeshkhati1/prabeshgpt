export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { model, messages, temperature, max_tokens, apiKey, baseURL } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: "Missing API key" });
  }

  // Use provided baseURL or fall back to Doubleword
  const endpoint = `${baseURL || "https://api.doubleword.ai/v1"}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
