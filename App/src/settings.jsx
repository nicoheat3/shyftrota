// ── Settings ──────────────────────────────────────────
// One place for everything that used to be scattered across the schedule
// toolbar, the volume panel, and the signup form.

import { useState } from "react";
import { seedThresholds } from "./volume.jsx";

var T = {
  bg:"#F8F6F3", surface:"#FFFFFF", border:"#E5E0D8", text:"#1A1714",
  muted:"#6B6460", faint:"#A09890", accent:"#C84B31", accentL:"#FDF0ED",
  danger:"#EF4444", dangerL:"#FEF2F2", success:"#10B981",
};
var CARD = { background:T.surface, border:"1px solid "+T.border, borderRadius:12, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.06)", boxSizing:"border-box", overflow:"hidden" };
var INP  = { width:"100%", background:T.surface, border:"1px solid "+T.border, borderRadius:8, padding:"9px 12px", color:T.text, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" };
var NINP = { ...INP, width:82, textAlign:"center", fontWeight:700, fontSize:14 };
var LBL  = { fontSize:11, color:T.muted, display:"block", marginBottom:5, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" };
var BTN  = { background:T.accent, border:"none", borderRadius:8, padding:"9px 16px", color:"white", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" };
var GBTN = { background:"transparent", border:"1px solid "+T.border, borderRadius:8, padding:"9px 16px", color:T.muted, cursor:"pointer", fontSize:13, fontWeight:500, fontFamily:"inherit" };

var DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var DOW = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };

function Section({ title, note, children }) {
  return (
    <div style={{ ...CARD, marginBottom:14 }}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{title}</div>
        {note && <div style={{ fontSize:12, color:T.muted, marginTop:3, lineHeight:1.6 }}>{note}</div>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 0", borderBottom:"1px solid "+T.border, flexWrap:"wrap" }}>
      <div style={{ minWidth:0, flex:"1 1 150px" }}>
        <div style={{ fontSize:13, color:T.text }}>{label}</div>
        {hint && <div style={{ fontSize:11, color:T.faint, marginTop:2 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink:0 }}>{children}</div>
    </div>
  );
}

export function Settings(props) {
  var [confirmText, setConfirmText] = useState("");
  var [deleteOpen, setDeleteOpen] = useState(false);
  var [deleting, setDeleting] = useState(false);
  var th = props.thresholds;
  var isAdmin = props.isAdmin;

  function setTh(key, value) {
    var n = Number(value);
    if (isNaN(n) || n < 0) return;
    var next = { ...th }; next[key] = n;
    props.onThresholds(next);
  }

  var isHospitality = props.industry === "hospitality";

  return (
    <div style={{ maxWidth:620 }}>
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:18 }}>Settings</h2>
        <p style={{ color:T.muted, fontSize:12, marginTop:3 }}>{isAdmin ? "Property setup and your account" : "Your account"}</p>
      </div>

      {isAdmin && (
        <Section title="Schedule" note="How the week is laid out for everyone at this property.">
          <Row label="Week starts on">
            <select value={DAY_NAMES[props.weekStartDow]} onChange={function(e){ props.onWeekStart(DOW[e.target.value]); }} style={{ ...INP, width:"auto" }}>
              {DAY_NAMES.map(function(d){ return <option key={d} value={d}>{d}day</option>; })}
            </select>
          </Row>
          <Row label="Industry" hint="Sets the role suggestions when adding staff">
            <select value={props.industry} onChange={function(e){ props.onIndustry(e.target.value); }} style={{ ...INP, width:"auto" }}>
              {Object.keys(props.industries).map(function(k){ return <option key={k} value={k}>{props.industries[k].label}</option>; })}
            </select>
          </Row>
          <Row label="Payroll provider" hint="Used to label the time clock export">
            <select value={props.payroll} onChange={function(e){ props.onPayroll(e.target.value); }} style={{ ...INP, width:"auto" }}>
              {props.payrollProviders.map(function(p){ return <option key={p.id} value={p.id}>{p.label}</option>; })}
            </select>
          </Row>
        </Section>
      )}

      {isAdmin && isHospitality && (
        <Section title="Staffing rules" note="How many people the app suggests per shift, based on the arrivals and departures you enter on the schedule.">
          <Row label="Rooms at this property">
            <div style={{ display:"flex", gap:7, alignItems:"center" }}>
              <input type="number" min={1} defaultValue={props.roomCount || ""} key={"rc"+props.roomCount} placeholder="259"
                onBlur={function(e){ props.onRoomCount(e.target.value === "" ? null : Number(e.target.value)); }} style={NINP} />
              <button onClick={function(){ if (props.roomCount) props.onThresholds(seedThresholds(props.roomCount)); }} style={GBTN}>Suggest</button>
            </div>
          </Row>
          <Row label="Second morning agent at" hint="departures">
            <input type="number" min={0} defaultValue={th.depTwo} key={"dt"+th.depTwo} onBlur={function(e){setTh("depTwo", e.target.value);}} style={NINP} />
          </Row>
          <Row label="Add a mid shift above" hint="departures">
            <input type="number" min={0} defaultValue={th.depMid} key={"dm"+th.depMid} onBlur={function(e){setTh("depMid", e.target.value);}} style={NINP} />
          </Row>
          <Row label="Second evening agent above" hint="arrivals">
            <input type="number" min={0} defaultValue={th.arrTwo} key={"at"+th.arrTwo} onBlur={function(e){setTh("arrTwo", e.target.value);}} style={NINP} />
          </Row>
          <div style={{ fontSize:11, color:T.faint, marginTop:12, lineHeight:1.6 }}>
            Suggest fills these from room count as a starting point. Your manager's own numbers will beat it — adjust until the suggestions match what he'd schedule anyway.
          </div>
        </Section>
      )}

      <Section title="Your account">
        <Row label="Name">
          <span style={{ fontSize:13, color:T.text, fontWeight:600 }}>{props.user.name}</span>
        </Row>
        <Row label="Email">
          <span style={{ fontSize:13, color:T.muted }}>{props.user.email}</span>
        </Row>
        <Row label="Role">
          <span style={{ fontSize:12, fontWeight:600, padding:"3px 10px", borderRadius:20, background:T.accentL, color:T.accent, textTransform:"capitalize" }}>{props.user.role}</span>
        </Row>
        <div style={{ marginTop:16, display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={props.onChangePassword} style={GBTN}>Change password</button>
          <button onClick={props.onLogout} style={GBTN}>Sign out</button>
        </div>
      </Section>

      <div style={{ ...CARD, border:"1px solid #FCA5A5", background:T.dangerL }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#991B1B", marginBottom:6 }}>Delete your account</div>
        <div style={{ fontSize:12, color:"#B45309", lineHeight:1.7, marginBottom:14 }}>
          Your login, profile and availability are removed for good. Your time clock punches stay on record under "Former employee" — your employer needs them for payroll, and they no longer point to you.
        </div>

        {!deleteOpen ? (
          <button onClick={function(){ setDeleteOpen(true); setConfirmText(""); }} style={{ ...GBTN, color:T.danger, borderColor:"#FCA5A5", background:T.surface }}>
            Delete my account
          </button>
        ) : (
          <div>
            <label style={LBL}>Type DELETE to confirm</label>
            <input value={confirmText} onChange={function(e){ setConfirmText(e.target.value); }} placeholder="DELETE" style={{ ...INP, marginBottom:12, maxWidth:220 }} />
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button
                disabled={confirmText !== "DELETE" || deleting}
                onClick={function(){ setDeleting(true); props.onDeleteAccount(function(){ setDeleting(false); }); }}
                style={{ ...BTN, background:T.danger, opacity:(confirmText === "DELETE" && !deleting) ? 1 : 0.45, cursor:(confirmText === "DELETE" && !deleting) ? "pointer" : "default" }}>
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
              <button onClick={function(){ setDeleteOpen(false); setConfirmText(""); }} style={{ ...GBTN, background:T.surface }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
