/* ============================================
   CHAT — Firestore functions (FULL v13)
   Friends: auto-symmetric, merge-safe, self-healing.
   ============================================ */

import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, onSnapshot, query, where, orderBy, limit,
  serverTimestamp, arrayUnion, arrayRemove, increment, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initFirebase } from "./auth.js";

const { app } = initFirebase();
export const db = getFirestore(app);

/* ============================================================
   HELPERS
   ============================================================ */
function isRealName(n) {
  if (!n) return false;
  const s = String(n).trim();
  if (s.length < 2) return false;
  if (s === "user" || s === "User" || s === "Pengguna" || s === "Pengguna Baru") return false;
  if (s.startsWith("user_")) return false;
  return true;
}

function safeEmailPrefix(email) {
  const p = (email || "").split("@")[0] || "";
  if (p.toLowerCase() === "user" || p.length < 2) return "";
  return p;
}

/** Canonical, order-independent pair id */
export function pairId(uid1, uid2) {
  return [String(uid1), String(uid2)].sort().join("_");
}

/* ============================================================
   USER PROFILE
   ============================================================ */
export async function saveUserProfile(user) {
  if (!user || !user.uid) return false;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const numericUid = String(Math.floor(100000000000 + Math.random() * 900000000000));
    const emailPrefix = safeEmailPrefix(user.email);
    const username = emailPrefix ? emailPrefix.toLowerCase() : "user_" + user.uid.slice(0, 6);

    let displayName = (user.displayName || "").trim();
    if (!isRealName(displayName)) displayName = emailPrefix;
    if (!isRealName(displayName)) displayName = "Pengguna Baru";

    await setDoc(ref, {
      uid: user.uid,
      numericUid,
      email: user.email || "",
      displayName,
      username,
      photoURL: user.photoURL || "",
      bannerURL: "",
      bio: "Halo, saya menggunakan FluxChat!",
      conversations: [],
      friends: [],
      pinnedChats: [],
      mutedChats: [],
      archivedChats: [],
      groups: [],
      isOnline: false,
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp()
    });
    return true;
  }

  const existing = snap.data();
  const updates = { lastSeen: serverTimestamp() };

  if (user.photoURL && !existing.photoURL) updates.photoURL = user.photoURL;
  if (!existing.email && user.email) updates.email = user.email;

  if (!isRealName(existing.displayName)) {
    const emailPrefix = safeEmailPrefix(existing.email || user.email);
    let newName = (user.displayName || "").trim();
    if (!isRealName(newName)) newName = emailPrefix;
    if (!isRealName(newName)) newName = "Pengguna Baru";
    updates.displayName = newName;
  }

  if (!existing.numericUid || existing.numericUid === "") {
    updates.numericUid = String(Math.floor(100000000000 + Math.random() * 900000000000));
  }

  if (!existing.username || existing.username === "" || existing.username === "user") {
    const emailPrefix = safeEmailPrefix(existing.email || user.email);
    updates.username = emailPrefix ? emailPrefix.toLowerCase() : "user_" + user.uid.slice(0, 6);
  }

  await updateDoc(ref, updates);
  return true;
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() };
}

export async function getUserProfileByUid(uid) {
  return getUserProfile(uid);
}

export async function getUsersProfiles(uids) {
  if (!uids || uids.length === 0) return [];
  const results = [];
  for (const uid of uids) {
    try {
      const p = await getUserProfile(uid);
      if (p) results.push(p);
    } catch (e) {
      console.warn("[getUsersProfiles] skip", uid, e?.message || e);
    }
  }
  return results;
}

export async function updateUserProfile(user, fields) {
  if (!user || !user.uid) throw new Error("User tidak valid");
  const ref = doc(db, "users", user.uid);

  try {
    await setDoc(ref, {
      ...fields,
      lastSeen: serverTimestamp()
    }, { merge: true });

    if (fields.displayName !== undefined || fields.photoURL !== undefined) {
      const { updateProfile: updateAuthProfile } = await import(
        "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
      );
      const authUpdates = {};
      if (fields.displayName !== undefined) authUpdates.displayName = fields.displayName;
      if (fields.photoURL !== undefined) authUpdates.photoURL = fields.photoURL;

      if (Object.keys(authUpdates).length > 0) {
        await updateAuthProfile(user, authUpdates).catch((e) => {
          console.warn("[updateUserProfile] Auth profile update gagal:", e);
        });
      }
    }

    return true;
  } catch (e) {
    console.error("[updateUserProfile]", e);
    throw e;
  }
}

