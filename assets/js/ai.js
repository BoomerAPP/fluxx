/* ============================================
   AI — Multi-Provider (Groq + OpenRouter) + Image Gen + Whisper
   ============================================ */

import {
  OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL,
  OPENROUTER_REFERER,
  OPENROUTER_TITLE,
  GROQ_API_KEY,
  GROQ_BASE_URL,
  AI_MODELS,
  DEFAULT_AI_MODEL,
  AI_CONFIG
} from "./config.js";

// ========== STATE ==========
let currentModel = localStorage.getItem("flux_ai_model") || DEFAULT_AI_MODEL;
let currentPersona = localStorage.getItem("flux_ai_persona") || "assistant";
let chatHistory = [];

// ========== PERSONAS ==========
const PERSONAS = {
  assistant: "Kamu adalah FluxAI, asisten AI yang cerdas, ramah, dan membantu. Jawab dengan jelas, ringkas, dan to the point. Pakai bahasa yang sama dengan user.",
  friend: "Kamu adalah FluxAI, teman ngobrol yang santai dan akrab. Pakai bahasa gaul Indonesia, ramah, kadang bercanda. Tetap helpful dan jujur.",
  dosen: "Kamu adalah FluxAI dalam mode dosen. Jelaskan dengan detail, terstruktur, edukatif, dan pakai contoh. Bahasa Indonesia formal.",
  motivator: "Kamu adalah FluxAI dalam mode motivator. Semangat, inspiring, dorong user buat maju. Bahasa Indonesia hangat dan positif."
};

// ========== HELPER ==========
function getModelInfo(modelId) {
  return AI_MODELS.find(m => m.id === modelId) || null;
}

function updateHeaderStatus() {
  const statusEl = document.getElementById("chat-status");
  if (!statusEl) return;
  const info = getModelInfo(currentModel);
  const shortName = info ? info.name : currentModel;
  statusEl.innerHTML = '<span class="ai-dot"></span> ' + shortName + ' · Online';
}

function autoSwitchModel(reason) {
  const freeModels = AI_MODELS.filter(m => m.badge === "FREE" && m.id !== currentModel);
  if (freeModels.length === 0) return null;
  const groqFallback = freeModels.find(m => m.provider === "groq");
  const fallback = groqFallback || freeModels[0];
  currentModel = fallback.id;
  localStorage.setItem("flux_ai_model", fallback.id);
  chatHistory = [];
  console.log("[AI] Auto-switch:", fallback.id, "|", reason);
  updateHeaderStatus();
  return fallback;
}

function needsFallback(errMsg) {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes("insufficient credit") ||
    lower.includes("never purchased") ||
    lower.includes("not available for free") ||
    lower.includes("no endpoints found") ||
    lower.includes("model not found") ||
    lower.includes("does not exist") ||
    lower.includes("not a valid model") ||
    lower.includes("no allowed providers") ||
    lower.includes("not available")
  );
}

function buildRequest(modelId) {
  const info = getModelInfo(modelId);
  const provider = info?.provider || "openrouter";
  const systemPrompt = PERSONAS[currentPersona] || PERSONAS.assistant;
  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-(AI_CONFIG.contextTurns * 2))
  ];

  if (provider === "groq") {
    return {
      url: GROQ_BASE_URL + "/chat/completions",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GROQ_API_KEY
      },
      body: {
        model: modelId,
        messages,
        stream: AI_CONFIG.streamEnabled,
        temperature: AI_CONFIG.temperature,
        max_tokens: AI_CONFIG.maxTokens
      },
      provider: "groq"
    };
  }
  return {
    url: OPENROUTER_BASE_URL + "/chat/completions",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + OPENROUTER_API_KEY,
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": OPENROUTER_TITLE
    },
    body: {
      model: modelId,
      messages,
      stream: AI_CONFIG.streamEnabled,
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens
    },
    provider: "openrouter"
  };
}

// ========== EXPORT: PERSONA ==========
export function setAIPersona(persona) {
  if (!PERSONAS[persona]) persona = "assistant";
  currentPersona = persona;
  localStorage.setItem("flux_ai_persona", persona);
  chatHistory = [];
}

export function getCurrentPersona() {
  return currentPersona;
}

