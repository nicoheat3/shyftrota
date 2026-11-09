import { useState } from "react";

// Schedule layouts other than the classic grid (which stays in App.jsx).
// Each one reads the same week data and calls the same assign/remove
// functions the grid uses, so nothing about saving changes.

export var LAYOUTS = [
  { id:"grid",     name:"Grid",     blurb:"People down the side, days across. See anyone's whole week in one row." },
  { id:"cards",    name:"Cards",    blurb:"One card per day with who's on. Reads like a printed schedule." },
  { id:"slots",    name:"Slots",    blurb:"Shift types down the side, days across. Fill each shift box." },
  { id:"timeline", name:"Timeline", blurb:"One day as bars on a clock. Spot overlaps and thin hours." },
  { id:"list",     name:"List",     blurb:"A running list, day by day. Easy to scan and print." },
  { id:"month",    name:"Month",    blurb:"The whole month at a glance. Tap a day to open its week." }
];

var LKEY = "sr_sched_layout";
export function getLayout() { try { var v = localStorage.getItem(LKEY); return LAYOUTS.some(function(l){ return l.id === v; }) ? v : "grid"; } catch(e) { return "grid"; } }
export function hasLocalLayout() { try { return !!localStorage.getItem(LKEY); } catch(e) { return false; } }
export function saveLayout(v) { try { localStorage.setItem(LKEY, v); } catch(e) {} }

// Small schematic pictures for the picker. Static markup, no user data.
var TH = {
  grid: function(){ var s = ""; for (var i = 0; i < 5; i++) { s += r(4, 8 + i * 13, 16, 7, "var(--faint)", .5); for (var j = 0; j < 6; j++) if ((i + j) % 3) s += r(26 + j * 15, 8 + i * 13, 12, 7, C[(i + j) % 4]); } return s; },
  cards: function(){ var s = ""; for (var c = 0; c < 4; c++) { s += '<rect x="' + (4 + c * 29) + '" y="6" width="25" height="60" rx="5" fill="none" stroke="var(--border)"/>'; for (var q = 0; q < 4; q++) s += r(8 + c * 29, 12 + q * 11, 17, 7, C[[0,0,2,3][q]]); } return s; },
  slots: function(){ var s = ""; C.forEach(function(col, i){ s += r(4, 6 + i * 16, 16, 10, col); for (var j = 0; j < 6; j++) { s += r(26 + j * 15, 6 + i * 16, 12, 4, "var(--faint)", .6); s += (i + j) % 4 === 1 ? '<rect x="' + (26.5 + j * 15) + '" y="' + (12 + i * 16) + '" width="11" height="4" rx="2" fill="none" stroke="var(--accent)" stroke-dasharray="2 1.5"/>' : r(26 + j * 15, 12 + i * 16, 12, 4, "var(--faint)", .6); } }); return s; },
  timeline: function(){ var s = ""; [[10,40,0],[14,44,0],[24,56,1],[46,86,2],[50,90,2],[84,112,3]].forEach(function(b, i){ s += r(b[0], 8 + i * 9, b[1] - b[0], 6, C[b[2]]); }); return s + '<line x1="38" y1="4" x2="38" y2="64" stroke="var(--accent)" stroke-width="1.5"/>'; },
  list: function(){ var s = ""; for (var g = 0; g < 3; g++) { s += r(4, 4 + g * 23, 30, 5, "var(--faint)", .8); s += r(8, 12 + g * 23, 50, 4, C[0]); s += r(8, 18 + g * 23, 70, 4, C[2]); } return s; },
  month: function(){ var s = ""; for (var m = 0; m < 35; m++) { var x = 4 + (m % 7) * 16, y = 4 + Math.floor(m / 7) * 13.5; s += '<rect x="' + x + '" y="' + y + '" width="14" height="11.5" rx="2.5" fill="none" stroke="' + (m === 11 ? "var(--text)" : "var(--border)") + '"/>'; s += r(x + 2, y + 7, 10, 2.5, m % 9 === 4 ? "var(--accent)" : "var(--success)", m > 20 ? .35 : 1); } return s; }
};
var C = ["var(--sc-am-dot)", "var(--sc-mid-dot)", "var(--sc-pm-dot)", "var(--sc-nt-dot)"];
function r(x, y, w, h, c, o) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2.5" fill="' + c + '"' + (o ? ' opacity="' + o + '"' : "") + '/>'; }
export function Thumb({ id }) {
  return <span aria-hidden="true" style={{ display:"block", width:"100%" }} dangerouslySetInnerHTML={{ __html:'<svg viewBox="0 0 120 72" width="100%" style="display:block">' + TH[id]() + "</svg>" }} />;
}

