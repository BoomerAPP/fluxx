/* ============================================
   CONFIG — Firebase + AI (OpenRouter + Groq)
   ============================================ */

// ========== FIREBASE ==========
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAFY9ZCxASmq-ZVnU84i7d5ouTn7tNSBZA",
  authDomain: "fluxxgram.firebaseapp.com",
  projectId: "fluxxgram",
  storageBucket: "fluxxgram.appspot.com",
  messagingSenderId: "92191375041",
  appId: "1:92191375041:web:284d4100a9ee18ba5b5e40"
};

// ========== OPENROUTER ==========
export const OPENROUTER_API_KEY = "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";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_REFERER = "https://fluxchat.app";
export const OPENROUTER_TITLE = "FluxChat";

// ========== GROQ ==========
export const GROQ_API_KEY = "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";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// ========== DAFTAR MODEL ==========
export const AI_MODELS = [
  // ===== GROQ (dari list model di akun lo) =====
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    desc: "OpenAI open model (Groq FREE)",
    badge: "FREE",
    provider: "groq",
    multimodal: false
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B",
    desc: "Ringan & cepet (Groq FREE)",
    badge: "FREE",
    provider: "groq",
    multimodal: false
  },
  {
    id: "qwen/qwen3.8-27b",
    name: "Qwen 3.8 27B",
    desc: "Multibahasa bagus (Groq FREE)",
    badge: "FREE",
    provider: "groq",
    multimodal: false
  },
  {
    id: "allam-2-7b",
    name: "ALLaM 2 7B",
    desc: "Arabic-focused (Groq FREE)",
    badge: "FREE",
    provider: "groq",
    multimodal: false
  },
  
  // ===== OPENROUTER (butuh API key OR, buat multimodal) =====
  {
    id: "google/gemini-flash-1.5:free",
    name: "Gemini Flash 1.5",
    desc: "Bisa baca gambar (OR free)",
    badge: "FREE",
    provider: "openrouter",
    multimodal: true
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o mini",
    desc: "Kualitas top (bayar)",
    badge: "PRO",
    provider: "openrouter",
    multimodal: true
  }
];

// Default model — pakai Groq yang beneran ada di akun lo
export const DEFAULT_AI_MODEL = "openai/gpt-oss-120b";

// Legacy alias biar app.js lama gak break
export const GEMINI_MODEL = DEFAULT_AI_MODEL;

// Konfigurasi generation
export const AI_CONFIG = {
  temperature: 0.7,
  maxTokens: 2048,
  contextTurns: 10,
  streamEnabled: true
};