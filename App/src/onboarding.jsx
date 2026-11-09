import { useState } from "react";

// First-login setup checklist for managers, plus "paste your team" bulk add.
// Steps are ticked from real data where possible (shift types, employees,
// posted weeks); the rest are remembered on this device.

export function setupKey(pid, k) { return "sr_setup_" + k + "_" + pid; }
export function setupGet(pid, k) { try { return localStorage.getItem(setupKey(pid, k)) === "1"; } catch(e) { return false; } }
export function setupSet(pid, k) { try { localStorage.setItem(setupKey(pid, k), "1"); } catch(e) {} }

export function SetupChecklist({ T, CARD, BTN, GBTN, steps, onHide }) {
  var done = steps.filter(function(s){ return s.done; }).length;
  var next = steps.find(function(s){ return !s.done; });
  return (
    <section aria-label="Set up ShyftRota" style={{ ...CARD, marginBottom:16, padding:0 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, padding:"16px 20px", borderBottom:"1px solid " + T.border, flexWrap:"wrap" }}>
        <div>
          <div className="mono" style={{ fontSize:11, letterSpacing:"0.06em", color:T.accent }}>GET SET UP · {done} OF {steps.length}</div>
          <div style={{ fontWeight:800, fontSize:18, color:T.text, marginTop:2 }}>{done === steps.length ? "You're all set" : "Five steps to your first posted week"}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div aria-hidden="true" style={{ width:120, height:6, borderRadius:3, background:T.bg, overflow:"hidden" }}><div style={{ width:(done / steps.length * 100) + "%", height:"100%", background:T.success, transition:"width .3s" }} /></div>
          <button onClick={onHide} style={{ ...GBTN, fontSize:12, padding:"6px 12px" }}>Hide</button>
        </div>
      </div>
      <ol style={{ listStyle:"none", margin:0, padding:"6px 0" }}>
        {steps.map(function(s, i){
          var isNext = next && next.id === s.id;
          return (
            <li key={s.id} style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"12px 20px", background:isNext ? T.bg : "transparent" }}>
              <span aria-hidden="true" style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, background:s.done ? T.success : "transparent", color:s.done ? T.bg : T.muted, border:s.done ? "none" : "1.5px solid " + (isNext ? T.text : T.border) }}>{s.done ? "✓" : i + 1}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14, color:s.done ? T.muted : T.text, textDecoration:s.done ? "line-through" : "none" }}>{s.title}</div>
                {!s.done && <div style={{ fontSize:12, color:T.muted, marginTop:2, lineHeight:1.45 }}>{s.sub}</div>}
                {isNext && s.extra}
              </div>
              {!s.done && s.action && <button onClick={s.action} style={{ ...(isNext && !s.extra ? BTN : GBTN), fontSize:12, padding:"7px 14px", whiteSpace:"nowrap", flexShrink:0 }}>{s.actionLabel}</button>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function tempPassword() {
  var words = ["Coral","Harbor","Maple","Cedar","Sunny","Pier","Lagoon","Orchid","Summit","River","Canyon","Meadow"];
  var a = new Uint32Array(3); try { crypto.getRandomValues(a); } catch(e) { a = [Date.now(), Date.now() / 7, Date.now() / 13]; }
  return words[a[0] % words.length] + "-" + words[a[1] % words.length] + "-" + String(1000 + (a[2] % 9000));
}

// Paste "Name, email" lines → employees + logins with temporary passwords.
export function BulkAddTeam({ T, BTN, GBTN, INP, supabase, user, defaultRole, allDays, existingEmails, onAdded, showT }) {
  var [text, setText] = useState("");
  var [busy, setBusy] = useState(false);
  var [results, setResults] = useState(null);

  function parse() {
    return text.split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){
      var parts = l.split(/\s*[,\t;]\s*/);
      var email = parts.find(function(x){ return /@/.test(x); }) || "";
      var name = parts.filter(function(x){ return x !== email; }).join(" ").trim();
      return { name:name, email:email.toLowerCase() };
    });
  }
  var rows = parse();
  var valid = rows.filter(function(r){ return r.name && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email) && existingEmails.indexOf(r.email) < 0; });

  async function run() {
    if (!valid.length || busy) return;
    setBusy(true);
    var sess = await supabase.auth.getSession(), token = sess.data.session ? sess.data.session.access_token : null;
    var out = [];
    for (var i = 0; i < valid.length; i++) {
      var r = valid[i], pw = tempPassword();
      var ins = await supabase.from("employees").insert({ property_id:user.property_id, name:r.name, role:defaultRole, avail:allDays, max_hours:40, dept_id:null, shift_avail:{} }).select().single();
      if (ins.error || !ins.data) { out.push({ name:r.name, email:r.email, ok:false, err:"couldn't save" }); continue; }
      var ok = false, err = "";
      try {
        var res = await fetch("/api/create-employee-login", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer " + token }, body:JSON.stringify({ name:r.name, email:r.email, password:pw, role:"employee", employeeId:ins.data.id }) });
        var j = await res.json().catch(function(){ return {}; }); ok = res.ok; err = j.error || "";
      } catch(e) { err = "no connection"; }
      out.push({ name:r.name, email:r.email, pw:pw, ok:ok, err:err, emp:{ id:ins.data.id, name:r.name, role:ins.data.role, avail:allDays, shiftAvail:{}, max:40, dept:"" } });
    }
    onAdded(out.filter(function(o){ return o.emp; }));
    setResults(out); setBusy(false); setText("");
    var n = out.filter(function(o){ return o.ok; }).length;
    showT(n + " of " + out.length + " added with logins", n === out.length ? "success" : "error");
  }

  function invite(o) { return "Hi " + o.name.split(" ")[0] + ", our schedule is on ShyftRota now. Tap to sign in: https://app.shyftrota.com/?email=" + encodeURIComponent(o.email) + "\nTemporary password: " + o.pw + "\nTip: add it to your Home Screen first (Share → Add to Home Screen), then sign in from there."; }
  function copy(s) { try { navigator.clipboard.writeText(s); showT("Copied"); } catch(e) { showT("Couldn't copy. Select the text instead.", "error"); } }

  if (results) {
    var good = results.filter(function(o){ return o.ok; });
    return (
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:12, color:T.muted, marginBottom:8 }}>Send each person their invite. Passwords are shown once.</div>
        {results.map(function(o){ return (
          <div key={o.email} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderTop:"1px solid " + T.border, flexWrap:"wrap" }}>
            <span style={{ flex:"1 1 160px", fontSize:13, color:T.text, fontWeight:600 }}>{o.name}<span style={{ display:"block", fontWeight:400, fontSize:12, color:T.muted }}>{o.email}</span></span>
            {o.ok ? <><span className="mono" style={{ fontSize:12, color:T.text }}>{o.pw}</span><button onClick={function(){ copy(invite(o)); }} style={{ ...GBTN, fontSize:12, padding:"5px 10px" }}>Copy invite</button></> : <span style={{ fontSize:12, color:T.danger }}>Failed: {o.err || "unknown"}</span>}
          </div>
        ); })}
        <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
          {good.length > 1 && <button onClick={function(){ copy(good.map(invite).join("\n\n")); }} style={{ ...BTN, fontSize:12 }}>Copy all invites</button>}
          <button onClick={function(){ setResults(null); }} style={{ ...GBTN, fontSize:12 }}>Add more</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop:10 }}>
      <textarea value={text} onChange={function(e){ setText(e.target.value); }} rows={5} placeholder={"One person per line:\nAna Reyes, ana@email.com\nDev Kapoor, dev@email.com"} aria-label="Paste your team" style={{ ...INP, fontFamily:"inherit", resize:"vertical", minHeight:110 }} />
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginTop:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:12, color:T.muted }}>{rows.length ? valid.length + " ready" + (rows.length > valid.length ? " · " + (rows.length - valid.length) + " need a name and a new email" : "") : "Copy from a spreadsheet or your phone's contacts."}</span>
        <button disabled={!valid.length || busy} onClick={run} style={{ ...BTN, fontSize:12, opacity:!valid.length || busy ? 0.5 : 1 }}>{busy ? "Adding…" : "Add " + (valid.length || "") + " with logins"}</button>
      </div>
    </div>
  );
}