export function LayoutPicker({ value, onChange, T, compact }) {
  return (
    <div role="radiogroup" aria-label="Schedule layout" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(" + (compact ? 104 : 160) + "px,1fr))", gap:compact ? 8 : 10 }}>
      {LAYOUTS.map(function(l){
        var on = value === l.id;
        return (
          <button key={l.id} role="radio" aria-checked={on} onClick={function(){ onChange(l.id); }} style={{ textAlign:"left", display:"flex", flexDirection:"column", gap:8, padding:10, borderRadius:"var(--r-card)", border:"1px solid " + (on ? T.text : T.border), background:on ? T.raised : T.surface, cursor:"pointer", fontFamily:"inherit", color:T.text }}>
            <span style={{ background:T.bg, borderRadius:10, padding:8, display:"block" }}><Thumb id={l.id} /></span>
            <span style={{ display:"flex", alignItems:"center", gap:6 }}><b style={{ fontSize:14 }}>{l.name}</b>{l.id === "grid" && <span style={{ fontSize:10, color:T.faint }}>default</span>}{on && <span className="mono" style={{ fontSize:10, color:T.success, border:"1px solid " + T.success, borderRadius:4, padding:"0 5px" }}>ON</span>}</span>
            {!compact && <span style={{ fontSize:12, color:T.muted, lineHeight:1.35 }}>{l.blurb}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Alternate week views ─────────────────────────────
export function AltSchedule(p) {
  var T = p.T;
  var [menu, setMenu] = useState(null);   // { day, eid } chip being edited
  var [adding, setAdding] = useState(null); // { day, sid?, eid? }

  function shiftsOn(d) {
    var ds = p.weekSched[d] || {};
    return p.emps.filter(function(e){ return ds[e.id]; }).map(function(e){
      var sid = ds[e.id], t = p.timesFor(d, e.id, sid), a = p.hrsOf(t.start);
      return { emp:e, sid:sid, t:t, a:a === null ? 99 : a, o:p.shiftDefs.findIndex(function(sd){ return sd.id === sid; }) };
    }).sort(function(x, y){ return (x.o < 0 ? 999 : x.o) - (y.o < 0 ? 999 : y.o) || x.a - y.a || x.emp.name.localeCompare(y.emp.name); });
  }
  function freeOn(d) { var ds = p.weekSched[d] || {}, iso = p.iso(d); return p.emps.filter(function(e){ return !ds[e.id] && !p.onPto(e.id, iso); }); }
  function timeLabel(t) { return t.start && t.end ? p.shortT(t.start) + "–" + p.shortT(t.end) : ""; }

  function Chip({ d, s, compact }) {
    var c = p.color(s.sid), open = menu && menu.day === d && menu.eid === s.emp.id;
    return (
      <div style={{ position:"relative" }}>
        <button onPointerDown={function(e){ if (p.onDragStart) p.onDragStart(e, { day:d, eid:s.emp.id, shift:s.sid, label:s.emp.name.split(" ")[0] }); }} onClick={function(){ if (!p.locked) setMenu(open ? null : { day:d, eid:s.emp.id }); }} aria-expanded={open} title="Tap to change, drag to move" style={{ opacity:p.cellDrag && p.cellDrag.from.day === d && String(p.cellDrag.from.eid) === String(s.emp.id) ? 0.35 : 1, width:"100%", display:"flex", alignItems:"center", gap:7, minHeight:compact ? 34 : 40, padding:"0 9px", borderRadius:"var(--r-ctl)", border:"1px solid " + T.border, background:T.bg, color:T.text, cursor:p.locked ? "default" : "pointer", fontFamily:"inherit", textAlign:"left" }}>
          <span style={{ width:8, height:8, borderRadius:2, background:c.dot, flexShrink:0 }} />
          <span style={{ fontWeight:700, fontSize:13, flex:1, minWidth:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.emp.name.split(" ")[0]}</span>
          {!compact && <span className="mono" style={{ fontSize:11, color:T.muted, whiteSpace:"nowrap" }}>{timeLabel(s.t)}</span>}
        </button>
        {open && <ShiftMenu d={d} eid={s.emp.id} cur={s.sid} onClose={function(){ setMenu(null); }} />}
      </div>
    );
  }
  function ShiftMenu({ d, eid, cur, onClose }) {
    return (
      <div role="menu" style={{ position:"absolute", zIndex:30, top:"calc(100% + 4px)", left:0, minWidth:200, background:T.surface, border:"1px solid " + T.border, borderRadius:12, padding:4, boxShadow:"0 16px 40px -12px rgba(0,0,0,.45)" }}>
        {p.shiftDefs.map(function(sd){ var c = p.color(sd.id); return (
          <button key={sd.id} role="menuitem" onClick={function(){ p.assign(d, eid, sd.id); onClose(); }} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, minHeight:38, padding:"0 10px", border:"none", borderRadius:8, background:sd.id === cur ? T.raised : "transparent", color:T.text, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
            <span style={{ width:7, height:7, borderRadius:2, background:c.dot }} /><span style={{ flex:1, textAlign:"left", fontWeight:600 }}>{sd.label}</span><span className="mono" style={{ fontSize:11, color:T.muted }}>{p.shortT(sd.start)}</span>
          </button>); })}
        {cur && <button role="menuitem" onClick={function(){ p.remove(d, eid); onClose(); }} style={{ width:"100%", minHeight:38, padding:"0 10px", border:"none", borderTop:"1px solid " + T.border, background:"transparent", color:T.danger, cursor:"pointer", fontFamily:"inherit", fontSize:13, textAlign:"left", marginTop:4 }}>Remove shift</button>}
        <button role="menuitem" onClick={onClose} style={{ width:"100%", minHeight:34, border:"none", background:"transparent", color:T.muted, cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>Cancel</button>
      </div>
    );
  }
  // "+ Add" control: pick a person, then (unless the shift is known) a shift type
  function AddControl({ d, sid, label, urgent }) {
    var st = adding && adding.day === d && adding.sid === sid ? adding : null, free = freeOn(d);
    if (p.locked) return null;
    if (!st) return <button onClick={function(){ setAdding({ day:d, sid:sid }); setMenu(null); }} style={{ width:"100%", minHeight:sid ? 34 : 40, borderRadius:"var(--r-ctl)", border:"1px dashed " + (urgent ? T.accent : T.border), background:"transparent", color:urgent ? T.accent : T.muted, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600 }}>{label || "+ Add"}</button>;
    return (
      <div style={{ position:"relative" }}>
        <select autoFocus aria-label={"Who works " + d} value="" onChange={function(e){ var eid = e.target.value; if (!eid) return; if (sid) { p.assign(d, eid, sid); setAdding(null); } else setAdding({ day:d, sid:sid, eid:eid }); }} onBlur={function(){ if (!st.eid) setTimeout(function(){ setAdding(function(x){ return x && x.eid ? x : null; }); }, 150); }} style={{ width:"100%", minHeight:38, borderRadius:"var(--r-ctl)", border:"1px solid " + T.border, background:T.bg, color:T.text, fontFamily:"inherit", fontSize:13, padding:"0 8px" }}>
          <option value="">{free.length ? "Pick someone…" : "Everyone's busy"}</option>
          {free.map(function(e){ return <option key={e.id} value={e.id}>{e.name}</option>; })}
        </select>
        {st.eid && <ShiftMenu d={d} eid={st.eid} cur={null} onClose={function(){ setAdding(null); }} />}
      </div>
    );
  }
  function dayHead(d, i) {
    var today = p.todayName === d;
    return (
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:6 }}>
        <b style={{ fontSize:17, fontWeight:800, letterSpacing:"-0.02em", color:T.text }}>{d}</b>
        <span className="mono" style={{ fontSize:11, color:today ? T.accent : T.faint }}>{today ? "TODAY" : p.dayDate(i)}</span>
      </div>
    );
  }

  if (p.layout === "cards") return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:10 }}>
      {p.days.map(function(d, i){
        var list = shiftsOn(d), today = p.todayName === d;
        return (
          <div key={d} data-drop-day={d} style={{ background:p.isDropOver && p.isDropOver(d) ? T.raised : T.surface, border:"1px solid " + (p.isDropOver && p.isDropOver(d) ? T.accent : today ? T.text : T.border), borderRadius:"var(--r-card)", padding:12, display:"flex", flexDirection:"column", gap:6, minHeight:220 }}>
            {dayHead(d, i)}
            {list.map(function(s){ return <Chip key={s.emp.id} d={d} s={s} />; })}
            {!list.length && <div style={{ fontSize:12, color:T.faint, padding:"6px 2px" }}>Nobody yet</div>}
            <div style={{ marginTop:"auto" }}><AddControl d={d} /></div>
          </div>
        );
      })}
    </div>
  );

  if (p.layout === "slots") return (
    <div style={{ background:T.surface, border:"1px solid " + T.border, borderRadius:"var(--r-card)", overflowX:"auto" }}>
      <div style={{ display:"grid", gridTemplateColumns:"170px repeat(" + p.days.length + ",minmax(112px,1fr))", minWidth:960 }}>
        <div style={{ padding:"12px 14px", borderBottom:"1px solid " + T.border, fontSize:11, color:T.faint, fontWeight:600, letterSpacing:"0.05em" }}>SHIFT</div>
        {p.days.map(function(d, i){ return <div key={d} style={{ padding:"12px 8px", borderBottom:"1px solid " + T.border, background:p.todayName === d ? T.bg : "transparent" }}>{dayHead(d, i)}</div>; })}
        {p.shiftDefs.map(function(sd){
          var c = p.color(sd.id);
          return [
            <div key={sd.id + "h"} style={{ padding:"10px 14px", borderBottom:"1px solid " + T.border, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:10, height:10, borderRadius:3, background:c.dot, flexShrink:0 }} />
              <span><b style={{ display:"block", fontSize:13, color:T.text }}>{sd.label}</b><span className="mono" style={{ fontSize:11, color:T.muted }}>{p.shortT(sd.start)}–{p.shortT(sd.end)}</span></span>
            </div>
          ].concat(p.days.map(function(d){
            var on = shiftsOn(d).filter(function(s){ return s.sid === sd.id; });
            return (
              <div key={sd.id + d} data-drop-day={d} data-drop-sid={sd.id} style={{ padding:"8px 6px", borderBottom:"1px solid " + T.border, display:"flex", flexDirection:"column", gap:5, background:p.isDropOver && p.isDropOver(d, null, sd.id) ? T.raised : p.todayName === d ? T.bg : "transparent", outline:p.isDropOver && p.isDropOver(d, null, sd.id) ? "2px solid " + T.accent : "none", outlineOffset:-2 }}>
                {on.map(function(s){ return <Chip key={s.emp.id} d={d} s={s} compact={true} />; })}
                <AddControl d={d} sid={sd.id} label={on.length ? "+" : "+ Fill"} urgent={!on.length} />
              </div>
            );
          }));
        })}
      </div>
    </div>
  );

  if (p.layout === "list") return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {p.days.map(function(d, i){
        var list = shiftsOn(d);
        return (
          <section key={d} data-drop-day={d} style={{ background:T.surface, border:"1px solid " + (p.isDropOver && p.isDropOver(d) ? T.accent : p.todayName === d ? T.text : T.border), borderRadius:"var(--r-card)", padding:"12px 16px" }}>
            {dayHead(d, i)}
            {p.shiftDefs.map(function(sd){
              var on = list.filter(function(s){ return s.sid === sd.id; }); if (!on.length) return null;
              return (
                <div key={sd.id} style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", minHeight:44, borderTop:"1px solid " + T.border, marginTop:8, paddingTop:8 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:7, width:180 }}><span style={{ width:8, height:8, borderRadius:2, background:p.color(sd.id).dot }} /><b style={{ fontSize:13, color:T.text }}>{sd.label}</b><span className="mono" style={{ fontSize:11, color:T.muted }}>{p.shortT(sd.start)}</span></span>
                  <span style={{ display:"flex", gap:6, flexWrap:"wrap", flex:1 }}>{on.map(function(s){ return <span key={s.emp.id} style={{ minWidth:110 }}><Chip d={d} s={s} compact={true} /></span>; })}</span>
                </div>
              );
            })}
            {!list.length && <div style={{ fontSize:12, color:T.faint, marginTop:8 }}>Nobody scheduled</div>}
            <div style={{ marginTop:10, maxWidth:220 }}><AddControl d={d} /></div>
          </section>
        );
      })}
    </div>
  );

  if (p.layout === "month") {
    var ws = p.weekStartDate, first = new Date(ws.getFullYear(), ws.getMonth(), 1), cells = [];
    // back up to the first visible week start
    var startOff = p.weekOff; var probe = new Date(ws);
    while (probe > first) { probe.setDate(probe.getDate() - 7); startOff--; }
    for (var w = 0; w < 6; w++) {
      var off = startOff + w, wk = p.sched[off];
      p.days.forEach(function(d, i){
        var iso = p.dayIso(off, d), dt = new Date(iso + "T12:00:00"), ds = wk && wk[d] ? wk[d] : null;
        var ids = ds ? p.emps.filter(function(e){ return ds[e.id]; }) : [];
        cells.push({ off:off, d:d, i:i, dt:dt, loaded:!!wk, n:ids.length, sids:ids.map(function(e){ return ds[e.id]; }) });
      });
    }
    var month = ws.getMonth(), todayIso = p.todayIso;
    return (
      <div style={{ background:T.surface, border:"1px solid " + T.border, borderRadius:"var(--r-card)", padding:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}><b style={{ fontSize:20, fontWeight:800, color:T.text }}>{ws.toLocaleDateString("en-US", { month:"long", year:"numeric" })}</b><span className="mono" style={{ fontSize:11, color:T.faint }}>TAP A DAY TO OPEN ITS WEEK</span></div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", gap:6 }}>
          {p.days.map(function(d){ return <span key={d} className="mono" style={{ fontSize:11, color:T.faint, paddingLeft:4 }}>{d.toUpperCase()}</span>; })}
          {cells.map(function(c, k){
            var inMonth = c.dt.getMonth() === month, isToday = p.dayIso(c.off, c.d) === todayIso, here = c.off === p.weekOff;
            return (
              <button key={k} onClick={function(){ p.openDay(c.off, c.d); }} style={{ textAlign:"left", minHeight:86, padding:8, borderRadius:12, border:"1px solid " + (isToday ? T.text : here ? T.muted : T.border), background:inMonth ? T.bg : "transparent", opacity:inMonth ? 1 : 0.45, display:"flex", flexDirection:"column", gap:4, cursor:"pointer", fontFamily:"inherit", color:T.text }}>
                <b style={{ fontSize:14 }}>{c.dt.getDate()}</b>
                <span className="mono" style={{ fontSize:10, color:c.loaded ? (c.n ? T.text : T.faint) : T.faint }}>{c.loaded ? (c.n ? c.n + " ON" : "EMPTY") : "OPEN WEEK"}</span>
                <span style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:"auto" }}>{c.sids.slice(0, 12).map(function(sid, j){ return <span key={j} style={{ width:7, height:7, borderRadius:2, background:p.color(sid).dot }} />; })}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}
