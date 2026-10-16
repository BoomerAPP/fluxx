/* ============================================================
   FLUXCHAT & FLUXAI — APP.JS v18
   WA-Style + Selection Mode + Auto-symmetric Friends
   ============================================================ */

import {
  saveUserProfile, getUserProfile, updateUserProfile,
  listenGlobalMessages, sendGlobalMessage,
  listenPrivateMessages, sendPrivateMessage,
  setTypingStatus, listenTypingStatus, markMessagesAsRead,
  sendCallSignal, listenCallSignal, clearCallSignal,
  findUserByNumericUidOrEmail,
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
  removeFriend, listenFriendships, searchUsers,
  getUserProfileByUid, getUsersProfiles,
  startRecording, stopRecording, cancelRecording,
  createStory, listenStories, deleteStory,
  addStoryReaction, markStoryViewed, replyToStory, getStoryViewers,
  getDMRoomId, deleteMessage, addMessageReaction, toggleMessageStar,
  updateLastSeen, setOffline, listenUserStatus, db,
  pinChat, searchMessagesInChat, forwardMessage,
  editMessage, muteChat, archiveChat,
  clearChat, markChatUnread, markAllRead, blockUser,
  removeChatFromList, repairFriendship,
  createGroup, sendGroupMessage, listenGroupMessages,
  updateGroupName, addGroupMember, removeGroupMember,
  leaveGroup, promoteGroupAdmin, demoteGroupAdmin
} from "./chat.js";

import {
  collection, query, onSnapshot, doc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, where, orderBy, limit,
  arrayUnion, arrayRemove, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { watchAuth, loginUser, registerUser, loginWithGoogle, logoutUser, loginAnon, formatAuthError, getAuthInstance } from "./auth.js";

import {
  sendToAI, resetAIChat, setAIPersona, speakText,
  getCurrentModel, getAvailableModels, setAIModel, getCurrentModelInfo,
  generateImage, isImageRequest, extractImagePrompt,
  transcribeAudio
} from "./ai.js";

import { GEMINI_MODEL, AI_MODELS, DEFAULT_AI_MODEL } from "./config.js";

window.addEventListener("error", e => console.error("[GLOBAL ERROR]", e.message, e.filename, e.lineno));
window.addEventListener("unhandledrejection", e => console.error("[PROMISE REJECT]", e.reason?.message || e.reason));

/* ============================================================
   STICKERS
   ============================================================ */
const STICKERS = {
  emoji: ["😀","😄","😁","😂","🤣","😊","😍","🥰","😎","🤩","😘","😗","😙","😚","🙂","🤗","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴","😌","😛","😜","😝","🤤","😒","😓","😔","😕","🙃","🤑","😲","☹️","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩","🤯","😬","😰","😱","🥵","🥶","😳","🤪","😵","🥴","😠","😡","🤬","😷","🤒","🤕","🤢","🤮","🤧","😇","🥳","🥺","🤠","🤡","🤥","🤫","🤭","🧐","🤓","😈","👿","💀","☠️","👻","👽","🤖"],
  gesture: ["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤝","🙏","✊","👊","🤛","🤜","💪","✍️","👏","🙌","🤲"],
  animal: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦆","🦅","🦉","🦇","🐺","🐴","🦄","🐝","🦋","🐢","🐍","🦎","🐙","🐬","🐳","🦈"],
  love: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","💌","💋","😍","🥰","😘","😻","💑","💐","🌹","🌷","🌸"],
  food: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🍒","🍑","🥭","🍍","🥝","🍅","🥑","🥦","🌽","🥕","🍞","🧀","🥚","🍳","🥓","🍗","🌭","🍔","🍟","🍕","🥪","🌮","🍣","🍱","🍜","🍩","🍪","☕","🍵"]
};

const THEMES = {
  kuning: { name: "Kuning Cokelat", color: "#FFC857" },
  ungu:   { name: "Ungu Modern",    color: "#8B5CF6" },
  pink:   { name: "Pink Rose",      color: "#EC4899" },
  hijau:  { name: "Hijau Daun",     color: "#10B981" },
  biru:   { name: "Biru Langit",    color: "#3B82F6" }
};

const WALLPAPER_PRESETS = {
  default: null,
  kuning: "linear-gradient(135deg, #FFC857, #E67E22)",
  ungu: "linear-gradient(135deg, #A78BFA, #7C3AED)",
  pink: "linear-gradient(135deg, #F472B6, #DB2777)",
  hijau: "linear-gradient(135deg, #34D399, #059669)",
  biru: "linear-gradient(135deg, #60A5FA, #2563EB)",
  gelap: "linear-gradient(135deg, #1F1B2E, #0F0A1A)"
};

const FONT_SIZES = { small: "13px", normal: "15px", large: "17px" };

/* ============================================================
   STATE
   ============================================================ */
const state = {
  user: null, profile: null,
  authMode: "login", currentTab: "chat",
  chatFilter: "all",
  selectionMode: false,
  selectedChats: new Set(),
  currentChat: null, dmWithUid: null,
  currentGroupId: null, currentGroupInfo: null,
  userGroups: [],
  globalUnsub: null, dmUnsub: null, groupUnsub: null, incomingDmUnsub: null,
  groupsUnsub: null,
  typingUnsub: null, callUnsub: null, statusUnsub: null,
  isAILoading: false,
  pendingAvatarFile: null, pendingBannerFile: null,
  pendingWallpaper: null, pendingStoryImage: null,
  lastGlobalMsgs: [], lastDmMsgs: [], lastAiMsgs: [],
  storiesList: [], storiesUnsub: null,
  currentStoryIndex: 0, storyTimer: null,
  currentStoryUid: null, currentStoryUserList: [],
  replyingTo: null, pendingAIImage: null,
  localStream: null, remoteStream: null, pc: null,
  isCalling: false, activeTargetUser: null,
  pinnedChats: [], forwardedMsg: null,
  mutedChats: [], archivedChats: [],
  globalTypingUsers: {},
  currentMention: null,
  notificationEnabled: true,
  fontSizes: "normal",
  aiPersona: localStorage.getItem("flux_ai_persona") || "assistant"
};

let frFriends = [], frRequests = [], frSentRequests = [];
let frUnsub = null, frSubTab = "friends";
let currentAudioData = null;
let typingTimer = null;
let frSearchTimer = null;
let currentReactionTarget = null;
let currentSelectedMsg = null;
let _reactionBackdrop = null;
let _pickerBackdrop = null;
let globalTypingInterval = null;

const viewedStories = new Set(JSON.parse(localStorage.getItem("flux_viewed_stories") || "[]"));
const saveViewedStories = () => localStorage.setItem("flux_viewed_stories", JSON.stringify([...viewedStories]));

/* ============================================================
   HELPERS
   ============================================================ */
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

function isRealName(n) {
  if (!n) return false;
  const s = String(n).trim();
  if (s.length < 2) return false;
  if (s === "user" || s === "User" || s === "Pengguna") return false;
  if (s.startsWith("user_")) return false;
  return true;
}

function showScreen(id) {
  $$(".screen").forEach(s => s.classList.remove("active"));
  const el = $(id);
  if (el) el.classList.add("active");
}

function updateChatBadges() {
  const chatBadge = $("badge-chat");
  if (chatBadge) {
    const unread = document.querySelectorAll(".unread-badge").length;
    chatBadge.textContent = unread > 0 ? (unread > 9 ? "9+" : unread) : "";
    chatBadge.classList.toggle("hidden", unread === 0);
  }
  const friendBadge = $("badge-friend");
  if (friendBadge) {
    friendBadge.textContent = frRequests.length > 0 ? frRequests.length : "";
    friendBadge.classList.toggle("hidden", frRequests.length === 0);
  }
}

function showToast(msg, duration = 1800) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.classList.add("hidden"), 250);
  }, duration);
}

function showInfo(title, bodyHtml, btnText = "OK", onBtn = null) {
  const titleEl = $("info-modal-title");
  const bodyEl = $("info-modal-body");
  const btn = $("info-modal-btn");
  if (!titleEl || !bodyEl || !btn) return;
  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  btn.textContent = btnText;
  btn.onclick = () => {
    $("info-modal")?.classList.add("hidden");
    if (onBtn) onBtn();
  };
  $("info-modal")?.classList.remove("hidden");
}

function formatTime(ts) {
  if (!ts) return "";
  let d;
  if (typeof ts === "object" && typeof ts.toDate === "function") d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.getHours().toString().padStart(2,"0") + ":" + d.getMinutes().toString().padStart(2,"0");
}

function formatDateLabel(ts) {
  if (!ts) return "";
  let d;
  if (typeof ts === "object" && typeof ts.toDate === "function") d = ts.toDate();
  else d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const tOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yOnly = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate()).getTime();
  if (dOnly === tOnly) return "Hari ini";
  if (dOnly === yOnly) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderTextWithMentions(text) {
  if (!text) return "";
  let html = escapeHtml(text);
  html = html.replace(/@([a-zA-Z0-9_]+)/g, '<span class="mention-tag">@$1</span>');
  return html;
}

function stableMsgId(m) {
  if (m.id) return m.id;
  const key = (m.uid || "") + "|" + (m.text || m.sticker || m.type || "");
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return "h-" + h.toString(36);
}

function getDisplayText(m) {
  if (!m) return "";
  if (m.type === "sticker" && m.sticker) return "Stiker " + m.sticker;
  if (m.type === "voice") return "🎤 Pesan suara";
  if (m.type === "location") return "📍 Lokasi";
  if (m.type === "contact") return "📇 Kontak";
  if (m.text && m.text.trim().length > 0) return m.text;
  return "Pesan";
}

function compressImage(file, maxSize = 720, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; } }
        else { if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Gagal baca gambar"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Gagal baca file"));
    reader.readAsDataURL(file);
  });
}

function haptic(ms = 8) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}

/* ============================================================
   NOTIF SOUND
   ============================================================ */
let audioCtx = null;
function playNotifSound() {
  if (!state.notificationEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.stop(audioCtx.currentTime + 0.2);
  } catch (e) { /* ignore */ }
}

/* ============================================================
   THEME
   ============================================================ */
function applyTheme(name) {
  if (!THEMES[name]) name = "hijau";
  document.body.setAttribute("data-theme", name);
  localStorage.setItem("flux_theme", name);
  const meta = $("meta-theme-color");
  if (meta) meta.setAttribute("content", THEMES[name].color);
  const sub = $("menu-theme-sub");
  if (sub) sub.textContent = THEMES[name].name;
  $$(".theme-option").forEach(o => o.classList.toggle("active", o.dataset.theme === name));
}

function isDarkMode() { return localStorage.getItem("flux_dark") === "1"; }
function applyDarkMode(enabled) {
  document.body.classList.toggle("dark", enabled);
  localStorage.setItem("flux_dark", enabled ? "1" : "0");
  const btn = $("btn-dark-toggle");
  if (btn) btn.textContent = enabled ? "☀️" : "🌙";
}

function applyFontSize(size) {
  if (!FONT_SIZES[size]) size = "normal";
  document.body.classList.remove("font-small", "font-normal", "font-large");
  document.body.classList.add("font-" + size);
  state.fontSizes = size;
  localStorage.setItem("flux_font_size", size);
}

applyTheme(localStorage.getItem("flux_theme") || "hijau");
applyDarkMode(isDarkMode());
applyFontSize(localStorage.getItem("flux_font_size") || "normal");

/* ============================================================
   SPLASH
   ============================================================ */
setTimeout(() => {
  const splash = $("splash");
  if (splash) {
    splash.style.transition = "opacity 400ms cubic-bezier(0.22, 0.61, 0.36, 1), transform 400ms";
    splash.style.opacity = "0";
    splash.style.transform = "scale(1.05)";
  }
  setTimeout(() => {
    if (state.user) showScreen("app");
    else showScreen("auth");
  }, 350);
}, 2000);

/* ============================================================
   AUTH
   ============================================================ */
$$(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    state.authMode = tab.dataset.mode;
    const btn = $("auth-submit");
    if (btn) btn.textContent = state.authMode === "login" ? "Masuk" : "Daftar";
    const nameWrap = $("field-name-wrap");
    if (nameWrap) nameWrap.style.display = state.authMode === "register" ? "flex" : "none";
  });
});

$("auth-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const nameInput = $("auth-name")?.value.trim() || "";
  const errEl = $("auth-error");
  const submitBtn = $("auth-submit");
  if (errEl) errEl.classList.add("hidden");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Memproses..."; }

  try {
    if (state.authMode === "login") {
      await loginUser(email, password);
      const user = getAuthInstance()?.currentUser;
      if (user) {
        const profile = await getUserProfile(user.uid).catch(() => null);
        if (!isRealName(profile?.displayName)) {
          setTimeout(() => showGoogleNamePrompt(user), 500);
        } else {
          showToast("Selamat datang, " + profile.displayName);
        }
      }
    } else {
      const displayName = nameInput || email.split("@")[0];
      await registerUser(email, password, displayName);
      const user = getAuthInstance()?.currentUser;
      if (user) {
        const profile = await getUserProfile(user.uid).catch(() => null);
        if (!isRealName(profile?.displayName)) {
          setTimeout(() => showGoogleNamePrompt(user), 500);
        } else {
          showToast("Selamat datang, " + profile.displayName);
        }
      }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = formatAuthError(err); errEl.classList.remove("hidden"); }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = state.authMode === "login" ? "Masuk" : "Daftar";
    }
  }
});

$("auth-google")?.addEventListener("click", async () => {
  try {
    const result = await loginWithGoogle();
    const user = result.user;
    const profile = await getUserProfile(user.uid).catch(() => null);
    if (!isRealName(profile?.displayName)) {
      setTimeout(() => showGoogleNamePrompt(user), 500);
    } else {
      showToast("Selamat datang, " + profile.displayName);
    }
  } catch (err) {
    const errEl = $("auth-error");
    if (errEl) { errEl.textContent = formatAuthError(err); errEl.classList.remove("hidden"); }
  }
});

$("auth-anon")?.addEventListener("click", async () => {
  try { await loginAnon(); }
  catch (err) {
    const errEl = $("auth-error");
    if (errEl) { errEl.textContent = formatAuthError(err); errEl.classList.remove("hidden"); }
  }
});

/* ============================================================
   PROMPT NAMA
   ============================================================ */
function showGoogleNamePrompt(user) {
  const modal = $("info-modal");
  const titleEl = $("info-modal-title");
  const bodyEl = $("info-modal-body");
  const btn = $("info-modal-btn");
  if (!modal || !titleEl || !bodyEl || !btn) return;

  titleEl.textContent = "Selamat Datang di FluxChat 👋";
  bodyEl.innerHTML =
    '<div style="text-align:center;margin-bottom:16px;">' +
      '<div style="width:80px;height:80px;border-radius:50%;background:var(--accent);color:#3B2A14;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:900;margin:0 auto;background-size:cover;background-position:center;' +
      (user.photoURL ? "background-image:url(" + user.photoURL + ");" : "") + '">' +
      (user.photoURL ? "" : (user.displayName || user.email || "U").charAt(0).toUpperCase()) +
      '</div>' +
      '<div style="margin-top:12px;font-size:14px;color:var(--muted);">' + escapeHtml(user.email || "") + '</div>' +
    '</div>' +
    '<div style="text-align:left;">' +
      '<label style="display:block;font-size:13px;font-weight:800;color:var(--muted);margin-bottom:6px;">Masukkan Nama Lu</label>' +
      '<input type="text" id="google-name-input" placeholder="Nama lengkap" value="' + escapeHtml(user.displayName || "") + '" style="width:100%;padding:14px 16px;border:2px solid var(--border);border-radius:12px;background:var(--bg-soft);color:var(--text);font-size:15px;box-sizing:border-box;" maxlength="30" />' +
      '<div style="font-size:12px;color:var(--muted);margin-top:6px;">Nama ini bakal tampil di chat & profil.</div>' +
    '</div>';

  btn.textContent = "Mulai Chat";
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener("click", async function() {
    const input = document.getElementById("google-name-input");
    const name = (input?.value || "").trim();
    if (!name || name.length < 2) { alert("Nama minimal 2 karakter"); return; }
    newBtn.disabled = true;
    newBtn.textContent = "...";
    try {
      const cleanUsername = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      await updateUserProfile(user, {
        displayName: name,
        username: cleanUsername,
        email: user.email || "",
        photoURL: user.photoURL || "",
        bio: "Halo, saya menggunakan FluxChat!"
      });
      state.profile = await getUserProfile(user.uid);
      updateProfileUI();
      modal.classList.add("hidden");
      showToast("Selamat datang, " + name + " ✅");
    } catch (e) {
      alert("Gagal simpan nama: " + e.message);
      newBtn.disabled = false;
      newBtn.textContent = "Mulai Chat";
    }
  });

  setTimeout(() => {
    const input = document.getElementById("google-name-input");
    if (input) {
      input.focus();
      input.addEventListener("keypress", function(e) {
        if (e.key === "Enter") newBtn.click();
      });
    }
  }, 100);

  modal.classList.remove("hidden");
}

/* ============================================================
   AUTH WATCHER
   ============================================================ */
watchAuth(async (user) => {
  if (user) {
    state.user = user;

    let profile = null;
    try { profile = await getUserProfile(user.uid); }
    catch (err) { console.warn("[Profile] fetch failed:", err?.message || err); }

    if (!profile || !isRealName(profile.displayName)) {
      try {
        await saveUserProfile(user);
        profile = await getUserProfile(user.uid);
      } catch (err) { console.warn("[saveUserProfile] failed:", err?.message || err); }
    }

    state.profile = profile || null;
    if (profile?.pinnedChats) state.pinnedChats = profile.pinnedChats;
    if (profile?.mutedChats) state.mutedChats = profile.mutedChats;
    if (profile?.archivedChats) state.archivedChats = (profile.archivedChats || []).filter(x => typeof x === "string" && x.length > 0);
    else state.archivedChats = [];

    try {
      updateLastSeen(user.uid);
      if (window._fluxLastSeenInterval) clearInterval(window._fluxLastSeenInterval);
      window._fluxLastSeenInterval = setInterval(() => updateLastSeen(user.uid), 30000);
      window.addEventListener("beforeunload", () => setOffline(user.uid));
      window.addEventListener("pagehide", () => setOffline(user.uid));
    } catch (err) { console.warn("[LastSeen] failed:", err); }

    if (profile && Array.isArray(profile.conversations)) {
      const seen = new Set();
      const blocked = profile.blockedUsers || [];
      for (const otherUid of profile.conversations) {
        if (seen.has(otherUid)) continue;
        seen.add(otherUid);
        if (blocked.includes(otherUid)) continue;
        try {
          const target = await getUserProfileByUid(otherUid);
          if (target) addPrivateChatToList(target, 0);
        } catch (err) { console.warn("[Conv preload]", otherUid, err?.message || err); }
      }
    }

    updateProfileUI();

    setupChatListeners();
    initIncomingChatListener();
    initGroupsListener();
    initGlobalTypingListener();
    loadWallpaper();

    showScreen("app");
    initFriends();
    initStories();
  } else {
    state.user = null; state.profile = null;
    if (state.incomingDmUnsub) { state.incomingDmUnsub(); state.incomingDmUnsub = null; }
    if (state.globalUnsub) { state.globalUnsub(); state.globalUnsub = null; }
    if (state.dmUnsub) { state.dmUnsub(); state.dmUnsub = null; }
    if (state.groupUnsub) { state.groupUnsub(); state.groupUnsub = null; }
    if (state.typingUnsub) { state.typingUnsub(); state.typingUnsub = null; }
    if (state.callUnsub) { state.callUnsub(); state.callUnsub = null; }
    if (state.statusUnsub) { state.statusUnsub(); state.statusUnsub = null; }
    if (globalTypingInterval) { clearInterval(globalTypingInterval); globalTypingInterval = null; }
    showScreen("auth");
  }
});

/* ============================================================
   PRIVATE CHAT LIST
   ============================================================ */
function addPrivateChatToList(targetUser, unreadCount = 0) {
  const list = $("private-list-tk");
  if (!list) return;

  let el = list.querySelector('[data-uid="' + targetUser.uid + '"]');
  const displayName = targetUser.displayName || targetUser.username || "User";
  const username = targetUser.username || (targetUser.email || "").split("@")[0] || "user";
  const initial = displayName.charAt(0).toUpperCase();
  const avatarStyle = targetUser.photoURL && targetUser.photoURL.length > 10 ?
    "background-image:url(" + targetUser.photoURL + ");" : "";

  const isPinned = (state.pinnedChats || []).includes(targetUser.uid);
  const isMuted = (state.mutedChats || []).includes(targetUser.uid);

  let badges = "";
  if (isPinned) badges += '<span class="mute-icon" title="Di-pin">📌</span>';
  if (isMuted) badges += '<span class="mute-icon" title="Dibisukan">🔕</span>';

  const badgeHtml = unreadCount > 0 ?
    '<div class="unread-badge">' + (unreadCount > 99 ? "99+" : unreadCount) + '</div>' :
    '<div class="tk-chat-preview">@' + username + '</div>';

  if (el) {
    const metaEl = el.querySelector(".tk-chat-meta");
    if (metaEl) metaEl.innerHTML = badgeHtml;
    const nameEl = el.querySelector(".tk-chat-name");
    if (nameEl) nameEl.innerHTML = escapeHtml(displayName) + ' <span class="tk-verified">✓</span>' + badges;
    const subEl = el.querySelector(".tk-chat-preview");
    if (subEl && unreadCount === 0) subEl.textContent = "@" + username;
    updateChatBadges();
    applyChatFilter();
    return;
  }

  const empty = list.querySelector(".tk-empty");
  if (empty) empty.remove();

  el = document.createElement("div");
  el.className = "tk-chat-item";
  el.dataset.uid = targetUser.uid;
  el.innerHTML =
    '<div class="tk-avatar" style="' + avatarStyle + '">' +
    '<span>' + (targetUser.photoURL && targetUser.photoURL.length > 10 ? "" : initial) + '</span>' +
    '</div>' +
    '<div class="tk-chat-info">' +
    '<div class="tk-chat-name">' + escapeHtml(displayName) + ' <span class="tk-verified">✓</span>' + badges + '</div>' +
    '<div class="tk-chat-preview">@' + username + '</div>' +
    '</div>' +
    '<div class="tk-chat-meta">' + badgeHtml + '</div>';

  list.appendChild(el);
  updateChatBadges();
  applyChatFilter();
}

