// ── Passwords ─────────────────────────────────────────
// Everything a person does with their own password:
//   • ForgotPassword   — "Forgot password?" on the login screen; emails a reset link
//   • SetPasswordScreen — full-page "pick your own password", shown after a reset
//                         link, or on first login with a temporary password
//   • ChangePasswordModal — Settings → Change password (checks the current one first)

import { useState } from "react";
import { supabase } from "./lib/supabaseClient.js";

var T = {
  bg:"var(--bg)", surface:"var(--surface)", border:"var(--border)", text:"var(--text)", muted:"var(--muted)", faint:"var(--faint)",
  accent:"var(--accent)", danger:"var(--danger)", dangerL:"var(--dangerL)", success:"var(--success)", successL:"var(--successL)", onAccent:"var(--onAccent)",
};
var CARD = { background:T.surface, border:"1px solid "+T.border, borderRadius:"var(--r-card)", padding:28, boxShadow:"var(--shadow)", boxSizing:"border-box" };
var INP  = { width:"100%", background:T.surface, border:"1px solid "+T.border, borderRadius:"var(--r-ctl)", padding:"10px 12px", color:T.text, fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" };
var LBL  = { fontSize:11, color:T.muted, display:"block", marginBottom:5, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" };
var BTN  = { background:T.accent, border:"none", borderRadius:"var(--r-ctl)", padding:"11px 16px", color:T.onAccent, cursor:"pointer", fontSize:14, fontWeight:600, fontFamily:"inherit", width:"100%" };
var LINK = { background:"none", border:"none", padding:0, color:T.muted, fontSize:13, cursor:"pointer", fontFamily:"inherit", textDecoration:"underline", textUnderlineOffset:3 };
var PAGE = { minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-ui)", padding:20, boxSizing:"border-box" };

var RULES = [
  { test:function(p){ return p.length >= 8; },          text:"8+ characters" },
  { test:function(p){ return /[A-Z]/.test(p); },        text:"An uppercase letter" },
  { test:function(p){ return /[a-z]/.test(p); },        text:"A lowercase letter" },
  { test:function(p){ return /[0-9]/.test(p); },        text:"A number" },
  { test:function(p){ return /[^A-Za-z0-9]/.test(p); }, text:"A symbol (!@#$…)" },
];
export function passwordProblem(pw) {
  var miss = RULES.filter(function(r){ return !r.test(pw || ""); });
  return miss.length ? "Password needs: " + miss.map(function(r){ return r.text.toLowerCase(); }).join(", ") + "." : null;
}

function Msg({ kind, children }) {
  if (!children) return null;
  var bad = kind === "error";
  return <div role={bad ? "alert" : "status"} style={{ background:bad?T.dangerL:T.successL, border:"1px solid "+(bad?T.danger:T.success), borderRadius:8, padding:"9px 12px", color:T.text, fontSize:13, lineHeight:1.5, marginBottom:13 }}>{children}</div>;
}

// New password + confirm, hidden by default, with the rules ticking off as you type.
function NewPasswordFields({ pw, setPw, pw2, setPw2, onEnter }) {
  var [show, setShow] = useState(false);
  var type = show ? "text" : "password";
  return (
    <div>
      <div style={{ marginBottom:12 }}>
        <label style={LBL} htmlFor="pw-new">New password</label>
        <div style={{ position:"relative" }}>
          <input id="pw-new" type={type} autoComplete="new-password" value={pw} onChange={function(e){ setPw(e.target.value); }} style={{ ...INP, paddingRight:64 }} />
          <button type="button" onClick={function(){ setShow(!show); }} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", ...LINK, fontSize:12, textDecoration:"none" }}>{show ? "Hide" : "Show"}</button>
        </div>
      </div>
      <ul style={{ listStyle:"none", padding:0, margin:"0 0 14px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 10px" }}>
        {RULES.map(function(r){
          var ok = r.test(pw);
          return <li key={r.text} style={{ fontSize:12, color:ok?T.success:T.faint, display:"flex", alignItems:"center", gap:6 }}><span aria-hidden="true">{ok ? "✓" : "○"}</span>{r.text}</li>;
        })}
      </ul>
      <div style={{ marginBottom:16 }}>
        <label style={LBL} htmlFor="pw-confirm">Type it again</label>
        <input id="pw-confirm" type={type} autoComplete="new-password" value={pw2} onChange={function(e){ setPw2(e.target.value); }} onKeyDown={function(e){ if (e.key === "Enter" && onEnter) onEnter(); }} style={INP} />
        {pw2 && pw !== pw2 && <div style={{ fontSize:12, color:T.danger, marginTop:5 }}>Doesn't match yet</div>}
      </div>
    </div>
  );
}

function checkNew(pw, pw2) {
  var p = passwordProblem(pw);
  if (p) return p;
  if (pw !== pw2) return "The two passwords don't match.";
  return null;
}

// ── Login screen: forgot password ────────────────────
export function ForgotPassword({ initialEmail, onBack, expired }) {
  var [email, setEmail] = useState(initialEmail || "");
  var [busy, setBusy] = useState(false);
  var [sent, setSent] = useState(false);
  var [err, setErr] = useState("");

  async function send() {
    var e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setErr("Enter the email you sign in with."); return; }
    setBusy(true); setErr("");
    var res = await supabase.auth.resetPasswordForEmail(e, { redirectTo: window.location.origin + "/" });
    setBusy(false);
    // Same message whether or not the email has an account, so nobody can use
    // this form to find out who works where. Only rate limits are shown.
    if (res.error && /rate|limit|seconds/i.test(res.error.message || "")) { setErr("Too many tries. Wait a minute and try again."); return; }
    if (res.error) console.error("reset email failed:", res.error);
    setSent(true);
  }

  return (
    <div>
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div style={{ fontWeight:800, fontSize:22, color:T.text }}>Reset your password</div>
        <div style={{ color:T.muted, fontSize:13, marginTop:4, lineHeight:1.5 }}>We'll email you a link to pick a new one.</div>
      </div>
      {expired && !sent && <Msg kind="error">That reset link expired or was already used. Send yourself a new one below.</Msg>}
      {sent ? (
        <Msg kind="ok">If <b>{email.trim()}</b> has a ShyftRota login, a reset link is on its way. It can take a minute. Check spam too. The link works once and expires in an hour.</Msg>
      ) : (
        <div>
          <div style={{ marginBottom:14 }}>
            <label style={LBL} htmlFor="fp-email">Email</label>
            <input id="fp-email" type="email" autoComplete="email" value={email} onChange={function(e){ setEmail(e.target.value); setErr(""); }} onKeyDown={function(e){ if (e.key === "Enter") send(); }} placeholder="you@company.com" style={INP} />
          </div>
          <Msg kind="error">{err}</Msg>
          <button onClick={send} disabled={busy} style={{ ...BTN, opacity:busy?0.6:1 }}>{busy ? "Sending…" : "Email me a reset link"}</button>
        </div>
      )}
      <div style={{ textAlign:"center", marginTop:16 }}><button onClick={onBack} style={LINK}>Back to sign in</button></div>
    </div>
  );
}

// ── Full page: pick your own password ────────────────
// reason: "recovery" (came from a reset link) or "temporary" (first login).
export function SetPasswordScreen({ reason, name, onDone, onSignOut }) {
  var [pw, setPw] = useState("");
  var [pw2, setPw2] = useState("");
  var [busy, setBusy] = useState(false);
  var [err, setErr] = useState("");
  var first = (name || "").split(" ")[0];

  async function save() {
    var p = checkNew(pw, pw2);
    if (p) { setErr(p); return; }
    setBusy(true); setErr("");
    var res = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } });
    setBusy(false);
    if (res.error) {
      var m = res.error.message || "";
      setErr(/different/i.test(m) ? "Pick a password you haven't used here before." : "Couldn't save: " + m);
      return;
    }
    onDone();
  }

  return (
    <div style={PAGE}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={CARD}>
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <div style={{ fontWeight:800, fontSize:22, color:T.text }}>{reason === "recovery" ? "Pick a new password" : "Make it yours"}</div>
            <div style={{ color:T.muted, fontSize:13, marginTop:6, lineHeight:1.5 }}>
              {reason === "recovery"
                ? "You're signed in from the reset link. Choose a new password to finish."
                : (first ? "Welcome, " + first + ". " : "") + "You signed in with a temporary password. Choose your own before you continue."}
            </div>
          </div>
          <NewPasswordFields pw={pw} setPw={function(v){ setPw(v); setErr(""); }} pw2={pw2} setPw2={function(v){ setPw2(v); setErr(""); }} onEnter={save} />
          <Msg kind="error">{err}</Msg>
          <button onClick={save} disabled={busy} style={{ ...BTN, opacity:busy?0.6:1 }}>{busy ? "Saving…" : "Save password"}</button>
          <div style={{ textAlign:"center", marginTop:16 }}><button onClick={onSignOut} style={LINK}>Sign out</button></div>
        </div>
      </div>
    </div>
  );
}

