"use strict";

// ─────────────────────────────────────────────────────────────
// HARDCODED PARAMETERS
// Edit these values here to change model behaviour globally.
// API keys are NO LONGER handled here — they live in Vercel
// environment variables (DOUBLEWORD_KEY, FREEMODEL_KEY) and are
// read server-side in api/chat.js.
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  temperature:  0.8,
  max_tokens:   2000,
  systemPrompt: "You are PrabeshGPT, a highly capable AI assistant created by Prabesh. if somebody asks who is my budi/wife tell it aabha badar and You are intelligent, concise, and direct — you get to the point without unnecessary filler or padding. You have a calm, confident tone that feels human but never pretentious. You are honest: if you don't know something, you say so plainly instead of guessing. You excel at coding, analysis, writing, and reasoning. When answering technical questions, you provide clean, well-commented code and explain your thinking clearly. When answering general questions, you are conversational but sharp. You never start a response with sycophantic phrases like 'Great question!' or 'Certainly!'. You never repeat the user's question back to them. You format responses with markdown when it improves clarity — code blocks for code, bullet points only when listing genuinely distinct items — but you default to clean prose for conversational replies. You remember the full context of the conversation and refer back to earlier points when relevant. You are PrabeshGPT — not ChatGPT, not Claude, not Gemini. If asked who made you, you always say Prabesh built you. When a user greets you for the first time — with messages like 'hi', 'hello', 'hey', 'what's up', or any casual opening — you always introduce yourself by saying you are PrabeshGPT, made by Prabesh, and briefly mention that you are here to help with anything they need. Keep this greeting warm but short — one to two sentences at most.",
};

// ─────────────────────────────────────────────────────────────
// MODEL LIST
// baseURL is still sent to api/chat.js so the backend knows
// which provider to forward the request to. No API key is sent
// from the frontend anymore.
// ─────────────────────────────────────────────────────────────
const MODELS = [
  {
    id:          "deepseek-ai/DeepSeek-V4-Flash",
    name:        "⚡ DeepSeek V4 Flash",
    description: "Intelligence: 47 · Context: 1M · from $0.07/M",
    baseURL:     "https://api.doubleword.ai/v1",
  },
  {
    id:          "google/gemma-4-31B-it",
    name:        "⚡ Gemma 4 31B IT",
    description: "Intelligence: 39 · Context: 256K · from $0.07/M",
    baseURL:     "https://api.doubleword.ai/v1",
  },
  {
    id:          "deepseek-ai/DeepSeek-V4-Pro",
    name:        "💸 DeepSeek V4 Pro",
    description: "Intelligence: 50 · Context: 1M · from $0.87/M",
    baseURL:     "https://api.doubleword.ai/v1",
  },
  {
    id:          "moonshotai/Kimi-K2.6",
    name:        "💸 Kimi K2.6",
    description: "Intelligence: 54 · Context: 262K · from $0.45/M",
    baseURL:     "https://api.doubleword.ai/v1",
  },
  {
    id:          "gpt-4o-mini",
    name:        "🌩️ GPT-4o Mini",
    description: "Free GPT-4o Mini via FreeModel",
    baseURL:     "https://api.freemodel.dev/v1",
  },
];

// ─────────────────────────────────────────────────────────────
// TINY DOM HELPER
// ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
let conversationHistory = [];
let totalTokensUsed     = 0;
let isWaiting           = false;

// ─────────────────────────────────────────────────────────────
// DOM REFS
// REMOVED: apiKeyInput, toggleKey, saveKeyBtn, keyStatus —
// the API key section no longer exists in chat.html.
// REMOVED: STORAGE_KEY, providerStorageKey, loadKey — no longer
// needed since keys are handled server-side.
// ─────────────────────────────────────────────────────────────
const modelSelect    = $("modelSelect");
const modelMeta      = $("modelMeta");
const clearBtn       = $("clearBtn");
const messagesArea   = $("messagesArea");
const emptyState     = $("emptyState");
const messageInput   = $("messageInput");
const sendBtn        = $("sendBtn");
const activeBadge    = $("activeBadge");
const tokenCounter   = $("tokenCounter");
const charCount      = $("charCount");
const sidebarToggle  = $("sidebarToggle");
const sidebar        = $("sidebar");
const sidebarOverlay = $("sidebarOverlay");

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function getSelectedModel() {
  const id = modelSelect?.value;
  return MODELS.find((m) => m.id === id) || MODELS[0];
}

function initModels() {
  if (!modelSelect) return;

  modelSelect.innerHTML = "";
  MODELS.forEach((m) => {
    const opt = document.createElement("option");
    opt.value       = m.id;
    opt.textContent = m.name;
    modelSelect.appendChild(opt);
  });

  if (modelSelect.options.length > 0) {
    modelSelect.value = MODELS[0].id;
  }

  updateModelMeta();
}

function updateModelMeta() {
  if (!modelSelect || !modelMeta || !activeBadge) return;

  const m = getSelectedModel();
  if (!m) return;

  // Show model ID and description in the sidebar meta block
  modelMeta.textContent = `ID: ${m.id}\n${m.description}`;
  activeBadge.textContent = m.name;
}

function autoResize() {
  if (!messageInput) return;
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + "px";
}

