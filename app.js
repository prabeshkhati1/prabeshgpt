/* ════════════════════════════════════════════════════════════════
   DoubleWord AI Studio — app.js
   ────────────────────────────────────────────────────────────────
   HOW TO INTEGRATE YOUR DOUBLEWORD API
   ─────────────────────────────────────
   There are 3 places to update, all clearly marked with:
     // ⚙️ API INTEGRATION POINT

   1. MODELS array     → add your model IDs + metadata
   2. CONFIG object    → set your DoubleWord base URL
   3. callDoubleWord() → plug in the exact fetch() call / SDK
                         that DoubleWord expects for your account
════════════════════════════════════════════════════════════════ */

"use strict";

/* ──────────────────────────────────────────────────────────────
   ⚙️ API INTEGRATION POINT #1 — YOUR MODELS
   ──────────────────────────────────────────────────────────────
   Add every DoubleWord model you want to test here.
   Fields:
     id          → the model identifier you pass to the API
     name        → friendly display name in the UI
     description → short note shown in the sidebar
     apiKeyHint  → optional: which key this model needs
                   (useful if models use different keys)
────────────────────────────────────────────────────────────── */
const MODELS = [
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    description: "Intelligence: 50 · Context: 1M · from $0.87/M",
    apiKeyHint: "Uses your DoubleWord API key"
  },
  {
    id: "deepseek/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    description: "Intelligence: 47 · Context: 1M · from $0.07/M",
    apiKeyHint: "Uses your DoubleWord API key"
  },
  {
    id: "qwen/qwen3.6-35b-a3b",
    name: "Qwen 3.6 35B A3B",
    description: "Intelligence: 43 · Context: 262K · from $0.05/M",
    apiKeyHint: "Uses your DoubleWord API key"
  },
  {
    id: "moonshot/kimi-k2.6",
    name: "Kimi K2.6",
    description: "Intelligence: 54 · Context: 262K · from $0.45/M",
    apiKeyHint: "Uses your DoubleWord API key"
  },
  {
    id: "z.ai/glm-5.1",
    name: "GLM 5.1",
    description: "Intelligence: 51 · Context: 203K · from $0.70/M",
    apiKeyHint: "Uses your DoubleWord API key"
  },
  {
    id: "google/gemma-4-31b-it",
    name: "Gemma 4 31B IT",
    description: "Intelligence: 39 · Context: 256K · from $0.07/M",
    apiKeyHint: "Uses your DoubleWord API key"
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    name: "Nemotron 3 Super 120B",
    description: "Intelligence: 36 · Context: 262K · from $0.15/M",
    apiKeyHint: "Uses your DoubleWord API key"
  },
  {
    id: "qwen/qwen3.5-9b-dottxt",
    name: "Qwen 3.5 9B dottxt",
    description: "Intelligence: 32 · Context: 262K · from $0.06/M",
    apiKeyHint: "Uses your DoubleWord API key"
  },
  {
    id: "qwen/qwen3.5-4b",
    name: "Qwen 3.5 4B",
    description: "Intelligence: 27 · Context: 262K · from $0.04/M",
    apiKeyHint: "Uses your DoubleWord API key"
  },
  {
    id: "qwen/qwen3.5-9b",
    name: "Qwen 3.5 9B",
    description: "Intelligence: 32 · Context: 262K · from $0.03/M",
    apiKeyHint: "Uses your DoubleWord API key"
  },
  // Add more from app.doubleword.ai/models — click the </> API button to get the exact model id
];

/* ──────────────────────────────────────────────────────────────
   ⚙️ API INTEGRATION POINT #2 — BASE CONFIG
   ──────────────────────────────────────────────────────────────
   Set the DoubleWord API base URL here.
   Check your DoubleWord dashboard for the exact endpoint.
────────────────────────────────────────────────────────────── */
const CONFIG = {
  baseURL: "https://api.doubleword.ai/v1",
  chatEndpoint: "/chat/completions",
};