// ========== EXPORT: MODEL ==========
export function setAIModel(modelId) {
  const valid = getModelInfo(modelId);
  if (!valid) return false;
  currentModel = modelId;
  localStorage.setItem("flux_ai_model", modelId);
  chatHistory = [];
  updateHeaderStatus();
  return true;
}

export function getCurrentModel() { return currentModel; }
export function getCurrentModelInfo() { return getModelInfo(currentModel) || AI_MODELS[0]; }
export function getAvailableModels() { return AI_MODELS; }

// ========== EXPORT: RESET ==========
export function resetAIChat() { chatHistory = []; }

// ========== CORE: SEND TO AI ==========
export async function sendToAI(text, onChunk, imageBase64 = null) {
  const modelInfo = getModelInfo(currentModel);
  if (!modelInfo) {
    const fallback = autoSwitchModel("model gak whitelist");
    if (!fallback) throw new Error("Model default gak ada di list.");
    throw new Error("Model di-reset ke " + fallback.name + ". Coba kirim ulang.");
  }

  if (imageBase64 && !modelInfo.multimodal) {
    throw new Error('⚠️ Model "' + modelInfo.name + '" gak support baca gambar.\nGanti ke Gemini Flash 1.5 dari menu ⋮ → Ganti Model AI.');
  }

  const provider = modelInfo.provider || "openrouter";
  if (provider === "groq" && (!GROQ_API_KEY || GROQ_API_KEY.includes("ISI_API_KEY"))) {
    throw new Error("🔑 API key Groq belum di-set di config.js.");
  }
  if (provider === "openrouter" && (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes("ISI_API_KEY"))) {
    throw new Error("🔑 API key OpenRouter belum di-set di config.js.\nModel ini butuh OpenRouter. Ganti ke model Groq dari menu ⋮.");
  }

  const req = buildRequest(currentModel);
  if (imageBase64) {
    req.body.messages.push({
      role: "user",
      content: [
        { type: "text", text },
        { type: "image_url", image_url: { url: imageBase64 } }
      ]
    });
  } else {
    req.body.messages.push({ role: "user", content: text });
  }

  let response;
  try {
    response = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body)
    });
  } catch (netErr) {
    throw new Error("📡 Koneksi gagal. Cek internet lo. (" + netErr.message + ")");
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let errMsg = "Error " + response.status;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error?.message || errJson.message || errMsg;
    } catch (e) {
      errMsg += " — " + errText.slice(0, 200);
    }

    if (needsFallback(errMsg)) {
      const fallback = autoSwitchModel(errMsg.slice(0, 80));
      if (fallback) {
        throw new Error("⚠️ Model '" + modelInfo.name + "' gak bisa dipakai.\nAuto-switch ke: " + fallback.name + ".\nCoba kirim ulang.");
      }
    }

    if (response.status === 401) throw new Error("🔑 API key salah atau expired.");
    if (response.status === 402) throw new Error("💰 Akun gak punya credits.");
    if (response.status === 429) throw new Error("⏱️ Rate limit kena. Tunggu bentar.");
    if (response.status === 404) throw new Error("🔍 Model gak ketemu.");
    if (response.status >= 500) throw new Error("🔧 Server error. Coba lagi.");
    throw new Error(errMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          if (onChunk) onChunk(delta, fullText);
        }
      } catch (e) {}
    }
  }

  if (!fullText) throw new Error("⚠️ Model gak ngasih respon.");

  chatHistory.push({ role: "user", content: text });
  chatHistory.push({ role: "assistant", content: fullText });
  if (chatHistory.length > AI_CONFIG.contextTurns * 2) {
    chatHistory = chatHistory.slice(-(AI_CONFIG.contextTurns * 2));
  }

  return fullText;
}

// ========== IMAGE GENERATION (Pollinations AI — GRATIS) ==========
export async function generateImage(prompt) {
  if (!prompt || !prompt.trim()) throw new Error("Prompt gambar kosong");

  const cleanPrompt = prompt.trim().slice(0, 500);
  const enhanced = cleanPrompt + ", high quality, detailed, 4k";
  const encoded = encodeURIComponent(enhanced);
  const seed = Math.floor(Math.random() * 999999);
  const url = "https://image.pollinations.ai/prompt/" + encoded +
    "?width=1024&height=1024&nologo=true&enhance=true&seed=" + seed;

  try {
    await fetch(url, { method: "HEAD", mode: "no-cors" });
    console.log("[AI] Image gen OK, seed:", seed);
  } catch (e) {
    console.warn("[AI] HEAD check gagal, tetep lanjut:", e.message);
  }

  return { url, prompt: cleanPrompt, seed, enhanced };
}

