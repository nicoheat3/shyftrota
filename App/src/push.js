// Phone notifications (web push) — browser side.
import { supabase } from "./lib/supabaseClient.js";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
export function isStandalone() {
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
}
export function isIOS() {
  var ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function keyBytes(b64) {
  var pad = "=".repeat((4 - (b64.length % 4)) % 4);
  var raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  var out = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function b64(buf) {
  var s = "", b = new Uint8Array(buf);
  for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function registration() {
  var reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

// "unsupported" | "install" (iPhone, not added to Home Screen) | "blocked" | "off" | "on"
export async function pushStatus() {
  if (!pushSupported()) return isIOS() && !isStandalone() ? "install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  var reg = await navigator.serviceWorker.getRegistration("/");
  var sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && Notification.permission === "granted" ? "on" : "off";
}

async function save(sub, user) {
  var j = sub.toJSON ? sub.toJSON() : {};
  // The server fills in who this is from the signed-in profile.
  var r = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: (j.keys && j.keys.p256dh) || b64(sub.getKey("p256dh")),
    p_auth: (j.keys && j.keys.auth) || b64(sub.getKey("auth")),
    p_user_agent: (navigator.userAgent || "").slice(0, 200),
  });
  if (r.error) throw new Error(/save_push_subscription|schema cache/.test(r.error.message) ? "the database isn't set up for notifications yet" : r.error.message);
}

// Must be called straight from a tap (iPhone requires it).
export async function enablePush(user) {
  var perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "blocked" : "off";
  var reg = await registration();
  var sub = await reg.pushManager.getSubscription();
  if (!sub) {
    var k = await fetch("/api/push-key").then(function (r) { return r.json(); });
    if (!k.publicKey) throw new Error("Notifications aren't set up on the server yet");
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(k.publicKey) });
  }
  await save(sub, user);
  return "on";
}

export async function disablePush() {
  var reg = await navigator.serviceWorker.getRegistration("/");
  var sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return "off";
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
  return "off";
}

// Quietly keep this phone's subscription saved (e.g. after the browser rotates it).
export async function refreshPush(user) {
  try {
    if (!pushSupported() || Notification.permission !== "granted" || !user || user.eid == null) return;
    var reg = await navigator.serviceWorker.getRegistration("/");
    var sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) await save(sub, user);
  } catch (e) { /* best effort */ }
}
