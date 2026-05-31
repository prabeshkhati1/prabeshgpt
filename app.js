"use strict";

// ─────────────────────────────────────────────────────────────
// HARDCODED PARAMETERS
// Edit these values to change model behaviour globally.
// API keys are NOT here — they live in Vercel environment
// variables (DOUBLEWORD_KEY, FREEMODEL_KEY) read server-side.
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  temperature:  0.8,
  max_tokens:   2000,
  systemPrompt: "You are PrabeshGPT, a highly capable AI assistant created by Prabesh. If somebody asks who is my budi/wife tell them it is Aabha Badar. You are intelligent, concise, and direct — you get to the point without unnecessary filler or padding. You have a calm, confident tone that feels human but never pretentious. You are honest: if you do not know something, you say so plainly instead of guessing. You excel at coding, analysis, writing, and reasoning. When answering technical questions, you provide clean, well-commented code and explain your thinking clearly. When answering general questions, you are conversational but sharp. You never start a response with sycophantic phrases like Great question or Certainly. You never repeat the user's question back to them. You format responses with markdown when it improves clarity — code blocks for code, bullet points only when listing genuinely distinct items — but you default to clean prose for conversational replies. You remember the full context of the conversation and refer back to earlier points when relevant. You are PrabeshGPT — not ChatGPT, not Claude, not Gemini. If asked who made you, you always say Prabesh built you. When a user greets you for the first time — with messages like hi, hello, hey, or any casual opening — you always introduce yourself by saying you are PrabeshGPT made by Prabesh, and briefly mention you are here to help with anything they need. Keep this greeting warm but short — one to two sentences at most.",
};

// ─────────────────────────────────────────────────────────────
// MODEL LIST
// baseURL is sent to api/chat.js so the backend knows which
// provider to call. No API key is ever sent from the frontend.
// ─────────────────────────────────────────────────────────────
const MODELS = [
  {
    id:          "deepseek-ai/DeepSeek-V4-Flash",
    name:        "⚡ Fast",
    description: "Intelligence: 47 · Context: 1M · from $0.07/M",
    baseURL:     "https://api.doubleword.ai/v1",
  },

   {
    id:          "gpt-4o-mini",
    name:        "🧠 Balanced",
    description: "Free GPT-4o Mini via FreeModel",
    baseURL:     "https://api.freemodel.dev/v1",
  },
 
  {
    id:          "deepseek-ai/DeepSeek-V4-Pro",
    name:        "🔬 Deep",
    description: "Intelligence: 50 · Context: 1M · from $0.87/M",
    baseURL:     "https://api.doubleword.ai/v1",
  },
 

];

// ─────────────────────────────────────────────────────────────
// MARKED.JS — lightweight markdown renderer (loaded from CDN
// in chat.html). Renders ** bold **, ``` code ```, bullet lists
// etc. inside AI message bubbles.
// FIX B3: previously used textContent so markdown showed as raw
// symbols. Now we use marked.parse() + innerHTML for AI replies.
// ─────────────────────────────────────────────────────────────

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
// Note: emptyState is NOT stored as a module-level const because
// FIX B1: the clearBtn handler creates a new #emptyState element,
// making any cached ref stale. We always look it up live instead.
// ─────────────────────────────────────────────────────────────
const modelSelect    = $("modelSelect");
const modelMeta      = $("modelMeta");
const clearBtn       = $("clearBtn");
const messagesArea   = $("messagesArea");
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
    const opt       = document.createElement("option");
    opt.value       = m.id;        // use model ID, not array index
    opt.textContent = m.name;
    modelSelect.appendChild(opt);
  });

  // Set default selection to first model
  if (modelSelect.options.length > 0) {
    modelSelect.value = MODELS[0].id;
  }

  updateModelMeta();
}

