const TYPE_LABEL = {
  cleanup:    "Cleanup Drive",
  plantation: "Tree Plantation",
  repair:     "Repair Work",
  awareness:  "Awareness Campaign",
  student:    "Student Volunteer Day",
  meetup:     "Community Meetup",
};
const TYPE_COLOR = {
  cleanup:    { primary: "#0ea5e9", light: "#e0f2fe", accent: "#0284c7" },
  plantation: { primary: "#16a34a", light: "#dcfce7", accent: "#15803d" },
  repair:     { primary: "#d97706", light: "#fef3c7", accent: "#b45309" },
  awareness:  { primary: "#7c3aed", light: "#ede9fe", accent: "#6d28d9" },
  student:    { primary: "#db2777", light: "#fce7f3", accent: "#be185d" },
  meetup:     { primary: "#0d9488", light: "#ccfbf1", accent: "#0f766e" },
};
const TYPE_EMOJI = {
  cleanup: "🧹", plantation: "🌳", repair: "🏗️",
  awareness: "📢", student: "🎓", meetup: "🤝",
};

function generateCertificateHTML({
  recipientName,
  eventTitle,
  eventType    = "meetup",
  eventDate,
  eventAddress = "",
  role         = "Volunteer",
  institution  = "",
  certId,
  verifyUrl,
  issuedAt,
}) {
  const color     = TYPE_COLOR[eventType] || TYPE_COLOR.meetup;
  const typeLabel = TYPE_LABEL[eventType] || "Community Event";
  const emoji     = TYPE_EMOJI[eventType] || "🤝";

  const dateStr = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const issuedStr = new Date(issuedAt || Date.now()).toLocaleDateString("en-BD", {
    year: "numeric", month: "long", day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Certificate — ${recipientName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@400;500;600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'DM Sans',sans-serif;background:#fff;width:1122px;height:794px;overflow:hidden;}
  .page{width:1122px;height:794px;background:#fff;position:relative;display:flex;flex-direction:column;}
  .top-bar{height:10px;background:linear-gradient(90deg,${color.primary},${color.accent},${color.primary});}
  .bottom-bar{position:absolute;bottom:0;left:0;right:0;height:8px;background:linear-gradient(90deg,${color.primary}60,${color.accent},${color.primary}60);}
  .border-outer{position:absolute;inset:18px;border:1.5px solid ${color.primary}30;border-radius:4px;pointer-events:none;}
  .border-inner{position:absolute;inset:23px;border:0.5px solid ${color.primary}15;border-radius:2px;pointer-events:none;}
  .corner{position:absolute;width:48px;height:48px;opacity:.18;}
  .corner svg{width:48px;height:48px;}
  .c-tl{top:14px;left:14px;}
  .c-tr{top:14px;right:14px;transform:scaleX(-1);}
  .c-bl{bottom:14px;left:14px;transform:scaleY(-1);}
  .c-br{bottom:14px;right:14px;transform:scale(-1,-1);}
  .side-left{position:absolute;left:0;top:10px;bottom:8px;width:185px;background:linear-gradient(180deg,${color.light}60 0%,${color.light}15 100%);border-right:1px solid ${color.primary}18;}
  .side-right{position:absolute;right:0;top:10px;bottom:8px;width:215px;background:linear-gradient(180deg,${color.light}45 0%,${color.light}08 100%);border-left:1px solid ${color.primary}18;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:40px 20px;z-index:10;}
  .watermark{position:absolute;bottom:44px;left:110px;font-family:'Playfair Display',serif;font-size:100px;font-weight:900;color:${color.primary}07;letter-spacing:-5px;line-height:1;pointer-events:none;user-select:none;}
  .content{position:relative;z-index:10;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 235px 0 205px;text-align:center;}
  .org-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
  .org-dot{width:5px;height:5px;border-radius:50%;background:${color.primary};}
  .org-name{font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${color.primary};}
  .type-badge{display:inline-flex;align-items:center;gap:6px;background:${color.light};border:1px solid ${color.primary}30;color:${color.accent};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:5px 16px;border-radius:100px;margin-bottom:16px;}
  .cert-sub{font-family:'Playfair Display',serif;font-size:12px;font-weight:400;letter-spacing:5px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;}
  .cert-main{font-family:'Playfair Display',serif;font-size:40px;font-weight:900;color:#0f172a;line-height:1.1;margin-bottom:14px;letter-spacing:-1px;}
  .cert-main span{color:${color.primary};}
  .presented{font-size:12px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin-bottom:7px;}
  .rec-name{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;color:#0f172a;margin-bottom:5px;letter-spacing:-0.5px;}
  .inst{font-size:12px;color:${color.accent};font-weight:600;margin-bottom:14px;}
  .divider{width:280px;height:1px;background:linear-gradient(90deg,transparent,${color.primary}40,transparent);margin:0 auto 14px;}
  .body-text{font-size:13px;color:#475569;line-height:1.7;max-width:540px;margin-bottom:16px;}
  .body-text strong{color:#1e293b;font-weight:600;}
  .pills{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:20px;}
  .pill{display:inline-flex;align-items:center;gap:5px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:100px;padding:5px 13px;font-size:11px;color:#475569;}
  .sigs{display:flex;justify-content:center;align-items:flex-end;gap:70px;}
  .sig{text-align:center;}
  .sig-line{width:130px;height:1px;background:#cbd5e1;margin:0 auto 5px;}
  .sig-name{font-size:11px;font-weight:600;color:#334155;}
  .sig-title{font-size:9px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;}
  .emoji-big{font-size:40px;line-height:1;}
  .role-badge{background:${color.primary};color:#fff;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:100px;text-align:center;}
  .cert-id-box{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;width:100%;text-align:center;}
  .cid-label{font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;}
  .cid-val{font-family:'Courier New',monospace;font-size:10px;color:#334155;word-break:break-all;font-weight:600;}
  .verify-note{font-size:8px;color:#94a3b8;text-align:center;line-height:1.6;}
  .verify-url{font-size:8px;color:${color.primary};word-break:break-all;font-weight:600;}
</style>
</head>
<body>
<div class="page">
  <div class="top-bar"></div>
  <div class="border-outer"></div>
  <div class="border-inner"></div>
  <div class="corner c-tl"><svg viewBox="0 0 48 48" fill="none"><path d="M4 4L44 4L44 9L9 9L9 44L4 44Z" fill="${color.primary}"/><circle cx="4" cy="4" r="3" fill="${color.primary}"/></svg></div>
  <div class="corner c-tr"><svg viewBox="0 0 48 48" fill="none"><path d="M4 4L44 4L44 9L9 9L9 44L4 44Z" fill="${color.primary}"/><circle cx="4" cy="4" r="3" fill="${color.primary}"/></svg></div>
  <div class="corner c-bl"><svg viewBox="0 0 48 48" fill="none"><path d="M4 4L44 4L44 9L9 9L9 44L4 44Z" fill="${color.primary}"/><circle cx="4" cy="4" r="3" fill="${color.primary}"/></svg></div>
  <div class="corner c-br"><svg viewBox="0 0 48 48" fill="none"><path d="M4 4L44 4L44 9L9 9L9 44L4 44Z" fill="${color.primary}"/><circle cx="4" cy="4" r="3" fill="${color.primary}"/></svg></div>
  <div class="side-left"></div>
  <div class="watermark">CF</div>
  <div class="content">
    <div class="org-row">
      <div class="org-dot"></div>
      <div class="org-name">CommunityFix · Civic Engagement Program</div>
      <div class="org-dot"></div>
    </div>
    <div class="type-badge"><span>${emoji}</span><span>${typeLabel}</span></div>
    <div class="cert-sub">Certificate of</div>
    <div class="cert-main">
      ${role === "Guest" ? "<span>Guest</span> Participation" : "Volunteer<br/><span>Achievement</span>"}
    </div>
    <div class="presented">Presented to</div>
    <div class="rec-name">${recipientName}</div>
    ${institution ? `<div class="inst">${institution}</div>` : ""}
    <div class="divider"></div>
    <div class="body-text">
      This certificate is proudly presented in recognition of outstanding participation
      as a <strong>${role}</strong> in <strong>${eventTitle}</strong>,
      demonstrating commendable civic spirit and commitment to community improvement.
    </div>
    <div class="pills">
      <div class="pill"><span>🗓️</span>${dateStr}</div>
      ${eventAddress ? `<div class="pill"><span>📍</span>${eventAddress}</div>` : ""}
    </div>
    <div class="sigs">
      <div class="sig">
        <div class="sig-line"></div>
        <div class="sig-name">Event Organizer</div>
        <div class="sig-title">CommunityFix Admin</div>
      </div>
      <div class="sig">
        <div class="sig-line"></div>
        <div class="sig-name">Issued: ${issuedStr}</div>
        <div class="sig-title">Date of Issue</div>
      </div>
    </div>
  </div>
  <div class="side-right">
    <div class="emoji-big">${emoji}</div>
    <div class="role-badge">${role}</div>
    <div class="cert-id-box">
      <div class="cid-label">Certificate ID</div>
      <div class="cid-val">${certId}</div>
    </div>
    <div class="verify-note">
      Verify this certificate at:<br/>
      <span class="verify-url">${verifyUrl}</span>
    </div>
  </div>
  <div class="bottom-bar"></div>
</div>
</body>
</html>`;
}

module.exports = { generateCertificateHTML };