/* ============================================================
   CARI USER
   ============================================================ */
export async function findUserByNumericUidOrEmail(text) {
  const clean = (text || "").trim();
  if (!clean) return null;

  const q1 = query(collection(db, "users"), where("email", "==", clean), limit(1));
  const s1 = await getDocs(q1);
  if (!s1.empty) return { uid: s1.docs[0].id, ...s1.docs[0].data() };

  const q2 = query(collection(db, "users"), where("numericUid", "==", clean), limit(1));
  const s2 = await getDocs(q2);
  if (!s2.empty) return { uid: s2.docs[0].id, ...s2.docs[0].data() };

  const clean2 = clean.replace(/^@/, "").toLowerCase();
  const q3 = query(collection(db, "users"), where("username", "==", clean2), limit(1));
  const s3 = await getDocs(q3);
  if (!s3.empty) return { uid: s3.docs[0].id, ...s3.docs[0].data() };

  return null;
}

export async function searchUsers(text, excludeUid, maxResults = 10) {
  const clean = (text || "").trim().toLowerCase();
  if (!clean) return [];
  const all = await getDocs(query(collection(db, "users"), limit(200)));
  return all.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u =>
      u.uid !== excludeUid &&
      ((u.email || "").toLowerCase().includes(clean) ||
       (u.displayName || "").toLowerCase().includes(clean) ||
       (u.username || "").toLowerCase().includes(clean) ||
       (u.numericUid || "").includes(clean))
    )
    .slice(0, maxResults);
}

/* ============================================================
   GLOBAL CHAT
   ============================================================ */
export function listenGlobalMessages(callback) {
  const q = query(
    collection(db, "global_messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs);
  }, (err) => {
    console.error("listenGlobalMessages error:", err);
    callback([], err);
  });
}

export async function sendGlobalMessage(user, payload) {
  const profile = await getUserProfile(user.uid);
  await addDoc(collection(db, "global_messages"), {
    ...payload,
    uid: user.uid,
    name: profile?.displayName || user.displayName || "Anonim",
    photoURL: profile?.photoURL || user.photoURL || "",
    createdAt: serverTimestamp(),
    read: false,
    reactions: {}
  });
}

/* ============================================================
   PRIVATE CHAT (DM)
   ============================================================ */
export function getDMRoomId(uid1, uid2) {
  return pairId(uid1, uid2);
}

export function listenPrivateMessages(uid1, uid2, callback) {
  const roomId = getDMRoomId(uid1, uid2);
  const q = query(
    collection(db, "chats_dm", roomId, "messages"),
    orderBy("createdAt", "asc"),
    limit(300)
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs);
  }, (err) => {
    console.error("listenPrivateMessages error:", err);
    callback([], err);
  });
}

export async function sendPrivateMessage(user, otherUid, payload, replyTo = null) {
  const roomId = getDMRoomId(user.uid, otherUid);
  const profile = await getUserProfile(user.uid);

  await addDoc(collection(db, "chats_dm", roomId, "messages"), {
    ...payload,
    uid: user.uid,
    name: profile?.displayName || user.displayName || "User",
    photoURL: profile?.photoURL || user.photoURL || "",
    replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, name: replyTo.name } : null,
    createdAt: serverTimestamp(),
    read: false,
    reactions: {}
  });

  await setDoc(doc(db, "chats_dm", roomId), {
    participants: [user.uid, otherUid],
    members: [user.uid, otherUid],
    lastMessage: payload.text
      || (payload.type === "sticker" ? "Stiker"
      : payload.type === "voice" ? "Voice Note"
      : payload.type === "location" ? "📍 Lokasi"
      : payload.type === "contact" ? "📇 Kontak"
      : "Pesan"),
    lastMessageUid: user.uid,
    lastTime: serverTimestamp(),
    [`unread.${otherUid}`]: increment(1),
    [`unread.${user.uid}`]: 0
  }, { merge: true });

  await setDoc(doc(db, "users", user.uid), {
    conversations: arrayUnion(otherUid)
  }, { merge: true }).catch(() => {});
  await setDoc(doc(db, "users", otherUid), {
    conversations: arrayUnion(user.uid)
  }, { merge: true }).catch(() => {});
}

