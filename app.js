"use strict";

const MODELS = [
  {
    id: "deepseek-ai/DeepSeek-V4-Flash",
    name: "⚡ DeepSeek V4 Flash",
    description: "Intelligence: 47 · Context: 1M · from $0.07/M",
    apiKeyHint: "Uses your DoubleWord API key",
    baseURL: "https://api.doubleword.ai/v1"
  },
  {
    id: "google/gemma-4-31B-it",
    name: "⚡ Gemma 4 31B IT",
    description: "Intelligence: 39 · Context: 256K · from $0.07/M",
    apiKeyHint: "Uses your DoubleWord API key",
    baseURL: "https://api.doubleword.ai/v1"
  },
  {
    id: "deepseek-ai/DeepSeek-V4-Pro",
    name: "💸 DeepSeek V4 Pro",
    description: "Intelligence: 50 · Context: 1M · from $0.87/M",
    apiKeyHint: "Uses your DoubleWord API key",
    baseURL: "https://api.doubleword.ai/v1"
  },
  {
    id: "moonshotai/Kimi-K2.6",
    name: "💸 Kimi K2.6",
    description: "Intelligence: 54 · Context: 262K · from $0.45/M",
    apiKeyHint: "Uses your DoubleWord API key",
    baseURL: "https://api.doubleword.ai/v1"
  },
  {
    id: "gpt-4o-mini",
    name: "🌩️ GPT-4o Mini",
    description: "Free GPT-4o Mini via FreeModel",
    apiKeyHint: "Uses your FreeModel API key",
    baseURL: "https://api.freemodel.dev/v1"
  },
];

const $ = (id) => document.getElementById(id);

let conversationHistory = [];
let totalTokensUsed = 0;
let isWaiting = false;

/* DOM REFS */
const modelSelect   = $("modelSelect");
const modelMeta     = $("modelMeta");
const apiKeyInput   = $("apiKeyInput");
const toggleKey     = $("toggleKey");
const saveKeyBtn    = $("saveKeyBtn");
const keyStatus     = $("keyStatus");
const systemPrompt  = $("systemPrompt"); // optional
const tempSlider    = $("tempSlider");   // optional
const tempVal       = $("tempVal");      // optional
const maxTokens     = $("maxTokens");    // optional
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

/* HELPERS */
function getSelectedModel() {
  const idx = Number(modelSelect?.value ?? 0);
  return MODELS[idx] || MODELS[0];
}

function initModels() {
  if (!modelSelect) return;

  modelSelect.innerHTML = "";
  MODELS.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = m.name;
    modelSelect.appendChild(opt);
  });

  if (modelSelect.options.length > 0) {
    modelSelect.value = "0";
  }

  updateModelMeta();
}

function updateModelMeta() {
  if (!modelSelect || !modelMeta || !activeBadge) return;

  const m = getSelectedModel();
  if (!m) return;

  modelMeta.textContent = `ID: ${m.id}${m.apiKeyHint ? "\n" + m.apiKeyHint : ""}`;
  activeBadge.textContent = m.name;
}

function loadKey() {
  if (!apiKeyInput || !keyStatus) return;

  const saved = localStorage.getItem("dw_api_key");
  if (saved) {
    apiKeyInput.value = saved;
    keyStatus.textContent = "✓ Key loaded from storage";
    keyStatus.className = "key-status ok";
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

  const wrap = document.createElement("div");
  wrap.classList.add("message", role);

  const avatar = document.createElement("div");
  avatar.classList.add("message-avatar");
  avatar.textContent = role === "user" ? "YOU" : "AI";

  const content = document.createElement("div");
  content.classList.add("message-content");

  const roleLabel = document.createElement("div");
  roleLabel.classList.add("message-role");
  roleLabel.textContent = role === "user" ? "You" : (getSelectedModel()?.name || "Assistant");

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

async function callDoubleWord({ model, baseURL, messages, apiKey, systemPrompt, temperature, maxTokens }) {
  const fullMessages = [];

  const cleanPrompt = (systemPrompt ?? "").trim();
  if (cleanPrompt) {
    fullMessages.push({ role: "system", content: cleanPrompt });
  }

  fullMessages.push(...messages);

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: fullMessages,
      temperature: Number.parseFloat(temperature) || 0.7,
      max_tokens: Number.parseInt(maxTokens) || 1024,
      apiKey,
      baseURL,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("No reply content in API response. Check console for raw response.");
  }

  return {
    reply,
    tokensUsed: data.usage?.total_tokens ?? null,
  };
}

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

  conversationHistory.push({ role: "user", content: userText });
  appendMessage("user", userText);

  messageInput.value = "";
  if (charCount) charCount.textContent = "0 chars";
  autoResize();

  isWaiting = true;
  if (sendBtn) sendBtn.disabled = true;

  const typingEl = appendTyping();

  try {
    const { reply, tokensUsed } = await callDoubleWord({
      model: model.id,
      baseURL: model.baseURL,
      messages: conversationHistory,
      apiKey,
      systemPrompt: systemPrompt ? systemPrompt.value : "",
      temperature: tempSlider ? tempSlider.value : 1,
      maxTokens: maxTokens ? maxTokens.value : 1024,
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
    console.error("API error:", err);
    showError(err.message || "Something went wrong. Check the console.");
  } finally {
    isWaiting = false;
    if (sendBtn) sendBtn.disabled = false;
    if (messageInput) messageInput.focus();
  }
}

/* EVENTS */
if (modelSelect) {
  modelSelect.addEventListener("change", updateModelMeta);
}

if (saveKeyBtn && apiKeyInput && keyStatus) {
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
}

if (toggleKey && apiKeyInput) {
  toggleKey.addEventListener("click", () => {
    const isPass = apiKeyInput.type === "password";
    apiKeyInput.type = isPass ? "text" : "password";
    toggleKey.title = isPass ? "Hide key" : "Show key";
  });
}

if (tempSlider && tempVal) {
  tempSlider.addEventListener("input", () => {
    tempVal.textContent = tempSlider.value;
  });
}

if (messageInput) {
  messageInput.addEventListener("input", () => {
    autoResize();
    if (charCount) charCount.textContent = `${messageInput.value.length} chars`;
    if (sendBtn) sendBtn.disabled = messageInput.value.trim().length === 0;
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
    totalTokensUsed = 0;

    if (tokenCounter) tokenCounter.textContent = "0 tokens used";

    messagesArea.innerHTML = "";
    const empty = document.createElement("div");
    empty.id = "emptyState";
    empty.classList.add("empty-state");
    empty.innerHTML = `
      <div class="empty-icon">⬡</div>
      <div class="empty-title">Ready when you are!</div>
      <div class="empty-sub">Pick a model from the sidebar, add your API key, and start chatting.</div>
    `;
    messagesArea.appendChild(empty);
  });
}

if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
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
  }
});

/* BOOT */
initModels();
loadKey();
autoResize();
if (sendBtn) sendBtn.disabled = true;