/* ============================================================
   PROFILE UI
   ============================================================ */
function updateProfileUI() {
  if (!state.profile) return;

  const name = isRealName(state.profile.displayName) ? state.profile.displayName :
    isRealName(state.profile.username) ? state.profile.username :
    (state.profile.email || "").split("@")[0] || "Pengguna";

  const email = state.profile.email || "";
  const bio = state.profile.bio || "Belum ada bio";
  const avatar = state.profile.photoURL || state.user?.photoURL;
  const banner = state.profile.bannerURL;
  const numericUid = state.profile.numericUid || "-";
  const username = state.profile.username || (email.split("@")[0] || "user").toLowerCase();

  const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  setText("profile-name", name);
  setText("profile-username", "@" + username);
  setText("profile-bio", bio);
  setText("profile-uid", numericUid);
  setText("menu-nama-value", name);
  setText("menu-uid-value", numericUid);
  setText("menu-username-sub", "@" + username);
  setText("menu-bio-sub", bio);

  const avatarEl = $("profile-avatar");
  const letterEl = $("profile-avatar-letter");
  if (avatarEl) {
    if (avatar && avatar.length > 10) {
      avatarEl.style.setProperty("background-image", 'url("' + avatar + '")', "important");
      avatarEl.style.setProperty("background-color", "transparent", "important");
      if (letterEl) letterEl.style.display = "none";
    } else {
      avatarEl.style.removeProperty("background-image");
      avatarEl.style.removeProperty("background-color");
      if (letterEl) {
        letterEl.style.display = "block";
        letterEl.textContent = name.charAt(0).toUpperCase();
      }
    }
  }

  const bannerEl = $("profile-banner");
  if (bannerEl) {
    if (banner && banner.length > 10) {
      bannerEl.style.setProperty("background-image", 'url("' + banner + '")', "important");
    } else {
      bannerEl.style.removeProperty("background-image");
    }
  }
}

/* ============================================================
   HEADER ACTIONS
   ============================================================ */
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const action = t.dataset.action;
  if (action === "search") {
    $("chat-search-input")?.focus();
  }
});

$("btn-dark-toggle")?.addEventListener("click", () => {
  const next = !isDarkMode();
  applyDarkMode(next);
  showToast(next ? "Dark mode ON 🌙" : "Light mode ON ☀️");
});

/* ============================================================
   TAB NAV
   ============================================================ */
$$(".tk-nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    if (state.selectionMode) exitSelectionMode();
    $$(".tk-nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.currentTab = btn.dataset.tab;
    $$(".tab-content").forEach(t => t.classList.remove("active"));
    const target = $("tab-" + state.currentTab);
    if (target) target.classList.add("active");
  });
});

$$(".tk-subtab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".tk-subtab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const name = tab.dataset.subtab;
    $$(".tk-subpanel").forEach(p => p.classList.remove("active"));
    const target = document.querySelector('.tk-subpanel[data-panel="' + name + '"]');
    if (target) target.classList.add("active");
  });
});

$("item-ai")?.addEventListener("click", () => {
  if (state.selectionMode) return;
  openChatDetail("ai");
});
$("item-global")?.addEventListener("click", () => {
  if (state.selectionMode) return;
  openChatDetail("global");
});

/* ============================================================
   WA-STYLE FILTER TABS + SEARCH
   ============================================================ */
$$(".wa-filter").forEach(tab => {
  tab.addEventListener("click", () => {
    if (state.selectionMode) exitSelectionMode();
    $$(".wa-filter").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    state.chatFilter = tab.dataset.filter || "all";
    applyChatFilter();
  });
});

function applyChatFilter() {
  const filter = state.chatFilter || "all";

  document.querySelectorAll("#private-list-tk .tk-chat-item").forEach(el => {
    const uid = el.dataset.uid;
    const hasUnread = el.querySelector(".unread-badge") !== null;
    const isFav = (state.pinnedChats || []).includes(uid);
    let show = true;
    if (filter === "unread") show = hasUnread;
    else if (filter === "favorites") show = isFav;
    else if (filter === "groups") show = false;
    el.style.display = show ? "" : "none";
  });

  document.querySelectorAll("#groups-list-tk .tk-chat-item").forEach(el => {
    const gid = el.dataset.gid;
    const hasUnread = el.querySelector(".unread-badge") !== null;
    let show = true;
    if (filter === "unread") show = hasUnread;
    else if (filter === "favorites") show = (state.pinnedChats || []).includes(gid);
    else if (filter === "groups") show = true;
    el.style.display = show ? "" : "none";
  });

  const labelPrivate = document.querySelector("#private-list-tk")?.previousElementSibling;
  if (labelPrivate && labelPrivate.classList.contains("tk-section-label")) {
    labelPrivate.style.display = filter === "groups" ? "none" : "";
  }
}

$("chat-search-input")?.addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll("#private-list-tk .tk-chat-item, #groups-list-tk .tk-chat-item").forEach(el => {
    const name = (el.querySelector(".tk-chat-name")?.textContent || "").toLowerCase();
    const preview = (el.querySelector(".tk-chat-preview")?.textContent || "").toLowerCase();
    const match = !q || name.includes(q) || preview.includes(q);
    el.style.display = match ? "" : "none";
  });
});

/* ============================================================
   SELECTION MODE
   ============================================================ */
function enterSelectionMode() {
  if (state.selectionMode) return;
  state.selectionMode = true;
  state.selectedChats = new Set();

  const tb = $("selection-toolbar");
  if (tb) {
    tb.classList.remove("hidden");
    tb.style.display = "flex";
  }
  document.body.classList.add("selection-active");

  document.querySelectorAll(".tk-chat-item").forEach(el => {
    if (el.id === "item-ai" || el.id === "item-global") return;
    el.classList.add("selectable");
  });

  const countEl = $("sel-count");
  if (countEl) countEl.textContent = "0";
  haptic(10);
}

function exitSelectionMode() {
  state.selectionMode = false;
  state.selectedChats = new Set();
  document.body.classList.remove("selection-active");

  const tb = $("selection-toolbar");
  if (tb) {
    tb.classList.add("hidden");
    tb.style.display = "";
  }

  document.querySelectorAll(".tk-chat-item").forEach(el => {
    el.classList.remove("selectable", "selected");
    el.querySelector(".sel-check")?.remove();
  });
}

function selectChat(el, force) {
  const chatId = el.dataset.uid || el.dataset.gid;
  if (!chatId) return;
  if (!state.selectionMode) return;

  const isSelected = force !== undefined ? force : !state.selectedChats.has(chatId);

  if (isSelected) {
    state.selectedChats.add(chatId);
    el.classList.add("selected");
    if (!el.querySelector(".sel-check")) {
      const check = document.createElement("div");
      check.className = "sel-check";
      check.textContent = "✓";
      el.appendChild(check);
    }
  } else {
    state.selectedChats.delete(chatId);
    el.classList.remove("selected");
    el.querySelector(".sel-check")?.remove();
  }

  const countEl = $("sel-count");
  if (countEl) countEl.textContent = state.selectedChats.size;

  if (state.selectedChats.size === 0) {
    exitSelectionMode();
  }
}

/* ============================================================
   LONG PRESS CHAT
   ============================================================ */
let _lpTimer = null;
let _lpStartX = 0, _lpStartY = 0, _lpFired = false;
let _lpJustFired = false;

function _lpStart(e, x, y) {
  const item = e.target.closest(".tk-chat-item");
  if (!item) return;
  if (item.id === "item-ai" || item.id === "item-global") return;
  if (state.selectionMode) return;

  _lpStartX = x; _lpStartY = y; _lpFired = false;
  clearTimeout(_lpTimer);
  _lpTimer = setTimeout(() => {
    _lpFired = true;
    _lpJustFired = true;
    if (navigator.vibrate) navigator.vibrate(15);
    enterSelectionMode();
    selectChat(item, true);
    setTimeout(() => { _lpJustFired = false; }, 400);
  }, 500);
}

function _lpMove(x, y) {
  if (_lpFired) return;
  const dx = Math.abs(x - _lpStartX);
  const dy = Math.abs(y - _lpStartY);
  if (dx > 12 || dy > 12) clearTimeout(_lpTimer);
}

function _lpEnd() {
  clearTimeout(_lpTimer);
}

document.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  _lpStart(e, t.clientX, t.clientY);
}, { passive: true });

document.addEventListener("touchmove", (e) => {
  const t = e.touches[0];
  _lpMove(t.clientX, t.clientY);
}, { passive: true });

document.addEventListener("touchend", _lpEnd);
document.addEventListener("touchcancel", _lpEnd);

document.addEventListener("mousedown", (e) => {
  _lpStart(e, e.clientX, e.clientY);
});
document.addEventListener("mousemove", (e) => {
  _lpMove(e.clientX, e.clientY);
});
document.addEventListener("mouseup", _lpEnd);

document.addEventListener("contextmenu", (e) => {
  const item = e.target.closest(".tk-chat-item");
  if (!item) return;
  if (item.id === "item-ai" || item.id === "item-global") return;
  e.preventDefault();
  if (!state.selectionMode) enterSelectionMode();
  selectChat(item, true);
});

/* ============================================================
   CHAT ITEM CLICK
   ============================================================ */
document.addEventListener("click", (e) => {
  if (_lpJustFired) return;
  if (e.target.closest("#selection-toolbar")) return;
  if (e.target.closest(".modal-overlay")) return;
  if (e.target.closest(".header-menu-dropdown")) return;
  if (e.target.closest(".app-header")) return;
  if (e.target.closest(".bottom-nav")) return;
  if (e.target.closest("#chat-detail")) return;
  if (e.target.closest(".wa-filter")) return;
  if (e.target.closest(".wa-search")) return;

  const item = e.target.closest(".tk-chat-item");
  if (!item) return;
  if (item.id === "item-ai" || item.id === "item-global") return;

  if (state.selectionMode) {
    e.preventDefault();
    e.stopPropagation();
    selectChat(item);
    return;
  }

  const uid = item.dataset.uid;
  const gid = item.dataset.gid;
  if (gid) {
    const g = state.userGroups.find(x => x.id === gid);
    if (g) openChatDetail("group", null, gid);
    return;
  }
  if (uid) {
    getUserProfileByUid(uid).then(p => {
      if (p) openChatDetail("dm", p);
    }).catch(() => {});
  }
});

/* ============================================================
   SELECTION TOOLBAR — back button
   ============================================================ */
$("sel-back")?.addEventListener("click", (e) => {
  e.stopPropagation();
  exitSelectionMode();
});

/* ============================================================
   SELECTION TOOLBAR — actions
   ============================================================ */
$$("#selection-toolbar [data-sel-action]").forEach(btn => {
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const act = btn.dataset.selAction;
    const ids = [...state.selectedChats];
    if (ids.length === 0) return;

    try {
      if (act === "pin") {
        for (const id of ids) {
          const isPinned = (state.pinnedChats || []).includes(id);
          await pinChat(state.user.uid, id, !isPinned);
          if (isPinned) state.pinnedChats = state.pinnedChats.filter(x => x !== id);
          else state.pinnedChats = [...state.pinnedChats, id];
        }
        showToast(ids.length + " chat di-pin 📌");

      } else if (act === "delete") {
        if (!confirm("Hapus " + ids.length + " chat dari daftar?")) return;
        for (const id of ids) {
          const isGroup = !!document.querySelector('[data-gid="' + id + '"]');
          if (!isGroup) {
            await removeChatFromList(state.user.uid, id);
          }
          const el = document.querySelector('[data-uid="' + id + '"], [data-gid="' + id + '"]');
          el?.remove();
        }
        showToast(ids.length + " chat dihapus 🗑️");

      } else if (act === "mute") {
        for (const id of ids) {
          const isMuted = (state.mutedChats || []).includes(id);
          await muteChat(state.user.uid, id, !isMuted);
          if (isMuted) state.mutedChats = state.mutedChats.filter(x => x !== id);
          else state.mutedChats = [...state.mutedChats, id];
        }
        showToast(ids.length + " chat dibisukan 🔕");

      } else if (act === "archive") {
        for (const id of ids) {
          await archiveChat(state.user.uid, id, true);
          state.archivedChats = [...new Set([...state.archivedChats, id])];
        }
        showToast(ids.length + " chat diarsipkan 📦");
      }
    } catch (err) {
      console.error("[sel action]", err);
      showToast("Gagal: " + (err.message || "unknown"));
    }

    exitSelectionMode();
    applyChatFilter();
  });
});

/* ============================================================
   SELECTION TOOLBAR — more
   ============================================================ */
$("sel-more")?.addEventListener("click", (e) => {
  e.stopPropagation();
  e.preventDefault();
  const ids = [...state.selectedChats];
  if (ids.length === 0) return;

  showInfo("Opsi Tambahan",
    '<div style="display:flex;flex-direction:column;gap:8px;">' +
      '<button id="sm-unread" style="padding:14px;background:var(--bg-soft);border:2px solid var(--border);border-radius:12px;font-weight:800;cursor:pointer;text-align:left;">📩 Tandai belum dibaca</button>' +
      '<button id="sm-clear" style="padding:14px;background:var(--bg-soft);border:2px solid var(--border);border-radius:12px;font-weight:800;cursor:pointer;text-align:left;">🧹 Bersihkan obrolan</button>' +
      '<button id="sm-favorite" style="padding:14px;background:var(--bg-soft);border:2px solid var(--border);border-radius:12px;font-weight:800;cursor:pointer;text-align:left;">⭐ Tambah ke favorit</button>' +
      '<button id="sm-block" style="padding:14px;background:var(--danger);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;text-align:left;">🚫 Blokir</button>' +
    '</div>');

  setTimeout(() => {
    $("sm-unread")?.addEventListener("click", async () => {
      $("info-modal")?.classList.add("hidden");
      for (const id of ids) {
        const isGroup = !!document.querySelector('[data-gid="' + id + '"]');
        await markChatUnread(state.user.uid, id, isGroup);
      }
      showToast(ids.length + " ditandai belum dibaca 📩");
      exitSelectionMode();
    });

    $("sm-clear")?.addEventListener("click", async () => {
      $("info-modal")?.classList.add("hidden");
      if (!confirm("Bersihkan " + ids.length + " obrolan? Pesan akan dihapus.")) return;
      for (const id of ids) {
        const isGroup = !!document.querySelector('[data-gid="' + id + '"]');
        const roomId = isGroup ? id : getDMRoomId(state.user.uid, id);
        const chatType = isGroup ? "group" : "dm";
        await clearChat(chatType, roomId);
      }
      showToast(ids.length + " obrolan dibersihkan 🧹");
      exitSelectionMode();
    });

    $("sm-favorite")?.addEventListener("click", async () => {
      $("info-modal")?.classList.add("hidden");
      for (const id of ids) {
        if (!(state.pinnedChats || []).includes(id)) {
          await pinChat(state.user.uid, id, true);
          state.pinnedChats = [...state.pinnedChats, id];
        }
      }
      showToast("Ditambahkan ke favorit ⭐");
      exitSelectionMode();
    });

    $("sm-block")?.addEventListener("click", async () => {
      $("info-modal")?.classList.add("hidden");
      for (const id of ids) {
        await blockUser(state.user.uid, id);
      }
      showToast("User diblokir 🚫");
      exitSelectionMode();
    });
  }, 100);
});

/* ============================================================
   HEADER MENU DROPDOWN
   ============================================================ */
$("header-menu-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  $("header-menu-dropdown")?.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  const dd = $("header-menu-dropdown");
  if (!dd || dd.classList.contains("hidden")) return;
  if (!e.target.closest("#header-menu-dropdown") && !e.target.closest("#header-menu-btn")) {
    dd.classList.add("hidden");
  }
});

$$("#header-menu-dropdown .header-menu-item").forEach(item => {
  item.addEventListener("click", async () => {
    $("header-menu-dropdown")?.classList.add("hidden");
    const a = item.dataset.action;

    if (a === "new-group") openCreateGroupModal();
    else if (a === "new-contact") {
      document.querySelector('[data-tab="friend"]')?.click();
      setTimeout(() => $("btn-add-friend")?.click(), 250);
    }
    else if (a === "shortcut") showToast("Pintasan ditambahkan ke home screen");
    else if (a === "contact-list") document.querySelector('[data-tab="friend"]')?.click();
    else if (a === "mark-all-unread") showToast("Semua chat ditandai belum dibaca");
    else if (a === "select-all") {
      enterSelectionMode();
      document.querySelectorAll(".tk-chat-item").forEach(el => {
        if (el.style.display !== "none" && el.id !== "item-ai" && el.id !== "item-global") {
          selectChat(el, true);
        }
      });
    }
    else if (a === "lock-chat") showToast("Fitur kunci obrolan segera hadir 🔒");
    else if (a === "add-favorite") showToast("Tandai chat sebagai favorit dari menu chat");
    else if (a === "add-list") showToast("Fitur daftar segera hadir 📋");
    else if (a === "clear-chat") showToast("Pilih chat dulu untuk bersihkan");
    else if (a === "block") showToast("Pilih user dulu untuk blokir");
  });
});

/* ============================================================
   FAB "="
   ============================================================ */
$("btn-new-chat")?.addEventListener("click", () => {
  if (state.selectionMode) exitSelectionMode();
  showInfo("Menu",
    '<div style="display:flex;flex-direction:column;gap:8px;">' +
      '<button id="fab-dm" style="padding:14px;background:var(--bg-soft);border:2px solid var(--border);border-radius:12px;font-weight:800;cursor:pointer;text-align:left;font-size:14px;">💬 Chat baru</button>' +
      '<button id="fab-group" style="padding:14px;background:var(--bg-soft);border:2px solid var(--border);border-radius:12px;font-weight:800;cursor:pointer;text-align:left;font-size:14px;">👥 Grup baru</button>' +
      '<button id="fab-contact" style="padding:14px;background:var(--bg-soft);border:2px solid var(--border);border-radius:12px;font-weight:800;cursor:pointer;text-align:left;font-size:14px;">➕ Tambah teman</button>' +
      '<button id="fab-story" style="padding:14px;background:var(--bg-soft);border:2px solid var(--border);border-radius:12px;font-weight:800;cursor:pointer;text-align:left;font-size:14px;">📖 Post story</button>' +
    '</div>');
  setTimeout(() => {
    $("fab-dm")?.addEventListener("click", () => {
      $("info-modal")?.classList.add("hidden");
      $("new-chat-modal")?.classList.remove("hidden");
    });
    $("fab-group")?.addEventListener("click", () => {
      $("info-modal")?.classList.add("hidden");
      openCreateGroupModal();
    });
    $("fab-contact")?.addEventListener("click", () => {
      $("info-modal")?.classList.add("hidden");
      document.querySelector('[data-tab="friend"]')?.click();
      setTimeout(() => $("btn-add-friend")?.click(), 250);
    });
    $("fab-story")?.addEventListener("click", () => {
      $("info-modal")?.classList.add("hidden");
      document.querySelector('.tk-subtab[data-subtab="story"]')?.click();
      setTimeout(() => $("btn-add-story-tk")?.click(), 250);
    });
  }, 100);
});

/* ============================================================
   OPEN CHAT DETAIL
   ============================================================ */
