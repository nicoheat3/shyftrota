// ── Daily volume → suggested cover ────────────────────
// Arrivals, departures and occupancy are typed in by the admin each day.
// No PMS integration — these are the same numbers the manager already
// reads off their own report every morning.

// Hilton San Diego / Del Mar baseline, 259 rooms:
//   departures >= 125  → 2 on the morning shift
//   departures >  165  → add a mid shift
//   arrivals   >  85   → 2 on the evening shift
// Stored per property so every hotel can tune its own.
export var DEFAULT_THRESHOLDS = { depTwo: 125, depMid: 165, arrTwo: 85 };

// Seeds thresholds from room count so a new property isn't staring at a
// blank form. Ratios come from the Hilton numbers above (48% / 64% / 33%).
export function seedThresholds(roomCount) {
  var rc = Number(roomCount);
  if (!rc || rc <= 0) return { ...DEFAULT_THRESHOLDS };
  return {
    depTwo: Math.round(rc * 0.48),
    depMid: Math.round(rc * 0.64),
    arrTwo: Math.round(rc * 0.33),
  };
}

function num(v) { return (v === null || v === undefined || v === "") ? null : Number(v); }

export function hasVolume(vol) {
  if (!vol) return false;
  return num(vol.arrivals) !== null || num(vol.departures) !== null || num(vol.occupancy) !== null;
}

// The whole rule set lives here. Change this function and every part of the
// app that shows a suggestion changes with it.
export function suggestCover(vol, thresholds) {
  if (!hasVolume(vol)) return null;
  var th = thresholds || DEFAULT_THRESHOLDS;
  var dep = num(vol.departures) || 0;
  var arr = num(vol.arrivals) || 0;
  return {
    am:  dep >= th.depTwo ? 2 : 1,
    mid: dep >  th.depMid ? 1 : 0,
    pm:  arr >  th.arrTwo ? 2 : 1,
  };
}

// Which bucket a shift falls into, by its start time.
export function shiftBucket(shiftId, shiftDefs) {
  var def = shiftDefs && shiftDefs.find(function(d){ return d.id === shiftId; });
  if (!def || !def.start) return null;
  var h = parseInt(def.start.split(":")[0], 10);
  if (isNaN(h)) return null;
  if (h < 10) return "am";
  if (h < 14) return "mid";
  if (h < 22) return "pm";
  return null; // overnight — not covered by arrivals/departures
}

// How many people are actually on each bucket for one day.
export function coverageForDay(emps, daySched, shiftDefs) {
  var out = { am:0, mid:0, pm:0 };
  if (!daySched) return out;
  emps.forEach(function(e){
    var shift = daySched[e.id];
    if (!shift) return;
    var b = shiftBucket(shift, shiftDefs);
    if (b) out[b]++;
  });
  return out;
}

export function isShort(suggested, actual) {
  if (!suggested || !actual) return false;
  return actual.am < suggested.am || actual.mid < suggested.mid || actual.pm < suggested.pm;
}

