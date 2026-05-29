"use strict";

// ─────────────────────────────────────────────────────────────
// HARDCODED PARAMETERS  (FIX: removed temperature, max_tokens,
// and system prompt from the UI — all controlled here instead)
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  temperature:  0.7,
  max_tokens:   1024,
  systemPrompt: "", // Set a system prompt here if you want one, e.g. "You are a helpful assistant."
};

// ─────────────────────────────────────────────────────────────
// MODEL LIST
// baseURL tells chat.js which provider to forward the request to.
// ─────────────────────────────────────────────────────────────
const MODELS = [
  {
    id:         "deepseek-ai/DeepSeek-V4-Flash",
    name:       "⚡ DeepSeek V4 Flash",
    description:"Intelligence: 47 · Context: 1M · from $0.07/M",
    apiKeyHint: "Uses your DoubleWord API key",
    baseURL:    "https://api.doubleword.ai/v1",
  },
  {
    id:         "google/gemma-4-31B-it",
    name:       "⚡ Gemma 4 31B IT",
    description:"Intelligence: 39 · Context: 256K · from $0.07/M",
    apiKeyHint: "Uses your DoubleWord API key",
    baseURL:    "https://api.doubleword.ai/v1",
  },
  {
    id:         "deepseek-ai/DeepSeek-V4-Pro",
    name:       "💸 DeepSeek V4 Pro",
    description:"Intelligence: 50 · Context: 1M · from $0.87/M",
    apiKeyHint: "Uses your DoubleWord API key",
    baseURL:    "https://api.doubleword.ai/v1",
  },
  {
    id:         "moonshotai/Kimi-K2.6",
    name:       "💸 Kimi K2.6",
    description:"Intelligence: 54 · Context: 262K · from $0.45/M",
    apiKeyHint: "Uses your DoubleWord API key",
    baseURL:    "https://api.doubleword.ai/v1",
  },
  {
    id:         "gpt-4o-mini",
    name:       "🌩️ GPT-4o Mini",
    description:"Free GPT-4o Mini via FreeModel",
    apiKeyHint: "Uses your FreeModel API key",
    baseURL:    "https://api.freemodel.dev/v1",
  },
];

// ─────────────────────────────────────────────────────────────
// STORAGE KEYS
// FIX: separate localStorage keys per provider so a DoubleWord
// key and a FreeModel key don't overwrite each other.
// ─────────────────────────────────────────────────────────────
const STORAGE_KEY = {
  doubleword: "dw_api_key",
  freemodel:  "fm_api_key",
};

function providerStorageKey(model) {
  // FIX: pick the right storage key based on which provider the
  // selected model uses.
  return model.baseURL.includes("freemodel") ? STORAGE_KEY.freemodel : STORAGE_KEY.doubleword;
}

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
// FIX: removed refs to tempSlider, tempVal, maxTokens,
// systemPrompt — those inputs no longer exist in chat.html.
// ─────────────────────────────────────────────────────────────
const modelSelect   = $("modelSelect");
const modelMeta     = $("modelMeta");
const apiKeyInput   = $("apiKeyInput");
const toggleKey     = $("toggleKey");
const saveKeyBtn    = $("saveKeyBtn");
const keyStatus     = $("keyStatus");
const clearBtn      = $("clearBtn");
const messagesArea  = $("messagesArea");
const emptyState    = $("emptyState");
const messageInput  = $("messageInput");
const sendBtn       = $("sendBtn");
const activeBadge   = $("activeBadge");
const tokenCounter  = $("tokenCounter");
const charCount     = $("charCount");
const sidebarToggle = $("sidebarToggle");
const sidebar       = $("sidebar");
const sidebarOverlay = $("sidebarOverlay");

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

// FIX: use model.id as the <option> value instead of the array
// index, so reordering MODELS never silently selects the wrong
// model.
function getSelectedModel() {
  const id = modelSelect?.value;
  return MODELS.find((m) => m.id === id) || MODELS[0];
}

function initModels() {
  if (!modelSelect) return;

  modelSelect.innerHTML = "";
  MODELS.forEach((m) => {
    const opt = document.createElement("option");
    // FIX: store m.id as the value, not the array index
    opt.value       = m.id;
    opt.textContent = m.name;
    modelSelect.appendChild(opt);
  });

  // Select the first model by default
  if (modelSelect.options.length > 0) {
    modelSelect.value = MODELS[0].id;
  }

  updateModelMeta();
}

function updateModelMeta() {
  if (!modelSelect || !modelMeta || !activeBadge) return;

  const m = getSelectedModel();
  if (!m) return;

  modelMeta.textContent = `ID: ${m.id}${m.apiKeyHint ? "\n" + m.apiKeyHint : ""}`;
  activeBadge.textContent = m.name;

  // FIX: when the model changes, reload the correct API key for
  // that provider from localStorage so the input always shows
  // the right key.
  loadKey();
}