function openChatDetail(type, targetUser = null, groupId = null) {
  if (state.selectionMode) exitSelectionMode();

  state.currentChat = type;
  state.activeTargetUser = targetUser;
  state.replyingTo = null;
  state.currentMention = null;
  updateReplyBanner();

  const overlay = $("chat-detail");
  const inputEl = $("chat-input");
  const msgBox = $("chat-messages");
  if (!overlay) return;

  if (state.typingUnsub) { state.typingUnsub(); state.typingUnsub = null; }
  if (state.callUnsub) { state.callUnsub(); state.callUnsub = null; }
  if (state.statusUnsub) { state.statusUnsub(); state.statusUnsub = null; }
  if (state.groupUnsub) { state.groupUnsub(); state.groupUnsub = null; }

  if (type === "ai") {
    const headerUser = $("chat-header-user");
    const modelName = getCurrentModel().split("/").pop().replace(":free", "").replace("instruct", "").trim();
    if (headerUser) {
      headerUser.innerHTML =
        '<div class="chat-avatar-sm ai-avatar-header" id="chat-avatar">' +
          '<span class="ai-avatar-icon">🤖</span>' +
          '<div class="ai-online-pulse"></div>' +
        '</div>' +
        '<div class="chat-header-info">' +
          '<div class="chat-name" id="chat-name">FluxAI <span class="ai-badge-header">AI</span></div>' +
          '<div class="chat-status ai-status" id="chat-status"><span class="ai-dot"></span> ' + modelName + ' · Online</div>' +
        '</div>';
    }
    if (inputEl) inputEl.placeholder = "Tanya FluxAI apa aja...";
    if (state.lastAiMsgs.length === 0) {
      const userName = isRealName(state.profile?.displayName) ? state.profile.displayName : "Kak";
      state.lastAiMsgs.push({
        role: "ai",
        text: `Halo ${userName}! 👋 Aku FluxAI.\n\nModel: ${modelName}\n\n• Jawab pertanyaan\n• Bikin gambar ("/img [prompt]")\n• Voice note langsung\n• Baca gambar\n\nMau tanya apa?`,
        time: Date.now()
      });
    }
    renderAIMessages();

  } else if (type === "global") {
    const headerUser = $("chat-header-user");
    if (headerUser) {
      headerUser.innerHTML =
        '<div class="chat-avatar-sm global-avatar-header" id="chat-avatar">🌍</div>' +
        '<div class="chat-header-info">' +
          '<div class="chat-name" id="chat-name">Chat Global</div>' +
          '<div class="chat-status" id="chat-status">Publik · Semua user</div>' +
        '</div>';
    }
    if (inputEl) inputEl.placeholder = "Pesan ke semua orang... (@ untuk mention)";
    renderGlobalMessages(state.lastGlobalMsgs);

  } else if (type === "group" && groupId) {
    state.currentGroupId = groupId;
    const headerUser = $("chat-header-user");
    if (headerUser) {
      headerUser.innerHTML =
        '<div class="chat-avatar-sm" id="chat-avatar" style="background:#10B981;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;">👥</div>' +
        '<div class="chat-header-info">' +
          '<div class="chat-name" id="chat-name">Memuat...</div>' +
          '<div class="chat-status" id="chat-status">Memuat...</div>' +
        '</div>';
    }
    if (inputEl) inputEl.placeholder = "Pesan ke grup... (@ untuk mention)";
    if (msgBox) msgBox.innerHTML = '<div class="chat-timestamp-divider">Memuat pesan...</div>';

    (async () => {
      try {
        const gSnap = await getDoc(doc(db, "groups", groupId));
        if (!gSnap.exists()) { showToast("Grup tidak ditemukan"); return; }
        const g = { id: groupId, ...gSnap.data() };
        state.currentGroupInfo = g;
        const nameEl = $("chat-name");
        const statusEl = $("chat-status");
        if (nameEl) nameEl.textContent = g.name || "Grup";
        if (statusEl) statusEl.textContent = (g.members || []).length + " anggota";

        state.groupUnsub = listenGroupMessages(groupId, (msgs) => {
          if (state.currentChat === "group" && state.currentGroupId === groupId) {
            renderWithTimestamps(msgs);
          }
        });
      } catch (e) {
        showToast("Gagal buka grup: " + e.message);
      }
    })();

  } else if (type === "dm" && targetUser) {
    const headerUser = $("chat-header-user");
    const displayName = targetUser.displayName || targetUser.username || "User";
    const username = targetUser.username || (targetUser.email || "").split("@")[0] || "user";

    if (headerUser) {
      const avatarHtml = (targetUser.photoURL && targetUser.photoURL.length > 10)
        ? '<div class="chat-avatar-sm" id="chat-avatar" style="background-image:url(' + targetUser.photoURL + ')"></div>'
        : '<div class="chat-avatar-sm" id="chat-avatar">' + displayName.charAt(0).toUpperCase() + '</div>';
      headerUser.innerHTML =
        avatarHtml +
        '<div class="chat-header-info">' +
          '<div class="chat-name" id="chat-name">' + escapeHtml(displayName) + '</div>' +
          '<div class="chat-status" id="chat-status">Memuat...</div>' +
        '</div>';
    }

    if (inputEl) inputEl.placeholder = "Tulis pesan...";
    markMessagesAsRead(state.user.uid, targetUser.uid);
    state.dmWithUid = targetUser.uid;

    const listEl = $("private-list-tk")?.querySelector('[data-uid="' + targetUser.uid + '"]');
    if (listEl) {
      const metaEl = listEl.querySelector(".tk-chat-meta");
      if (metaEl) metaEl.innerHTML = '<div class="tk-chat-preview">@' + username + '</div>';
    }

    const roomId = getDMRoomId(state.user.uid, targetUser.uid);
    setDoc(doc(db, "chats_dm", roomId), {
      participants: [state.user.uid, targetUser.uid],
      [`unread.${state.user.uid}`]: 0
    }, { merge: true }).catch(() => {});

    addPrivateChatToList(targetUser, 0);
    if (state.dmUnsub) state.dmUnsub();
    state.dmUnsub = listenPrivateMessages(state.user.uid, targetUser.uid, (msgs) => {
      state.lastDmMsgs = msgs || [];
      if (state.currentChat === "dm" && state.dmWithUid === targetUser.uid) {
        renderDMMessages(state.lastDmMsgs);
      }
      markMessagesAsRead(state.user.uid, targetUser.uid);
    });

    state.typingUnsub = listenTypingStatus(state.user.uid, targetUser.uid, (isTyping) => {
      const statusEl2 = $("chat-status");
      if (statusEl2 && isTyping) {
        statusEl2.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span> mengetik...';
      }
    });

    state.statusUnsub = listenUserStatus(targetUser.uid, (status) => {
      const statusEl2 = $("chat-status");
      if (!statusEl2) return;
      if (status.isOnline) {
        statusEl2.textContent = "Online";
        statusEl2.style.color = "var(--online)";
      } else {
        const lastSeen = status.lastSeen;
        let text = "Offline";
        if (lastSeen > 0) {
          const diff = Date.now() - lastSeen;
          const min = Math.floor(diff / 60000);
          if (min < 1) text = "Baru saja";
          else if (min < 60) text = min + " menit lalu";
          else if (min < 1440) text = Math.floor(min / 60) + " jam lalu";
          else text = Math.floor(min / 1440) + " hari lalu";
        }
        statusEl2.textContent = text;
        statusEl2.style.color = "var(--muted)";
      }
    });

    setupDmCallListener(targetUser.uid);
    renderDMMessages(state.lastDmMsgs);
  }

  overlay.classList.remove("hidden");
  loadWallpaper();
  setTimeout(() => { if (msgBox) msgBox.scrollTop = msgBox.scrollHeight; }, 50);
}

$("chat-back")?.addEventListener("click", () => {
  hideReactionPicker();
  hideMentionDropdown();
  $("chat-detail")?.classList.add("hidden");
  state.currentChat = null;
  state.activeTargetUser = null;
  state.dmWithUid = null;
  state.currentGroupId = null;
  state.currentGroupInfo = null;
  state.replyingTo = null;
  if (state.typingUnsub) { state.typingUnsub(); state.typingUnsub = null; }
  if (state.callUnsub) { state.callUnsub(); state.callUnsub = null; }
  if (state.dmUnsub) { state.dmUnsub(); state.dmUnsub = null; }
  if (state.groupUnsub) { state.groupUnsub(); state.groupUnsub = null; }
  if (state.statusUnsub) { state.statusUnsub(); state.statusUnsub = null; }
});

/* ============================================================
   SHOW GLOBAL USER INFO
   ============================================================ */
async function showGlobalUserInfo(uid, fallbackName, fallbackPhoto) {
  if (!uid) return;

  showInfo("👤 Memuat...", '<div style="text-align:center;padding:20px;color:var(--muted);">Loading profil...</div>');

  let profile = null;
  try { profile = await getUserProfileByUid(uid); }
  catch (e) { console.warn("[GlobalUserInfo]", e); }

  const displayName = profile?.displayName || fallbackName || "User";
  const username = profile?.username || (profile?.email || "").split("@")[0] || "user";
  const numericUid = profile?.numericUid || uid;
  const bio = profile?.bio || "Belum ada bio";
  const photoURL = profile?.photoURL || fallbackPhoto || "";
  const isMe = uid === state.user?.uid;

  const isOnline = profile?.isOnline === true && profile?.lastSeen &&
    (Date.now() - (profile.lastSeen.toDate?.().getTime() || 0)) < 60000;
  const statusText = isOnline ? "🟢 Online" : "⚪ Offline";
  const statusColor = isOnline ? "#10B981" : "var(--muted)";

  const isFriend = frFriends.some(f => f.otherUid === uid);

  const html =
    '<div style="text-align:center;padding:8px 0 16px;">' +
      '<div style="width:96px;height:96px;border-radius:50%;background:var(--accent);color:#3B2A14;' +
        'display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;' +
        'margin:0 auto;background-size:cover;background-position:center;border:3px solid var(--accent-dark);' +
        (photoURL ? 'background-image:url(' + photoURL + ');' : '') + '">' +
        (photoURL ? '' : escapeHtml(displayName.charAt(0).toUpperCase())) +
      '</div>' +
      '<div style="font-weight:900;font-size:20px;margin-top:12px;color:var(--text);">' + escapeHtml(displayName) + '</div>' +
      '<div style="font-size:13px;color:var(--muted);margin-top:4px;">@' + escapeHtml(username) + '</div>' +
      '<div style="font-size:12px;color:' + statusColor + ';margin-top:6px;font-weight:700;">' + statusText + '</div>' +
    '</div>' +
    '<div style="background:var(--bg-soft);border-radius:12px;padding:14px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:var(--muted);letter-spacing:1px;margin-bottom:8px;">NOMOR / UID</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;padding:6px 0;" onclick="window.copyUID(\'' + numericUid + '\')">' +
        '<span style="font-family:monospace;font-size:14px;font-weight:700;color:var(--text);word-break:break-all;">' + numericUid + '</span>' +
        '<button type="button" style="background:var(--accent);color:#3B2A14;border:2px solid #3B2A14;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:900;cursor:pointer;flex-shrink:0;">📋 Salin</button>' +
      '</div>' +
    '</div>' +
    '<div style="background:var(--bg-soft);border-radius:12px;padding:14px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:var(--muted);letter-spacing:1px;margin-bottom:6px;">BIO</div>' +
      '<div style="font-size:13px;color:var(--text);font-style:italic;">' + escapeHtml(bio) + '</div>' +
    '</div>' +
    (!isMe ?
    '<div style="display:flex;flex-direction:column;gap:8px;">' +
      '<button id="gui-btn-chat" style="padding:12px;background:var(--accent);color:#3B2A14;border:2px solid #3B2A14;border-radius:10px;font-weight:900;cursor:pointer;font-size:14px;">💬 Chat Pribadi</button>' +
      (!isFriend ? '<button id="gui-btn-friend" style="padding:12px;background:var(--bg-soft);color:var(--text);border:2px solid var(--border);border-radius:10px;font-weight:900;cursor:pointer;font-size:14px;">➕ Tambah Teman</button>' : '') +
      '<button id="gui-btn-copy-name" style="padding:12px;background:var(--bg-soft);color:var(--text);border:2px solid var(--border);border-radius:10px;font-weight:900;cursor:pointer;font-size:14px;">📋 Salin Nama</button>' +
    '</div>'
    : '<div style="text-align:center;font-size:12px;color:var(--muted);font-style:italic;">Ini kamu sendiri 👋</div>');

  showInfo("👤 Info Kontak", html);

  setTimeout(() => {
    const btnChat = document.getElementById("gui-btn-chat");
    if (btnChat) btnChat.onclick = () => {
      $("info-modal")?.classList.add("hidden");
      if (profile) openChatDetail("dm", profile);
    };
    const btnFriend = document.getElementById("gui-btn-friend");
    if (btnFriend) btnFriend.onclick = async () => {
      try {
        const result = await sendFriendRequest(state.user.uid, uid);
        const msgs = { sent: "Request terkirim ✅", already_friends: "Kalian sudah teman", already_sent: "Sudah pernah minta", auto_accepted: "Kalian sekarang teman ✅", self: "Nggak bisa add diri sendiri", error: "Gagal kirim request" };
        showToast(msgs[result] || "Selesai");
        $("info-modal")?.classList.add("hidden");
      } catch (e) { showToast("Gagal: " + e.message); }
    };
    const btnCopyName = document.getElementById("gui-btn-copy-name");
    if (btnCopyName) btnCopyName.onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(displayName).then(() => showToast("Nama disalin 📋"));
    };
  }, 100);
}

$("chat-header-user")?.addEventListener("click", () => {
  if (state.currentChat === "dm" && state.activeTargetUser) {
    const u = state.activeTargetUser;
    showGlobalUserInfo(u.uid, u.displayName, u.photoURL);
  } else if (state.currentChat === "group") {
    openGroupInfo();
  }
});

window.copyUID = function(uid) {
  if (!uid) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(uid).then(() => showToast("Nomor disalin: " + uid)).catch(() => { prompt("UID:", uid); });
  } else {
    prompt("UID:", uid);
  }
};

/* ============================================================
   WEBRTC
   ============================================================ */
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function startCall(isVideo) {
  if (!state.dmWithUid) { showToast("Buka chat privat dulu!"); return; }
  state.isCalling = true;
  showCallUI(isVideo, true);
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
    if (isVideo && $("local-video")) $("local-video").srcObject = state.localStream;
    state.pc = new RTCPeerConnection(ICE_SERVERS);
    state.localStream.getTracks().forEach(t => state.pc.addTrack(t, state.localStream));
    state.pc.ontrack = (event) => {
      state.remoteStream = event.streams[0];
      if (isVideo && $("remote-video")) $("remote-video").srcObject = state.remoteStream;
      else if (!isVideo && $("remote-audio")) { $("remote-audio").srcObject = state.remoteStream; $("remote-audio").play(); }
    };
    state.pc.onicecandidate = (e) => {
      if (e.candidate) sendCallSignal(state.user.uid, state.dmWithUid, { type: "candidate", candidate: e.candidate, isVideo });
    };
    const offer = await state.pc.createOffer();
    await state.pc.setLocalDescription(offer);
    await sendCallSignal(state.user.uid, state.dmWithUid, { type: "offer", offer, isVideo });
    if ($("call-status-text")) $("call-status-text").textContent = "Memanggil...";
  } catch (err) { showToast("Akses kamera/mikrofon ditolak."); endCall(); }
}

function setupDmCallListener(otherUid) {
  if (state.callUnsub) state.callUnsub();
  state.callUnsub = listenCallSignal(state.user.uid, otherUid, async (signal) => {
    if (!signal || !signal.type) return;
    const signalTime = signal.timestamp?.toDate?.()?.getTime() || 0;
    if (signalTime > 0 && Date.now() - signalTime > 30000) {
      try { await clearCallSignal(state.user.uid, otherUid); } catch (e) {}
      return;
    }
    if (signal.type === "end") {
      if (!state.pc && !state.isCalling) return;
      endCall();
      return;
    }
    if (!state.pc && signal.type === "offer") {
      if (confirm("Panggilan " + (signal.isVideo ? "Video" : "Suara") + " masuk. Terima?")) {
        state.isCalling = true;
        showCallUI(signal.isVideo, false);
        try {
          state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: signal.isVideo });
          if (signal.isVideo && $("local-video")) $("local-video").srcObject = state.localStream;
          state.pc = new RTCPeerConnection(ICE_SERVERS);
          state.localStream.getTracks().forEach(t => state.pc.addTrack(t, state.localStream));
          state.pc.ontrack = (e) => {
            state.remoteStream = e.streams[0];
            if (signal.isVideo && $("remote-video")) $("remote-video").srcObject = state.remoteStream;
            else if (!signal.isVideo && $("remote-audio")) { $("remote-audio").srcObject = state.remoteStream; $("remote-audio").play(); }
          };
          state.pc.onicecandidate = (e) => {
            if (e.candidate) sendCallSignal(state.user.uid, otherUid, { type: "candidate", candidate: e.candidate });
          };
          await state.pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
          const answer = await state.pc.createAnswer();
          await state.pc.setLocalDescription(answer);
          await sendCallSignal(state.user.uid, otherUid, { type: "answer", answer });
          if ($("call-status-text")) $("call-status-text").textContent = "Terhubung";
        } catch (err) { endCall(); }
      }
    } else if (state.pc && signal.type === "answer") {
      await state.pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
      if ($("call-status-text")) $("call-status-text").textContent = "Terhubung";
    } else if (state.pc && signal.type === "candidate") {
      await state.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  });
}

function showCallUI(isVideo, isCaller) {
  let modal = $("call-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "call-modal";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#111; z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:20px; color:#fff;";
    modal.innerHTML = '<div id="call-status-text" style="font-size:18px; font-weight:600; margin-top:20px;">' + (isCaller ? "Memanggil..." : "Panggilan Masuk...") + '</div>' +
      '<div style="flex:1; width:100%; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; border-radius:12px; background:#000; margin:10px 0;">' +
      '<video id="remote-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover; ' + (isVideo ? "" : "display:none;") + '"></video>' +
      '<video id="local-video" autoplay muted playsinline style="position:absolute; bottom:20px; right:20px; width:100px; height:150px; object-fit:cover; border-radius:8px; border:2px solid #fff; ' + (isVideo ? "" : "display:none;") + '"></video>' +
      '<audio id="remote-audio" autoplay></audio>' +
      (isVideo ? "" : '<div style="font-size:64px;">📞</div>') + '</div>' +
      '<div style="margin-bottom:30px;"><button id="end-call-btn" style="background:red; color:#fff; border:none; padding:14px 32px; border-radius:30px; font-weight:700; cursor:pointer; font-size:16px;">Akhiri Panggilan</button></div>';
    document.body.appendChild(modal);
    $("end-call-btn").onclick = endCall;
  }
  modal.style.display = "flex";
}

function endCall() {
  if (!state.pc && !state.isCalling && !$("call-modal")) return;
  if (state.localStream) { state.localStream.getTracks().forEach(t => t.stop()); state.localStream = null; }
  if (state.pc) { try { state.pc.close(); } catch (e) {} state.pc = null; }
  state.remoteStream = null;
  state.isCalling = false;
  if (state.dmWithUid) clearCallSignal(state.user.uid, state.dmWithUid).catch(() => {});
  $("call-modal")?.remove();
  showToast("Panggilan diakhiri");
}

$("chat-call")?.addEventListener("click", () => {
  if (state.currentChat === "ai" || state.currentChat === "global" || state.currentChat === "group") {
    showToast("Panggilan cuma buat chat pribadi"); return;
  }
  startCall(false);
});
$("chat-video")?.addEventListener("click", () => {
  if (state.currentChat === "ai" || state.currentChat === "global" || state.currentChat === "group") {
    showToast("Panggilan cuma buat chat pribadi"); return;
  }
  startCall(true);
});

/* ============================================================
   REACTIONS
   ============================================================ */
function renderReactionsHTML(msgId, msgData) {
  const reactions = msgData?.reactions || {};
  if (!reactions || Object.keys(reactions).length === 0) return "";
  let html = '<div class="msg-reactions">';
  for (const [emoji, users] of Object.entries(reactions)) {
    if (!users || users.length === 0) continue;
    const mine = state.user && users.includes(state.user.uid);
    html += '<div class="reaction-chip ' + (mine ? "mine" : "") + '" data-msg="' + msgId + '" data-emoji="' + emoji + '"><span>' + emoji + '</span><span class="count">' + users.length + '</span></div>';
  }
  html += "</div>";
  return html;
}

/* ============================================================
   RENDER MESSAGES
   ============================================================ */
function renderWithTimestamps(msgs) {
  const box = $("chat-messages");
  if (!box) return;
  box.innerHTML = "";
  if (!msgs || msgs.length === 0) {
    box.innerHTML = '<div class="tk-empty" style="padding: 40px 20px;"><div class="tk-empty-icon">💬</div><p>Belum ada pesan</p><span>Mulai percakapan sekarang</span></div>';
    return;
  }
  let lastDateLabel = "";
  let lastSenderUid = null;
  const isGlobal = state.currentChat === "global";
  const isGroup  = state.currentChat === "group";

  for (const m of msgs) {
    const dateLabel = formatDateLabel(m.createdAt);
    if (dateLabel && dateLabel !== lastDateLabel) {
      const div = document.createElement("div");
      div.className = "chat-timestamp-divider";
      div.textContent = dateLabel;
      box.appendChild(div);
      lastDateLabel = dateLabel;
      lastSenderUid = null;
    }
    const isSelf = m.uid === state.user?.uid;
    const msgId = stableMsgId(m);
    const wrapper = document.createElement("div");
    wrapper.className = "msg-wrapper " + (isSelf ? "self" : "other");

    if (!isSelf && (isGlobal || isGroup)) {
      if (lastSenderUid !== m.uid) {
        const initial = (m.name || "U").charAt(0).toUpperCase();
        const hasAvatar = m.photoURL && m.photoURL.length > 10;
        const senderHeader = document.createElement("div");
        senderHeader.className = "global-sender-header";
        senderHeader.dataset.uid = m.uid || "";
        senderHeader.innerHTML =
          '<div class="global-sender-avatar" ' + (hasAvatar ? 'style="background-image:url(' + m.photoURL + ')"' : '') + '>' +
            (hasAvatar ? '' : initial) +
          '</div>' +
          '<div class="global-sender-name">' + escapeHtml(m.name || "User") + '</div>';
        senderHeader.style.cursor = "pointer";
        senderHeader.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (m.uid) showGlobalUserInfo(m.uid, m.name, m.photoURL);
        });
        wrapper.appendChild(senderHeader);
      }
      lastSenderUid = m.uid;
    } else if (isSelf) {
      lastSenderUid = null;
    }

    const el = document.createElement("div");
    el.className = "chat-msg " + (isSelf ? "self" : "other");

    let fwdHtml = "";
    if (m.forwarded) {
      fwdHtml = '<div style="font-size:10px;opacity:0.7;font-style:italic;margin-bottom:4px;">↪️ Diteruskan dari ' + escapeHtml(m.forwardedFrom || "User") + '</div>';
    }

    let replyHtml = "";
    if (m.replyTo) {
      replyHtml = '<div class="reply-context">' +
        '<div class="reply-context-name">' + escapeHtml(m.replyTo.name || "User") + '</div>' +
        '<div class="reply-context-text">' + escapeHtml(m.replyTo.text || "Pesan") + '</div>' +
        '</div>';
    }

    let content = "";
    if (m.type === "sticker" && m.sticker) {
      content = '<span class="msg-sticker" data-sticker="' + m.sticker + '" style="cursor:pointer;font-size:48px;line-height:1;">' + m.sticker + '</span>';
    } else if (m.type === "voice" && m.audioBase64) {
      let waveHTML = "";
      for (let i = 0; i < 20; i++) { const h = 6 + Math.random() * 18; waveHTML += '<div class="voice-wave-bar" style="height:' + h + 'px"></div>'; }
      content = '<div class="voice-bubble"><button class="voice-play-btn" data-audio="' + m.audioBase64 + '">▶</button><div class="voice-wave-display">' + waveHTML + '</div><div class="voice-duration">' + (m.duration || 0) + 's</div></div>';
    } else if (m.type === "location") {
      content = '<div style="background:rgba(0,0,0,0.1); padding:10px; border-radius:10px; text-align:center;">📍 <b>Live Location</b><br><a href="https://maps.google.com/?q=' + m.lat + ',' + m.lng + '" target="_blank" style="color:var(--accent); font-size:12px;">Buka di Maps</a></div>';
    } else if (m.type === "contact") {
      content = '<div style="background:rgba(0,0,0,0.1); padding:10px; border-radius:10px; display:flex; align-items:center; gap:8px;"><div style="font-size:24px;">📇</div><div><div style="font-weight:600;">' + escapeHtml(m.contactName) + '</div><div style="font-size:11px; opacity:0.8;">UID: ' + m.contactUid + '</div></div></div>';
    } else {
      content = '<span class="msg-text">' + renderTextWithMentions(m.text || "") + '</span>';
    }

    const isRead = m.read === true;
    const isDM = state.currentChat === "dm";
    let check = "";
    if (isSelf) {
      if (isDM) {
        check = ' <span class="msg-check ' + (isRead ? "msg-check-blue" : "msg-check-gray") + '">✓✓</span>';
      } else {
        check = ' <span class="msg-check msg-check-gray">✓✓</span>';
      }
    }

    const starBadge = m.starred ? '<span class="msg-star-badge" title="Pesan berbintang">⭐</span>' : "";
    const editedTag = m.edited ? '<span class="edited-tag">(diedit)</span>' : "";
    const time = formatTime(m.createdAt);

    el.innerHTML = fwdHtml + replyHtml + content +
      '<span class="msg-meta-line">' + starBadge + editedTag +
      '<span class="msg-time">' + time + check + '</span></span>';

    el.dataset.msgId = msgId;
    const msgData = { id: msgId, text: getDisplayText(m), name: m.name || "User", uid: m.uid, type: m.type, raw: m };
    attachLongPress(el, msgId, msgData);
    attachSwipeReply(el, msgData);

    const stickerEl = el.querySelector(".msg-sticker");
    if (stickerEl) {
      stickerEl.addEventListener("click", () => {
        const overlay = $("sticker-preview-overlay");
        const big = $("sticker-preview-big");
        if (overlay && big) {
          big.textContent = stickerEl.dataset.sticker;
          overlay.classList.remove("hidden");
        }
      });
    }

    wrapper.appendChild(el);
    const rxHTML = renderReactionsHTML(msgId, m);
    if (rxHTML) {
      const tmp = document.createElement("div");
      tmp.innerHTML = rxHTML;
      const rxEl = tmp.firstChild;
      rxEl.querySelectorAll(".reaction-chip").forEach(chip => {
        chip.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const chatType = state.currentChat === "global" ? "global" : state.currentChat === "group" ? "group" : "dm";
          const roomId = chatType === "dm" ? getDMRoomId(state.user.uid, state.dmWithUid) : chatType === "group" ? state.currentGroupId : null;
          addMessageReaction(chatType, roomId, msgId, chip.dataset.emoji, state.user.uid);
        });
      });
      wrapper.appendChild(rxEl);
    }
    box.appendChild(wrapper);
  }
  box.scrollTop = box.scrollHeight;

  box.querySelectorAll(".voice-play-btn").forEach(btn => {
    btn.onclick = function(e) {
      e.preventDefault(); e.stopPropagation();
      const audioSrc = btn.getAttribute("data-audio");
      if (!audioSrc) { showToast("Voice note tidak valid"); return; }
      const audioEl = $("audio-player");
      const modal = $("audio-player-modal");
      if (!audioEl || !modal) { showToast("Audio player tidak ditemukan"); return; }
      audioEl.src = audioSrc;
      modal.classList.remove("hidden");
      audioEl.play().then(() => {
        btn.textContent = "⏸";
        btn.classList.add("playing");
      }).catch(err => { showToast("Gagal play: " + err.message); });
      audioEl.onended = function() {
        btn.textContent = "▶";
        btn.classList.remove("playing");
      };
    };
  });
}

