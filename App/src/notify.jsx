// ── Email notifications ───────────────────────────────
// Settings card where each person saves the email they want notifications
// at, and admins can fill in emails for their team as they collect them.
// Nobody is emailed until an address is saved here.

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient.js";
import { pushStatus, enablePush, disablePush, isIOS } from "./push.js";

var T = {
  bg:"var(--bg)", surface:"var(--surface)", border:"var(--border)", text:"var(--text)", muted:"var(--muted)", faint:"var(--faint)", accent:"var(--accent)", accentL:"var(--accentL)", danger:"var(--danger)", success:"var(--success)",
};
var CARD = { background:T.surface, border:"1px solid "+T.border, borderRadius:12, padding:20, boxShadow:"var(--shadow)", boxSizing:"border-box", marginBottom:14 };
var INP  = { width:"100%", background:T.surface, border:"1px solid "+T.border, borderRadius:8, padding:"9px 12px", color:T.text, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" };
var LBL  = { fontSize:11, color:T.muted, display:"block", marginBottom:5, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" };
var BTN  = { background:T.accent, border:"none", borderRadius:8, padding:"9px 16px", color:"white", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" };

var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Fire-and-forget: ask the server to send emails for something that just happened.
export async function sendNotification(payload, onResult) {
  try {
    var s = await supabase.auth.getSession();
    var token = s.data && s.data.session ? s.data.session.access_token : null;
    if (!token) return;
    var r = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(payload),
    });
    var data = await r.json().catch(function(){ return {}; });
    if (!r.ok) console.error("notify failed:", data);
    if (onResult) onResult(data);
  } catch (e) { console.error("notify request failed:", e); }
}

function Toggle({ on, onChange, label, hint }) {
  return (
    <label style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 0", borderTop:"1px solid "+T.border, cursor:"pointer" }}>
      <span>
        <span style={{ fontSize:13, color:T.text, display:"block" }}>{label}</span>
        {hint && <span style={{ fontSize:11, color:T.faint }}>{hint}</span>}
      </span>
      <input type="checkbox" checked={on} onChange={function(e){ onChange(e.target.checked); }} style={{ width:18, height:18, accentColor:T.accent, flexShrink:0 }} />
    </label>
  );
}

// ── Phone notifications (Home Screen app) ─────────────
function PhoneCard({ user, showT }) {
  var [st, setSt] = useState(null);
  var [busy, setBusy] = useState(false);
  var [msg, setMsg] = useState(null);
  useEffect(function(){ pushStatus().then(setSt).catch(function(){ setSt("unsupported"); }); }, []);

  function turnOn() {
    setBusy(true); setMsg(null);
    enablePush(user).then(function(r){
      setSt(r); setBusy(false);
      if (r === "on") showT("Notifications are on for this device");
    }).catch(function(e){ setBusy(false); setMsg({ ok:false, text:"Couldn't turn on: " + (e && e.message || e) }); });
  }
  function turnOff() {
    setBusy(true); setMsg(null);
    disablePush().then(function(r){ setSt(r); setBusy(false); showT("Notifications off for this device"); })
      .catch(function(){ setBusy(false); });
  }
  function test() {
    setBusy(true); setMsg(null);
    var done = false;
    sendNotification({ type:"push_test" }, function(r){
      done = true; setBusy(false);
      if (r && r.pushed > 0) setMsg({ ok:true, text:"Sent. It should pop up in a few seconds." });
      else if (r && r.skipped === "no_device") setMsg({ ok:false, text:"This device isn't registered. Turn notifications off and on again." });
      else setMsg({ ok:false, text:"Didn't send: " + ((r && (r.error || (r.errors && r.errors[0]))) || "no answer from the server") });
    });
    setTimeout(function(){ if (!done) { setBusy(false); setMsg({ ok:false, text:"The server didn't respond." }); } }, 20000);
  }

  var ghost = { ...BTN, background:"transparent", color:T.text, border:"1px solid "+T.border };
  var note = { fontSize:12, color:T.muted, lineHeight:1.6 };
  return (
    <div style={CARD}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10 }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Phone notifications</div>
        {st === "on" && <div style={{ fontSize:12, color:T.success, fontWeight:600 }}>On for this device</div>}
      </div>
      <div style={{ ...note, marginTop:3, marginBottom:12 }}>Get a buzz when your schedule is posted, a request is answered, before your shift, or when you miss a message.</div>
      {st === null && <div style={{ fontSize:12, color:T.faint }}>Checking…</div>}
      {st === "install" && (
        <div style={{ ...note, color:T.text }}>
          On iPhone, notifications only work from the Home Screen app:
          <ol style={{ margin:"8px 0 0", paddingLeft:20 }}>
            <li>Tap the <b>Share</b> button in Safari</li>
            <li>Choose <b>Add to Home Screen</b></li>
            <li>Open ShyftRota from the new icon and come back here</li>
          </ol>
        </div>
      )}
      {st === "unsupported" && <div style={note}>{isIOS() ? "This needs iOS 16.4 or newer, opened from the Home Screen icon." : "This browser can't show notifications. Try Chrome, Edge or Safari."}</div>}
      {st === "blocked" && <div style={note}>Notifications are blocked for ShyftRota. {isIOS() ? "Open your iPhone's Settings → Notifications → ShyftRota and allow them, then come back." : "Allow them in your browser's site settings, then reload."}</div>}
      {st === "off" && <button onClick={turnOn} disabled={busy} style={{ ...BTN, opacity:busy?0.6:1 }}>{busy ? "Turning on…" : "Turn on notifications"}</button>}
      {st === "on" && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={test} disabled={busy} style={{ ...ghost, opacity:busy?0.6:1 }}>{busy ? "Working…" : "Send a test"}</button>
          <button onClick={turnOff} disabled={busy} style={{ ...ghost, color:T.muted, opacity:busy?0.6:1 }}>Turn off</button>
        </div>
      )}
      {msg && <div style={{ marginTop:10, fontSize:12, lineHeight:1.6, padding:"9px 12px", borderRadius:8, background:msg.ok?"var(--xECFDF5)":"var(--xFEF2F2)", color:msg.ok?"var(--x065F46)":"var(--x991B1B)", wordBreak:"break-word" }}>{msg.text}</div>}
    </div>
  );
}