function loadKey() {
  if (!apiKeyInput || !keyStatus) return;

  const model = getSelectedModel();
  const saved = localStorage.getItem(providerStorageKey(model));

  if (saved) {
    apiKeyInput.value       = saved;
    keyStatus.textContent   = "✓ Key loaded from storage";
    keyStatus.className     = "key-status ok";
  } else {
    // FIX: clear the input when switching to a model whose
    // provider has no saved key, so the user doesn't
    // accidentally send the wrong provider's key.
    apiKeyInput.value     = "";
    keyStatus.textContent = "";
    keyStatus.className   = "key-status";
  }
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

  // FIX: use "ai" as the CSS class for assistant messages
  // consistently throughout (matches style.css .message.ai rule)
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
// FIX: temperature, max_tokens, and systemPrompt now come from
// the hardcoded CONFIG object at the top of this file, not from
// UI inputs that no longer exist.
//
// FIX: the raw API response is now logged to the console
// whenever there is an error, so "Check console" in the error
// message is actually true.
// ─────────────────────────────────────────────────────────────
async function callAPI({ model, baseURL, messages, apiKey }) {
  const fullMessages = [];

  // FIX: pull systemPrompt from CONFIG, not from a DOM element
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
      messages: fullMessages,
      // FIX: pull temperature and max_tokens from CONFIG
      temperature: CONFIG.temperature,
      max_tokens:  CONFIG.max_tokens,
      apiKey,
      baseURL,
    }),
  });

  // FIX: always try to parse the body before deciding what to do
  // so we can log it and surface a meaningful error message.
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // The server returned non-JSON (e.g. Vercel 404 HTML page)
    console.error("[callAPI] Non-JSON response:", text);
    throw new Error(`Server returned an unexpected response (status ${response.status}). Check the console.`);
  }

  if (!response.ok) {
    // FIX: log the raw error body so "Check console" is meaningful
    console.error("[callAPI] Error response:", data);
    const msg = data?.error?.message || data?.error || JSON.stringify(data);
    throw new Error(`API error ${response.status}: ${msg}`);
  }

  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    // FIX: log raw response so developer can inspect it
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
// FIX: removed failed-message leak from conversationHistory.
// If the API call throws, the user message is removed from
// history so it won't be re-sent on the next attempt.
// ─────────────────────────────────────────────────────────────
async function sendMessage() {
  if (isWaiting) return;
  if (!messageInput || !apiKeyInput || !modelSelect) return;

  const userText = messageInput.value.trim();
  if (!userText) return;

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showError("No API key set. Add your API key in the sidebar.");
    return;
  }

  const model = getSelectedModel();
  if (!model) {
    showError("No model selected.");
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  // Push user message to history
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
      model:   model.id,
      baseURL: model.baseURL,
      messages: conversationHistory,
      apiKey,
      // FIX: no longer passing temperature/maxTokens/systemPrompt
      // from UI — they come from CONFIG inside callAPI()
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

    // FIX: remove the failed user message from history so it
    // doesn't get duplicated if the user tries again.
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
  // FIX: updateModelMeta now also calls loadKey() so the correct
  // provider key is loaded whenever the model changes.
  modelSelect.addEventListener("change", updateModelMeta);
}

if (saveKeyBtn && apiKeyInput && keyStatus) {
  saveKeyBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      keyStatus.textContent = "⚠ Enter a key first";
      keyStatus.className   = "key-status err";
      return;
    }
    // FIX: save under the correct provider-specific storage key
    const model = getSelectedModel();
    localStorage.setItem(providerStorageKey(model), key);
    keyStatus.textContent = "✓ Saved to local storage";
    keyStatus.className   = "key-status ok";
  });
}

if (toggleKey && apiKeyInput) {
  toggleKey.addEventListener("click", () => {
    const isPass      = apiKeyInput.type === "password";
    apiKeyInput.type  = isPass ? "text" : "password";
    toggleKey.title   = isPass ? "Hide key" : "Show key";
  });
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

    // Rebuild the empty state
    messagesArea.innerHTML = "";
    const empty = document.createElement("div");
    empty.id = "emptyState";
    empty.classList.add("empty-state");
    empty.innerHTML = `
      <div class="empty-icon">⬡</div>
      <div class="empty-title">Ready when you are!</div>
      <div class="empty-sub">Pick a model, add your API key, and start chatting.</div>
    `;
    messagesArea.appendChild(empty);
  });
}

// Sidebar toggle (mobile) — handled in chat.html inline script,
// but keep this as a fallback for any environment that skips it.
if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    if (sidebarOverlay) sidebarOverlay.classList.toggle("active");
  });
}

// Tap-outside-to-close on mobile
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
initModels(); // populates <select> and calls loadKey() via updateModelMeta()
autoResize();
if (sendBtn) sendBtn.disabled = true;