export async function markMessagesAsRead(uid, otherUid) {
  if (!uid || !otherUid) return;
  const roomId = getDMRoomId(uid, otherUid);
  try {
    const q = query(
      collection(db, "chats_dm", roomId, "messages"),
      where("uid", "==", otherUid)
    );
    const snap = await getDocs(q);
    const unreadDocs = snap.docs.filter(d => d.data().read !== true);
    if (unreadDocs.length > 0) {
      await Promise.all(unreadDocs.map(d => updateDoc(d.ref, { read: true })));
    }
    await setDoc(doc(db, "chats_dm", roomId), {
      [`unread.${uid}`]: 0
    }, { merge: true });
  } catch (e) {
    console.error("[markMessagesAsRead] Error:", e);
  }
}

/* ============================================================
   TYPING
   ============================================================ */
export async function setTypingStatus(uid, otherUid, isTyping) {
  const roomId = getDMRoomId(uid, otherUid);
  try {
    await setDoc(doc(db, "chats_dm", roomId, "typing", uid), {
      isTyping,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn("[setTypingStatus]", e);
  }
}

export function listenTypingStatus(uid, otherUid, callback) {
  const roomId = getDMRoomId(uid, otherUid);
  return onSnapshot(doc(db, "chats_dm", roomId, "typing", otherUid), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const age = Date.now() - (data.updatedAt?.toDate?.().getTime() || 0);
      callback(data.isTyping && age < 5000);
    } else {
      callback(false);
    }
  }, () => callback(false));
}

/* ============================================================
   CALLS
   ============================================================ */
export async function sendCallSignal(fromUid, toUid, signal) {
  await setDoc(doc(db, "calls", toUid + "_" + fromUid), {
    ...signal,
    fromUid,
    toUid,
    timestamp: serverTimestamp()
  }, { merge: true });
}