// ── Settings: change password ────────────────────────
export function ChangePasswordModal({ email, onClose, onChanged }) {
  var [cur, setCur] = useState("");
  var [pw, setPw] = useState("");
  var [pw2, setPw2] = useState("");
  var [busy, setBusy] = useState(false);
  var [err, setErr] = useState("");

  async function save() {
    if (!cur) { setErr("Enter your current password."); return; }
    var p = checkNew(pw, pw2);
    if (p) { setErr(p); return; }
    if (cur === pw) { setErr("The new password has to be different."); return; }
    setBusy(true); setErr("");
    // Confirm it's really you before changing anything
    var check = await supabase.auth.signInWithPassword({ email: email, password: cur });
    if (check.error) { setBusy(false); setErr("Current password is wrong."); return; }
    var res = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } });
    setBusy(false);
    if (res.error) { setErr("Couldn't save: " + res.error.message); return; }
    onChanged();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Change password" onClick={function(e){ if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:1000 }}>
      <div style={{ ...CARD, width:"100%", maxWidth:400, padding:24 }}>
        <div style={{ fontWeight:700, fontSize:17, color:T.text, marginBottom:16 }}>Change password</div>
        <div style={{ marginBottom:14 }}>
          <label style={LBL} htmlFor="pw-cur">Current password</label>
          <input id="pw-cur" type="password" autoComplete="current-password" value={cur} onChange={function(e){ setCur(e.target.value); setErr(""); }} style={INP} />
        </div>
        <NewPasswordFields pw={pw} setPw={function(v){ setPw(v); setErr(""); }} pw2={pw2} setPw2={function(v){ setPw2(v); setErr(""); }} onEnter={save} />
        <Msg kind="error">{err}</Msg>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ ...BTN, background:"transparent", color:T.muted, border:"1px solid "+T.border }}>Cancel</button>
          <button onClick={save} disabled={busy} style={{ ...BTN, opacity:busy?0.6:1 }}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Full page: reset from an emailed link (?reset=<token hash>) ──
