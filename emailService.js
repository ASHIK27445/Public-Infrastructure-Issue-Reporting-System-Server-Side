const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
/* ─────────────────────────────────────────────
   TRANSPORTER SETUP
   .env variables needed:
     EMAIL_HOST=smtp.gmail.com
     EMAIL_PORT=587
     EMAIL_USER=your@gmail.com
     EMAIL_PASS=your_app_password
     EMAIL_FROM="CommunityFix <noreply@communityfix.com>"
───────────────────────────────────────────── */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ─── Base HTML template wrapper ─── */
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>CommunityFix</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f3; color: #1a1a1a; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px 40px; }
    .header-logo { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
    .header-logo span { color: #86efac; }
    .body { padding: 36px 40px; }
    .footer { background: #f9fafb; border-top: 1px solid #f0f0f0; padding: 24px 40px; text-align: center; }
    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.6; }
    h1 { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    p { font-size: 15px; line-height: 1.7; color: #374151; margin-bottom: 16px; }
    .highlight-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px 24px; margin: 20px 0; }
    .detail-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 14px; color: #374151; }
    .detail-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
    .btn { display: inline-block; background: #16a34a; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 600; margin: 8px 0; }
    .btn-outline { display: inline-block; border: 2px solid #16a34a; color: #16a34a !important; text-decoration: none; padding: 12px 26px; border-radius: 10px; font-size: 14px; font-weight: 600; margin: 8px 0; }
    .qr-box { text-align: center; background: #fff; border: 2px dashed #d1d5db; border-radius: 12px; padding: 24px; margin: 20px 0; }
    .token-code { font-family: 'Courier New', monospace; font-size: 13px; background: #f3f4f6; padding: 10px 16px; border-radius: 8px; color: #374151; word-break: break-all; margin-top: 12px; display: block; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .divider { height: 1px; background: #f3f4f6; margin: 24px 0; }
    .steps { counter-reset: step; }
    .step-item { display: flex; gap: 14px; margin-bottom: 16px; align-items: flex-start; }
    .step-num { width: 28px; height: 28px; background: #dcfce7; color: #166534; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
    .step-text { font-size: 14px; color: #374151; line-height: 1.6; padding-top: 3px; }
    @media (max-width: 600px) {
      .body, .header, .footer { padding: 24px 20px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">Community<span>Fix</span></div>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>This email was sent by CommunityFix · Dhaka, Bangladesh<br/>
      You're receiving this because you registered for a community event.<br/>
      <a href="#" style="color:#9ca3af">Unsubscribe</a> · <a href="#" style="color:#9ca3af">Privacy Policy</a></p>
    </div>
  </div>
</body>
</html>`;

/* ─────────────────────────────────────────────
   1. VOLUNTEER REGISTRATION CONFIRMATION & PAYMENT CONFIRMATION MAIL
───────────────────────────────────────────── */
const sendRegistrationConfirmation = async ({
  to, name, eventTitle, eventDate, eventAddress,
  eventType, qrToken, role, registrationFee, paymentLink,
}) => {
  const typeEmoji = { cleanup:"🧹", plantation:"🌳", repair:"🏗️", awareness:"📢", student:"🎓", meetup:"🤝" }[eventType] || "🤝";
  const formattedDate = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const formattedTime = new Date(eventDate).toLocaleTimeString("en-BD", {
    hour: "2-digit", minute: "2-digit",
  });

  const content = `
    <h1>You're registered! 🎉</h1>
    <p>Hi <strong>${name}</strong>, your spot as a <strong>${role}</strong> has been confirmed for the following event:</p>

    <div class="highlight-box">
      <div class="detail-row"><span class="detail-icon">${typeEmoji}</span><strong style="font-size:16px">${eventTitle}</strong></div>
      <div class="detail-row"><span class="detail-icon">🗓️</span>${formattedDate} at ${formattedTime}</div>
      <div class="detail-row"><span class="detail-icon">📍</span>${eventAddress}</div>
      <div class="detail-row"><span class="detail-icon">👤</span>Registered as: <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong></div>
    </div>

    ${qrToken ? `
    <div class="qr-box">
    <p style="margin-bottom:8px;font-weight:600;color:#111">Your Attendance QR Token</p>
    <p style="font-size:13px;color:#6b7280;margin-bottom:12px">Show this at the event entrance to mark attendance</p>
    <span class="token-code">${qrToken}</span>
    <p style="font-size:12px;color:#9ca3af;margin-top:12px">Keep this safe. One token per registration.</p>
    </div>` : `
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px 20px;margin:16px 0">
    <p style="color:#92400e;font-weight:600">⏳ QR Token will be sent after payment is confirmed.</p>
    </div>`}

    ${registrationFee > 0 ? `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:16px 20px;margin:16px 0">
      <p style="color:#92400e;font-weight:600;margin-bottom:6px">💳 Payment Required — ৳${registrationFee}</p>
      <p style="font-size:13px;color:#92400e;margin-bottom:12px">Complete payment within 24 hours to secure your spot.</p>
      <a href="${paymentLink}" class="btn" style="background:#d97706">Pay ৳${registrationFee} Now</a>
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin:16px 0">
      <p style="color:#166534;font-weight:600">✅ Free Registration — No payment needed!</p>
    </div>`}

    <div class="divider"></div>
    <p style="font-weight:600;margin-bottom:16px">What to do next:</p>
    <div class="steps">
      <div class="step-item">
        <div class="step-num">1</div>
        <div class="step-text">Save this email and bring your QR token (printed or on phone) on event day.</div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div class="step-text">${registrationFee > 0 ? `Complete your payment of ৳${registrationFee} using the button above.` : "Show up on time — your spot is confirmed!"}</div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div class="step-text">After attending, you will receive a digital certificate sent to this email.</div>
      </div>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `✅ You're registered for "${eventTitle}"`,
    html: baseTemplate(content),
  });
};

const sendFreeRegistrationConfirmationEmail = async ({
  to,
  name,
  eventTitle,
  eventDate,
  eventAddress,
  eventType,
  role,
  qrToken,
}) => {
  const typeEmoji =
    {
      cleanup: "🧹",
      plantation: "🌳",
      repair: "🏗️",
      awareness: "📢",
      student: "🎓",
      meetup: "🤝",
    }[eventType] || "🤝";

  const formattedDate = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedTime = new Date(eventDate).toLocaleTimeString("en-BD", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const qrBuffer = await QRCode.toBuffer(qrToken, {
    width: 300, margin: 3, color: { dark: "#111827", light: "#ffffff" },
  });

  const content = `
    <h1>🎉 Registration Successful (Free Event)</h1>

    <p>Hi <strong>${name}</strong>, your registration is confirmed for the event below.</p>

    <div class="highlight-box">
      <div class="detail-row">
        <span class="detail-icon">${typeEmoji}</span>
        <strong style="font-size:16px">${eventTitle}</strong>
      </div>

      <div class="detail-row">🗓️ ${formattedDate} at ${formattedTime}</div>
      <div class="detail-row">📍 ${eventAddress}</div>
      <div class="detail-row">👤 Role: <strong>${role}</strong></div>
    </div>

    <div class="qr-box">
      <p style="font-weight:600;color:#111;margin-bottom:6px">
        Your Attendance QR Token
      </p>

      <p style="font-size:13px;color:#6b7280;margin-bottom:12px">
        Show this QR token at the event entry
      </p>

      <span class="token-code">${qrToken}</span>

      <p style="font-size:12px;color:#9ca3af;margin-top:12px">
        Do not share this token with others
      </p>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:20px 0">
      <p style="color:#166534;font-weight:600;margin:0">
        ✅ This is a FREE registration — no payment required
      </p>
    </div>

    <div style="margin-top:20px">
      <p style="font-weight:600">Next Steps:</p>
      <ul style="padding-left:18px;color:#374151">
        <li>Save this email</li>
        <li>Bring your QR token on event day</li>
        <li>Arrive 10–15 minutes early</li>
      </ul>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `🎉 Free Registration Confirmed — ${eventTitle}`,
    html: baseTemplate(content),
    attachments: [
      { filename: "qr-checkin.png", content: qrBuffer, contentType: "image/png" },
    ]
  });
};

const sendPaymentConfirmationEmail = async ({
  to, name, eventTitle, eventDate, eventAddress, amount, qrToken,
}) => {
  const formattedDate = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const qrBuffer = await QRCode.toBuffer(qrToken, {
    width: 300, margin: 3, color: { dark: "#111827", light: "#ffffff" },
  });

  const content = `
    <h1>Payment Confirmed! ✅</h1>
    <p>Hi <strong>${name}</strong>, your payment of <strong>৳${amount}</strong> has been received and your registration is now confirmed!</p>

    <div class="highlight-box">
      <div class="detail-row"><span class="detail-icon">🎉</span><strong style="font-size:16px">${eventTitle}</strong></div>
      <div class="detail-row"><span class="detail-icon">🗓️</span>${formattedDate}</div>
      <div class="detail-row"><span class="detail-icon">📍</span>${eventAddress}</div>
      <div class="detail-row"><span class="detail-icon">💳</span>Amount Paid: <strong>৳${amount}</strong></div>
    </div>

    <div class="qr-box">
    <p style="margin-bottom:8px;font-weight:600;color:#111">Your Attendance QR Token</p>
    <p style="font-size:13px;color:#6b7280;margin-bottom:12px">Show this at the event entrance to mark attendance</p>
    <span class="token-code">${qrToken}</span>
    <p style="font-size:12px;color:#9ca3af;margin-top:12px">Keep this safe. One token per registration.</p>
    </div>

    <p>See you at the event! 💚</p>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `✅ Payment Confirmed — "${eventTitle}"`,
    html: baseTemplate(content),
    attachments: [
      { filename: "qr-checkin.png", content: qrBuffer, contentType: "image/png" },
    ]
  });
};

const sendFreeParticipationConfirmation = async ({
  to, name, eventTitle, eventDate, eventAddress, qrToken,
}) => {
  const formattedDate = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const formattedTime = new Date(eventDate).toLocaleTimeString("en-BD", {
    hour: "2-digit", minute: "2-digit",
  });

  const qrBuffer = await QRCode.toBuffer(qrToken, {
    width: 300, margin: 3, color: { dark: "#111827", light: "#ffffff" },
  });

  const content = `
    <h1>You're in! 🎟️</h1>
    <p>Hi <strong>${name}</strong>, your free participation is confirmed. No payment needed — just show up!</p>

    <div class="highlight-box">
      <div class="detail-row"><span class="detail-icon">🎟️</span><strong style="font-size:16px">${eventTitle}</strong></div>
      <div class="detail-row"><span class="detail-icon">🗓️</span>${formattedDate} at ${formattedTime}</div>
      <div class="detail-row"><span class="detail-icon">📍</span>${eventAddress}</div>
      <div class="detail-row"><span class="detail-icon">🆓</span>Free Participation — No fee required</div>
    </div>

    <div class="qr-box">
      <p style="font-weight:600;color:#111;margin-bottom:6px">Your Attendance QR Code</p>
      <p style="font-size:13px;color:#6b7280;margin-bottom:12px">
        📎 QR code attached as <strong>qr-checkin.png</strong> — open and show at entrance.
      </p>
      <span class="token-code">${qrToken}</span>
      <p style="font-size:12px;color:#9ca3af;margin-top:10px">This QR code is unique to you — do not share it.</p>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin:16px 0">
      <p style="color:#166534;font-weight:600;margin:0">✅ Free Registration Confirmed — No payment needed!</p>
    </div>

    <div class="divider"></div>
    <p style="font-weight:600;margin-bottom:16px">What to do next:</p>
    <div class="steps">
      <div class="step-item"><div class="step-num">1</div><div class="step-text">Open the attached <strong>qr-checkin.png</strong> and save or screenshot it.</div></div>
      <div class="step-item"><div class="step-num">2</div><div class="step-text">Arrive 10–15 minutes early and show the QR at the entrance.</div></div>
      <div class="step-item"><div class="step-num">3</div><div class="step-text">After attending, you'll receive a digital certificate at this email.</div></div>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `🎟️ Free Participation Confirmed — "${eventTitle}"`,
    html: baseTemplate(content),
    attachments: [
      { filename: "qr-checkin.png", content: qrBuffer, contentType: "image/png" },
    ],
  });
};

/* ─────────────────────────────────────────────
   2. WAITLIST CONFIRMATION
───────────────────────────────────────────── */
const sendWaitlistConfirmation = async ({
  to, name, eventTitle, eventDate, eventAddress, waitlistPosition,
}) => {
  const formattedDate = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const content = `
    <h1>You're on the waitlist ⏳</h1>
    <p>Hi <strong>${name}</strong>, all volunteer spots for <strong>${eventTitle}</strong> are currently full. You've been added to the waitlist.</p>

    <div class="highlight-box">
      <div class="detail-row"><span class="detail-icon">🏅</span>Your waitlist position: <strong style="font-size:18px;color:#16a34a">#${waitlistPosition}</strong></div>
      <div class="detail-row"><span class="detail-icon">🗓️</span>${formattedDate}</div>
      <div class="detail-row"><span class="detail-icon">📍</span>${eventAddress}</div>
    </div>

    <p>We'll notify you <strong>immediately</strong> if a spot opens up. The sooner someone cancels, the sooner you'll get in.</p>

    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px 20px;margin:20px 0">
      <p style="color:#92400e;font-size:14px;margin:0">⚡ Tip: Waitlist spots move fast. Keep an eye on your inbox!</p>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `⏳ Waitlist #${waitlistPosition} — "${eventTitle}"`,
    html: baseTemplate(content),
  });
};

/* ─────────────────────────────────────────────
   3. WAITLIST → SPOT OPENED NOTIFICATION
───────────────────────────────────────────── */
const sendWaitlistPromotion = async ({
  to, name, eventTitle, eventDate, eventAddress, qrToken, paymentLink, registrationFee,
}) => {
  const formattedDate = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const content = `
    <h1>A spot opened up! 🎊</h1>
    <p>Great news, <strong>${name}</strong>! A volunteer cancelled and your waitlist spot for <strong>${eventTitle}</strong> is now available.</p>

    <div class="highlight-box">
      <div class="detail-row"><span class="detail-icon">⚡</span><strong>Act fast — spot reserved for 12 hours only!</strong></div>
      <div class="detail-row"><span class="detail-icon">🗓️</span>${formattedDate}</div>
      <div class="detail-row"><span class="detail-icon">📍</span>${eventAddress}</div>
    </div>

    <div class="qr-box">
      <p style="font-weight:600;color:#111;margin-bottom:6px">Your Attendance QR Token</p>
      <span class="token-code">${qrToken}</span>
    </div>

    ${registrationFee > 0 ? `
    <p style="text-align:center">
      <a href="${paymentLink}" class="btn">Complete Payment ৳${registrationFee} →</a>
    </p>` : `
    <p style="text-align:center">
      <a href="#" class="btn">Confirm Your Spot →</a>
    </p>`}
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `🎊 Spot opened! Confirm now — "${eventTitle}"`,
    html: baseTemplate(content),
  });
};

/* ─────────────────────────────────────────────
   4. EVENT REMINDER (send 24h before)
───────────────────────────────────────────── */
const sendEventReminder = async ({
  to, name, eventTitle, eventDate, eventAddress, qrToken, equipmentList,
}) => {
  const formattedTime = new Date(eventDate).toLocaleTimeString("en-BD", {
    hour: "2-digit", minute: "2-digit",
  });

  const content = `
    <h1>Event tomorrow! 🌅</h1>
    <p>Hi <strong>${name}</strong>, just a reminder that <strong>${eventTitle}</strong> is happening tomorrow.</p>

    <div class="highlight-box">
      <div class="detail-row"><span class="detail-icon">⏰</span>Starts at <strong>${formattedTime}</strong></div>
      <div class="detail-row"><span class="detail-icon">📍</span>${eventAddress}</div>
    </div>

    ${equipmentList?.length > 0 ? `
    <p><strong>📦 Remember to bring:</strong></p>
    <ul style="padding-left:20px;margin-bottom:16px">
      ${equipmentList.map((item) => `<li style="margin-bottom:6px;color:#374151">${item}</li>`).join("")}
    </ul>` : ""}

    <div class="qr-box">
      <p style="font-weight:600;margin-bottom:6px">Your Attendance QR Token</p>
      <p style="font-size:13px;color:#6b7280;margin-bottom:10px">Have this ready for check-in</p>
      <span class="token-code">${qrToken}</span>
    </div>

    <p>We look forward to seeing you! 💚</p>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `🌅 Tomorrow: "${eventTitle}" — See you there!`,
    html: baseTemplate(content),
  });
};

/* ─────────────────────────────────────────────
   5. DONOR THANK-YOU
───────────────────────────────────────────── */
const sendDonorThankYou = async ({ to, name, eventTitle, amount }) => {
  const content = `
    <h1>Thank you for your donation! 💚</h1>
    <p>Hi <strong>${name}</strong>, your generous contribution of <strong>৳${amount}</strong> to <strong>${eventTitle}</strong> has been received.</p>

    <div class="highlight-box">
      <div class="detail-row"><span class="detail-icon">💰</span>Donation amount: <strong>৳${amount}</strong></div>
      <div class="detail-row"><span class="detail-icon">🌍</span>Your donation helps buy equipment and supplies for the event.</div>
    </div>

    <p>After the event, you'll receive a spending breakdown showing exactly how your money was used, along with before/after photos of the impact.</p>
    <p>Every contribution matters. Thank you for making your community a better place! 🙌</p>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `💚 Thank you for donating to "${eventTitle}"`,
    html: baseTemplate(content),
  });
};

module.exports = {
  sendRegistrationConfirmation,
  sendPaymentConfirmationEmail,
  sendFreeRegistrationConfirmationEmail,
  sendWaitlistConfirmation,
  sendWaitlistPromotion,
  sendEventReminder,
  sendDonorThankYou,
  sendFreeParticipationConfirmation
};