/* ══════════════════════════════════════════════════════════════
   ⚙️ API INTEGRATION POINT #3 — THE ACTUAL API CALL
   ══════════════════════════════════════════════════════════════
   This is the core function that sends your message to
   DoubleWord and returns the assistant's reply.

   Currently structured for an OpenAI-compatible API
   (which many platforms use). If DoubleWord has a different
   request/response format, update:
     - the request body structure (payload)
     - how you extract the reply (data.choices[0]... line)

   For streaming responses, see the commented section below.
══════════════════════════════════════════════════════════════ */
async function callDoubleWord({ model, messages, apiKey, systemPrompt, temperature, maxTokens }) {

  // Build the message array — include system prompt if set
  const fullMessages = [];
  if (systemPrompt && systemPrompt.trim()) {
    fullMessages.push({ role: "system", content: systemPrompt.trim() });
  }
  fullMessages.push(...messages);

  // ── Request payload (OpenAI-compatible format) ──────────────
  // Adjust this object to match DoubleWord's expected schema
  const payload = {
    model: model,
    messages: fullMessages,
    temperature: parseFloat(temperature) || 0.7,
    max_tokens: parseInt(maxTokens) || 1024,
    // stream: false,    // set to true if you want streaming (see below)
  };

  // ── The actual fetch call ───────────────────────────────────
  const response = await fetch(`${CONFIG.baseURL}${CONFIG.chatEndpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,   // ← DoubleWord may use a different auth header
      // "X-Api-Key": apiKey,                 // ← uncomment if they use X-Api-Key instead
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();

  // ── Extract the reply ──────────────────────────────────────
  // OpenAI-compatible:
  const reply = data.choices?.[0]?.message?.content;

  // If DoubleWord returns a different structure, adjust here. Examples:
  // const reply = data.response;
  // const reply = data.message;
  // const reply = data.output?.text;

  if (!reply) {
    throw new Error("No reply content in API response. Check console for raw response.");
  }

  // ── Token tracking (optional) ──────────────────────────────
  const tokensUsed = data.usage?.total_tokens ?? null;

  return { reply, tokensUsed };

  /* ── STREAMING VERSION (commented out) ───────────────────────
     Uncomment and use this instead if DoubleWord supports streaming.
     You'll also need to update the sendMessage() function to handle
     incremental updates to the last AI message bubble.

  const response = await fetch(`${CONFIG.baseURL}${CONFIG.chatEndpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...payload, stream: true }),
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
    for (const line of lines) {
      const json = line.replace("data: ", "");
      if (json === "[DONE]") break;
      const parsed = JSON.parse(json);
      fullText += parsed.choices?.[0]?.delta?.content ?? "";
      // update the bubble in real-time:
      updateLastMessage(fullText);
    }
  }
  return { reply: fullText, tokensUsed: null };
  ──────────────────────────────────────────────────────────── */
}

/* ══════════════════════════════════════════════════════════════
   UI STATE
══════════════════════════════════════════════════════════════ */
let conversationHistory = [];  // { role, content }[]
let totalTokensUsed = 0;
let isWaiting = false;

/* ══════════════════════════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════════════════════════ */
const modelSelect    = document.getElementById("modelSelect");
const modelMeta      = document.getElementById("modelMeta");
const apiKeyInput    = document.getElementById("apiKeyInput");
const toggleKey      = document.getElementById("toggleKey");
const saveKeyBtn     = document.getElementById("saveKeyBtn");
const keyStatus      = document.getElementById("keyStatus");
const systemPrompt   = document.getElementById("systemPrompt");
const tempSlider     = document.getElementById("tempSlider");
const tempVal        = document.getElementById("tempVal");
const maxTokens      = document.getElementById("maxTokens");
const clearBtn       = document.getElementById("clearBtn");
const messagesArea   = document.getElementById("messagesArea");
const emptyState     = document.getElementById("emptyState");
const messageInput   = document.getElementById("messageInput");
const sendBtn        = document.getElementById("sendBtn");
const activeBadge    = document.getElementById("activeBadge");
const tokenCounter   = document.getElementById("tokenCounter");
const charCount      = document.getElementById("charCount");
const sidebarToggle  = document.getElementById("sidebarToggle");
const sidebar        = document.getElementById("sidebar");