function renderGlobalMessages(msgs) {
  state.lastGlobalMsgs = msgs || [];
  if (state.currentChat !== "global") return;
  renderWithTimestamps(state.lastGlobalMsgs);
}

function renderDMMessages(msgs) {
  if (state.currentChat !== "dm") return;
  renderWithTimestamps(msgs || []);
}

/* ============================================================
   FLUXAI MESSAGE RENDER
   ============================================================ */
function renderAIMessages() {
  const box = $("chat-messages");
  if (!box) return;
  box.innerHTML = "";

  const div = document.createElement("div");
  div.className = "chat-timestamp-divider";
  div.textContent = "Hari ini";
  box.appendChild(div);

  let idx = 0;
  for (const m of state.lastAiMsgs) {
    const isSelf = m.role === "user";
    const msgId = "ai-" + idx + "-" + (m.time || 0);
    idx++;
    const wrapper = document.createElement("div");
    wrapper.className = "msg-wrapper " + (isSelf ? "self" : "other");

    const el = document.createElement("div");
    el.className = "chat-msg " + (isSelf ? "self" : "other") + (isSelf ? "" : " ai-msg");

    const ttsBtn = !isSelf ? '<button class="ai-tts-btn" data-text="' + escapeHtml(m.text) + '" title="Bacakan">🔊</button>' : "";
    const time = formatTime(m.time ? new Date(m.time) : new Date());

    let contentHtml = '';
    if (m.imageUrl) {
      contentHtml =
        '<div style="margin-bottom:8px;">' + escapeHtml(m.text) + '</div>' +
        '<img src="' + m.imageUrl + '" style="width:100%;max-width:400px;border-radius:12px;border:2px solid #10B981;display:block;cursor:pointer;background:rgba(0,0,0,0.05);" onclick="window.open(this.src)" loading="lazy" alt="' + escapeHtml(m.text) + '" />' +
        '<div style="font-size:11px;opacity:0.6;margin-top:6px;">💡 Tap gambar buat lihat full size</div>';
    } else {
      contentHtml = escapeHtml(m.text);
    }

    el.innerHTML =
      '<span class="msg-text">' + contentHtml + '</span>' +
      (m.imageUrl ? '' : ttsBtn) +
      '<span class="msg-meta-line"><span class="msg-time">' + time + '</span></span>';

    attachLongPress(el, msgId, { id: msgId, text: m.text, name: "FluxAI", uid: "ai" });

    if (!isSelf) {
      const aiAvatar = document.createElement("div");
      aiAvatar.className = "ai-msg-avatar";
      aiAvatar.innerHTML = "🤖";
      wrapper.appendChild(aiAvatar);
    }
    wrapper.appendChild(el);
    box.appendChild(wrapper);
  }
  box.scrollTop = box.scrollHeight;
  box.querySelectorAll(".ai-tts-btn").forEach(btn => {
    btn.onclick = () => speakText(btn.dataset.text);
  });
}

/* ============================================================
   SWIPE REPLY
   ============================================================ */
function attachSwipeReply(el, msgData) {
  let startX = 0, startY = 0, currentX = 0;
  let isSwiping = false, moved = false;

  el.addEventListener("touchstart", function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = startX;
    isSwiping = true;
    moved = false;
  }, { passive: true });

  el.addEventListener("touchmove", function(e) {
    if (!isSwiping) return;
    currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (Math.abs(diff) > 15 && dy < 30) {
      moved = true;
      if (diff > 0 && diff <= 80) {
        el.style.transform = "translateX(" + diff + "px)";
        el.style.transition = "none";
      }
    }
  }, { passive: true });

  el.addEventListener("touchend", function() {
    if (!isSwiping) return;
    isSwiping = false;
    el.style.transition = "transform .2s";
    el.style.transform = "translateX(0px)";
    const diff = currentX - startX;
    if (moved && diff > 60) {
      state.replyingTo = msgData;
      updateReplyBanner();
      showToast("Membalas pesan 💬");
    }
  });

  el.addEventListener("touchcancel", function() {
    isSwiping = false;
    el.style.transform = "translateX(0px)";
  });
}

/* ============================================================
   LONG PRESS MESSAGE
   ============================================================ */
function attachLongPress(el, msgId, msgData) {
  let pressTimer = null, startX = 0, startY = 0, fired = false;

  function start(e) {
    if (fired) return;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY;
    fired = false;
    el.classList.add("pressing");
    clearTimeout(pressTimer);
    pressTimer = setTimeout(function() {
      fired = true;
      el.classList.remove("pressing");
      if (navigator.vibrate) navigator.vibrate(30);
      showReactionPicker(el, msgId, msgData);
    }, 500);
  }

  function cancel() {
    if (fired) return;
    el.classList.remove("pressing");
    clearTimeout(pressTimer);
  }

  function move(e) {
    if (!e.touches) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - startX);
    const dy = Math.abs(t.clientY - startY);
    if (dx > 25 || dy > 25) cancel();
  }

  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("touchmove", move, { passive: true });
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchcancel", cancel);
  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
  el.addEventListener("contextmenu", function(e) {
    e.preventDefault();
    clearTimeout(pressTimer);
    showReactionPicker(el, msgId, msgData);
  });
}

/* ============================================================
   REACTION PICKER
   ============================================================ */
function showReactionPicker(bubbleEl, msgId, msgData) {
  currentReactionTarget = msgId;
  currentSelectedMsg = msgData;
  if (_reactionBackdrop) { _reactionBackdrop.remove(); _reactionBackdrop = null; }
  showMessageToolbar(msgData);

  const picker = $("reaction-picker");
  if (picker) {
    picker.classList.remove("hidden");
    picker.style.display = "flex";
    picker.style.position = "fixed";
    picker.style.zIndex = "100005";
    picker.style.pointerEvents = "auto";

    const buttons = Array.from(picker.querySelectorAll(".reaction-btn"));
    buttons.forEach(function(btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.dataset.reactionTarget = msgId;
      newBtn.addEventListener("click", function(e) {
        e.preventDefault(); e.stopPropagation();
        const emoji = newBtn.dataset.emoji;
        const targetId = newBtn.dataset.reactionTarget;
        if (!emoji || !targetId) { showToast("Target tidak valid"); return; }
        if (state.currentChat === "ai") {
          showToast("Reaction di chat AI belum didukung");
          hideReactionPicker();
          return;
        }
        const chatType = state.currentChat === "global" ? "global" : state.currentChat === "group" ? "group" : "dm";
        const roomId = chatType === "dm" ? getDMRoomId(state.user.uid, state.dmWithUid) : chatType === "group" ? state.currentGroupId : null;
        addMessageReaction(chatType, roomId, targetId, emoji, state.user.uid)
          .then(() => showToast("Reaction " + emoji + " dikirim"))
          .catch(err => showToast("Gagal: " + err.message));
        hideReactionPicker();
      });
    });

    const rect = bubbleEl.getBoundingClientRect();
    const pickerW = 300, pickerH = 64;
    let left = rect.left + rect.width / 2 - pickerW / 2;
    let top = rect.top - pickerH - 14;
    if (left < 10) left = 10;
    if (left + pickerW > window.innerWidth - 10) left = window.innerWidth - pickerW - 10;
    if (top < 70) top = rect.bottom + 14;
    picker.style.left = left + "px";
    picker.style.top = top + "px";
    picker.style.width = pickerW + "px";
  }
}

function showMessageToolbar(msg) {
  const header = document.querySelector(".chat-detail-header");
  if (!header) return;
  header.style.position = "relative";
  const existing = document.getElementById("action-header");
  if (existing) existing.remove();
  Array.from(header.children).forEach(function(child) {
    if (child.id !== "action-header") child.style.visibility = "hidden";
  });

  const isMyMsg = msg.uid === state.user?.uid;
  const isAIMsg = msg.uid === "ai";

  let canEdit = false;
  if (isMyMsg && msg.raw?.createdAt) {
    const created = msg.raw.createdAt.toDate?.()?.getTime() || 0;
    canEdit = (Date.now() - created) < 15 * 60 * 1000;
  }

  const toolbar = document.createElement("div");
  toolbar.id = "action-header";
  toolbar.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; background:var(--card); display:flex; align-items:center; justify-content:space-between; padding:0 8px; box-sizing:border-box; z-index:100004; pointer-events:auto; overflow-x:auto;";

  let btns = '<span class="toolbar-btn" id="act-back">⬅️</span><div style="display:flex;align-items:center;gap:2px;">';
  btns += '<span class="toolbar-btn" id="act-reply">💬</span>';
  if (!isAIMsg) btns += '<span class="toolbar-btn" id="act-forward">↪️</span>';
  if (!isAIMsg) btns += '<span class="toolbar-btn" id="act-star">⭐</span>';
  if (canEdit) btns += '<span class="toolbar-btn" id="act-edit">✏️</span>';
  btns += '<span class="toolbar-btn" id="act-copy">📋</span>';
  if (!isAIMsg) btns += '<span class="toolbar-btn" id="act-delete">🗑️</span>';
  btns += '</div>';

  toolbar.innerHTML = btns;
  header.appendChild(toolbar);

  function bind(id, handler) {
    const btn = document.getElementById(id);
    if (!btn) return;
    let handled = false;
    btn.addEventListener("touchstart", function(e) {
      e.preventDefault(); e.stopPropagation();
      if (handled) return;
      handled = true;
      handler();
      setTimeout(() => { handled = false; }, 400);
    }, { passive: false });
    btn.addEventListener("click", function(e) {
      e.preventDefault(); e.stopPropagation();
      if (handled) return;
      handler();
    });
  }

  bind("act-back", () => hideReactionPicker());

  bind("act-reply", () => {
    state.replyingTo = msg;
    updateReplyBanner();
    hideReactionPicker();
    showToast("Membalas pesan 💬");
  });

  if (document.getElementById("act-forward")) {
    bind("act-forward", () => {
      state.forwardedMsg = msg;
      hideReactionPicker();
      openForwardPicker();
    });
  }

  if (document.getElementById("act-star")) {
    bind("act-star", async () => {
      try {
        const chatType = state.currentChat === "global" ? "global" : state.currentChat === "group" ? "group" : "dm";
        const roomId = chatType === "dm" ? getDMRoomId(state.user.uid, state.dmWithUid) : chatType === "group" ? state.currentGroupId : null;
        await toggleMessageStar(chatType, roomId, msg.id, state.user.uid);
        showToast("Pesan diberi bintang ⭐");
      } catch (e) { showToast("Gagal: " + e.message); }
      hideReactionPicker();
    });
  }

  if (document.getElementById("act-edit")) {
    bind("act-edit", () => {
      hideReactionPicker();
      const currentText = msg.raw?.text || msg.text || "";
      const newText = prompt("Edit pesan (maks 15 menit):", currentText);
      if (newText === null || newText.trim() === "" || newText === currentText) return;
      (async () => {
        try {
          const chatType = state.currentChat === "global" ? "global" : state.currentChat === "group" ? "group" : "dm";
          const roomId = chatType === "dm" ? getDMRoomId(state.user.uid, state.dmWithUid) : chatType === "group" ? state.currentGroupId : null;
          await editMessage(chatType, roomId, msg.id, newText.trim(), state.user.uid);
          showToast("Pesan diedit ✏️");
        } catch (e) { showToast("Gagal edit: " + e.message); }
      })();
    });
  }

  bind("act-copy", () => {
    if (navigator.clipboard) navigator.clipboard.writeText(msg.text || "").catch(()=>{});
    showToast("Teks disalin 📋");
    hideReactionPicker();
  });

  if (document.getElementById("act-delete")) {
    bind("act-delete", () => {
      const tl = document.getElementById("action-header");
      const pk = document.getElementById("reaction-picker");
      if (tl) tl.style.display = "none";
      if (pk) pk.style.display = "none";

      const modal = document.getElementById("info-modal");
      const titleEl = document.getElementById("info-modal-title");
      const bodyEl = document.getElementById("info-modal-body");
      const btnEl = document.getElementById("info-modal-btn");
      if (!modal || !titleEl || !bodyEl || !btnEl) return;

      titleEl.textContent = "🗑️ Hapus Pesan";
      bodyEl.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:10px;padding:10px 0;">' +
        (isMyMsg ? '<button id="del-all" style="padding:14px;background:var(--danger);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:800;font-size:15px;">Hapus untuk Semua</button>' : '') +
        '<button id="del-me" style="padding:14px;background:var(--bg-soft);border:2px solid var(--border);color:var(--text);border-radius:8px;cursor:pointer;font-weight:800;font-size:15px;">Hapus untuk Saya</button>' +
        '</div>';
      btnEl.textContent = "Batal";
      btnEl.onclick = function() {
        modal.classList.add("hidden");
        hideReactionPicker();
      };
      modal.classList.remove("hidden");

      setTimeout(function() {
        const delAll = document.getElementById("del-all");
        if (delAll) delAll.addEventListener("click", async function() {
          modal.classList.add("hidden");
          try {
            if (state.currentChat === "global") await deleteMessage("global", null, msg.id);
            else if (state.currentChat === "dm" && state.dmWithUid) {
              const roomId = getDMRoomId(state.user.uid, state.dmWithUid);
              await deleteMessage("dm", roomId, msg.id);
            } else if (state.currentChat === "group" && state.currentGroupId) {
              await deleteMessage("group", state.currentGroupId, msg.id);
            }
            showToast("Pesan dihapus 🗑️");
          } catch (err) { showToast("Gagal hapus: " + err.message); }
          hideReactionPicker();
        });
        const delMe = document.getElementById("del-me");
        if (delMe) delMe.addEventListener("click", function() {
          modal.classList.add("hidden");
          const msgEl = document.querySelector('[data-msg-id="' + msg.id + '"]');
          if (msgEl) { const w = msgEl.closest(".msg-wrapper"); if (w) w.remove(); }
          showToast("Pesan dihapus untuk Anda");
          hideReactionPicker();
        });
      }, 100);
    });
  }
}

function hideReactionPicker() {
  const picker = $("reaction-picker");
  if (picker) {
    picker.classList.add("hidden");
    picker.style.display = "";
    picker.style.left = ""; picker.style.top = ""; picker.style.width = "";
    picker.style.zIndex = ""; picker.style.pointerEvents = "";
  }
  if (_reactionBackdrop) { _reactionBackdrop.remove(); _reactionBackdrop = null; }
  if (_pickerBackdrop) { _pickerBackdrop.remove(); _pickerBackdrop = null; }
  currentReactionTarget = null;
  currentSelectedMsg = null;
  const toolbar = document.getElementById("action-header");
  if (toolbar) toolbar.remove();
  const header = document.querySelector(".chat-detail-header");
  if (header) {
    Array.from(header.children).forEach(function(child) {
      if (child.id !== "action-header") child.style.visibility = "";
    });
  }
}

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    hideReactionPicker();
    hideMentionDropdown();
    if (state.selectionMode) exitSelectionMode();
  }
});

/* ============================================================
   FORWARD PICKER
   ============================================================ */
async function openForwardPicker() {
  if (!state.forwardedMsg) return;
  const msg = state.forwardedMsg;

  let html = '<div style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow-y:auto;">';

  html += '<button class="fwd-btn" data-type="global" data-uid="" style="padding:12px;background:var(--bg-soft);border:2px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;width:100%;">' +
    '<span style="font-size:24px;">🌍</span>' +
    '<div><div style="font-weight:900;">Chat Global</div></div>' +
    '</button>';

  const list = $("private-list-tk");
  const chatItems = list ? Array.from(list.querySelectorAll(".tk-chat-item")) : [];
  for (const el of chatItems) {
    const uid = el.dataset.uid;
    if (!uid) continue;
    const name = el.querySelector(".tk-chat-name")?.textContent.replace("✓","").replace("📌","").replace("🔕","").trim() || "User";
    const initial = name.charAt(0).toUpperCase();
    html += '<button class="fwd-btn" data-type="dm" data-uid="' + uid + '" style="padding:12px;background:var(--bg-soft);border:2px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;width:100%;">' +
      '<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;">' + initial + '</div>' +
      '<div style="font-weight:900;">' + escapeHtml(name) + '</div>' +
      '</button>';
  }

  for (const g of state.userGroups) {
    html += '<button class="fwd-btn" data-type="group" data-uid="' + g.id + '" style="padding:12px;background:var(--bg-soft);border:2px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;width:100%;">' +
      '<div style="width:32px;height:32px;border-radius:50%;background:#10B981;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;">👥</div>' +
      '<div style="font-weight:900;">' + escapeHtml(g.name) + '</div>' +
      '</button>';
  }

  html += '</div>';
  showInfo("↪️ Forward ke", html);
  setTimeout(() => {
    document.querySelectorAll(".fwd-btn").forEach(btn => {
      btn.onclick = async () => {
        try {
          await forwardMessage(msg.raw || msg, state.user, btn.dataset.type, btn.dataset.uid);
          showToast("Pesan diteruskan ✅");
        } catch (e) {
          showToast("Gagal forward: " + e.message);
        }
        state.forwardedMsg = null;
        $("info-modal")?.classList.add("hidden");
      };
    });
  }, 100);
}

/* ============================================================
   MENTION DROPDOWN
   ============================================================ */
function showMentionDropdown(users, inputEl, onSelect) {
  const dd = $("mention-dropdown");
  if (!dd) return;
  if (!users || users.length === 0) { hideMentionDropdown(); return; }

  let html = "";
  users.forEach((u, i) => {
    const name = u.displayName || u.username || "User";
    const initial = name.charAt(0).toUpperCase();
    const hasAvatar = u.photoURL && u.photoURL.length > 10;
    html += '<div class="mention-item' + (i === 0 ? " active" : "") + '" data-uid="' + u.uid + '" data-name="' + escapeHtml(u.username || name) + '">' +
      '<div class="mention-avatar" ' + (hasAvatar ? 'style="background-image:url(' + u.photoURL + ')"' : '') + '>' + (hasAvatar ? '' : initial) + '</div>' +
      '<div>' + escapeHtml(name) + '</div>' +
      '</div>';
  });
  dd.innerHTML = html;
  dd.classList.remove("hidden");

  const rect = inputEl.getBoundingClientRect();
  dd.style.left = rect.left + "px";
  dd.style.bottom = (window.innerHeight - rect.top + 8) + "px";
  dd.style.width = Math.min(rect.width, 280) + "px";

  dd.querySelectorAll(".mention-item").forEach(item => {
    item.onclick = () => {
      onSelect(item.dataset.uid, item.dataset.name);
      hideMentionDropdown();
    };
  });
}

function hideMentionDropdown() {
  const dd = $("mention-dropdown");
  if (dd) dd.classList.add("hidden");
}