export function listenCallSignal(uid, otherUid, callback) {
  return onSnapshot(doc(db, "calls", uid + "_" + otherUid), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

export async function clearCallSignal(fromUid, toUid) {
  try {
    await deleteDoc(doc(db, "calls", toUid + "_" + fromUid));
  } catch (e) {
    console.log("[clearCallSignal] Nothing to clear:", e.message);
  }
}

/* ============================================================
   MESSAGE REACTIONS
   ============================================================ */
export async function addMessageReaction(chatType, roomId, msgId, emoji, uid) {
  let ref;
  if (chatType === "global") ref = doc(db, "global_messages", msgId);
  else if (chatType === "group" && roomId) ref = doc(db, "groups", roomId, "messages", msgId);
  else if (chatType === "dm" && roomId) ref = doc(db, "chats_dm", roomId, "messages", msgId);
  else return false;

  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const reactions = snap.data().reactions || {};
  const users = reactions[emoji] || [];
  if (users.includes(uid)) {
    reactions[emoji] = users.filter(u => u !== uid);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  } else {
    reactions[emoji] = [...users, uid];
  }
  await updateDoc(ref, { reactions });
  return true;
}

export async function deleteMessage(chatType, roomId, msgId) {
  let ref;
  if (chatType === "global") ref = doc(db, "global_messages", msgId);
  else if (chatType === "group" && roomId) ref = doc(db, "groups", roomId, "messages", msgId);
  else if (chatType === "dm" && roomId) ref = doc(db, "chats_dm", roomId, "messages", msgId);
  else return false;
  await deleteDoc(ref);
  return true;
}

export async function toggleMessageStar(chatType, roomId, msgId, uid) {
  let ref;
  if (chatType === "global") ref = doc(db, "global_messages", msgId);
  else if (chatType === "group" && roomId) ref = doc(db, "groups", roomId, "messages", msgId);
  else if (chatType === "dm" && roomId) ref = doc(db, "chats_dm", roomId, "messages", msgId);
  else throw new Error("Invalid chatType/roomId");

  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Pesan tidak ditemukan");
  const starred = snap.data().starred || false;
  await updateDoc(ref, { starred: !starred });
  return !starred;
}

export async function editMessage(chatType, roomId, msgId, newText, uid) {
  let ref;
  if (chatType === "global") ref = doc(db, "global_messages", msgId);
  else if (chatType === "group" && roomId) ref = doc(db, "groups", roomId, "messages", msgId);
  else if (chatType === "dm" && roomId) ref = doc(db, "chats_dm", roomId, "messages", msgId);
  else throw new Error("Invalid chatType/roomId");

  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Pesan gak ketemu");
  const data = snap.data();
  if (data.uid !== uid) throw new Error("Bukan pesan lo");
  const created = data.createdAt?.toDate?.()?.getTime() || 0;
  if (Date.now() - created > 15 * 60 * 1000) {
    throw new Error("Udah lewat 15 menit, gak bisa edit");
  }
  await updateDoc(ref, {
    text: newText,
    edited: true,
    editedAt: serverTimestamp()
  });
  return true;
}

/* ============================================================
   MUTE / ARCHIVE / PIN
   ============================================================ */
export async function muteChat(uid, otherUid, muted) {
  if (!uid || !otherUid) return false;
  try {
    await setDoc(doc(db, "users", uid), {
      mutedChats: muted ? arrayUnion(otherUid) : arrayRemove(otherUid)
    }, { merge: true });
    return true;
  } catch (e) { console.warn("[muteChat]", e); return false; }
}

export async function archiveChat(uid, otherUid, archived) {
  if (!uid || !otherUid) return false;
  try {
    await setDoc(doc(db, "users", uid), {
      archivedChats: archived ? arrayUnion(otherUid) : arrayRemove(otherUid)
    }, { merge: true });
    return true;
  } catch (e) { console.warn("[archiveChat]", e); return false; }
}

export async function pinChat(uid, otherUid, pinned) {
  if (!uid || !otherUid) return false;
  try {
    await setDoc(doc(db, "users", uid), {
      pinnedChats: pinned ? arrayUnion(otherUid) : arrayRemove(otherUid)
    }, { merge: true });
    return true;
  } catch (e) { console.warn("[pinChat]", e); return false; }
}

/* ============================================================
   CHAT ACTIONS — buat selection toolbar
   ============================================================ */

/** Clear obrolan — hapus semua pesan di room. */
export async function clearChat(chatType, roomId) {
  try {
    if (!chatType || !roomId) return false;
    let colRef;
    if (chatType === "global") {
      return false;
    } else if (chatType === "group") {
      colRef = collection(db, "groups", roomId, "messages");
    } else {
      colRef = collection(db, "chats_dm", roomId, "messages");
    }

    const snap = await getDocs(colRef);
    const batch = [];
    snap.forEach(d => {
      batch.push(deleteDoc(d.ref).catch(e => console.warn("[clearChat] skip", d.id, e.code)));
    });
    await Promise.all(batch);
    return true;
  } catch (e) {
    console.error("[clearChat]", e);
    return false;
  }
}

/** Tandai chat sebagai belum dibaca. */
export async function markChatUnread(uid, chatId, isGroup = false) {
  try {
    if (!uid || !chatId) return false;
    if (isGroup) {
      const ref = doc(db, "groups", chatId);
      await updateDoc(ref, { [`unread.${uid}`]: increment(1) });
    } else {
      const roomId = pairId(uid, chatId);
      const ref = doc(db, "chats_dm", roomId);
      await setDoc(ref, { [`unread.${uid}`]: increment(1) }, { merge: true });
    }
    return true;
  } catch (e) {
    console.warn("[markChatUnread]", e);
    return false;
  }
}

/** Tandai semua chat sebagai sudah dibaca. */
export async function markAllRead(uid, chatIds = []) {
  try {
    if (!uid) return false;
    for (const chatId of chatIds) {
      try {
        const roomId = pairId(uid, chatId);
        await setDoc(doc(db, "chats_dm", roomId), { [`unread.${uid}`]: 0 }, { merge: true });
      } catch (e) { /* skip */ }
    }
    return true;
  } catch (e) {
    console.warn("[markAllRead]", e);
    return false;
  }
}

/** Block user — belum ada UI, tapi siapin. */
export async function blockUser(myUid, targetUid) {
  try {
    if (!myUid || !targetUid) return false;
    await setDoc(doc(db, "users", myUid), {
      blockedUsers: arrayUnion(targetUid)
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn("[blockUser]", e);
    return false;
  }
}

/* ============================================================
   FRIENDS — AUTO-SYMMETRIC
   ============================================================ */

async function ensureSymmetricFriends(uidA, uidB) {
  if (!uidA || !uidB || uidA === uidB) return { okA: false, okB: false };
  let okA = false, okB = false;
  let aHas = false, bHas = false;

  try {
    const aSnap = await getDoc(doc(db, "users", uidA));
    aHas = (aSnap.data()?.friends || []).includes(uidB);
  } catch (e) { /* lanjut */ }
  try {
    const bSnap = await getDoc(doc(db, "users", uidB));
    bHas = (bSnap.data()?.friends || []).includes(uidA);
  } catch (e) { /* lanjut */ }

  if (!aHas) {
    try {
      await setDoc(doc(db, "users", uidA), { friends: arrayUnion(uidB) }, { merge: true });
      okA = true;
    } catch (e) {
      console.error("[friends] GAGAL update", uidA, ":", e.code, e.message);
    }
  } else {
    okA = true;
  }

  if (!bHas) {
    try {
      await setDoc(doc(db, "users", uidB), { friends: arrayUnion(uidA) }, { merge: true });
      okB = true;
    } catch (e) {
      console.error("[friends] GAGAL update", uidB, ":", e.code, e.message);
    }
  } else {
    okB = true;
  }

  console.log("[ensureSymmetricFriends]", { uidA, uidB, aHas, bHas, wroteA: okA, wroteB: okB });
  return { okA, okB };
}

export async function sendFriendRequest(fromUid, toUid) {
  try {
    if (!fromUid || !toUid) return "error";
    if (fromUid === toUid) return "self";

    const mySnap = await getDoc(doc(db, "users", fromUid));
    const myFriends = mySnap.data()?.friends || [];
    if (myFriends.includes(toUid)) {
      await ensureSymmetricFriends(fromUid, toUid);
      return "already_friends";
    }

    const reqId = pairId(fromUid, toUid);
    const ref = doc(db, "friend_requests", reqId);
    const existing = await getDoc(ref);

    if (existing.exists()) {
      const d = existing.data();
      if (d.status === "accepted") {
        await ensureSymmetricFriends(fromUid, toUid);
        return "already_friends";
      }
      if (d.status === "pending" && d.fromUid === toUid) {
        await acceptFriendRequest(toUid, fromUid);
        return "auto_accepted";
      }
      return "already_sent";
    }

    await setDoc(ref, {
      fromUid,
      toUid,
      participants: [fromUid, toUid],
      status: "pending",
      createdAt: serverTimestamp()
    });
    return "sent";
  } catch (e) {
    console.error("[sendFriendRequest]", e?.code || "", e?.message || e);
    return "error";
  }
}

export async function acceptFriendRequest(fromUid, toUid) {
  try {
    if (!fromUid || !toUid) return false;

    const reqId = pairId(fromUid, toUid);
    const ref = doc(db, "friend_requests", reqId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      try {
        await setDoc(ref, {
          fromUid,
          toUid,
          participants: [fromUid, toUid],
          status: "accepted",
          acceptedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn("[acceptFriendRequest] req doc update gagal:", e.code);
      }
    }

    const r = await ensureSymmetricFriends(fromUid, toUid);
    return r.okA && r.okB;
  } catch (e) {
    console.error("[acceptFriendRequest]", e?.code || "", e?.message || e);
    return false;
  }
}

export async function rejectFriendRequest(fromUid, toUid) {
  try {
    const reqId = pairId(fromUid, toUid);
    await deleteDoc(doc(db, "friend_requests", reqId));
    return true;
  } catch (e) {
    console.error("[rejectFriendRequest]", e?.code || "", e?.message || e);
    return false;
  }
}

export async function removeFriend(uid1, uid2) {
  try {
    const reqId = pairId(uid1, uid2);
    await deleteDoc(doc(db, "friend_requests", reqId)).catch(() => {});

    await setDoc(doc(db, "users", uid1), {
      friends: arrayRemove(uid2),
      conversations: arrayRemove(uid2)
    }, { merge: true }).catch(e => console.warn("[removeFriend]", uid1, e.code));

    await setDoc(doc(db, "users", uid2), {
      friends: arrayRemove(uid1),
      conversations: arrayRemove(uid1)
    }, { merge: true }).catch(e => console.warn("[removeFriend]", uid2, e.code));

    return true;
  } catch (e) {
    console.error("[removeFriend]", e?.code || "", e?.message || e);
    return false;
  }
}

/** Hapus chat dari daftar pribadi (tanpa hapus pertemanan). */
export async function removeChatFromList(uid, otherUid) {
  try {
    if (!uid || !otherUid) return false;
    await setDoc(doc(db, "users", uid), {
      conversations: arrayRemove(otherUid)
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn("[removeChatFromList]", e);
    return false;
  }
}

export function listenFriendships(uid, callback) {
  if (!uid) return () => {};

  let friends = [];
  let allReqs = [];
  let healing = false;

  const emit = () => {
    const incoming = allReqs
      .filter(r => r.status === "pending" && r.toUid === uid)
      .map(r => ({ id: r.id, otherUid: r.fromUid }));
    const sent = allReqs
      .filter(r => r.status === "pending" && r.fromUid === uid)
      .map(r => ({ id: r.id, otherUid: r.toUid }));
    callback(friends, incoming, sent);
  };

  const reqUnsub = onSnapshot(
    query(collection(db, "friend_requests"), where("participants", "array-contains", uid)),
    (snap) => {
      allReqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      emit();
    },
    (err) => {
      console.warn("[listenFriendships:req]", err?.code || "", err?.message || err);
      allReqs = [];
      emit();
    }
  );

  const userUnsub = onSnapshot(
    doc(db, "users", uid),
    async (snap) => {
      if (!snap.exists()) {
        friends = [];
        emit();
        return;
      }
      const fArr = snap.data().friends || [];
      friends = fArr.map(otherUid => ({ otherUid }));
      emit();

      if (!healing && fArr.length > 0) {
        healing = true;
        for (const otherUid of fArr) {
          try {
            const otherSnap = await getDoc(doc(db, "users", otherUid));
            const otherFriends = otherSnap.data()?.friends || [];
            if (!otherFriends.includes(uid)) {
              console.log("[friends-heal] fixing asymmetry:", uid, "↔", otherUid);
              await setDoc(doc(db, "users", otherUid), { friends: arrayUnion(uid) }, { merge: true })
                .catch(e => console.warn("[friends-heal] gagal:", e.code));
            }
          } catch (e) { /* skip */ }
        }
        healing = false;
      }
    },
    (err) => {
      console.warn("[listenFriendships:user]", err?.code || "", err?.message || err);
      friends = [];
      emit();
    }
  );

  return () => { reqUnsub(); userUnsub(); };
}

/* ============================================================
   VOICE RECORDING
   ============================================================ */
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;
let recordingTimerId = null;

export async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    recordingStartTime = Date.now();

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.start();

    recordingTimerId = setInterval(() => {
      const sec = Math.floor((Date.now() - recordingStartTime) / 1000);
      window.dispatchEvent(new CustomEvent("recordingTick", { detail: sec }));
    }, 200);

    return true;
  } catch (e) {
    console.error("startRecording:", e);
    return false;
  }
}

export function stopRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") return resolve(null);
    mediaRecorder.onstop = () => {
      clearInterval(recordingTimerId);
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          base64: reader.result,
          duration: Math.floor((Date.now() - recordingStartTime) / 1000)
        });
      };
      reader.readAsDataURL(blob);
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.stop();
  });
}

export function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  clearInterval(recordingTimerId);
  audioChunks = [];
}