export function NotificationSettings({ user, emps, isAdmin, showT, weeks, defaultWeek }) {
  var myEid = user.eid != null ? Number(user.eid) : null;
  var [rows, setRows] = useState({});          // employee_id -> settings row
  var [loaded, setLoaded] = useState(false);
  var [mine, setMine] = useState({ email:"", on_schedule:true, on_requests:true, on_reminders:true, on_chat:true });
  var [savingMine, setSavingMine] = useState(false);
  var [teamDraft, setTeamDraft] = useState({}); // employee_id -> email being typed
  var [sendWeek, setSendWeek] = useState(defaultWeek || 0);
  var [sendingTo, setSendingTo] = useState(null);

  useEffect(function(){
    supabase.from("notification_settings").select("*").eq("property_id", user.property_id).then(function(res){
      if (res.error) { console.error("load notification settings failed:", res.error); setLoaded(true); return; }
      var m = {};
      (res.data || []).forEach(function(r){ m[r.employee_id] = r; });
      setRows(m);
      if (myEid != null && m[myEid]) setMine({ email:m[myEid].email || "", on_schedule:m[myEid].on_schedule, on_requests:m[myEid].on_requests, on_reminders:m[myEid].on_reminders, on_chat:m[myEid].on_chat });
      setLoaded(true);
    });
  }, [user.property_id, myEid]);

  async function save(eid, patch) {
    var prev = rows[eid] || {};
    var row = {
      employee_id: eid, property_id: user.property_id,
      email: prev.email || null, on_schedule: prev.on_schedule !== false, on_requests: prev.on_requests !== false,
      on_reminders: prev.on_reminders !== false, on_chat: prev.on_chat !== false,
      ...patch, updated_at: new Date().toISOString(),
    };
    var res = await supabase.from("notification_settings").upsert(row, { onConflict:"employee_id" }).select().single();
    if (res.error || !res.data) {
      console.error("save notification settings failed:", res.error);
      showT(res.error ? ("Couldn't save — " + res.error.message) : "Couldn't save", "error");
      return false;
    }
    setRows(function(p){ var n = {...p}; n[eid] = res.data; return n; });
    return true;
  }

  var [testing, setTesting] = useState(false);
  var [testMsg, setTestMsg] = useState(null);
  function sendTest() {
    setTesting(true); setTestMsg(null);
    var done = false;
    sendNotification({ type:"test" }, function(r){
      done = true; setTesting(false);
      if (!r) { setTestMsg({ ok:false, text:"No answer from the server." }); return; }
      if (r.skipped === "no_key") setTestMsg({ ok:false, text:"Email isn't connected: RESEND_API_KEY isn't set in Vercel for this project (or it was added after the last deploy — redeploy)." });
      else if (r.skipped === "no_email") setTestMsg({ ok:false, text:"Save your email above first." });
      else if (r.sent > 0) setTestMsg({ ok:true, text:"Sent to "+r.to+". Check your inbox and spam folder." });
      else if (r.errors && r.errors.length) setTestMsg({ ok:false, text:"Resend refused it: "+r.errors[0] });
      else setTestMsg({ ok:false, text:"Didn't send: "+(r.error || JSON.stringify(r)) });
    });
    setTimeout(function(){ if (!done) { setTesting(false); setTestMsg({ ok:false, text:"The server didn't respond. The email function may have crashed — check Vercel → Logs." }); } }, 20000);
  }

  async function saveMine() {
    var email = mine.email.trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) { showT("That email doesn't look right", "error"); return; }
    setSavingMine(true);
    var ok = await save(myEid, { email: email || null, on_schedule: mine.on_schedule, on_requests: mine.on_requests, on_reminders: mine.on_reminders, on_chat: mine.on_chat });
    setSavingMine(false);
    if (ok) showT(email ? "Notification settings saved" : "Saved — no email set, so you'll only get phone notifications");
  }

  async function saveTeam(eid) {
    var email = (teamDraft[eid] != null ? teamDraft[eid] : ((rows[eid] && rows[eid].email) || "")).trim().toLowerCase();
    if (email === ((rows[eid] && rows[eid].email) || "")) return;
    if (email && !EMAIL_RE.test(email)) { showT("That email doesn't look right", "error"); return; }
    var e = emps.find(function(x){ return Number(x.id) === Number(eid); });
    if (await save(eid, { email: email || null })) showT((e ? e.name.split(" ")[0] : "Their") + "'s email " + (email ? "saved" : "removed"));
  }

  // Emails one person their shifts for the chosen (posted) week.
  function sendOne(e) {
    var w = weeks && weeks[sendWeek]; if (!w) return;
    var first = e.name.split(" ")[0];
    setSendingTo(e.id);
    var done = false;
    var guard = setTimeout(function(){ if (!done) { setSendingTo(null); showT("The email server didn't answer. Try again in a minute.", "error"); } }, 20000);
    sendNotification({ type:"schedule_posted", weekStart:w.key, repost:false, only:e.id }, function(r){
      done = true; clearTimeout(guard); setSendingTo(null);
      if (r && (r.sent > 0 || r.pushed > 0)) showT("Sent " + first + " the " + w.label + " schedule" + (r.sent > 0 && r.pushed > 0 ? " (email + phone)" : r.pushed > 0 ? " to their phone" : ""));
      else if (r && r.skipped === "opted_out") showT(first + " turned off schedule emails in their Settings", "info");
      else if (r && r.skipped === "no_email") showT(first + " has no email saved and hasn't turned on phone notifications", "error");
      else if (r && r.skipped === "no_key") showT("Email isn't set up on the server yet", "error");
      else if (r && r.error === "That week isn't posted") showT(w.label + " isn't posted yet. Post it first.", "error");
      else if (r && r.errors && r.errors.length) showT("The email didn't send. Check Resend.", "error");
      else if (r && r.error) showT(r.error, "error");
      else showT("Couldn't send to " + first, "error");
    });
  }

  if (!loaded) return <div style={CARD}><div style={{ fontSize:13, color:T.faint }}>Loading notification settings…</div></div>;

  var team = emps.slice().sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
  var withEmail = team.filter(function(e){ return rows[e.id] && rows[e.id].email; }).length;

  return (
    <div>
      {myEid != null && <PhoneCard user={user} showT={showT} />}
      {myEid != null && (
        <div style={CARD}>
          <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Email notifications</div>
          <div style={{ fontSize:12, color:T.muted, marginTop:3, marginBottom:14, lineHeight:1.6 }}>Where should ShyftRota email you? Leave it blank and you won't get any emails.</div>
          <label style={LBL}>Your email</label>
          <input type="email" value={mine.email} placeholder="you@example.com" onChange={function(e){ setMine({ ...mine, email:e.target.value }); }} style={{ ...INP, marginBottom:16 }} />
          <div style={{ fontSize:12, color:T.muted, marginBottom:4 }}><b style={{ color:T.text }}>Notify me about</b> · applies to email and phone</div>
          <Toggle on={mine.on_schedule} onChange={function(v){ setMine({ ...mine, on_schedule:v }); }} label="Schedule posted or updated" hint="Your shifts for the week" />
          <Toggle on={mine.on_requests} onChange={function(v){ setMine({ ...mine, on_requests:v }); }} label="Time off & swap answers" hint="When a request is approved or declined" />
          <Toggle on={mine.on_reminders} onChange={function(v){ setMine({ ...mine, on_reminders:v }); }} label="Shift reminders" hint="About 2 hours before each shift" />
          <Toggle on={mine.on_chat} onChange={function(v){ setMine({ ...mine, on_chat:v }); }} label="Missed chat messages" hint="When a message sits unread for 10+ minutes (at most every 30 min)" />
          <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
            <button onClick={saveMine} disabled={savingMine} style={{ ...BTN, opacity:savingMine?0.6:1 }}>{savingMine ? "Saving…" : "Save"}</button>
            {isAdmin && <button onClick={sendTest} disabled={testing} style={{ ...BTN, background:"transparent", color:T.text, border:"1px solid "+T.border, opacity:testing?0.6:1 }}>{testing ? "Sending…" : "Send test email"}</button>}
          </div>
          {testMsg && <div style={{ marginTop:10, fontSize:12, lineHeight:1.6, padding:"9px 12px", borderRadius:8, background:testMsg.ok?"var(--xECFDF5)":"var(--xFEF2F2)", color:testMsg.ok?"var(--x065F46)":"var(--x991B1B)", wordBreak:"break-word" }}>{testMsg.text}</div>}
        </div>
      )}

      {isAdmin && (
        <div style={CARD}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Team emails</div>
            <div style={{ fontSize:12, color:withEmail === team.length ? T.success : T.muted, fontWeight:600 }}>{withEmail} of {team.length} set</div>
          </div>
          <div style={{ fontSize:12, color:T.muted, marginTop:3, marginBottom:12, lineHeight:1.6 }}>Type in emails as you collect them — each one saves when you click away. Employees can also add their own under Settings.</div>
          {weeks && weeks.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:12 }}>
              <span style={{ fontSize:12, color:T.muted }}>Send button emails the schedule for</span>
              <div role="group" aria-label="Week to send" style={{ display:"flex", border:"1px solid "+T.border, borderRadius:8, padding:2 }}>
                {weeks.map(function(w, i){ var on = sendWeek === i; return (
                  <button key={w.key} aria-pressed={on} onClick={function(){ setSendWeek(i); }} style={{ minHeight:32, padding:"0 12px", borderRadius:6, border:"none", background:on?T.bg:"transparent", color:on?T.text:T.faint, fontSize:12, fontWeight:on?700:500, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{(i === 0 ? "This week · " : "Next week · ") + w.label.replace(/, \d{4}$/, "")}</button>
                ); })}
              </div>
            </div>
          )}
          {team.map(function(e){
            var current = (rows[e.id] && rows[e.id].email) || "";
            var val = teamDraft[e.id] != null ? teamDraft[e.id] : current;
            return (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderTop:"1px solid "+T.border, flexWrap:"wrap" }}>
                <div style={{ flex:"1 1 130px", fontSize:13, color:T.text, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.name}</div>
                <input type="email" value={val} placeholder="No email yet"
                  onChange={function(ev){ var v = ev.target.value; setTeamDraft(function(p){ var n = {...p}; n[e.id] = v; return n; }); }}
                  onBlur={function(){ saveTeam(e.id); }}
                  onKeyDown={function(ev){ if (ev.key === "Enter") ev.target.blur(); }}
                  style={{ ...INP, flex:"2 1 200px", padding:"7px 10px", fontSize:12 }} />
                {weeks && weeks.length > 0 && (
                  <button onClick={function(){ sendOne(e); }} disabled={!current || sendingTo === e.id}
                    title={current ? "Email " + e.name.split(" ")[0] + " their " + weeks[sendWeek].label + " schedule" : "Save an email first"}
                    style={{ ...BTN, background:"transparent", color:current ? T.text : T.faint, border:"1px solid "+T.border, padding:"0 14px", minHeight:34, fontSize:12, flexShrink:0, opacity:(!current || sendingTo === e.id) ? 0.5 : 1, cursor:current ? "pointer" : "default" }}>
                    {sendingTo === e.id ? "Sending…" : "Send"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
