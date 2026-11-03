// ── Email notifications ───────────────────────────────
// Settings card where each person saves the email they want notifications
// at, and admins can fill in emails for their team as they collect them.
// Nobody is emailed until an address is saved here.

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient.js";

var T = {
  bg:"#F8F6F3", surface:"#FFFFFF", border:"#E5E0D8", text:"#1A1714",
  muted:"#6B6460", faint:"#A09890", accent:"#C84B31", accentL:"#FDF0ED",
  danger:"#EF4444", success:"#10B981",
};
var CARD = { background:T.surface, border:"1px solid "+T.border, borderRadius:12, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.06)", boxSizing:"border-box", marginBottom:14 };
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

export function NotificationSettings({ user, emps, isAdmin, showT }) {
  var myEid = user.eid != null ? Number(user.eid) : null;
  var [rows, setRows] = useState({});          // employee_id -> settings row
  var [loaded, setLoaded] = useState(false);
  var [mine, setMine] = useState({ email:"", on_schedule:true, on_requests:true });
  var [savingMine, setSavingMine] = useState(false);
  var [teamDraft, setTeamDraft] = useState({}); // employee_id -> email being typed

  useEffect(function(){
    supabase.from("notification_settings").select("*").eq("property_id", user.property_id).then(function(res){
      if (res.error) { console.error("load notification settings failed:", res.error); setLoaded(true); return; }
      var m = {};
      (res.data || []).forEach(function(r){ m[r.employee_id] = r; });
      setRows(m);
      if (myEid != null && m[myEid]) setMine({ email:m[myEid].email || "", on_schedule:m[myEid].on_schedule, on_requests:m[myEid].on_requests });
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

  async function saveMine() {
    var email = mine.email.trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) { showT("That email doesn't look right", "error"); return; }
    setSavingMine(true);
    var ok = await save(myEid, { email: email || null, on_schedule: mine.on_schedule, on_requests: mine.on_requests });
    setSavingMine(false);
    if (ok) showT(email ? "Email notifications saved" : "Email removed — you won't get notifications");
  }

  async function saveTeam(eid) {
    var email = (teamDraft[eid] != null ? teamDraft[eid] : ((rows[eid] && rows[eid].email) || "")).trim().toLowerCase();
    if (email === ((rows[eid] && rows[eid].email) || "")) return;
    if (email && !EMAIL_RE.test(email)) { showT("That email doesn't look right", "error"); return; }
    var e = emps.find(function(x){ return Number(x.id) === Number(eid); });
    if (await save(eid, { email: email || null })) showT((e ? e.name.split(" ")[0] : "Their") + "'s email " + (email ? "saved" : "removed"));
  }

  if (!loaded) return <div style={CARD}><div style={{ fontSize:13, color:T.faint }}>Loading notification settings…</div></div>;

  var team = emps.slice().sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
  var withEmail = team.filter(function(e){ return rows[e.id] && rows[e.id].email; }).length;

  return (
    <div>
      {myEid != null && (
        <div style={CARD}>
          <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Email notifications</div>
          <div style={{ fontSize:12, color:T.muted, marginTop:3, marginBottom:14, lineHeight:1.6 }}>Where should ShyftRota email you? Leave it blank and you won't get any emails.</div>
          <label style={LBL}>Your email</label>
          <input type="email" value={mine.email} placeholder="you@example.com" onChange={function(e){ setMine({ ...mine, email:e.target.value }); }} style={{ ...INP, marginBottom:6 }} />
          <Toggle on={mine.on_schedule} onChange={function(v){ setMine({ ...mine, on_schedule:v }); }} label="Schedule posted or updated" hint="Your shifts for the week" />
          <Toggle on={mine.on_requests} onChange={function(v){ setMine({ ...mine, on_requests:v }); }} label="Time off & swap answers" hint="When a request is approved or declined" />
          <button onClick={saveMine} disabled={savingMine} style={{ ...BTN, marginTop:12, opacity:savingMine?0.6:1 }}>{savingMine ? "Saving…" : "Save"}</button>
        </div>
      )}

      {isAdmin && (
        <div style={CARD}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Team emails</div>
            <div style={{ fontSize:12, color:withEmail === team.length ? T.success : T.muted, fontWeight:600 }}>{withEmail} of {team.length} set</div>
          </div>
          <div style={{ fontSize:12, color:T.muted, marginTop:3, marginBottom:12, lineHeight:1.6 }}>Type in emails as you collect them — each one saves when you click away. Employees can also add their own under Settings.</div>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