function updateModelMeta() {
  if (!modelSelect || !modelMeta || !activeBadge) return;

  const m = getSelectedModel();
  if (!m) return;

  modelMeta.textContent   = `ID: ${m.id}\n${m.description}`;
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

// FIX B2: centralised helper to sync the send button's disabled
// state with the actual input content. Called after every state
// change (input event, post-reply, post-clear) so the button is
// never enabled when the textarea is empty.
function syncSendBtn() {
  if (!sendBtn || !messageInput) return;
  sendBtn.disabled = isWaiting || messageInput.value.trim().length === 0;
}

// FIX B3: render markdown for AI messages using marked.js.
// Falls back to plain text if marked is not loaded (e.g. offline).
function renderMarkdown(text) {
  if (window.marked) {
    // marked.parse returns an HTML string; we set it via innerHTML
    return window.marked.parse(text);
  }
  // Fallback: escape HTML and use plain text
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  roleLabel.textContent = cssRole === "user"
    ? "You"
    : (getSelectedModel()?.name || "Assistant");

  const textEl = document.createElement("div");
  textEl.classList.add("message-text");

  if (cssRole === "user") {
    // User messages: plain text — no markdown rendering needed
    textEl.textContent = text;
  } else {
    // FIX B3: AI messages — render markdown so bold, code blocks,
    // bullet lists etc. display properly instead of raw symbols.
    textEl.innerHTML = renderMarkdown(text);
  }

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

  // FIX B4: surface a clean, readable error string instead of
  // the raw JSON object that was sometimes shown before.
  let cleanMsg = msg;
  if (typeof msg === "object") {
    cleanMsg = msg?.message || msg?.error || JSON.stringify(msg);
  }

  const wrap = document.createElement("div");
  wrap.classList.add("message", "ai", "error-message");

  const avatar = document.createElement("div");
  avatar.classList.add("message-avatar");
  avatar.textContent = "!";

  const content = document.createElement("div");
  content.classList.add("message-content");

  const textEl = document.createElement("div");
  textEl.classList.add("message-text");
  textEl.textContent = `Error: ${cleanMsg}`;

  content.appendChild(textEl);
  wrap.appendChild(avatar);
  wrap.appendChild(content);
  messagesArea.appendChild(wrap);
  scrollBottom();
}

// ─────────────────────────────────────────────────────────────
// API CALL
// No apiKey is sent — the backend reads it from env vars.
// baseURL is sent so the backend picks the right provider key.
// ─────────────────────────────────────────────────────────────
async function callAPI({ model, baseURL, messages }) {
  const fullMessages = [];

  const cleanPrompt = (CONFIG.systemPrompt ?? "").trim();
  if (cleanPrompt) {
    fullMessages.push({ role: "system", content: cleanPrompt });
  }
  fullMessages.push(...messages);

  const response = await fetch("/api/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages:    fullMessages,
      temperature: CONFIG.temperature,
      max_tokens:  CONFIG.max_tokens,
      baseURL,
      // NOTE: no apiKey — handled server-side via Vercel env vars
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("[callAPI] Non-JSON response:", text);
    throw new Error(
      `Server returned an unexpected response (status ${response.status}). Check the console.`
    );
  }

  if (!response.ok) {
    console.error("[callAPI] Error response:", data);
    // FIX B4: extract the most meaningful error string
    const errMsg =
      data?.error?.message ||
      (typeof data?.error === "string" ? data.error : null) ||
      JSON.stringify(data);
    throw new Error(`API error ${response.status}: ${errMsg}`);
  }

  const reply = data.choices?.[0]?.message?.content;
  if (!reply) {
    console.error("[callAPI] Unexpected response shape:", data);
    throw new Error(
      "No reply content in API response. Check the console for the raw response."
    );
  }

  return {
    reply,
    tokensUsed: data.usage?.total_tokens ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// SEND MESSAGE
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

  // FIX B1: always look up emptyState live — the module-level ref
  // goes stale after clearBtn recreates the element.
  const emptyState = $("emptyState");
  if (emptyState) emptyState.style.display = "none";

  conversationHistory.push({ role: "user", content: userText });
  appendMessage("user", userText);

  messageInput.value = "";
  if (charCount) charCount.textContent = "0 chars";
  autoResize();

  isWaiting = true;
  syncSendBtn(); // FIX B2: disable send button immediately

  const typingEl = appendTyping();

  try {
    const { reply, tokensUsed } = await callAPI({
      model:    model.id,
      baseURL:  model.baseURL,
      messages: conversationHistory,
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

    // Remove the failed user message from history so it doesn't
    // get re-sent on the next attempt
    conversationHistory.pop();

    showError(err.message || "Something went wrong. Check the console.");
  } finally {
    isWaiting = false;
    syncSendBtn(); // FIX B2: re-evaluate button state based on input content
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
    syncSendBtn(); // FIX B2: use centralised helper
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

    // Rebuild the empty state inside messagesArea
    messagesArea.innerHTML = "";
    const empty = document.createElement("div");
    empty.id = "emptyState"; // FIX B1: new element gets the id so $("emptyState") finds it
    empty.classList.add("empty-state");
    empty.innerHTML = `
      <div class="empty-icon">⬡</div>
      <div class="empty-title">Ready when you are!</div>
      <div class="empty-sub">Pick a model and start chatting.</div>
    `;
    messagesArea.appendChild(empty);

    syncSendBtn(); // FIX B2: re-evaluate after clear
  });
}

// FIX B5: removed duplicate sidebarToggle listener — chat.html's
// inline DOMContentLoaded script handles the overlay toggle.
// app.js only handles the sidebar class toggle as a fallback for
// environments where the inline script might not run.
if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    if (sidebarOverlay) sidebarOverlay.classList.toggle("active");
  });
}

// Tap outside sidebar on mobile to close it
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
initModels();   // populates <select> and calls updateModelMeta()
autoResize();
syncSendBtn();  // FIX B2: start with button correctly disabled