// ── Tokens (mirrors App.jsx so this file stays self-contained) ──
var T = {
  bg:"#F8F6F3", surface:"#FFFFFF", border:"#E5E0D8", text:"#1A1714",
  muted:"#6B6460", faint:"#A09890", accent:"#C84B31", accentL:"#FDF0ED",
  danger:"#EF4444", success:"#10B981", warning:"#F59E0B", warningL:"#FFFBEB",
};
var CARD = { background:T.surface, border:"1px solid "+T.border, borderRadius:12, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.06)", boxSizing:"border-box", overflow:"hidden" };
var LBL  = { fontSize:9, color:T.faint, display:"block", marginBottom:3, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" };
var NINP = { width:"100%", background:T.surface, border:"1px solid "+T.border, borderRadius:8, padding:"7px 4px", color:T.text, fontSize:14, fontWeight:700, textAlign:"center", outline:"none", fontFamily:"inherit", boxSizing:"border-box" };
var SINP = { width:70, background:T.surface, border:"1px solid "+T.border, borderRadius:8, padding:"6px 8px", color:T.text, fontSize:13, fontWeight:600, textAlign:"center", outline:"none", fontFamily:"inherit", boxSizing:"border-box" };
var GBTN = { background:"transparent", border:"1px solid "+T.border, borderRadius:8, padding:"6px 12px", color:T.muted, cursor:"pointer", fontSize:12, fontWeight:500, fontFamily:"inherit" };

// Small pill under each day header in the week grid.
export function CoverBadge({ vol, thresholds, actual }) {
  var s = suggestCover(vol, thresholds);
  if (!s) return null;
  var short = isShort(s, actual);
  var title = "Suggested: morning " + s.am + (s.mid ? ", mid " + s.mid : "") + ", evening " + s.pm
            + " | Scheduled: morning " + actual.am + ", mid " + actual.mid + ", evening " + actual.pm;
  return (
    <div title={title} style={{ marginTop:3, display:"inline-block", padding:"1px 6px", borderRadius:20, fontSize:9, fontWeight:700, letterSpacing:"0.02em", background:short?T.warningL:T.bg, color:short?"#92400E":T.faint, border:"1px solid "+(short?"#FDE68A":T.border) }}>
      {s.am}{s.mid ? "·"+s.mid : ""}·{s.pm}
    </div>
  );
}

function DayCard({ day, date, label, vol, thresholds, actual, onChange, readOnly }) {
  var s = suggestCover(vol, thresholds);
  var v = vol || {};
  function field(name, short) {
    return (
      <div style={{ minWidth:0 }}>
        <label style={LBL}>{short}</label>
        <input
          type="number" min={0} disabled={readOnly}
          key={day+"_"+name+"_"+date}
          defaultValue={v[name] === null || v[name] === undefined ? "" : v[name]}
          onBlur={function(ev){ onChange(date, name, ev.target.value); }}
          onKeyDown={function(ev){ if (ev.key === "Enter") ev.target.blur(); }}
          placeholder="—"
          style={{ ...NINP, opacity:readOnly?0.6:1 }}
        />
      </div>
    );
  }
  function cover(lbl, want, got) {
    if (want === 0 && got === 0) return null;
    var shortHere = got < want;
    return (
      <span style={{ fontSize:11, color:shortHere?T.danger:T.muted }}>
        {lbl} <strong style={{ color:shortHere?T.danger:T.text }}>{got}</strong>
        <span style={{ color:T.faint }}>/{want}</span>
      </span>
    );
  }
  return (
    <div style={{ ...CARD, padding:14 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:10 }}>
        <span style={{ fontSize:12, fontWeight:700, color:T.text }}>{day}</span>
        <span style={{ fontSize:11, color:T.faint }}>{label}</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:7 }}>
        {field("arrivals", "Arr")}
        {field("departures", "Dep")}
        {field("occupancy", "Occ %")}
      </div>
      <div style={{ marginTop:10, paddingTop:9, borderTop:"1px solid "+T.border, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        {s ? (
          <>
            {cover("AM", s.am, actual.am)}
            {cover("Mid", s.mid, actual.mid)}
            {cover("PM", s.pm, actual.pm)}
          </>
        ) : (
          <span style={{ fontSize:11, color:T.faint }}>Add numbers to see suggested cover</span>
        )}
      </div>
    </div>
  );
}

export function VolumePanel(props) {
  var th = props.thresholds || DEFAULT_THRESHOLDS;
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Daily volume</div>
          <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>
            Type in arrivals, departures and occupancy. Suggested cover shows scheduled against needed.
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:10 }}>
        {props.days.map(function(d, i){
          return (
            <DayCard
              key={d}
              day={d}
              date={props.dates[i]}
              label={props.labels[i]}
              vol={props.volumes[props.dates[i]]}
              thresholds={th}
              actual={props.coverage[i]}
              onChange={props.onChange}
              readOnly={props.readOnly}
            />
          );
        })}
      </div>
    </div>
  );
}
