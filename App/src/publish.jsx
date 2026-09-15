// ── Schedule publishing ───────────────────────────────
// A week is a draft until the admin posts it. Employees see nothing for an
// unposted week. Edits to a posted week go live immediately — a shift
// disappearing from someone's phone mid-week is worse than a stale one — but
// the admin gets a flag telling them to let the team know.

var T = {
  bg:"#F8F6F3", surface:"#FFFFFF", border:"#E5E0D8", text:"#1A1714",
  muted:"#6B6460", faint:"#A09890", accent:"#C84B31", accentL:"#FDF0ED",
  success:"#10B981", successL:"#ECFDF5", warning:"#F59E0B", warningL:"#FFFBEB",
};
var BTN  = { background:T.accent, border:"none", borderRadius:8, padding:"9px 18px", color:"white", cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit" };
var GBTN = { background:"transparent", border:"1px solid "+T.border, borderRadius:8, padding:"7px 14px", color:T.muted, cursor:"pointer", fontSize:12, fontWeight:500, fontFamily:"inherit" };

function fmtWhen(ts) {
  if (!ts) return "";
  var d = new Date(ts);
  var today = new Date().toDateString() === d.toDateString();
  var time = d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  return today ? ("today at " + time) : (d.toLocaleDateString() + " at " + time);
}

// Sits above the schedule grid for admins.
export function PublishBar({ publishedAt, editedSince, onPublish, onUnpublish, isPastWeek, busy }) {
  var published = !!publishedAt;
  var stale = published && !!editedSince;

  var tone = !published
    ? { bg:T.bg,        border:T.border,   color:T.muted,   label:"Draft" }
    : stale
    ? { bg:T.warningL,  border:"#FDE68A",  color:"#92400E", label:"Edited since posted" }
    : { bg:T.successL,  border:"#6EE7B7",  color:"#065F46", label:"Posted" };

  var note = !published
    ? "Only you can see this week. Your team sees nothing until you post it."
    : stale
    ? "Your team can see these changes already. Repost to clear this flag once you've told them."
    : "Your team can see this week. Posted " + fmtWhen(publishedAt) + ".";

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap",
                  background:tone.bg, border:"1px solid "+tone.border, borderRadius:10, padding:"12px 16px", marginBottom:14 }}>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:tone.color }}>{tone.label}</div>
        <div style={{ fontSize:12, color:T.muted, marginTop:2, lineHeight:1.5 }}>{note}</div>
      </div>
      {!isPastWeek && (
        <div style={{ display:"flex", gap:8, flexShrink:0, flexWrap:"wrap" }}>
          {published && !stale && <button onClick={onUnpublish} disabled={busy} style={GBTN}>Unpost</button>}
          {(!published || stale) && (
            <button onClick={onPublish} disabled={busy} style={{ ...BTN, opacity:busy?0.6:1 }}>
              {busy ? "Posting…" : (stale ? "Repost" : "Post to team")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// What an employee sees instead of an unposted week.
export function NotPosted({ weekLabel, compact }) {
  return (
    <div style={{ background:T.surface, border:"1px dashed "+T.border, borderRadius:12,
                  padding:compact ? 20 : 34, textAlign:"center" }}>
      <div style={{ fontSize:22, marginBottom:8 }}>🗓</div>
      <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:5 }}>Not posted yet</div>
      <div style={{ fontSize:12, color:T.muted, lineHeight:1.6, maxWidth:320, margin:"0 auto" }}>
        Your manager is still working on {weekLabel ? weekLabel : "this week"}. It'll show up here once it's posted.
      </div>
    </div>
  );
}