/* ══════════════════════════════════════════════════════════════
   INIT — populate model dropdown
══════════════════════════════════════════════════════════════ */
function initModels() {
  modelSelect.innerHTML = "";
  MODELS.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = m.name;
    modelSelect.appendChild(opt);
  });
  updateModelMeta();
}

function updateModelMeta() {
  const m = MODELS[modelSelect.value];
  if (!m) return;
  modelMeta.textContent = `ID: ${m.id}${m.apiKeyHint ? "\n" + m.apiKeyHint : ""}`;
  activeBadge.textContent = m.name;
}

modelSelect.addEventListener("change", updateModelMeta);

/* ══════════════════════════════════════════════════════════════
   API KEY — save/load from localStorage
══════════════════════════════════════════════════════════════ */
function loadKey() {
  const saved = localStorage.getItem("dw_api_key");
  if (saved) {
    apiKeyInput.value = saved;
    keyStatus.textContent = "✓ Key loaded from storage";
    keyStatus.className = "key-status ok";
  }
}

saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = "⚠ Enter a key first";
    keyStatus.className = "key-status err";
    return;
  }
  localStorage.setItem("dw_api_key", key);
  keyStatus.textContent = "✓ Saved to local storage";
  keyStatus.className = "key-status ok";
});

toggleKey.addEventListener("click", () => {
  const isPass = apiKeyInput.type === "password";
  apiKeyInput.type = isPass ? "text" : "password";
  toggleKey.title = isPass ? "Hide key" : "Show key";
});

/* ══════════════════════════════════════════════════════════════
   PARAMETERS
══════════════════════════════════════════════════════════════ */
tempSlider.addEventListener("input", () => {
  tempVal.textContent = tempSlider.value;
});

/* ══════════════════════════════════════════════════════════════
   SEND MESSAGE
══════════════════════════════════════════════════════════════ */
async function sendMessage() {
  if (isWaiting) return;

  const userText = messageInput.value.trim();
  if (!userText) return;

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showError("No API key set. Add your DoubleWord API key in the sidebar.");
    return;
  }

  const model = MODELS[modelSelect.value];
  if (!model) {
    showError("No model selected.");
    return;
  }

  // Hide empty state
  if (emptyState) emptyState.style.display = "none";

  // Add user message to UI + history
  conversationHistory.push({ role: "user", content: userText });
  appendMessage("user", userText);
  messageInput.value = "";
  charCount.textContent = "0 chars";
  autoResize();

  // Show typing indicator
  isWaiting = true;
  sendBtn.disabled = true;
  const typingEl = appendTyping();

  try {
    const { reply, tokensUsed } = await callDoubleWord({
      model: model.id,
      messages: conversationHistory,
      apiKey,
      systemPrompt: systemPrompt.value,
      temperature: tempSlider.value,
      maxTokens: maxTokens.value,
    });

    typingEl.remove();
    conversationHistory.push({ role: "assistant", content: reply });
    appendMessage("ai", reply);

    if (tokensUsed !== null) {
      totalTokensUsed += tokensUsed;
      tokenCounter.textContent = `${totalTokensUsed.toLocaleString()} tokens used`;
    }
  } catch (err) {
    typingEl.remove();
    console.error("DoubleWord API error:", err);
    showError(err.message || "Something went wrong. Check the console.");
  } finally {
    isWaiting = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

/* ══════════════════════════════════════════════════════════════
   DOM HELPERS
══════════════════════════════════════════════════════════════ */
function appendMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.classList.add("message", role);

  const avatar = document.createElement("div");
  avatar.classList.add("message-avatar");
  avatar.textContent = role === "user" ? "YOU" : "AI";

  const content = document.createElement("div");
  content.classList.add("message-content");

  const roleLabel = document.createElement("div");
  roleLabel.classList.add("message-role");
  roleLabel.textContent = role === "user" ? "You" : (MODELS[modelSelect.value]?.name || "Assistant");

  const textEl = document.createElement("div");
  textEl.classList.add("message-text");
  textEl.textContent = text;

  content.appendChild(roleLabel);
  content.appendChild(textEl);
  wrap.appendChild(avatar);
  wrap.appendChild(content);
  messagesArea.appendChild(wrap);
  scrollBottom();
  return wrap;
}