function setupMentionInput() {
  const input = $("chat-input");
  if (!input || input._mentionBound) return;
  input._mentionBound = true;

  input.addEventListener("input", (e) => {
    if (state.currentChat !== "global" && state.currentChat !== "group") { hideMentionDropdown(); return; }
    const val = input.value;
    const cursor = input.selectionStart;
    const before = val.slice(0, cursor);
    const match = before.match(/@([a-zA-Z0-9_]*)$/);
    if (!match) { hideMentionDropdown(); return; }

    const query = match[1].toLowerCase();
    const userMap = {};

    if (state.currentChat === "group" && state.currentGroupInfo) {
      for (const uid of state.currentGroupInfo.members || []) {
        if (uid === state.user?.uid) continue;
        userMap[uid] = { uid, displayName: null, photoURL: null };
      }
    } else {
      (state.lastGlobalMsgs || []).forEach(m => {
        if (m.uid && m.uid !== state.user?.uid) {
          userMap[m.uid] = { uid: m.uid, displayName: m.name, photoURL: m.photoURL };
        }
      });
    }

    let candidates = Object.values(userMap);
    if (!query || "semua".startsWith(query)) {
      candidates.unshift({ uid: "__all__", displayName: "Semua", username: "semua" });
    }
    if (query) {
      candidates = candidates.filter(u => u.uid === "__all__" || (u.username || "").toLowerCase().includes(query) || (u.displayName || "").toLowerCase().includes(query));
    }
    if (candidates.length === 0) { hideMentionDropdown(); return; }

    showMentionDropdown(candidates.slice(0, 8), input, (uid, name) => {
      const beforeCursor = input.value.slice(0, cursor);
      const afterCursor = input.value.slice(cursor);
      const replaced = beforeCursor.replace(/@([a-zA-Z0-9_]*)$/, "@" + name + " ");
      input.value = replaced + afterCursor;
      input.focus();
      input.setSelectionRange(replaced.length, replaced.length);
    });
  });

  input.addEventListener("blur", () => {
    setTimeout(hideMentionDropdown, 200);
  });
}

/* ============================================================
   SEND MESSAGE
   ============================================================ */
$("chat-input")?.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessageFromInput(); });
setupMentionInput();

$("chat-send")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); sendMessageFromInput(); });
$("chat-send")?.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); sendMessageFromInput(); }, { passive: false });

$("chat-input")?.addEventListener("input", () => {
  if (state.currentChat === "dm" && state.dmWithUid) {
    setTypingStatus(state.user.uid, state.dmWithUid, true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => setTypingStatus(state.user.uid, state.dmWithUid, false), 2000);
  }
});

async function sendMessageFromInput() {
  const input = $("chat-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text && !state.pendingAIImage) return;
  hideMentionDropdown();

  try {
    if (state.currentChat === "ai" && !state.pendingAIImage && isImageRequest(text)) {
      const prompt = extractImagePrompt(text);
      input.value = "";
      state.lastAiMsgs.push({ role: "user", text, time: Date.now() });
      renderAIMessages();
      const box = $("chat-messages");
      const loadingEl = document.createElement("div");
      loadingEl.className = "chat-msg other ai-msg";
      loadingEl.innerHTML = '<span class="msg-text">🎨 Sabar ya, lagi bikin gambar "<b>' + escapeHtml(prompt) + '</b>"...</span>';
      box.appendChild(loadingEl);
      box.scrollTop = box.scrollHeight;
      try {
        const result = await generateImage(prompt);
        loadingEl.remove();
        state.lastAiMsgs.push({ role: "ai", text: "🎨 Gambar untuk: \"" + prompt + "\"", imageUrl: result.url, time: Date.now() });
        renderAIMessages();
      } catch (err) {
        loadingEl.remove();
        state.lastAiMsgs.push({ role: "ai", text: "⚠️ Gagal bikin gambar: " + err.message, time: Date.now() });
        renderAIMessages();
      }
      return;
    }

    if (state.currentChat === "ai") {
      const img = state.pendingAIImage;
      input.value = ""; state.pendingAIImage = null; updateAIAttachPreview();
      await sendAIMessage(text, img);
    } else if (state.currentChat === "global") {
      input.value = "";
      const reply = state.replyingTo; state.replyingTo = null; updateReplyBanner();
      await sendGlobalMessage(state.user, { type: "text", text, replyTo: reply });
    } else if (state.currentChat === "dm" && state.dmWithUid) {
      input.value = "";
      const reply = state.replyingTo; state.replyingTo = null; updateReplyBanner();
      await setTypingStatus(state.user.uid, state.dmWithUid, false);
      await sendPrivateMessage(state.user, state.dmWithUid, { type: "text", text }, reply);
    } else if (state.currentChat === "group" && state.currentGroupId) {
      input.value = "";
      const reply = state.replyingTo; state.replyingTo = null; updateReplyBanner();
      await sendGroupMessage(state.user, state.currentGroupId, { type: "text", text }, reply);
    } else {
      showToast("Pilih tujuan chat terlebih dahulu!");
    }
  } catch (err) {
    showToast("Gagal kirim pesan");
    input.value = text;
  }
}

function updateReplyBanner() {
  const banner = $("reply-banner");
  if (!banner) return;
  if (state.replyingTo) {
    banner.classList.remove("hidden");
    banner.style.display = "flex";
    banner.innerHTML =
      '<div class="reply-info">' +
      '<div class="reply-label">Membalas ' + escapeHtml(state.replyingTo.name || "User") + '</div>' +
      '<div class="reply-text">' + escapeHtml(state.replyingTo.text || "Pesan") + '</div>' +
      '</div>' +
      '<button id="cancel-reply" class="modal-close" type="button">✕</button>';
    const cancelBtn = $("cancel-reply");
    if (cancelBtn) {
      cancelBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        state.replyingTo = null;
        updateReplyBanner();
      };
    }
  } else {
    banner.classList.add("hidden");
    banner.style.display = "none";
    banner.innerHTML = "";
  }
}

/* ============================================================
   AI CHAT
   ============================================================ */
async function sendAIMessage(text, imageBase64 = null) {
  if (state.isAILoading) return;
  state.isAILoading = true;
  state.lastAiMsgs.push({ role: "user", text, time: Date.now() });
  renderAIMessages();
  const box = $("chat-messages");
  if (!box) { state.isAILoading = false; return; }
  const aiEl = document.createElement("div");
  aiEl.className = "chat-msg other ai-msg";
  const streamId = "stream-" + Date.now();
  aiEl.innerHTML = '<span class="msg-text" id="' + streamId + '">...</span><span class="msg-meta-line"><span class="msg-time">' + formatTime(new Date()) + '</span></span>';
  box.appendChild(aiEl);
  box.scrollTop = box.scrollHeight;
  const streamEl = aiEl.querySelector("#" + streamId);
  let firstChunk = true, fullText = "";
  try {
    await sendToAI(text, (delta, full) => {
      if (firstChunk) { streamEl.textContent = ""; firstChunk = false; }
      streamEl.textContent = full;
      fullText = full;
      box.scrollTop = box.scrollHeight;
    }, imageBase64);
    state.lastAiMsgs.push({ role: "ai", text: fullText, time: Date.now() });
    renderAIMessages();
  } catch (err) {
    streamEl.textContent = "⚠️ " + err.message;
    streamEl.style.color = "var(--danger)";
    state.lastAiMsgs.push({ role: "ai", text: "⚠️ " + err.message, time: Date.now() });
  }
  state.isAILoading = false;
}

function updateAIAttachPreview() {
  const prev = $("ai-attach-preview");
  if (!prev) return;
  if (state.pendingAIImage) {
    prev.style.display = "flex";
    prev.innerHTML = '<span>📷 Gambar terlampir</span> <button id="remove-ai-img" style="background:none;border:none;color:red;cursor:pointer;margin-left:auto;">✕</button>';
    $("remove-ai-img").onclick = () => { state.pendingAIImage = null; updateAIAttachPreview(); };
  } else {
    prev.style.display = "none";
    prev.innerHTML = "";
  }
}

/* ============================================================
   GLOBAL TYPING
   ============================================================ */
function initGlobalTypingListener() {
  if (!state.user) return;
  if (globalTypingInterval) clearInterval(globalTypingInterval);
  globalTypingInterval = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const uid in state.globalTypingUsers) {
      if (now - state.globalTypingUsers[uid].timestamp > 5000) {
        delete state.globalTypingUsers[uid];
        changed = true;
      }
    }
    if (changed && state.currentChat === "global") updateGlobalTypingIndicator();
  }, 2000);
}

function updateGlobalTypingIndicator() {
  const statusEl = $("chat-status");
  if (!statusEl || state.currentChat !== "global") return;
  const users = Object.values(state.globalTypingUsers).filter(u => u.uid !== state.user?.uid);
  if (users.length === 0) statusEl.textContent = "Publik · Semua user";
  else if (users.length === 1) statusEl.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span> ' + escapeHtml(users[0].name) + ' mengetik...';
  else statusEl.textContent = users.length + " orang mengetik...";
}

/* ============================================================
   STICKERS
   ============================================================ */
function renderStickerPicker(category) {
  const grid = $("sticker-picker-grid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const s of (STICKERS[category] || [])) {
    const cell = document.createElement("div");
    cell.className = "sticker-pick-cell";
    cell.textContent = s;
    cell.addEventListener("click", () => {
      sendSticker(s);
      $("sticker-picker")?.classList.add("hidden");
    });
    grid.appendChild(cell);
  }
}

async function sendSticker(sticker) {
  try {
    if (state.currentChat === "global") await sendGlobalMessage(state.user, { type: "sticker", sticker });
    else if (state.currentChat === "dm" && state.dmWithUid) await sendPrivateMessage(state.user, state.dmWithUid, { type: "sticker", sticker });
    else if (state.currentChat === "group" && state.currentGroupId) await sendGroupMessage(state.user, state.currentGroupId, { type: "sticker", sticker });
    else if (state.currentChat === "ai") await sendAIMessage(sticker);
  } catch (err) { showToast("Gagal kirim stiker"); }
}

$$(".sticker-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".sticker-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    renderStickerPicker(tab.dataset.tab);
  });
});

$("sticker-picker-close")?.addEventListener("click", () => $("sticker-picker")?.classList.add("hidden"));
$("chat-emoji")?.addEventListener("click", () => {
  renderStickerPicker("emoji");
  $("sticker-picker")?.classList.remove("hidden");
});

/* ============================================================
   ATTACHMENT
   ============================================================ */
$("chat-attach")?.addEventListener("click", () => $("attachment-popup")?.classList.remove("hidden"));
$("attachment-close")?.addEventListener("click", () => $("attachment-popup")?.classList.add("hidden"));

$$(".att-item").forEach(item => {
  item.addEventListener("click", async () => {
    const type = item.dataset.type;
    $("attachment-popup")?.classList.add("hidden");
    if (type === "location") {
      if (!navigator.geolocation) { showToast("GPS tidak didukung"); return; }
      showToast("Mengambil lokasi GPS...");
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const payload = { type: "location", lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (state.currentChat === "global") await sendGlobalMessage(state.user, payload);
        else if (state.currentChat === "dm" && state.dmWithUid) await sendPrivateMessage(state.user, state.dmWithUid, payload);
        else if (state.currentChat === "group" && state.currentGroupId) await sendGroupMessage(state.user, state.currentGroupId, payload);
        showToast("Live location terkirim 📍");
      }, () => showToast("Gagal mengambil lokasi"));
    } else if (type === "contact") {
      const contactName = prompt("Nama kontak:");
      const contactUid = prompt("UID kontak:");
      if (!contactName || !contactUid) return;
      const payload = { type: "contact", contactName, contactUid };
      if (state.currentChat === "global") await sendGlobalMessage(state.user, payload);
      else if (state.currentChat === "dm" && state.dmWithUid) await sendPrivateMessage(state.user, state.dmWithUid, payload);
      else if (state.currentChat === "group" && state.currentGroupId) await sendGroupMessage(state.user, state.currentGroupId, payload);
      showToast("Kontak terkirim 📇");
    } else if (type === "ai" && state.currentChat === "ai") {
      const fi = document.createElement("input"); fi.type = "file"; fi.accept = "image/*";
      fi.onchange = async (ev) => {
        state.pendingAIImage = await compressImage(ev.target.files[0], 600);
        updateAIAttachPreview();
        showToast("Gambar siap dianalisis AI 📷");
      };
      fi.click();
    } else {
      showToast("Fitur " + type + " segera hadir");
    }
  });
});

$("chat-gif")?.addEventListener("click", () => showToast("GIF segera hadir"));

/* ============================================================
   GLOBAL LISTENER
   ============================================================ */
function setupChatListeners() {
  if (state.globalUnsub) state.globalUnsub();
  state.globalUnsub = listenGlobalMessages((msgs) => {
    state.lastGlobalMsgs = msgs || [];
    const preview = $("global-preview");
    if (preview && state.lastGlobalMsgs.length > 0) {
      const last = state.lastGlobalMsgs[state.lastGlobalMsgs.length - 1];
      preview.textContent = (last.name || "Anonim") + ": " + (last.text || (last.sticker ? "Stiker" : ""));
    }
    if (state.currentChat === "global") renderGlobalMessages(state.lastGlobalMsgs);
  });
}

/* ============================================================
   INCOMING CHAT LISTENER
   ============================================================ */
function initIncomingChatListener() {
  if (!state.user) return;
  if (state.incomingDmUnsub) state.incomingDmUnsub();
  const q = query(
    collection(db, "chats_dm"),
    where("participants", "array-contains", state.user.uid)
  );
  state.incomingDmUnsub = onSnapshot(q, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== "added" && change.type !== "modified") continue;
      const roomId = change.doc.id;
      if (!roomId || !roomId.includes(state.user.uid)) continue;
      const uids = roomId.split("_");
      const senderUid = uids.find(u => u !== state.user.uid);
      if (!senderUid || senderUid === state.user.uid) continue;
      const data = change.doc.data();
      const lastMsgUid = data.lastMessageUid;
      const lastTime = data.lastTime?.toDate?.()?.getTime() || 0;
      if (lastMsgUid === state.user.uid) continue;
      if (Date.now() - lastTime > 10000) continue;
      if (state.mutedChats.includes(senderUid)) { playNotifSound(); continue; }
      const isCurrentlyOpen = (state.currentChat === "dm" && state.dmWithUid === senderUid);
      const unreadCount = data.unread?.[state.user.uid] || 0;
      const targetUser = await getUserProfileByUid(senderUid).catch(() => null);
      if (!targetUser) continue;
      addPrivateChatToList(targetUser, isCurrentlyOpen ? 0 : unreadCount);
      playNotifSound();
      updateChatBadges();
    }
  }, (err) => console.warn("[IncomingChat] listener error:", err?.message || err));
}

/* ============================================================
   GROUPS LISTENER
   ============================================================ */
function initGroupsListener() {
  if (!state.user) return;
  if (state.groupsUnsub) state.groupsUnsub();
  state.groupsUnsub = onSnapshot(doc(db, "users", state.user.uid), async (snap) => {
    if (!snap.exists()) return;
    const groupIds = snap.data().groups || [];
    const groups = [];
    for (const gid of groupIds) {
      try {
        const gSnap = await getDoc(doc(db, "groups", gid));
        if (gSnap.exists()) groups.push({ id: gid, ...gSnap.data() });
      } catch (e) { /* skip */ }
    }
    groups.sort((a, b) => (b.lastTime?.seconds || 0) - (a.lastTime?.seconds || 0));
    state.userGroups = groups;
    renderGroupsList();
    if (state.currentChat === "group" && state.currentGroupId) {
      const current = groups.find(g => g.id === state.currentGroupId);
      if (current) {
        state.currentGroupInfo = current;
        const statusEl = $("chat-status");
        if (statusEl) statusEl.textContent = (current.members || []).length + " anggota";
      }
    }
  }, (err) => console.warn("[initGroupsListener]", err?.message || err));
}

function renderGroupsList() {
  let container = $("groups-list-tk");
  if (!container) {
    const privateList = $("private-list-tk");
    if (!privateList) return;
    const parent = privateList.parentElement;
    const label = document.createElement("div");
    label.className = "tk-section-label";
    label.textContent = "Grup";
    parent.insertBefore(label, privateList);

    container = document.createElement("div");
    container.id = "groups-list-tk";
    container.className = "tk-private-list";
    parent.insertBefore(container, privateList);
  }

  container.innerHTML = "";
  if (state.userGroups.length === 0) {
    container.innerHTML = '';
    applyChatFilter();
    return;
  }

  for (const g of state.userGroups) {
    const el = document.createElement("div");
    el.className = "tk-chat-item";
    el.dataset.gid = g.id;
    const initial = (g.name || "G").charAt(0).toUpperCase();
    const avatarStyle = g.photoURL && g.photoURL.length > 10 ? "background-image:url(" + g.photoURL + ")" : "";
    const unreadCount = g.unread?.[state.user.uid] || 0;
    const badgeHtml = unreadCount > 0 ? '<div class="unread-badge">' + (unreadCount > 99 ? "99+" : unreadCount) + '</div>' : '';

    el.innerHTML =
      '<div class="tk-avatar" style="background-color:#10B981;color:#fff;' + avatarStyle + '">' +
        '<span>' + (avatarStyle ? "" : initial) + '</span>' +
      '</div>' +
      '<div class="tk-chat-info">' +
        '<div class="tk-chat-name">' + escapeHtml(g.name || "Grup") + '</div>' +
        '<div class="tk-chat-preview">' + escapeHtml(g.lastMessageName || "") + ': ' + escapeHtml(g.lastMessage || "") + '</div>' +
      '</div>' +
      '<div class="tk-chat-meta">' + badgeHtml + '</div>';

    container.appendChild(el);
  }
  applyChatFilter();
}

/* ============================================================
   NEW CHAT MODAL
   ============================================================ */
$("new-chat-cancel")?.addEventListener("click", () => $("new-chat-modal")?.classList.add("hidden"));

$("new-chat-start")?.addEventListener("click", async () => {
  const qStr = $("new-chat-email")?.value.trim();
  if (!qStr) return;
  const target = await findUserByNumericUidOrEmail(qStr);
  if (!target) { showToast("User tidak ditemukan"); return; }
  if (target.uid === state.user.uid) { showToast("Nggak bisa chat diri sendiri"); return; }
  $("new-chat-modal")?.classList.add("hidden");
  if ($("new-chat-email")) $("new-chat-email").value = "";
  addPrivateChatToList(target, 0);
  openChatDetail("dm", target);
});

/* ============================================================
   CREATE GROUP
   ============================================================ */
function openCreateGroupModal() {
  const friendUids = frFriends.map(f => f.otherUid);
  let html = '<input type="text" id="group-name-input" placeholder="Nama grup" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:10px;background:var(--bg-soft);color:var(--text);font-size:14px;box-sizing:border-box;margin-bottom:12px;" />' +
    '<div style="font-size:12px;font-weight:900;color:var(--muted);margin-bottom:6px;">Pilih Anggota:</div>' +
    '<div id="group-member-list" style="max-height:40vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"></div>';

  showInfo("👥 Buat Grup", html, "Buat Grup", async () => {
    const name = $("group-name-input")?.value.trim();
    if (!name || name.length < 2) { showToast("Nama grup minimal 2 huruf"); return; }
    const checked = Array.from(document.querySelectorAll(".group-member-check:checked")).map(c => c.dataset.uid);
    if (checked.length === 0) { showToast("Pilih minimal 1 anggota"); return; }
    try {
      const gid = await createGroup(state.user, name, checked);
      showToast("Grup dibuat ✅");
      $("info-modal")?.classList.add("hidden");
      setTimeout(() => openChatDetail("group", null, gid), 500);
    } catch (e) {
      showToast("Gagal buat grup: " + e.message);
    }
  });

  setTimeout(async () => {
    const list = $("group-member-list");
    if (!list) return;
    if (friendUids.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:10px;">Belum ada teman. Tambah teman dulu.</div>';
      return;
    }
    const profiles = await getUsersProfiles(friendUids);
    list.innerHTML = "";
    for (const p of profiles) {
      const name = p.displayName || p.username || "User";
      const initial = name.charAt(0).toUpperCase();
      const hasAvatar = p.photoURL && p.photoURL.length > 10;
      const el = document.createElement("label");
      el.style.cssText = "display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer;";
      el.innerHTML =
        '<input type="checkbox" class="group-member-check" data-uid="' + p.uid + '" style="width:18px;height:18px;" />' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;' + (hasAvatar ? "background-image:url(" + p.photoURL + ");" : "") + '">' + (hasAvatar ? "" : initial) + '</div>' +
        '<div style="font-weight:800;">' + escapeHtml(name) + '</div>';
      list.appendChild(el);
    }
  }, 100);
}

/* ============================================================
   GROUP INFO
   ============================================================ */
async function refreshGroupInfo() {
  if (!state.currentGroupId) return;
  try {
    const gSnap = await getDoc(doc(db, "groups", state.currentGroupId));
    if (!gSnap.exists()) return;
    state.currentGroupInfo = { id: state.currentGroupId, ...gSnap.data() };
    const statusEl = $("chat-status");
    if (statusEl && state.currentChat === "group") {
      statusEl.textContent = (state.currentGroupInfo.members || []).length + " anggota";
    }
    const nameEl = $("chat-name");
    if (nameEl) nameEl.textContent = state.currentGroupInfo.name || "Grup";
  } catch (e) { console.warn("[refreshGroupInfo]", e); }
}