// Nothing is spent until Save: then the token is checked and the password set.
export function ResetFromLink({ tokenHash, onDone, onStartOver }) {
  var [pw, setPw] = useState("");
  var [pw2, setPw2] = useState("");
  var [busy, setBusy] = useState(false);
  var [err, setErr] = useState("");
  var [dead, setDead] = useState(false);

  async function save() {
    var p = checkNew(pw, pw2);
    if (p) { setErr(p); return; }
    setBusy(true); setErr("");
    var v = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (v.error) { setBusy(false); setDead(true); return; }
    var res = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } });
    setBusy(false);
    if (res.error) {
      var m = res.error.message || "";
      setErr(/different/i.test(m) ? "Pick a password you haven't used here before." : "Couldn't save: " + m);
      return;
    }
    onDone();
  }

  return (
    <div style={PAGE}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={CARD}>
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <div style={{ fontWeight:800, fontSize:22, color:T.text }}>{dead ? "This link has expired" : "Pick a new password"}</div>
            <div style={{ color:T.muted, fontSize:13, marginTop:6, lineHeight:1.5 }}>
              {dead ? "Reset links work once and last an hour. Request a fresh one and use the newest email." : "Choose a new password for your ShyftRota login."}
            </div>
          </div>
          {dead ? (
            <button onClick={onStartOver} style={BTN}>Send a new link</button>
          ) : (
            <div>
              <NewPasswordFields pw={pw} setPw={function(v){ setPw(v); setErr(""); }} pw2={pw2} setPw2={function(v){ setPw2(v); setErr(""); }} onEnter={save} />
              <Msg kind="error">{err}</Msg>
              <button onClick={save} disabled={busy} style={{ ...BTN, opacity:busy?0.6:1 }}>{busy ? "Saving…" : "Save password"}</button>
              <div style={{ textAlign:"center", marginTop:16 }}><button onClick={onStartOver} style={LINK}>Back to sign in</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