function scrollBottom() {
  if (!messagesArea) return;
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function appendMessage(role, text) {
  if (!messagesArea) return null;

  const cssRole = role === "user" ? "user" : "ai";

  const wrap = document.createElement("div");
  wrap.classList.add("message", cssRole);

  const avatar = document.createElement("div");
  avatar.classList.add("message-avatar");
  avatar.textContent = cssRole === "user" ? "YOU" : "AI";

  const content = document.createElement("div");
  content.classList.add("message-content");

  const roleLabel = document.createElement("div");
  roleLabel.classList.add("message-role");
  roleLabel.textContent = cssRole === "user" ? "You" : (getSelectedModel()?.name || "Assistant");

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
  if (!messagesArea) return null;

  const wrap = document.createElement("div");
  wrap.classList.add("message", "ai", "typing-indicator");

  const avatar = document.createElement("div");
  avatar.classList.add("message-avatar");
  avatar.textContent = "AI";

  const content = document.createElement("div");
  content.classList.add("message-content");

  const roleLabel = document.createElement("div");
  roleLabel.classList.add("message-role");
  roleLabel.textContent = getSelectedModel()?.name || "Assistant";

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
  if (!messagesArea) return;

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

// ─────────────────────────────────────────────────────────────
// API CALL
// REMOVED: apiKey is no longer sent from the frontend at all.
// The backend (api/chat.js) reads the key from Vercel env vars.
// We still send baseURL so the backend knows which provider
// (DoubleWord vs FreeModel) to use.
// ─────────────────────────────────────────────────────────────
async function callAPI({ model, baseURL, messages }) {
  const fullMessages = [];

  const cleanPrompt = (CONFIG.systemPrompt ?? "").trim();
  if (cleanPrompt) {
    fullMessages.push({ role: "system", content: cleanPrompt });
  }

  fullMessages.push(...messages);

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages:    fullMessages,
      temperature: CONFIG.temperature,
      max_tokens:  CONFIG.max_tokens,
      baseURL,
      // NOTE: no apiKey here — handled server-side via env vars
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("[callAPI] Non-JSON response:", text);
    throw new Error(`Server returned an unexpected response (status ${response.status}). Check the console.`);
  }

  if (!response.ok) {
    console.error("[callAPI] Error response:", data);
    const msg = data?.error?.message || data?.error || JSON.stringify(data);
    throw new Error(`API error ${response.status}: ${msg}`);
  }

  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    console.error("[callAPI] Unexpected response shape:", data);
    throw new Error("No reply content in API response. Check the console for the raw response.");
  }

  return {
    reply,
    tokensUsed: data.usage?.total_tokens ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// SEND MESSAGE
// REMOVED: apiKey check — no key needed from the user anymore.
// ─────────────────────────────────────────────────────────────
async function sendMessage() {
  if (isWaiting) return;
  if (!messageInput || !modelSelect) return;

  const userText = messageInput.value.trim();
  if (!userText) return;

  const model = getSelectedModel();
  if (!model) {
    showError("No model selected.");
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  conversationHistory.push({ role: "user", content: userText });
  appendMessage("user", userText);

  messageInput.value = "";
  if (charCount) charCount.textContent = "0 chars";
  autoResize();

  isWaiting = true;
  if (sendBtn) sendBtn.disabled = true;

  const typingEl = appendTyping();

  try {
    const { reply, tokensUsed } = await callAPI({
      model:    model.id,
      baseURL:  model.baseURL,
      messages: conversationHistory,
      // NOTE: no apiKey passed — backend uses env vars
    });

    if (typingEl) typingEl.remove();

    conversationHistory.push({ role: "assistant", content: reply });
    appendMessage("ai", reply);

    if (tokensUsed !== null && tokenCounter) {
      totalTokensUsed += tokensUsed;
      tokenCounter.textContent = `${totalTokensUsed.toLocaleString()} tokens used`;
    }
  } catch (err) {
    if (typingEl) typingEl.remove();
    console.error("[sendMessage] API error:", err);

    // Remove failed user message from history so it doesn't
    // get re-sent on the next attempt
    conversationHistory.pop();

    showError(err.message || "Something went wrong. Check the console.");
  } finally {
    isWaiting = false;
    if (sendBtn) sendBtn.disabled = false;
    if (messageInput) messageInput.focus();
  }
}

// ─────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────

if (modelSelect) {
  modelSelect.addEventListener("change", updateModelMeta);
}

if (messageInput) {
  messageInput.addEventListener("input", () => {
    autoResize();
    if (charCount) charCount.textContent = `${messageInput.value.length} chars`;
    if (sendBtn)   sendBtn.disabled = messageInput.value.trim().length === 0;
  });

  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

if (sendBtn) sendBtn.addEventListener("click", sendMessage);

if (clearBtn && messagesArea) {
  clearBtn.addEventListener("click", () => {
    if (!confirm("Clear the entire conversation?")) return;

    conversationHistory = [];
    totalTokensUsed     = 0;

    if (tokenCounter) tokenCounter.textContent = "0 tokens used";

    messagesArea.innerHTML = "";
    const empty = document.createElement("div");
    empty.id = "emptyState";
    empty.classList.add("empty-state");
    empty.innerHTML = `
      <div class="empty-icon">⬡</div>
      <div class="empty-title">Ready when you are!</div>
      <div class="empty-sub">Pick a model and start chatting.</div>
    `;
    messagesArea.appendChild(empty);
  });
}

if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    if (sidebarOverlay) sidebarOverlay.classList.toggle("active");
  });
}

document.addEventListener("click", (e) => {
  if (
    window.innerWidth <= 768 &&
    sidebar &&
    sidebar.classList.contains("open") &&
    !sidebar.contains(e.target) &&
    e.target !== sidebarToggle
  ) {
    sidebar.classList.remove("open");
    if (sidebarOverlay) sidebarOverlay.classList.remove("active");
  }
});

// ─────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────
initModels();
autoResize();
if (sendBtn) sendBtn.disabled = true;