function openGroupInfo() {
  if (!state.currentGroupInfo) { showToast("Info grup gak ada"); return; }
  const g = state.currentGroupInfo;
  const isAdmin = (g.admins || []).includes(state.user.uid);
  const memberCount = (g.members || []).length;

  (async () => {
    const profiles = await getUsersProfiles(g.members || []);
    let membersHtml = "";
    for (const p of profiles) {
      const isMe = p.uid === state.user.uid;
      const isTargetAdmin = (g.admins || []).includes(p.uid);
      const name = p.displayName || p.username || "User";
      const initial = name.charAt(0).toUpperCase();
      const hasAvatar = p.photoURL && p.photoURL.length > 10;
      membersHtml += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">' +
        '<div style="width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;' + (hasAvatar ? "background-image:url(" + p.photoURL + ");" : "") + '">' + (hasAvatar ? "" : initial) + '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-weight:900;">' + escapeHtml(name) + (isMe ? " (Kamu)" : "") + '</div>' +
          '<div style="font-size:11px;color:var(--muted);">' + (isTargetAdmin ? "👑 Admin" : "Anggota") + '</div>' +
        '</div>' +
        (isAdmin && !isMe ? '<button class="mbr-action-btn" data-uid="' + p.uid + '" data-act="promote" style="padding:6px 10px;font-size:11px;background:var(--bg-soft);border:2px solid var(--border);border-radius:6px;font-weight:800;cursor:pointer;">' + (isTargetAdmin ? "Demote" : "Promote") + '</button>' : '') +
        (isAdmin && !isMe ? '<button class="mbr-action-btn" data-uid="' + p.uid + '" data-act="remove" style="padding:6px 10px;font-size:11px;background:var(--danger);color:#fff;border:none;border-radius:6px;font-weight:800;cursor:pointer;">Keluarkan</button>' : '') +
      '</div>';
    }

    const html =
      '<div style="text-align:center;padding:8px 0 16px;">' +
        '<div style="width:80px;height:80px;border-radius:50%;background:#10B981;color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;margin:0 auto;">👥</div>' +
        '<div style="font-weight:900;font-size:18px;margin-top:12px;">' + escapeHtml(g.name) + '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:4px;">' + memberCount + ' anggota</div>' +
      '</div>' +
      (isAdmin ? '<button id="grp-rename-btn" style="width:100%;padding:10px;background:var(--bg-soft);border:2px solid var(--border);border-radius:8px;font-weight:900;cursor:pointer;margin-bottom:12px;">✏️ Ubah Nama Grup</button>' : '') +
      (isAdmin ? '<button id="grp-add-btn" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:900;cursor:pointer;margin-bottom:12px;">➕ Tambah Anggota</button>' : '') +
      '<div style="font-size:12px;font-weight:900;color:var(--muted);margin-bottom:6px;">ANGGOTA</div>' +
      '<div style="max-height:40vh;overflow-y:auto;">' + membersHtml + '</div>' +
      '<button id="grp-leave-btn" style="width:100%;padding:12px;background:var(--danger);color:#fff;border:none;border-radius:8px;font-weight:900;cursor:pointer;margin-top:16px;">🚪 Keluar Grup</button>';

    showInfo("👥 Info Grup", html);

    setTimeout(() => {
      const renameBtn = $("grp-rename-btn");
      if (renameBtn) renameBtn.onclick = async () => {
        const newName = prompt("Nama grup baru:", g.name);
        if (!newName || newName === g.name) return;
        try {
          await updateGroupName(g.id, newName.trim(), state.user.uid);
          showToast("Nama diubah ✅");
          $("info-modal")?.classList.add("hidden");
        } catch (e) { showToast("Gagal: " + e.message); }
      };

      const addBtn = $("grp-add-btn");
      if (addBtn) addBtn.onclick = () => {
        $("info-modal")?.classList.add("hidden");
        setTimeout(() => openAddMemberModal(), 200);
      };

      document.querySelectorAll(".mbr-action-btn").forEach(btn => {
        btn.onclick = async () => {
          const uid = btn.dataset.uid;
          const act = btn.dataset.act;
          try {
            if (act === "promote") {
              const isTargetAdmin = (g.admins || []).includes(uid);
              if (isTargetAdmin) await demoteGroupAdmin(g.id, uid, state.user.uid);
              else await promoteGroupAdmin(g.id, uid, state.user.uid);
            } else if (act === "remove") {
              if (!confirm("Keluarkan anggota ini?")) return;
              await removeGroupMember(g.id, uid, state.user.uid);
            }
            showToast("Berhasil ✅");
            await refreshGroupInfo();
            $("info-modal")?.classList.add("hidden");
            setTimeout(() => openGroupInfo(), 200);
          } catch (e) { showToast("Gagal: " + e.message); }
        };
      });

      const leaveBtn = $("grp-leave-btn");
      if (leaveBtn) leaveBtn.onclick = async () => {
        if (!confirm("Yakin keluar dari grup ini?")) return;
        try {
          await leaveGroup(g.id, state.user.uid);
          showToast("Keluar grup ✅");
          $("info-modal")?.classList.add("hidden");
          $("chat-back")?.click();
        } catch (e) { showToast("Gagal: " + e.message); }
      };
    }, 100);
  })();
}

function openAddMemberModal() {
  if (!state.currentGroupInfo) return;
  const g = state.currentGroupInfo;
  const currentMembers = g.members || [];
  const friendUids = frFriends.map(f => f.otherUid).filter(uid => !currentMembers.includes(uid));

  let html = '<div id="add-member-list" style="max-height:50vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"></div>';

  showInfo("➕ Tambah Anggota", html, "Tambah", async () => {
    const checked = Array.from(document.querySelectorAll(".add-member-check:checked")).map(c => c.dataset.uid);
    if (checked.length === 0) { showToast("Pilih minimal 1"); return; }
    try {
      for (const uid of checked) {
        await addGroupMember(g.id, uid, state.user.uid);
      }
      showToast(checked.length + " anggota ditambahkan ✅");
      $("info-modal")?.classList.add("hidden");
    } catch (e) { showToast("Gagal: " + e.message); }
  });

  setTimeout(async () => {
    const list = $("add-member-list");
    if (!list) return;
    if (friendUids.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">Semua teman lo udah ada di grup ini.</div>';
      return;
    }
    const profiles = await getUsersProfiles(friendUids);
    list.innerHTML = "";
    for (const p of profiles) {
      const name = p.displayName || p.username || "User";
      const initial = name.charAt(0).toUpperCase();
      const hasAvatar = p.photoURL && p.photoURL.length > 10;
      const el = document.createElement("label");
      el.style.cssText = "display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer;";
      el.innerHTML =
        '<input type="checkbox" class="add-member-check" data-uid="' + p.uid + '" style="width:18px;height:18px;" />' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;' + (hasAvatar ? "background-image:url(" + p.photoURL + ");" : "") + '">' + (hasAvatar ? "" : initial) + '</div>' +
        '<div style="font-weight:800;">' + escapeHtml(name) + '</div>';
      list.appendChild(el);
    }
  }, 100);
}

/* ============================================================
   VOICE RECORDER
   ============================================================ */
const btnRecord = $("btn-record");
const btnStopRecord = $("btn-stop-record");
const btnCancelVoice = $("btn-cancel-voice");
const btnSendVoice = $("btn-send-voice");
const recordingUI = $("recording-ui");
const voicePreview = $("voice-preview");
const recordingTimer = $("recording-timer");
const previewDuration = $("preview-duration");

btnRecord?.addEventListener("click", async () => {
  try {
    const success = await startRecording();
    if (success !== false) {
      recordingUI?.classList.remove("hidden");
      btnRecord.classList.add("hidden");
    }
  } catch (err) {}
});

window.addEventListener("recordingTick", (e) => {
  if (recordingTimer) {
    const s = e.detail;
    recordingTimer.textContent = Math.floor(s / 60) + ":" + (s % 60).toString().padStart(2, "0");
  }
});

btnStopRecord?.addEventListener("click", async () => {
  const result = await stopRecording();
  recordingUI?.classList.add("hidden");
  if (result) {
    currentAudioData = result;
    if (previewDuration) previewDuration.textContent = Math.floor(result.duration / 60) + ":" + (result.duration % 60).toString().padStart(2, "0");
    voicePreview?.classList.remove("hidden");
    btnRecord.classList.add("hidden");
  }
});

btnCancelVoice?.addEventListener("click", () => {
  currentAudioData = null;
  voicePreview?.classList.add("hidden");
  cancelRecording();
  btnRecord?.classList.remove("hidden");
});

btnSendVoice?.addEventListener("click", async () => {
  if (!currentAudioData) { showToast("Belum ada rekaman"); return; }
  const base64Size = currentAudioData.base64.length;
  if (base64Size > 700000) {
    showToast("Voice note terlalu panjang (max ~30 detik)");
    currentAudioData = null;
    voicePreview?.classList.add("hidden");
    btnRecord?.classList.remove("hidden");
    return;
  }
  try {
    const payload = { type: "voice", audioBase64: currentAudioData.base64, duration: currentAudioData.duration };
    if (state.currentChat === "global") { await sendGlobalMessage(state.user, payload); }
    else if (state.currentChat === "dm" && state.dmWithUid) { await sendPrivateMessage(state.user, state.dmWithUid, payload); }
    else if (state.currentChat === "group" && state.currentGroupId) { await sendGroupMessage(state.user, state.currentGroupId, payload); }
    else if (state.currentChat === "ai") {
      showToast("🎤 Transkripsi suara...");
      try {
        const transcript = await transcribeAudio(currentAudioData.base64);
        if (!transcript) { showToast("Gagal transkripsi"); return; }
        currentAudioData = null; voicePreview?.classList.add("hidden"); btnRecord?.classList.remove("hidden");
        state.lastAiMsgs.push({ role: "user", text: "🎤 " + transcript, time: Date.now() });
        renderAIMessages();
        await sendAIMessage(transcript);
      } catch (err) { showToast("Gagal transkripsi: " + err.message); }
      return;
    } else { showToast("Pilih chat dulu"); return; }
    currentAudioData = null; voicePreview?.classList.add("hidden"); btnRecord?.classList.remove("hidden");
    showToast("Voice note terkirim ✅");
  } catch (err) { showToast("Gagal kirim voice note: " + err.message); }
});

document.addEventListener("click", function(e) {
  if (e.target.closest("#audio-player-close")) {
    e.preventDefault();
    const audioEl = $("audio-player");
    if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
    $("audio-player-modal")?.classList.add("hidden");
    document.querySelectorAll(".voice-play-btn").forEach(b => {
      b.textContent = "▶";
      b.classList.remove("playing");
    });
  }
});

/* ============================================================
   FRIEND SYSTEM
   ============================================================ */
function initFriends() {
  if (!state.user) { console.warn("[initFriends] no user"); return; }
  if (frUnsub) frUnsub();
  frUnsub = listenFriendships(state.user.uid, (friends, requests, sent) => {
    console.log("[friends listener]", { friends: friends.length, requests: requests.length, sent: sent.length });
    frFriends = friends || [];
    frRequests = requests || [];
    frSentRequests = sent || [];
    renderFriendsList();
    renderRequestsList();
    updateFriendBadges();
    updateChatBadges();
  });
}

async function renderFriendsList() {
  const list = $("fr-friends-list");
  if (!list) return;
  if (frFriends.length === 0) {
    list.innerHTML = '<div class="tk-empty"><div class="tk-empty-icon">👥</div><p>Belum ada teman</p><span>Tap <b>+</b> untuk tambah teman</span></div>';
    return;
  }
  const uids = frFriends.map(f => f.otherUid);
  let profiles = [];
  try { profiles = await getUsersProfiles(uids); } catch (e) {}
  const map = {};
  profiles.forEach(p => map[p.uid] = p);
  list.innerHTML = "";
  for (const fr of frFriends) {
    const p = map[fr.otherUid];
    if (!p) continue;
    const name = p.displayName || p.username || "User";
    const initial = name.charAt(0).toUpperCase();
    const avatarStyle = p.photoURL && p.photoURL.length > 10 ? "background-image:url(" + p.photoURL + ");" : "";
    const isOnline = p.isOnline === true && p.lastSeen && (Date.now() - (p.lastSeen.toDate?.().getTime() || 0)) < 60000;
    const el = document.createElement("div");
    el.className = "fr-item";
    el.innerHTML = '<div class="fr-avatar" style="' + avatarStyle + '">' + (p.photoURL && p.photoURL.length > 10 ? "" : initial) + '<div class="' + (isOnline ? "fr-online-dot" : "fr-offline-dot") + '"></div></div>' +
      '<div class="fr-info"><div class="fr-name">' + escapeHtml(name) + '</div><div class="fr-sub">@' + (p.username || "user") + ' · ' + (isOnline ? "Online" : "Offline") + '</div></div>' +
      '<button class="fr-btn fr-btn-primary" data-action="chat">Chat</button>' +
      '<button class="fr-btn fr-btn-danger" data-action="remove">Hapus</button>';
    el.querySelector('[data-action="chat"]').onclick = (e) => { e.stopPropagation(); openChatDetail("dm", p); };
    el.querySelector('[data-action="remove"]').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Hapus " + name + " dari teman?")) return;
      const ok = await removeFriend(state.user.uid, p.uid);
      showToast(ok ? "Teman dihapus" : "Gagal hapus");
      if (ok) {
        const chatEl = document.querySelector('#private-list-tk [data-uid="' + p.uid + '"]');
        chatEl?.remove();
        updateChatBadges();
      }
    };
    el.onclick = () => openChatDetail("dm", p);
    list.appendChild(el);
  }
}

async function renderRequestsList() {
  const list = $("fr-requests-list");
  if (!list) { console.warn("[renderRequestsList] #fr-requests-list NOT FOUND"); return; }
  if (frRequests.length === 0 && frSentRequests.length === 0) {
    list.innerHTML = '<div class="tk-empty"><div class="tk-empty-icon">📨</div><p>Belum ada request</p><span>Request dari user lain muncul di sini</span></div>';
    return;
  }
  let html = "";
  if (frRequests.length > 0) {
    html += '<div class="tk-section-label">Request Masuk</div>';
    for (const req of frRequests) {
      const p = await getUserProfileByUid(req.otherUid).catch(() => null);
      if (!p) continue;
      const name = p.displayName || p.username || "User";
      const initial = name.charAt(0).toUpperCase();
      const avatarStyle = p.photoURL && p.photoURL.length > 10 ? "background-image:url(" + p.photoURL + ");" : "";
      html += '<div class="fr-item" data-uid="' + p.uid + '"><div class="fr-avatar" style="' + avatarStyle + '">' + (p.photoURL ? "" : initial) + '</div><div class="fr-info"><div class="fr-name">' + escapeHtml(name) + '</div><div class="fr-sub">@' + (p.username || "user") + '</div></div><button class="fr-btn fr-btn-primary" data-action="accept">✓</button><button class="fr-btn fr-btn-danger" data-action="reject">✕</button></div>';
    }
  }
  if (frSentRequests.length > 0) {
    html += '<div class="tk-section-label" style="margin-top:16px;">Request Terkirim</div>';
    for (const req of frSentRequests) {
      const p = await getUserProfileByUid(req.otherUid).catch(() => null);
      if (!p) continue;
      const name = p.displayName || p.username || "User";
      const initial = name.charAt(0).toUpperCase();
      const avatarStyle = p.photoURL && p.photoURL.length > 10 ? "background-image:url(" + p.photoURL + ");" : "";
      html += '<div class="fr-item" data-uid="' + p.uid + '"><div class="fr-avatar" style="' + avatarStyle + '">' + (p.photoURL ? "" : initial) + '</div><div class="fr-info"><div class="fr-name">' + escapeHtml(name) + '</div><div class="fr-sub">Menunggu konfirmasi...</div></div><button class="fr-btn fr-btn-ghost" data-action="cancel">Batal</button></div>';
    }
  }
  list.innerHTML = html;

  list.querySelectorAll('[data-action="accept"]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const item = btn.closest(".fr-item");
      const fromUid = item?.dataset.uid;
      const toUid = state.user.uid;
      if (!fromUid || !toUid) { showToast("UID gak valid"); return; }
      btn.disabled = true;
      btn.textContent = "...";
      try {
        const ok = await acceptFriendRequest(fromUid, toUid);
        showToast(ok ? "Teman ditambah ✅" : "Gagal");
      } catch (err) {
        showToast("Gagal: " + (err.message || "unknown"));
      } finally {
        btn.disabled = false;
        btn.textContent = "✓";
      }
    };
  });
  list.querySelectorAll('[data-action="reject"]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const uid = btn.closest(".fr-item").dataset.uid;
      await rejectFriendRequest(uid, state.user.uid);
      showToast("Request ditolak");
    };
  });
  list.querySelectorAll('[data-action="cancel"]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const uid = btn.closest(".fr-item").dataset.uid;
      await removeFriend(state.user.uid, uid);
      showToast("Dibatalkan");
    };
  });
}

function updateFriendBadges() {
  const badge = $("fr-requests-badge");
  if (!badge) return;
  if (frRequests.length > 0) { badge.textContent = frRequests.length; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");
}

$$(".fr-subtab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".fr-subtab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    frSubTab = tab.dataset.fr;
    $$(".fr-panel").forEach(p => p.classList.remove("active"));
    const target = document.querySelector('.fr-panel[data-fr-panel="' + frSubTab + '"]');
    if (target) target.classList.add("active");
  });
});

$("btn-add-friend")?.addEventListener("click", () => {
  $("fr-add-modal")?.classList.remove("hidden");
  if ($("fr-add-input")) $("fr-add-input").value = "";
  if ($("fr-add-result")) $("fr-add-result").innerHTML = "";
  $("fr-add-input")?.focus();
});
$("fr-add-close")?.addEventListener("click", () => $("fr-add-modal")?.classList.add("hidden"));
$("fr-add-search")?.addEventListener("click", async () => {
  const text = $("fr-add-input").value.trim();
  if (!text) { showToast("Masukkan UID atau email"); return; }
  const btn = $("fr-add-search");
  btn.disabled = true; btn.textContent = "Mencari...";
  $("fr-add-result").innerHTML = "";
  const results = await searchUsers(text, state.user.uid, 10);
  btn.disabled = false; btn.textContent = "Cari User";
  if (results.length === 0) { $("fr-add-result").innerHTML = '<div class="fr-sub" style="text-align:center;padding:20px;">User tidak ditemukan</div>'; return; }
  for (const p of results) {
    const name = p.displayName || p.username || "User";
    const initial = name.charAt(0).toUpperCase();
    const avatarStyle = p.photoURL && p.photoURL.length > 10 ? "background-image:url(" + p.photoURL + ");" : "";
    const el = document.createElement("div");
    el.className = "fr-search-result";
    el.innerHTML = '<div class="fr-avatar" style="' + avatarStyle + '">' + (p.photoURL ? "" : initial) + '</div><div class="fr-info"><div class="fr-name">' + escapeHtml(name) + '</div><div class="fr-sub">@' + (p.username || "user") + '</div></div><button class="fr-btn fr-btn-primary" data-action="add">+ Add</button>';
    el.querySelector('[data-action="add"]').onclick = async (e) => {
      e.stopPropagation();
      const b = e.target; b.disabled = true; b.textContent = "...";
      const result = await sendFriendRequest(state.user.uid, p.uid);
      const msgs = { sent: "Request terkirim ✅", already_friends: "Kalian sudah teman", already_sent: "Sudah pernah minta", auto_accepted: "Kalian sekarang teman ✅", self: "Nggak bisa add diri sendiri", error: "Gagal kirim request" };
      showToast(msgs[result] || "Selesai");
      if (result === "sent" || result === "already_sent") b.textContent = "Terkirim";
      else if (result === "auto_accepted" || result === "already_friends") b.textContent = "Teman ✓";
      else { b.disabled = false; b.textContent = "+ Add"; }
    };
    $("fr-add-result").appendChild(el);
  }
});
$("fr-add-input")?.addEventListener("keypress", (e) => { if (e.key === "Enter") $("fr-add-search")?.click(); });

$("fr-search-input")?.addEventListener("input", (e) => {
  clearTimeout(frSearchTimer);
  const text = e.target.value.trim();
  if (!text) { $("fr-search-results").innerHTML = ""; return; }
  frSearchTimer = setTimeout(async () => {
    const results = await searchUsers(text, state.user.uid, 10);
    const container = $("fr-search-results");
    container.innerHTML = "";
    if (results.length === 0) { container.innerHTML = '<div class="fr-sub" style="text-align:center;padding:20px;">User tidak ditemukan</div>'; return; }
    for (const p of results) {
      const name = p.displayName || p.username || "User";
      const initial = name.charAt(0).toUpperCase();
      const avatarStyle = p.photoURL && p.photoURL.length > 10 ? "background-image:url(" + p.photoURL + ");" : "";
      const el = document.createElement("div");
      el.className = "fr-search-result";
      el.innerHTML = '<div class="fr-avatar" style="' + avatarStyle + '">' + (p.photoURL ? "" : initial) + '</div><div class="fr-info"><div class="fr-name">' + escapeHtml(name) + '</div><div class="fr-sub">@' + (p.username || "user") + '</div></div><button class="fr-btn fr-btn-primary" data-action="add">+ Add</button>';
      el.querySelector('[data-action="add"]').onclick = async (e) => {
        e.stopPropagation();
        const b = e.target; b.disabled = true; b.textContent = "...";
        const result = await sendFriendRequest(state.user.uid, p.uid);
        if (result === "sent" || result === "already_sent") b.textContent = "Terkirim";
        else if (result === "auto_accepted" || result === "already_friends") b.textContent = "Teman ✓";
        else { b.disabled = false; b.textContent = "+ Add"; }
        showToast(result);
      };
      container.appendChild(el);
    }
  }, 400);
});

/* ============================================================
   PROFILE FUNCS
   ============================================================ */
async function editNama() {
  const current = state.profile?.displayName || "";
  const val = prompt("Nama baru:", current);
  if (val && val.trim() && val.trim() !== current) {
    try {
      await updateUserProfile(state.user, { displayName: val.trim() });
      state.profile = await getUserProfile(state.user.uid);
      updateProfileUI();
      showToast("Nama diubah ✅");
    } catch (e) { showToast("Gagal: " + e.message); }
  }
}

async function editBio() {
  const current = state.profile?.bio || "";
  const val = prompt("Bio baru:", current);
  if (val !== null && val.trim() !== current) {
    try {
      await updateUserProfile(state.user, { bio: val.trim() });
      state.profile = await getUserProfile(state.user.uid);
      updateProfileUI();
      showToast("Bio diubah ✅");
    } catch (e) { showToast("Gagal: " + e.message); }
  }
}

async function editUsername() {
  const current = state.profile?.username || "";
  const val = prompt("Username baru (tanpa @):", current);
  if (val && val.trim() && val.trim() !== current) {
    try {
      const cleanUsername = val.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      await updateUserProfile(state.user, { username: cleanUsername });
      state.profile = await getUserProfile(state.user.uid);
      updateProfileUI();
      showToast("Username diubah ✅");
    } catch (e) { showToast("Gagal: " + e.message); }
  }
}