export function isImageRequest(text) {
  const lower = text.toLowerCase().trim();
  const triggers = [
    "/img", "/image", "/gambar", "/pic", "/photo",
    "buatkan gambar", "buat gambar", "bikin gambar", "bikinin gambar",
    "buatkan saya gambar", "bisa buatkan gambar", "bisa bikin gambar",
    "generate gambar", "generate image", "generate photo",
    "create image", "create picture",
    "lukis", "gambarkan", "gambarin"
  ];
  return triggers.some(t => lower.startsWith(t) || lower.includes(t));
}

export function extractImagePrompt(text) {
  const lower = text.toLowerCase();
  const triggers = [
    "/img", "/image", "/gambar", "/pic", "/photo",
    "buatkan gambar", "buat gambar", "bikin gambar", "bikinin gambar",
    "buatkan saya gambar", "bisa buatkan gambar", "bisa bikin gambar",
    "generate gambar", "generate image", "generate photo",
    "create image", "create picture",
    "lukis", "gambarkan", "gambarin"
  ];
  const sorted = [...triggers].sort((a, b) => b.length - a.length);
  let cleaned = text;
  for (const t of sorted) {
    const idx = lower.indexOf(t);
    if (idx >= 0) {
      cleaned = text.slice(idx + t.length).trim();
      cleaned = cleaned.replace(/^[:,\-–—\s]+/, "").trim();
      if (cleaned) return cleaned;
    }
  }
  return text.trim();
}

// ========== SPEECH-TO-TEXT (Groq Whisper — GRATIS) ==========
export async function transcribeAudio(audioBase64) {
  if (!audioBase64) throw new Error("Audio kosong");
  if (!GROQ_API_KEY || GROQ_API_KEY.includes("ISI_API_KEY")) {
    throw new Error("Groq API key belum di-set");
  }

  const match = audioBase64.match(/^data:(audio\/[\w-]+);base64,(.+)$/);
  if (!match) throw new Error("Format audio tidak valid");
  const mimeType = match[1];
  const base64Data = match[2];

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });

  const formData = new FormData();
  formData.append("file", blob, "voice.webm");
  formData.append("model", "whisper-large-v3");
  formData.append("language", "id");
  formData.append("response_format", "json");

  const res = await fetch(GROQ_BASE_URL + "/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + GROQ_API_KEY },
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let errMsg = "Whisper error " + res.status;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error?.message || errMsg;
    } catch (e) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  return (data.text || "").trim();
}

// ========== TTS (WA/WA-like — voice Indonesia natural) ==========
export function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  // Bersihin markdown biar enak didenger
  const cleanText = String(text || "")
    .replace(/```[\s\S]*?```/g, " kode ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/[#_>~`]/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " link ")
    .trim();

  const u = new SpeechSynthesisUtterance(cleanText);
  u.lang = "id-ID";
  u.rate = 1.05;
  u.pitch = 1.0;
  u.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const idVoice = voices.find(v => v.lang === "id-ID") ||
    voices.find(v => v.lang.startsWith("id"));
  if (idVoice) u.voice = idVoice;

  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

// ========== HEALTH CHECK ==========
export async function testConnection() {
  const modelInfo = getModelInfo(currentModel);
  const provider = modelInfo?.provider || "openrouter";
  const req = buildRequest(currentModel);
  req.body.messages = [{ role: "user", content: "hi" }];
  req.body.max_tokens = 5;
  try {
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body)
    });
    if (res.ok) return { ok: true, provider, model: currentModel };
    const err = await res.json().catch(() => ({}));
    return { ok: false, provider, model: currentModel, error: err.error?.message || ("HTTP " + res.status) };
  } catch (e) {
    return { ok: false, provider, model: currentModel, error: e.message };
  }
}

console.log("✅ ai.js v5 loaded (fixed). Model:", currentModel);