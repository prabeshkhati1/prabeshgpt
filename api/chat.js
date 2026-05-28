export default async function handler(req, res) {
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

    const text = await response.text();  // read as text first

    let data;
    try {
      data = JSON.parse(text);  // try to parse as JSON
    } catch {
      // Doubleword returned plain text (e.g. auth error)
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