function copyUID() {
  const uid = state.profile?.numericUid || state.user?.uid || "";
  if (!uid) { showToast("UID ga ada"); return; }
  if (navigator.clipboard) navigator.clipboard.writeText(uid).then(() => showToast("Disalin: " + uid)).catch(() => prompt("UID:", uid));
  else prompt("UID:", uid);
}

async function logout() {
  if (!confirm("Yakin mau keluar?")) return;
  try {
    await setOffline(state.user.uid).catch(() => {});
    await logoutUser();
    showToast("Keluar akun ✅");
  } catch (e) { showToast("Gagal logout: " + e.message); }
}

/* ============================================================
   PROFILE MODAL
   ============================================================ */
function openProfileModal() {
  const p = state.profile || {};
  if ($("edit-name")) $("edit-name").value = p.displayName || "";
  if ($("edit-bio")) $("edit-bio").value = p.bio || "";
  const preview = $("edit-avatar-preview");
  const letter = $("edit-avatar-letter");
  if (preview && letter) {
    if (p.photoURL && p.photoURL.length > 10) {
      preview.style.setProperty("background-image", 'url("' + p.photoURL + '")', "important");
      letter.style.display = "none";
    } else {
      preview.style.removeProperty("background-image");
      letter.style.display = "block";
      letter.textContent = (p.displayName || "U").charAt(0).toUpperCase();
    }
  }
  const banner = $("edit-banner-preview");
  if (banner) {
    if (p.bannerURL && p.bannerURL.length > 10) {
      banner.style.setProperty("background-image", 'url("' + p.bannerURL + '")', "important");
    } else {
      banner.style.removeProperty("background-image");
    }
  }
  $("profile-modal")?.classList.remove("hidden");
}

$("btn-edit-profile-header")?.addEventListener("click", openProfileModal);
$("btn-edit-avatar")?.addEventListener("click", openProfileModal);
$("btn-edit-banner")?.addEventListener("click", openProfileModal);
$("menu-about-me")?.addEventListener("click", openProfileModal);

$("menu-photo")?.addEventListener("click", () => $("file-avatar")?.click());
$("menu-banner")?.addEventListener("click", () => $("file-banner")?.click());
$("menu-nama")?.addEventListener("click", editNama);
$("menu-bio")?.addEventListener("click", editBio);
$("menu-username")?.addEventListener("click", editUsername);
$("menu-uid")?.addEventListener("click", copyUID);

$("btn-pick-avatar")?.addEventListener("click", () => $("file-avatar")?.click());
$("file-avatar")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    showToast("Mengupload foto...");
    const compressed = await compressImage(file, 300, 0.85);
    await updateUserProfile(state.user, { photoURL: compressed });
    state.profile = await getUserProfile(state.user.uid);
    updateProfileUI();
    showToast("Foto profil diubah ✅");
  } catch (err) { showToast("Gagal upload: " + err.message); }
  finally { e.target.value = ""; }
});

$("btn-pick-banner")?.addEventListener("click", () => $("file-banner")?.click());
$("file-banner")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    showToast("Mengupload banner...");
    const compressed = await compressImage(file, 800, 0.8);
    await updateUserProfile(state.user, { bannerURL: compressed });
    state.profile = await getUserProfile(state.user.uid);
    updateProfileUI();
    showToast("Banner diubah ✅");
  } catch (err) { showToast("Gagal upload: " + err.message); }
  finally { e.target.value = ""; }
});

$("profile-cancel")?.addEventListener("click", () => $("profile-modal")?.classList.add("hidden"));

$("profile-save")?.addEventListener("click", async () => {
  const name = $("edit-name")?.value.trim();
  const bio = $("edit-bio")?.value.trim() || "";
  const saveBtn = $("profile-save");
  if (!name) { showToast("Nama tidak boleh kosong"); return; }
  saveBtn.disabled = true; saveBtn.textContent = "...";
  try {
    await updateUserProfile(state.user, { displayName: name, bio });
    state.profile = await getUserProfile(state.user.uid);
    updateProfileUI();
    $("profile-modal")?.classList.add("hidden");
    showToast("Profil tersimpan ✅");
  } catch (err) { showToast("Gagal simpan: " + err.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = "Simpan"; }
});

/* ============================================================
   THEME + WALLPAPER
   ============================================================ */
$("menu-theme")?.addEventListener("click", () => $("theme-modal")?.classList.remove("hidden"));
$("theme-modal-close")?.addEventListener("click", () => $("theme-modal")?.classList.add("hidden"));
$$(".theme-option").forEach(opt => {
  opt.addEventListener("click", () => {
    applyTheme(opt.dataset.theme);
    showToast("Tema: " + THEMES[opt.dataset.theme].name);
    setTimeout(() => $("theme-modal")?.classList.add("hidden"), 250);
  });
});

function getWallpaperKey() { return "flux_wallpaper_" + (state.user?.uid || "guest"); }
function getSavedWallpaper() {
  try { const raw = localStorage.getItem(getWallpaperKey()); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}
function applyWallpaper(wp) {
  const box = $("chat-messages");
  if (!box) return;
  if (!wp || (wp.type === "preset" && !wp.value)) {
    box.style.background = ""; box.style.backgroundImage = "";
    box.classList.remove("has-wallpaper");
    return;
  }
  box.classList.add("has-wallpaper");
  if (wp.type === "preset") { box.style.backgroundImage = "none"; box.style.background = wp.value; }
  else if (wp.type === "image") { box.style.background = ""; box.style.backgroundImage = "url(" + wp.value + ")"; }
}
function loadWallpaper() { const s = getSavedWallpaper(); if (s) applyWallpaper(s); }
function updateWallpaperPreview() {
  $$(".wallpaper-preset").forEach(el => {
    let isActive = false;
    if (!state.pendingWallpaper) isActive = el.dataset.preset === "default";
    else if (state.pendingWallpaper.type === "preset") {
      const key = Object.keys(WALLPAPER_PRESETS).find(k => WALLPAPER_PRESETS[k] === state.pendingWallpaper.value);
      isActive = el.dataset.preset === key;
    }
    el.classList.toggle("active", isActive);
  });
}

$("menu-wallpaper")?.addEventListener("click", () => {
  state.pendingWallpaper = getSavedWallpaper();
  updateWallpaperPreview();
  $("wallpaper-modal")?.classList.remove("hidden");
});
$("wallpaper-close")?.addEventListener("click", () => { $("wallpaper-modal")?.classList.add("hidden"); state.pendingWallpaper = null; });
$("wallpaper-upload")?.addEventListener("click", () => $("wallpaper-file")?.click());
$("wallpaper-file")?.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const compressed = await compressImage(file, 600);
    state.pendingWallpaper = { type: "image", value: compressed };
    updateWallpaperPreview();
    showToast("Gambar siap disimpan");
  } catch (e) { showToast("Gagal baca gambar"); }
  e.target.value = "";
});
$$(".wallpaper-preset").forEach(el => {
  el.addEventListener("click", () => {
    state.pendingWallpaper = { type: "preset", value: WALLPAPER_PRESETS[el.dataset.preset] };
    updateWallpaperPreview();
  });
});
$("wallpaper-reset")?.addEventListener("click", () => {
  state.pendingWallpaper = null;
  localStorage.removeItem(getWallpaperKey());
  applyWallpaper(null);
  updateWallpaperPreview();
  showToast("Wallpaper direset");
});
$("wallpaper-save")?.addEventListener("click", () => {
  try {
    if (state.pendingWallpaper) {
      localStorage.setItem(getWallpaperKey(), JSON.stringify(state.pendingWallpaper));
      applyWallpaper(state.pendingWallpaper);
      showToast("Wallpaper tersimpan ✅");
    } else {
      localStorage.removeItem(getWallpaperKey());
      applyWallpaper(null);
    }
    $("wallpaper-modal")?.classList.add("hidden");
    state.pendingWallpaper = null;
  } catch (e) { showToast("Gagal simpan"); }
});

/* ============================================================
   SETTINGS
   ============================================================ */
$("menu-privacy")?.addEventListener("click", () => showInfo("🔒 Privasi", '<div class="info-row">✅ Chat pribadi terenkripsi Firebase</div>'));
$("menu-security")?.addEventListener("click", () => showInfo("🛡️ Keamanan", '<div class="info-row">🔐 Login dengan Firebase Auth</div>'));
$("menu-storage")?.addEventListener("click", () => {
  const cache = JSON.stringify(localStorage).length;
  showInfo("📦 Penyimpanan", '<div class="info-row"><b>Cache:</b> ~' + (cache / 1024).toFixed(1) + ' KB</div>', "Bersihkan Cache AI", () => {
    resetAIChat();
    state.lastAiMsgs = [];
    showToast("Cache dibersihkan");
  });
});

$("menu-font-size")?.addEventListener("click", () => {
  const current = state.fontSizes || "normal";
  showInfo("🔤 Ukuran Font",
    '<div style="display:flex;flex-direction:column;gap:8px;">' +
      '<button class="fontsize-btn" data-size="small" style="padding:14px;background:var(--bg-soft);border:2px solid ' + (current === "small" ? "var(--accent)" : "var(--border)") + ';border-radius:10px;font-weight:800;cursor:pointer;text-align:left;font-size:13px;">🔹 Kecil</button>' +
      '<button class="fontsize-btn" data-size="normal" style="padding:14px;background:var(--bg-soft);border:2px solid ' + (current === "normal" ? "var(--accent)" : "var(--border)") + ';border-radius:10px;font-weight:800;cursor:pointer;text-align:left;font-size:15px;">🔸 Sedang</button>' +
      '<button class="fontsize-btn" data-size="large" style="padding:14px;background:var(--bg-soft);border:2px solid ' + (current === "large" ? "var(--accent)" : "var(--border)") + ';border-radius:10px;font-weight:800;cursor:pointer;text-align:left;font-size:17px;">🔶 Besar</button>' +
    '</div>');
  setTimeout(() => {
    document.querySelectorAll(".fontsize-btn").forEach(btn => {
      btn.onclick = () => { applyFontSize(btn.dataset.size); showToast("Font diubah"); $("info-modal")?.classList.add("hidden"); };
    });
  }, 100);
});

$("menu-notif-sound")?.addEventListener("click", () => {
  const enabled = state.notificationEnabled;
  showInfo("🔔 Suara Notifikasi",
    '<div class="info-row">Status: <b>' + (enabled ? "Aktif ✅" : "Mati ❌") + '</b></div>',
    enabled ? "Matikan" : "Aktifkan",
    () => {
      state.notificationEnabled = !enabled;
      localStorage.setItem("flux_notif_sound", state.notificationEnabled ? "1" : "0");
      showToast(state.notificationEnabled ? "Suara aktif 🔔" : "Suara mati 🔕");
      if (state.notificationEnabled) playNotifSound();
    }
  );
});

$("menu-about")?.addEventListener("click", () => showInfo("📱 Tentang FluxChat",
  '<div style="text-align:center;margin-bottom:16px;"><div style="font-size:48px;">F</div><div style="font-weight:700;font-size:18px;">FluxChat & FluxAI</div><div style="font-size:12px;color:var(--muted);">Versi 2.0.0 (Group)</div></div>' +
  '<div class="info-row">🤖 <b>Model:</b> ' + getCurrentModel() + '</div><div class="info-row">🎨 <b>Image:</b> Pollinations AI</div><div class="info-row">🎤 <b>Voice:</b> Groq Whisper</div><div class="info-row">👥 <b>Group Chat:</b> Yes</div>'));

$("btn-logout")?.addEventListener("click", () => {
  showInfo("🚪 Keluar", '<div class="info-row">Yakin mau logout?</div>', "Ya, Keluar", async () => { await logoutUser(); });
});
$("info-modal-close")?.addEventListener("click", () => $("info-modal")?.classList.add("hidden"));

if (localStorage.getItem("flux_notif_sound") === "0") state.notificationEnabled = false;

/* ============================================================
   MINI GAME
   ============================================================ */
const GAME_KEY = "flux_game_data";
const GAME_DURATION = 30;
const gameState = { playing: false, score: 0, startTime: 0, timerId: null, tapCooldown: false };

function getGameData() {
  try { return JSON.parse(localStorage.getItem(GAME_KEY) || "") || { highScore: 0, plays: 0 }; }
  catch (e) { return { highScore: 0, plays: 0 }; }
}
function saveGameData(d) { try { localStorage.setItem(GAME_KEY, JSON.stringify(d)); } catch (e) {} }
function updateGameStatsUI() {
  const data = getGameData();
  if (typeof data.highScore !== "number") data.highScore = 0;
  if (typeof data.plays !== "number") data.plays = 0;
  if ($("game-high-score")) $("game-high-score").textContent = data.highScore;
  if ($("game-total-plays")) $("game-total-plays").textContent = data.plays;
}

function startGame() {
  if (gameState.playing) return;
  gameState.playing = true;
  gameState.score = 0;
  gameState.startTime = Date.now();
  gameState.tapCooldown = false;
  $("game-overlay")?.classList.remove("hidden");
  $("game-over-modal")?.classList.add("hidden");
  if ($("game-score-live")) $("game-score-live").textContent = "0";
  if ($("game-timer")) $("game-timer").textContent = "30.0";
  clearInterval(gameState.timerId);
  gameState.timerId = setInterval(() => {
    if (!gameState.playing) return;
    const elapsed = (Date.now() - gameState.startTime) / 1000;
    const timeLeft = Math.max(0, GAME_DURATION - elapsed);
    if ($("game-timer")) $("game-timer").textContent = timeLeft.toFixed(1);
    if (timeLeft <= 0) endGame();
  }, 50);
}

function handleTap() {
  if (!gameState.playing || gameState.tapCooldown) return;
  gameState.tapCooldown = true;
  setTimeout(() => { gameState.tapCooldown = false; }, 30);
  gameState.score++;
  if ($("game-score-live")) $("game-score-live").textContent = gameState.score;
  const target = $("game-tap-target");
  if (target) { target.classList.add("tapped"); setTimeout(() => target.classList.remove("tapped"), 150); }
}

function endGame() {
  if (!gameState.playing) return;
  gameState.playing = false;
  clearInterval(gameState.timerId);
  const finalScore = gameState.score;
  const data = getGameData();
  const isNewHigh = finalScore > data.highScore;
  data.plays++;
  if (isNewHigh) data.highScore = finalScore;
  saveGameData(data);
  $("game-overlay")?.classList.add("hidden");
  $("game-over-modal")?.classList.remove("hidden");
  if ($("game-over-score")) $("game-over-score").textContent = finalScore;
  if ($("game-over-title")) $("game-over-title").textContent = isNewHigh ? "🎉 REKOR BARU!" : "SELESAI!";
  updateGameStatsUI();
}

$("btn-play-game")?.addEventListener("click", startGame);
$("game-tap-target")?.addEventListener("touchstart", (e) => { e.preventDefault(); handleTap(); }, { passive: false });
$("game-tap-target")?.addEventListener("mousedown", handleTap);
$("game-close")?.addEventListener("click", () => {
  if (gameState.playing && !confirm("Keluar? Skor hilang.")) return;
  gameState.playing = false;
  clearInterval(gameState.timerId);
  $("game-overlay")?.classList.add("hidden");
});
$("game-over-again")?.addEventListener("click", () => { $("game-over-modal")?.classList.add("hidden"); startGame(); });
$("game-over-home")?.addEventListener("click", () => $("game-over-modal")?.classList.add("hidden"));
updateGameStatsUI();

/* ============================================================
   STORY SYSTEM
   ============================================================ */
function initStories() {
  if (state.storiesUnsub) state.storiesUnsub();
  state.storiesUnsub = listenStories((stories) => {
    state.storiesList = stories || [];
    renderStoryBar();
    renderStoryContent();
  });
}

function renderStoryBar() {
  const list = $("story-list-tk");
  if (!list) return;
  list.innerHTML = "";

  const myStories = state.storiesList.filter(s => s.uid === state.user?.uid);
  const myAvatar = state.profile?.photoURL || "";
  const hasMyStories = myStories.length > 0;
  const myInitial = (state.profile?.displayName || "U").charAt(0).toUpperCase();

  const addBtn = document.createElement("div");
  addBtn.className = "story-item-tk story-add";
  addBtn.id = "btn-add-story-tk";

  const avatarHtml = myAvatar.length > 10
    ? '<div class="story-avatar-tk" style="background-image:url(' + myAvatar + ')"></div>'
    : '<div class="story-avatar-tk">' + myInitial + '</div>';

  addBtn.innerHTML =
    '<div class="story-ring-tk story-add-ring">' +
      avatarHtml +
      '<div class="story-add-btn">+</div>' +
    '</div>' +
    '<span>Tambah Status</span>';

  addBtn.onclick = () => {
    if (hasMyStories) {
      openStoryViewer(state.user.uid);
    } else {
      state.pendingStoryImage = null;
      if ($("create-story-caption")) $("create-story-caption").value = "";
      const prev = $("create-story-preview");
      if (prev) {
        prev.style.backgroundImage = "";
        prev.innerHTML = '<div class="create-story-placeholder"><div class="csp-icon">📷</div><div>Tap untuk pilih foto</div></div>';
      }
      $("create-story-modal")?.classList.remove("hidden");
    }
  };
  list.appendChild(addBtn);

  const byUser = {};
  for (const s of state.storiesList) {
    if (s.uid === state.user?.uid) continue;
    if (!byUser[s.uid]) byUser[s.uid] = [];
    byUser[s.uid].push(s);
  }

  for (const uid of Object.keys(byUser)) {
    const userStories = byUser[uid];
    userStories.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const first = userStories[0];
    const initial = (first.name || "U").charAt(0).toUpperCase();
    const allSeen = userStories.every(s => viewedStories.has(s.id));
    const hasAvatar = first.photoURL && first.photoURL.length > 10;

    const el = document.createElement("div");
    el.className = "story-item-tk" + (allSeen ? " seen" : "");
    el.innerHTML =
      '<div class="story-ring-tk">' +
        '<div class="story-avatar-tk" ' + (hasAvatar ? 'style="background-image:url(' + first.photoURL + ')"' : '') + '>' +
          (hasAvatar ? '' : initial) +
        '</div>' +
      '</div>' +
      '<span>' + escapeHtml(first.name || "User") + '</span>';
    el.onclick = () => openStoryViewer(uid);
    list.appendChild(el);
  }
}

function renderStoryContent() {
  const content = $("story-content-tk");
  if (!content) return;
  if (state.storiesList.length === 0) {
    content.innerHTML = '<div class="tk-empty"><div class="tk-empty-icon">📖</div><p>Belum ada story</p><span>Tap + di atas untuk posting story</span></div>';
    return;
  }
  const myStories = state.storiesList.filter(s => s.uid === state.user.uid);
  const others = state.storiesList.filter(s => s.uid !== state.user.uid);
  let html = "";

  if (myStories.length > 0) {
    html += '<div style="padding: 12px 4px 8px; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;">Story Kamu</div>';
    html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px;">';
    for (const s of myStories) {
      const viewCount = (s.viewedBy || []).length;
      const reactionCount = Object.values(s.reactions || {}).reduce((sum, users) => sum + users.length, 0);
      html += '<div style="position:relative; aspect-ratio: 9/16; border-radius: 12px; overflow: hidden; background: url(' + s.imageBase64 + '); background-size: cover; background-position: center; cursor: pointer;" data-story-id="' + s.id + '">' +
        '<div style="position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer;" class="story-delete" data-id="' + s.id + '">✕</div>' +
        '<div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 6px 8px; background: linear-gradient(transparent, rgba(0,0,0,0.85)); color: #fff; font-size: 10px; font-weight: 700; display: flex; gap: 8px;">' +
          '<span>👁️ ' + viewCount + '</span>' +
          (reactionCount > 0 ? '<span>❤️ ' + reactionCount + '</span>' : '') +
        '</div>' +
      '</div>';
    }
    html += '</div>';
  }

  if (others.length > 0) {
    html += '<div style="padding: 12px 4px 8px; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;">Story Terbaru</div>';
    html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">';
    for (const s of others) {
      html += '<div style="position:relative; aspect-ratio: 9/16; border-radius: 12px; overflow: hidden; background: url(' + s.imageBase64 + '); background-size: cover; background-position: center; cursor: pointer;" data-uid="' + s.uid + '">' +
        '<div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 6px 8px; background: linear-gradient(transparent, rgba(0,0,0,0.8)); color: #fff; font-size: 10px; font-weight: 600;">' + escapeHtml(s.name) + '</div>' +
      '</div>';
    }
    html += '</div>';
  }

  content.innerHTML = html;
  content.querySelectorAll(".story-delete").forEach(el => {
    el.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Hapus story ini?")) return;
      try { await deleteStory(el.dataset.id); showToast("Story dihapus"); }
      catch (e) { showToast("Gagal hapus"); }
    };
  });
  content.querySelectorAll("[data-story-id]").forEach(el => {
    el.onclick = (e) => { if (e.target.closest(".story-delete")) return; openStoryViewer(state.user.uid); };
  });
  content.querySelectorAll("[data-uid]").forEach(el => {
    el.onclick = () => openStoryViewer(el.dataset.uid);
  });
}

function openStoryViewer(uid) {
  state.currentStoryUid = uid;
  state.currentStoryUserList = state.storiesList.filter(s => s.uid === uid);
  if (state.currentStoryUserList.length === 0) { showToast("Story kosong"); return; }
  state.currentStoryIndex = 0;
  $("story-viewer-tk")?.classList.remove("hidden");
  clearTimeout(state.storyTimer);
  renderCurrentStory();
}