/* ============================================================
   STORIES
   ============================================================ */
export async function createStory(user, { imageBase64, caption }) {
  const profile = await getUserProfile(user.uid);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await addDoc(collection(db, "stories"), {
    uid: user.uid,
    name: profile?.displayName || "User",
    photoURL: profile?.photoURL || "",
    imageBase64,
    caption: caption || "",
    viewedBy: [],
    reactions: {},
    createdAt: serverTimestamp(),
    expiresAt
  });
}

export function listenStories(callback) {
  const q = query(collection(db, "stories"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const stories = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => {
        const exp = s.expiresAt?.toDate?.().getTime() || 0;
        return exp > now;
      });
    callback(stories);
  }, (err) => {
    console.warn("[listenStories] error:", err?.message || err);
    callback([]);
  });
}

export async function deleteStory(storyId) {
  await deleteDoc(doc(db, "stories", storyId));
}

export async function addStoryReaction(storyId, emoji, uid) {
  const ref = doc(db, "stories", storyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;

  const reactions = snap.data().reactions || {};
  const users = reactions[emoji] || [];

  if (users.includes(uid)) {
    reactions[emoji] = users.filter(u => u !== uid);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  } else {
    reactions[emoji] = [...users, uid];
  }

  await updateDoc(ref, { reactions });
  return true;
}

export async function markStoryViewed(storyId, uid) {
  if (!storyId || !uid) return false;
  try {
    await setDoc(doc(db, "stories", storyId), {
      viewedBy: arrayUnion(uid)
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn("[markStoryViewed]", e);
    return false;
  }
}

export async function replyToStory(story, fromUser, replyText) {
  if (!story || !fromUser || !replyText) return false;

  const payload = {
    type: "text",
    text: replyText,
    storyReply: {
      storyId: story.id,
      imageBase64: (story.imageBase64 || "").slice(0, 500),
      caption: story.caption || ""
    }
  };

  await sendPrivateMessage(fromUser, story.uid, payload);
  return true;
}

export async function getStoryViewers(storyId) {
  const ref = doc(db, "stories", storyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data();
  const viewerUids = data.viewedBy || [];
  if (viewerUids.length === 0) return [];
  return await getUsersProfiles(viewerUids);
}

/* ============================================================
   ONLINE STATUS
   ============================================================ */
export async function updateLastSeen(uid) {
  if (!uid) return;
  try {
    await setDoc(doc(db, "users", uid), {
      lastSeen: serverTimestamp(),
      isOnline: true
    }, { merge: true });
  } catch (e) {
    console.warn("[updateLastSeen]", e);
  }
}

export async function setOffline(uid) {
  if (!uid) return;
  try {
    await setDoc(doc(db, "users", uid), {
      isOnline: false,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn("[setOffline]", e);
  }
}

export function listenUserStatus(uid, callback) {
  if (!uid) return () => {};
  return onSnapshot(doc(db, "users", uid), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const lastSeen = data.lastSeen?.toDate?.()?.getTime() || 0;
      const isRecent = (Date.now() - lastSeen) < 60000;
      callback({
        isOnline: data.isOnline === true && isRecent,
        lastSeen
      });
    } else {
      callback({ isOnline: false, lastSeen: 0 });
    }
  }, () => callback({ isOnline: false, lastSeen: 0 }));
}

/* ============================================================
   SEARCH MESSAGES IN CHAT
   ============================================================ */
export async function searchMessagesInChat(chatType, uid1, uid2, keyword, groupId) {
  if (!keyword) return [];
  const clean = keyword.toLowerCase();

  try {
    if (chatType === "global") {
      const q = query(
        collection(db, "global_messages"),
        orderBy("createdAt", "desc"),
        limit(200)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => (m.text || "").toLowerCase().includes(clean));
    }

    if (chatType === "group" && groupId) {
      const q = query(
        collection(db, "groups", groupId, "messages"),
        orderBy("createdAt", "desc"),
        limit(300)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => (m.text || "").toLowerCase().includes(clean));
    }

    const roomId = getDMRoomId(uid1, uid2);
    const q = query(
      collection(db, "chats_dm", roomId, "messages"),
      orderBy("createdAt", "desc"),
      limit(300)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => (m.text || "").toLowerCase().includes(clean));
  } catch (e) {
    console.warn("[searchMessagesInChat]", e);
    return [];
  }
}

/* ============================================================
   FORWARD MESSAGE
   ============================================================ */
export async function forwardMessage(message, fromUser, toType, toUid) {
  const payload = {
    type: message.type || "text",
    forwarded: true,
    forwardedFrom: message.name || "User"
  };

  if (message.text != null) payload.text = message.text;
  if (message.sticker != null) payload.sticker = message.sticker;
  if (message.audioBase64 != null) payload.audioBase64 = message.audioBase64;
  if (message.duration != null) payload.duration = message.duration;
  if (message.lat != null) payload.lat = message.lat;
  if (message.lng != null) payload.lng = message.lng;
  if (message.contactName != null) payload.contactName = message.contactName;
  if (message.contactUid != null) payload.contactUid = message.contactUid;

  if (toType === "global") {
    await sendGlobalMessage(fromUser, payload);
  } else if (toType === "dm" && toUid) {
    await sendPrivateMessage(fromUser, toUid, payload);
  } else if (toType === "group" && toUid) {
    await sendGroupMessage(fromUser, toUid, payload);
  }
  return true;
}

/* ============================================================
   GROUPS
   ============================================================ */
export async function createGroup(user, name, memberUids) {
  const gid = "g_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  const members = [user.uid, ...memberUids];
  await setDoc(doc(db, "groups", gid), {
    id: gid,
    name: name.trim(),
    photoURL: "",
    members,
    admins: [user.uid],
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    lastMessage: "",
    lastMessageName: "",
    lastTime: serverTimestamp(),
    unread: {}
  });
  for (const uid of members) {
    await setDoc(doc(db, "users", uid), { groups: arrayUnion(gid) }, { merge: true })
      .catch(e => console.warn("[createGroup] user doc", uid, e.code));
  }
  return gid;
}

export async function sendGroupMessage(user, gid, payload, replyTo = null) {
  const profile = await getUserProfile(user.uid);
  const body = {
    ...payload,
    uid: user.uid,
    name: profile?.displayName || user.displayName || "User",
    photoURL: profile?.photoURL || user.photoURL || "",
    replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, name: replyTo.name } : null,
    createdAt: serverTimestamp(),
    read: false,
    reactions: {}
  };
  const ref = await addDoc(collection(db, "groups", gid, "messages"), body);
  await setDoc(doc(db, "groups", gid), {
    lastMessage: payload.text
      || (payload.type === "sticker" ? "Stiker"
      : payload.type === "voice" ? "Voice Note"
      : payload.type === "location" ? "📍 Lokasi"
      : payload.type === "contact" ? "📇 Kontak"
      : "Pesan"),
    lastMessageName: profile?.displayName || "User",
    lastTime: serverTimestamp()
  }, { merge: true });
  return ref.id;
}

export function listenGroupMessages(gid, callback) {
  const q = query(
    collection(db, "groups", gid, "messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs);
  }, (err) => {
    console.warn("[listenGroupMessages]", err?.message || err);
    callback([]);
  });
}

export async function updateGroupName(gid, name, uid) {
  await updateDoc(doc(db, "groups", gid), { name });
  return true;
}

export async function addGroupMember(gid, uid, byUid) {
  await updateDoc(doc(db, "groups", gid), { members: arrayUnion(uid) });
  await setDoc(doc(db, "users", uid), { groups: arrayUnion(gid) }, { merge: true });
  return true;
}

export async function removeGroupMember(gid, uid, byUid) {
  await updateDoc(doc(db, "groups", gid), {
    members: arrayRemove(uid),
    admins: arrayRemove(uid)
  });
  await setDoc(doc(db, "users", uid), { groups: arrayRemove(gid) }, { merge: true });
  return true;
}

export async function leaveGroup(gid, uid) {
  return removeGroupMember(gid, uid, uid);
}

export async function promoteGroupAdmin(gid, uid, byUid) {
  await updateDoc(doc(db, "groups", gid), { admins: arrayUnion(uid) });
  return true;
}

export async function demoteGroupAdmin(gid, uid, byUid) {
  await updateDoc(doc(db, "groups", gid), { admins: arrayRemove(uid) });
  return true;
}

/* ============================================================
   REPAIR MANUAL — dipanggil dari console
   ============================================================ */
export async function repairFriendship(myUid) {
  const me = await getUserProfile(myUid);
  if (!me) return { fixed: [], failed: [] };
  const myFriends = me.friends || [];
  const fixed = [];
  const failed = [];

  for (const otherUid of myFriends) {
    try {
      const op = await getUserProfile(otherUid);
      if (op?.friends?.includes(myUid)) continue;
      await setDoc(doc(db, "users", otherUid), { friends: arrayUnion(myUid) }, { merge: true });
      fixed.push(otherUid);
    } catch (e) {
      failed.push({ uid: otherUid, code: e.code, message: e.message });
    }
  }

  return { fixed, failed };
}

/* ============================================================
   AUTO HIDE STRAY ELEMENTS
   ============================================================ */
let _strayRunning = false;
let _strayObserver = null;

export function hideStrayElements() {
  const hide = () => {
    if (_strayRunning) return;
    _strayRunning = true;
    try {
      document.querySelectorAll("*").forEach(el => {
        if (el.dataset.hiddenStray === "true") return;
        if (el.id && ["chat-messages", "chat-detail", "chat-input", "toast"].includes(el.id)) return;
        if (el.closest("#chat-messages")) return;
        if (el.closest("#chat-detail")) return;
        if (el.closest(".modal")) return;
        if (el.closest(".tk-nav")) return;
        if (el.closest(".tk-subpanel")) return;

        const txt = (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) ?
          el.textContent.trim() : "";

        if (txt === "Nama Pengguna" || txt === "@mega" || txt.includes("MENU KEDUA")) {
          const p = el.parentElement;
          if (p && !p.closest("#chat-messages") && !p.closest(".modal")) {
            p.style.display = "none";
            p.setAttribute("data-hidden-stray", "true");
          }
        }
      });
    } finally {
      _strayRunning = false;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hide);
  } else {
    hide();
  }

  if (_strayObserver) _strayObserver.disconnect();
  _strayObserver = new MutationObserver(() => {
    clearTimeout(window._strayTimer);
    window._strayTimer = setTimeout(hide, 300);
  });
  _strayObserver.observe(document.body, { childList: true, subtree: true });
}

hideStrayElements();

console.log("✅ chat.js loaded v13 (auto-symmetric friends + self-healing + removeChatFromList)");