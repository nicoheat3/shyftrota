// ── Schedule publishing ───────────────────────────────
// A week is a draft until the admin posts it. Employees see nothing for an
// unposted week. Edits to a posted week go live immediately — a shift
// disappearing from someone's phone mid-week is worse than a stale one — but
// the admin gets a flag telling them to let the team know.

import { t as tr } from "./i18n.js";
import { useState, useEffect, useRef } from "react";

var T = {
  bg:"var(--bg)", surface:"var(--surface)", border:"var(--border)", text:"var(--text)", muted:"var(--muted)", faint:"var(--faint)", accent:"var(--accent)", accentL:"var(--accentL)", success:"var(--success)", successL:"var(--successL)", warning:"var(--warning)", warningL:"var(--warningL)",
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
export function PublishBar({ publishedAt, editedSince, onPublish, onUnpublish, onEmail, emailBusy, isPastWeek, busy }) {
  var published = !!publishedAt;
  // Two taps to send, so a stray tap doesn't email the whole team.
  var [armed, setArmed] = useState(false);
  useEffect(function(){ if (!armed) return; var t = setTimeout(function(){ setArmed(false); }, 4000); return function(){ clearTimeout(t); }; }, [armed]);
  var stale = published && !!editedSince;

  // After a tap on Post/Repost, play a check mark once the week shows as posted.
  var pending = useRef(false);
  var [celebrate, setCelebrate] = useState(false);
  useEffect(function(){
    if (!pending.current || !published || stale) return;
    pending.current = false;
    setCelebrate(true);
    var t = setTimeout(function(){ setCelebrate(false); }, 2000);
    return function(){ clearTimeout(t); };
  }, [published, stale, publishedAt]);
  function post() { pending.current = true; onPublish(); }

  var tone = !published
    ? { bg:T.bg,        border:T.border,   color:T.muted,   label:"Draft" }
    : stale
    ? { bg:T.warningL,  border:"var(--xFDE68A)",  color:"var(--x92400E)", label:"Edited since posted" }
    : { bg:T.successL,  border:"var(--x6EE7B7)",  color:"var(--x065F46)", label:"Posted" };

  var note = !published
    ? "Only you can see this week. Your team sees nothing until you post it."
    : stale
    ? "Your team can see these changes already. Repost to clear this flag once you've told them."
    : "Your team can see this week. Posted " + fmtWhen(publishedAt) + ".";

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap",
                  background:tone.bg, border:"1px solid "+tone.border, borderRadius:10, padding:"12px 16px", marginBottom:14 }}>
      <div style={{ minWidth:0 }}>
        <div className={celebrate ? "sr-posted-pop" : undefined} style={{ fontSize:13, fontWeight:700, color:tone.color, transformOrigin:"left center" }}>
          {celebrate && (
            <span className="sr-check" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M7.5 12.5l3 3 6-6.5" />
              </svg>
            </span>
          )}
          {tone.label}
        </div>
        <div style={{ fontSize:12, color:T.muted, marginTop:2, lineHeight:1.5 }}>{note}</div>
      </div>
      {!isPastWeek && (
        <div style={{ display:"flex", gap:8, flexShrink:0, flexWrap:"wrap" }}>
          {published && onEmail && (
            <button onClick={function(){ if (!armed) { setArmed(true); return; } setArmed(false); onEmail(); }} disabled={emailBusy}
              style={{ ...GBTN, color:armed?T.accent:T.text, borderColor:armed?T.accent:T.border, opacity:emailBusy?0.6:1, minHeight:36 }}>
              {emailBusy ? "Sending…" : armed ? "Tap again to send" : "Email schedule"}
            </button>
          )}
          {published && !stale && <button onClick={onUnpublish} disabled={busy} style={GBTN}>Unpost</button>}
          {(!published || stale) && (
            <button onClick={post} disabled={busy} style={{ ...BTN, opacity:busy?0.6:1 }}>
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
            <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:5 }}>{tr("Not posted yet")}</div>
      <div style={{ fontSize:12, color:T.muted, lineHeight:1.6, maxWidth:320, margin:"0 auto" }}>
        {tr("Your manager is still working on")} {weekLabel ? weekLabel : tr("this week")}. {tr("It'll show up here once it's posted.")}
      </div>
    </div>
  );
}