async function renderCurrentStory() {
  const story = state.currentStoryUserList[state.currentStoryIndex];
  if (!story) { closeStoryViewer(); return; }

  const avatarEl = $("story-viewer-avatar");
  const nameEl = $("story-viewer-name");
  const timeEl = $("story-viewer-time");
  const imageEl = $("story-viewer-image");
  const captionEl = $("story-viewer-caption");
  const created = story.createdAt?.toDate?.() || new Date();
  const ageMin = Math.floor((Date.now() - created.getTime()) / 60000);
  const ageText = ageMin < 1 ? "Baru saja" : ageMin < 60 ? ageMin + " menit lalu" : Math.floor(ageMin / 60) + " jam lalu";
  const initial = (story.name || "U").charAt(0).toUpperCase();
  const isMine = String(story.uid).trim() === String(state.user?.uid).trim();

  if (avatarEl) {
    avatarEl.textContent = story.photoURL && story.photoURL.length > 10 ? "" : initial;
    avatarEl.style.backgroundImage = story.photoURL && story.photoURL.length > 10 ? "url(" + story.photoURL + ")" : "";
  }
  if (nameEl) nameEl.textContent = story.name || "User";
  if (timeEl) timeEl.textContent = ageText;
  if (imageEl) imageEl.src = story.imageBase64;
  if (captionEl) captionEl.textContent = story.caption || "";

  if (!isMine) markStoryViewed(story.id, state.user.uid).catch(() => {});

  const progressWrap = $("story-progress-wrap");
  if (progressWrap) {
    progressWrap.innerHTML = "";
    state.currentStoryUserList.forEach((_, i) => {
      const bar = document.createElement("div");
      bar.className = "story-viewer-progress";
      if (i < state.currentStoryIndex) bar.style.transform = "scaleX(1)";
      else if (i === state.currentStoryIndex) bar.classList.add("active");
      progressWrap.appendChild(bar);
    });
  }

  let actionBar = $("story-action-bar");
  if (!actionBar) {
    actionBar = document.createElement("div");
    actionBar.id = "story-action-bar";
    actionBar.className = "story-action-bar";
    document.getElementById("story-viewer-tk")?.appendChild(actionBar);
  }

  const reactions = story.reactions || {};
  const myReactions = {};
  for (const [emoji, users] of Object.entries(reactions)) {
    if (users.includes(state.user.uid)) myReactions[emoji] = true;
  }

  actionBar.innerHTML =
    (!isMine ?
    '<div class="story-reply-input-wrap">' +
      '<input type="text" id="story-reply-input" placeholder="Balas story ' + escapeHtml(story.name || "User") + '..." class="story-reply-input" />' +
      '<button id="story-send-reply" class="story-send-btn" type="button">➤</button>' +
    '</div>' : '') +
    '<div class="story-reaction-row">' +
      '<button class="story-react-btn" data-emoji="❤️" ' + (myReactions["❤️"] ? 'style="background:rgba(255,0,0,0.35)"' : '') + '>❤️</button>' +
      '<button class="story-react-btn" data-emoji="😂" ' + (myReactions["😂"] ? 'style="background:rgba(255,255,0,0.35)"' : '') + '>😂</button>' +
      '<button class="story-react-btn" data-emoji="😮" ' + (myReactions["😮"] ? 'style="background:rgba(255,255,0,0.35)"' : '') + '>😮</button>' +
      '<button class="story-react-btn" data-emoji="😢" ' + (myReactions["😢"] ? 'style="background:rgba(0,100,255,0.35)"' : '') + '>😢</button>' +
      '<button class="story-react-btn" data-emoji="🔥" ' + (myReactions["🔥"] ? 'style="background:rgba(255,100,0,0.35)"' : '') + '>🔥</button>' +
      (isMine ? '<button class="story-viewers-btn" id="story-viewers-btn" type="button">👁️ ' + ((story.viewedBy || []).length) + '</button>' : '') +
    '</div>';

  actionBar.querySelectorAll(".story-react-btn").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const emoji = btn.dataset.emoji;
      try {
        await addStoryReaction(story.id, emoji, state.user.uid);
        if (!story.reactions) story.reactions = {};
        if (!story.reactions[emoji]) story.reactions[emoji] = [];
        if (story.reactions[emoji].includes(state.user.uid)) {
          story.reactions[emoji] = story.reactions[emoji].filter(u => u !== state.user.uid);
        } else {
          story.reactions[emoji] = [...story.reactions[emoji], state.user.uid];
        }
        renderCurrentStory();
      } catch (err) { showToast("Gagal react: " + err.message); }
    };
  });

  const replyInput = actionBar.querySelector("#story-reply-input");
  const sendReplyBtn = actionBar.querySelector("#story-send-reply");
  const doReply = async () => {
    const txt = (replyInput?.value || "").trim();
    if (!txt) return;
    try {
      await replyToStory(story, state.user, txt);
      showToast("Balasan terkirim ✅");
      replyInput.value = "";
    } catch (err) { showToast("Gagal balas: " + err.message); }
  };
  if (sendReplyBtn) sendReplyBtn.onclick = (e) => { e.stopPropagation(); doReply(); };
  if (replyInput) {
    replyInput.onkeypress = (e) => {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); doReply(); }
    };
    replyInput.onclick = (e) => e.stopPropagation();
  }

  const viewersBtn = actionBar.querySelector("#story-viewers-btn");
  if (viewersBtn) {
    viewersBtn.onclick = async (e) => {
      e.stopPropagation();
      const viewers = await getStoryViewers(story.id);
      let html = "";
      if (viewers.length === 0) html = '<div style="text-align:center;color:var(--muted);padding:20px;">Belum ada yang liat</div>';
      else {
        for (const v of viewers) {
          const name = v.displayName || v.username || "User";
          const initial = name.charAt(0).toUpperCase();
          const avStyle = v.photoURL && v.photoURL.length > 10 ? "background-image:url(" + v.photoURL + ");" : "";
          html += '<div class="info-row" style="display:flex;align-items:center;gap:10px;">' +
            '<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;' + avStyle + '">' +
              (v.photoURL && v.photoURL.length > 10 ? "" : initial) +
            '</div>' +
            '<div><div style="font-weight:800;">' + escapeHtml(name) + '</div>' +
            '<div style="font-size:11px;color:var(--muted);">@' + escapeHtml(v.username || "user") + '</div></div>' +
          '</div>';
        }
      }
      showInfo("👁️ Viewers (" + viewers.length + ")", html);
    };
  }

  clearTimeout(state.storyTimer);
  state.storyTimer = setTimeout(() => nextStory(), 5000);
}

function nextStory() {
  state.currentStoryIndex++;
  if (state.currentStoryIndex >= state.currentStoryUserList.length) closeStoryViewer();
  else renderCurrentStory();
}
function prevStory() {
  state.currentStoryIndex--;
  if (state.currentStoryIndex < 0) state.currentStoryIndex = 0;
  renderCurrentStory();
}
function closeStoryViewer() {
  $("story-viewer-tk")?.classList.add("hidden");
  const ab = document.getElementById("story-action-bar");
  if (ab) ab.remove();
  clearTimeout(state.storyTimer);
  renderStoryBar();
}

$("create-story-cancel")?.addEventListener("click", () => { $("create-story-modal")?.classList.add("hidden"); state.pendingStoryImage = null; });
$("create-story-preview")?.addEventListener("click", () => $("create-story-file")?.click());
$("create-story-file")?.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const compressed = await compressImage(file, 600);
    state.pendingStoryImage = compressed;
    const prev = $("create-story-preview");
    if (prev) { prev.innerHTML = ""; prev.style.backgroundImage = "url(" + compressed + ")"; }
  } catch (e) { showToast("Gagal baca gambar"); }
  e.target.value = "";
});
$("create-story-post")?.addEventListener("click", async () => {
  if (!state.pendingStoryImage) { showToast("Pilih foto dulu"); return; }
  const caption = $("create-story-caption")?.value.trim() || "";
  const btn = $("create-story-post");
  btn.disabled = true; btn.textContent = "...";
  try {
    const myStories = state.storiesList.filter(s => s.uid === state.user.uid);
    if (myStories.length >= 3) { showToast("Maksimal 3 story per 24 jam"); return; }
    await createStory(state.user, { imageBase64: state.pendingStoryImage, caption });
    $("create-story-modal")?.classList.add("hidden");
    state.pendingStoryImage = null;
    if ($("create-story-caption")) $("create-story-caption").value = "";
    const prev = $("create-story-preview");
    if (prev) {
      prev.style.backgroundImage = "";
      prev.innerHTML = '<div class="create-story-placeholder"><div class="csp-icon">📷</div><div>Tap untuk pilih foto</div></div>';
    }
    showToast("Story posted ✅");
  } catch (err) { showToast("Gagal post: " + err.message); }
  finally { btn.disabled = false; btn.textContent = "Post"; }
});
$("story-viewer-close")?.addEventListener("click", closeStoryViewer);
$("story-nav-prev")?.addEventListener("click", prevStory);
$("story-nav-next")?.addEventListener("click", nextStory);

/* ============================================================
   CHAT MENU (3-dot dalam chat detail)
   ============================================================ */
document.addEventListener("click", function(e) {
  const btn = e.target.closest("#chat-menu-btn");
  if (btn) { e.preventDefault(); e.stopPropagation(); showChatMenu(); return; }
  if (!e.target.closest(".chat-menu-dropdown") && !e.target.closest("#chat-menu-btn")) {
    const existing = document.querySelector(".chat-menu-dropdown");
    if (existing) existing.remove();
  }
});

function showChatMenu() {
  const existing = document.querySelector(".chat-menu-dropdown");
  if (existing) { existing.remove(); return; }

  const isDM = state.currentChat === "dm";
  const isAI = state.currentChat === "ai";
  const isGlobal = state.currentChat === "global";
  const isGroup = state.currentChat === "group";

  const menu = document.createElement("div");
  menu.className = "chat-menu-dropdown";

  if (isAI) {
    menu.innerHTML =
      '<div class="chat-menu-item" data-menu="ai-model"><span class="chat-menu-item-icon">🧠</span> Ganti Model</div>' +
      '<div class="chat-menu-item" data-menu="ai-persona"><span class="chat-menu-item-icon">🎭</span> Ganti Persona</div>' +
      '<div class="chat-menu-item" data-menu="ai-image"><span class="chat-menu-item-icon">🎨</span> Bikin Gambar</div>' +
      '<div class="chat-menu-item" data-menu="ai-clear"><span class="chat-menu-item-icon">🧹</span> Reset</div>' +
      '<div class="chat-menu-item" data-menu="ai-about"><span class="chat-menu-item-icon">ℹ️</span> Tentang</div>';
    const header = document.querySelector(".chat-detail-header");
    if (!header) return;
    header.appendChild(menu);
    menu.querySelectorAll(".chat-menu-item").forEach(item => {
      item.addEventListener("click", function(ev) {
        ev.stopPropagation();
        handleAIMenuAction(item.dataset.menu);
        menu.remove();
      });
    });
    return;
  }

  const chatId = isDM ? state.dmWithUid : isGroup ? state.currentGroupId : null;
  const isPinned = chatId && (state.pinnedChats || []).includes(chatId);
  const isMuted = chatId && (state.mutedChats || []).includes(chatId);
  const isArchived = chatId && (state.archivedChats || []).includes(chatId);

  menu.innerHTML =
    (isDM ? '<div class="chat-menu-item" data-menu="contact"><span class="chat-menu-item-icon">👤</span> Info Kontak</div>' : '') +
    (isGroup ? '<div class="chat-menu-item" data-menu="group-info"><span class="chat-menu-item-icon">👥</span> Info Grup</div>' : '') +
    '<div class="chat-menu-item" data-menu="search"><span class="chat-menu-item-icon">🔍</span> Cari Pesan</div>' +
    (chatId ? '<div class="chat-menu-item" data-menu="pin-chat"><span class="chat-menu-item-icon">📌</span> ' + (isPinned ? 'Unpin' : 'Pin') + '</div>' : '') +
    (chatId ? '<div class="chat-menu-item" data-menu="mute-chat"><span class="chat-menu-item-icon">' + (isMuted ? '🔔' : '🔕') + '</span> ' + (isMuted ? 'Aktifkan' : 'Bisukan') + '</div>' : '') +
    (chatId && isArchived ? '<div class="chat-menu-item" data-menu="archive-chat"><span class="chat-menu-item-icon">📦</span> Unarchive</div>' : '') +
    '<div class="chat-menu-item" data-menu="wallpaper"><span class="chat-menu-item-icon">🖼️</span> Wallpaper</div>' +
    (isGlobal ? '<div class="chat-menu-item danger" data-menu="leave"><span class="chat-menu-item-icon">🚪</span> Keluar</div>' : '');

  const header = document.querySelector(".chat-detail-header");
  if (!header) return;
  header.appendChild(menu);
  menu.querySelectorAll(".chat-menu-item").forEach(item => {
    item.addEventListener("click", function(ev) {
      ev.stopPropagation();
      handleChatMenuAction(item.dataset.menu);
      menu.remove();
    });
  });
}

async function handleAIMenuAction(action) {
  if (action === "ai-model") {
    const current = getCurrentModel();
    const models = getAvailableModels();
    let html = '<div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto;">';
    models.forEach(m => {
      const isActive = m.id === current;
      html += '<button class="model-btn" data-mid="' + m.id + '" style="padding:12px;background:var(--bg-soft);border:2px solid ' + (isActive ? "var(--accent)" : "var(--border)") + ';border-radius:10px;cursor:pointer;text-align:left;font-size:13px;width:100%;">' +
        '<div style="font-weight:900;">' + m.name + (isActive ? " ✅" : "") + '</div>' +
        '<div style="font-size:11px;color:var(--muted);">' + m.desc + '</div></button>';
    });
    html += '</div>';
    showInfo("🧠 Pilih Model", html);
    setTimeout(() => {
      document.querySelectorAll(".model-btn").forEach(btn => {
        btn.onclick = () => {
          setAIModel(btn.dataset.mid);
          showToast("Model diubah");
          $("info-modal")?.classList.add("hidden");
        };
      });
    }, 100);
  } else if (action === "ai-persona") {
    const current = state.aiPersona || "assistant";
    showInfo("🎭 Ganti Persona",
      '<div style="display:flex;flex-direction:column;gap:8px;">' +
        '<button class="persona-btn" data-p="assistant" style="padding:14px;background:var(--bg-soft);border:2px solid ' + (current === "assistant" ? "var(--accent)" : "var(--border)") + ';border-radius:10px;font-weight:800;cursor:pointer;text-align:left;">🤖 Asisten</button>' +
        '<button class="persona-btn" data-p="friend" style="padding:14px;background:var(--bg-soft);border:2px solid ' + (current === "friend" ? "var(--accent)" : "var(--border)") + ';border-radius:10px;font-weight:800;cursor:pointer;text-align:left;">😎 Teman</button>' +
        '<button class="persona-btn" data-p="dosen" style="padding:14px;background:var(--bg-soft);border:2px solid ' + (current === "dosen" ? "var(--accent)" : "var(--border)") + ';border-radius:10px;font-weight:800;cursor:pointer;text-align:left;">🎓 Dosen</button>' +
        '<button class="persona-btn" data-p="motivator" style="padding:14px;background:var(--bg-soft);border:2px solid ' + (current === "motivator" ? "var(--accent)" : "var(--border)") + ';border-radius:10px;font-weight:800;cursor:pointer;text-align:left;">🔥 Motivator</button>' +
      '</div>');
    setTimeout(() => {
      document.querySelectorAll(".persona-btn").forEach(btn => {
        btn.onclick = () => {
          state.aiPersona = btn.dataset.p;
          setAIPersona(btn.dataset.p);
          showToast("Persona diubah");
          $("info-modal")?.classList.add("hidden");
        };
      });
    }, 100);
  } else if (action === "ai-image") {
    showInfo("🎨 Bikin Gambar",
      '<input type="text" id="ai-image-prompt" placeholder="kucing lucu pakai topi" style="width:100%;padding:14px;border:2px solid var(--border);border-radius:10px;background:var(--bg-soft);color:var(--text);box-sizing:border-box;" />',
      "Bikin 🎨",
      () => {
        const prompt = ($("ai-image-prompt")?.value || "").trim();
        if (!prompt) return;
        const chatInput = $("chat-input");
        if (chatInput) { chatInput.value = "/img " + prompt; sendMessageFromInput(); }
      });
  } else if (action === "ai-clear") {
    if (!confirm("Reset percakapan AI?")) return;
    resetAIChat();
    state.lastAiMsgs = [];
    renderAIMessages();
    showToast("Reset 🧹");
  } else if (action === "ai-about") {
    const info = getCurrentModelInfo();
    showInfo("🤖 Tentang FluxAI",
      '<div class="info-row">🧠 <b>Model:</b> ' + (info?.name || "-") + '</div>' +
      '<div class="info-row">⚡ <b>Provider:</b> ' + (info?.provider === "groq" ? "Groq" : "OpenRouter") + '</div>');
  }
}

async function handleChatMenuAction(action) {
  if (action === "contact") {
    const u = state.activeTargetUser;
    if (u) showGlobalUserInfo(u.uid, u.displayName, u.photoURL);
  } else if (action === "group-info") {
    openGroupInfo();
  } else if (action === "search") {
    showInfo("🔍 Cari Pesan", '<input type="text" id="msg-search-input" placeholder="Cari pesan..." style="width:100%;padding:12px;border-radius:8px;border:2px solid var(--border);background:var(--bg-soft);color:var(--text);box-sizing:border-box;" /><div id="msg-search-results" style="margin-top:12px;max-height:50vh;overflow-y:auto;"></div>');
    setTimeout(() => {
      const input = $("msg-search-input");
      if (!input) return;
      let timer;
      input.addEventListener("input", (e) => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const kw = e.target.value.trim();
          const box = $("msg-search-results");
          if (!box) return;
          if (!kw) { box.innerHTML = ""; return; }
          box.innerHTML = '<div style="text-align:center;color:var(--muted);">Mencari...</div>';
          const chatType = state.currentChat === "global" ? "global" : state.currentChat === "group" ? "group" : "dm";
          const uid2 = state.dmWithUid || "";
          const results = await searchMessagesInChat(chatType, state.user.uid, uid2, kw, state.currentGroupId);
          if (results.length === 0) { box.innerHTML = '<div style="text-align:center;color:var(--muted);">Gak ketemu</div>'; return; }
          let html = "";
          for (const m of results.slice(0, 20)) {
            const esc = escapeRegex(kw);
            const text = (m.text || "").replace(new RegExp(esc, "gi"), match => '<mark style="background:var(--accent);padding:2px 4px;border-radius:4px;">' + match + '</mark>');
            html += '<div class="msg-search-result" data-mid="' + m.id + '" style="padding:10px;border-bottom:1px solid var(--border);cursor:pointer;">' +
              '<div style="font-size:11px;color:var(--accent-dark);font-weight:900;">' + escapeHtml(m.name || "User") + ' · ' + formatTime(m.createdAt) + '</div>' +
              '<div style="font-size:13px;">' + text + '</div></div>';
          }
          box.innerHTML = html;
          box.querySelectorAll(".msg-search-result").forEach(el => {
            el.onclick = () => {
              const mid = el.dataset.mid;
              const msgEl = document.querySelector('[data-msg-id="' + mid + '"]');
              if (msgEl) {
                $("info-modal")?.classList.add("hidden");
                msgEl.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            };
          });
        }, 300);
      });
      input.focus();
    }, 150);
  } else if (action === "pin-chat") {
    const chatId = state.currentChat === "dm" ? state.dmWithUid : state.currentGroupId;
    if (!chatId) return;
    const isPinned = (state.pinnedChats || []).includes(chatId);
    const ok = await pinChat(state.user.uid, chatId, !isPinned);
    if (ok) {
      if (isPinned) state.pinnedChats = state.pinnedChats.filter(u => u !== chatId);
      else state.pinnedChats = [...state.pinnedChats, chatId];
      showToast(isPinned ? "Unpin 📌" : "Pin 📌");
      applyChatFilter();
    }
  } else if (action === "mute-chat") {
    const chatId = state.currentChat === "dm" ? state.dmWithUid : state.currentGroupId;
    if (!chatId) return;
    const isMuted = (state.mutedChats || []).includes(chatId);
    const ok = await muteChat(state.user.uid, chatId, !isMuted);
    if (ok) {
      if (isMuted) state.mutedChats = state.mutedChats.filter(u => u !== chatId);
      else state.mutedChats = [...state.mutedChats, chatId];
      showToast(isMuted ? "Notif aktif 🔔" : "Dibisukan 🔕");
    }
  } else if (action === "archive-chat") {
    const chatId = state.currentChat === "dm" ? state.dmWithUid : state.currentGroupId;
    if (!chatId) return;
    const ok = await archiveChat(state.user.uid, chatId, false);
    if (ok) {
      state.archivedChats = state.archivedChats.filter(u => u !== chatId);
      showToast("Unarchive 📦");
    }
  } else if (action === "wallpaper") {
    $("menu-wallpaper")?.click();
  } else if (action === "leave") {
    if (!confirm("Keluar dari chat ini?")) return;
    $("chat-back")?.click();
  }
}

/* ============================================================
   EXPOSE
   ============================================================ */
window.App = {
  state, showToast, showInfo, applyTheme, openChatDetail, openProfileModal,
  openStoryViewer, closeStoryViewer, nextStory, prevStory,
  editNama, editBio, editUsername, logout,
  startGame, endGame, handleTap,
  addMessageReaction, getDMRoomId, copyUID,
  isRealName,
  getCurrentModel, getAvailableModels, setAIModel,
  generateImage, showGlobalUserInfo,
  openGroupInfo, openCreateGroupModal,
  applyChatFilter, enterSelectionMode, exitSelectionMode, selectChat,
  repairFriendship
};

/* ============================================================
   RIPPLE + HEADER SCROLL
   ============================================================ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".icon-round-btn, .btn-primary, .input-round-btn, .tk-subtab, .wa-filter, .fab");
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
  ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
});

// header shadow saat scroll
const _scrollTargets = [".tab-content", ".chat-messages"];
_scrollTargets.forEach(sel => {
  document.addEventListener("scroll", (e) => {
    const t = e.target;
    if (!t || !t.matches?.(sel)) return;
    const header = document.querySelector(".app-header");
    if (header) header.classList.toggle("scrolled", t.scrollTop > 8);
  }, true);
});

console.log("✅ FluxChat & FluxAI loaded v18 (WA-Style + Selection Mode + auto-symmetric friends)");