function appendTyping() {
  const wrap = document.createElement("div");
  wrap.classList.add("message", "ai", "typing-indicator");

  const avatar = document.createElement("div");
  avatar.classList.add("message-avatar");
  avatar.textContent = "AI";

  const content = document.createElement("div");
  content.classList.add("message-content");

  const roleLabel = document.createElement("div");
  roleLabel.classList.add("message-role");
  roleLabel.textContent = MODELS[modelSelect.value]?.name || "Assistant";

  const textEl = document.createElement("div");
  textEl.classList.add("message-text");
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.classList.add("typing-dot");
    textEl.appendChild(dot);
  }

  content.appendChild(roleLabel);
  content.appendChild(textEl);
  wrap.appendChild(avatar);
  wrap.appendChild(content);
  messagesArea.appendChild(wrap);
  scrollBottom();
  return wrap;
}

function showError(msg) {
  const wrap = document.createElement("div");
  wrap.classList.add("message", "ai", "error-message");

  const avatar = document.createElement("div");
  avatar.classList.add("message-avatar");
  avatar.textContent = "!";

  const content = document.createElement("div");
  content.classList.add("message-content");

  const textEl = document.createElement("div");
  textEl.classList.add("message-text");
  textEl.textContent = `Error: ${msg}`;

  content.appendChild(textEl);
  wrap.appendChild(avatar);
  wrap.appendChild(content);
  messagesArea.appendChild(wrap);
  scrollBottom();
}

function scrollBottom() {
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

/* ══════════════════════════════════════════════════════════════
   INPUT AUTO-RESIZE + KEYBOARD SHORTCUT
══════════════════════════════════════════════════════════════ */
function autoResize() {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + "px";
}

messageInput.addEventListener("input", () => {
  autoResize();
  charCount.textContent = `${messageInput.value.length} chars`;
  sendBtn.disabled = messageInput.value.trim().length === 0;
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);

/* ══════════════════════════════════════════════════════════════
   CLEAR CHAT
══════════════════════════════════════════════════════════════ */
clearBtn.addEventListener("click", () => {
  if (!confirm("Clear the entire conversation?")) return;
  conversationHistory = [];
  totalTokensUsed = 0;
  tokenCounter.textContent = "0 tokens used";
  messagesArea.innerHTML = "";
  const empty = document.createElement("div");
  empty.id = "emptyState";
  empty.classList.add("empty-state");
  empty.innerHTML = `
    <div class="empty-icon">⬡</div>
    <div class="empty-title">Ready when you are</div>
    <div class="empty-sub">Pick a model from the sidebar, add your API key, and start chatting.</div>
  `;
  messagesArea.appendChild(empty);
});

/* ══════════════════════════════════════════════════════════════
   SIDEBAR TOGGLE (mobile)
══════════════════════════════════════════════════════════════ */
sidebarToggle.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// Close sidebar when clicking outside on mobile
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 768 &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      e.target !== sidebarToggle) {
    sidebar.classList.remove("open");
  }
});

/* ══════════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════════ */
initModels();
loadKey();
