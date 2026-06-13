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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: #f6f7fb;
      color: #111827;
      line-height: 1.6;
    }

    .wrapper {
      max-width: 620px;
      margin: 48px auto;
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid #eef0f4;
    }

    /* HEADER */
    .header {
      padding: 28px 36px;
      background: #ffffff;
      border-bottom: 1px solid #f1f5f9;
    }

    .brand {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.4px;
      color: #111827;
    }

    .brand span {
      color: #16a34a;
    }

    /* BODY */
    .body {
      padding: 34px 36px;
    }

    h1 {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
      margin-bottom: 10px;
    }

    p {
      font-size: 14.5px;
      color: #4b5563;
      margin-bottom: 14px;
    }

    /* CARD */
    .card {
      background: #f9fafb;
      border: 1px solid #eef2f7;
      border-radius: 14px;
      padding: 18px 20px;
      margin: 18px 0;
    }

    .muted {
      font-size: 13px;
      color: #6b7280;
    }

    /* QR */
    .qr {
      margin-top: 20px;
      text-align: center;
      padding: 20px;
      border: 1px dashed #e5e7eb;
      border-radius: 14px;
      background: #ffffff;
    }

    /* STEPS */
    .steps {
      margin-top: 22px;
    }

    .step {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }

    .dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #eaf7ef;
      color: #16a34a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .step p {
      margin: 0;
      font-size: 13.5px;
      color: #4b5563;
    }

    /* BADGE */
    .badge {
      display: inline-block;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #ecfdf5;
      color: #047857;
      font-weight: 600;
    }

    /* FOOTER */
    .footer {
      padding: 20px 36px;
      border-top: 1px solid #f1f5f9;
      text-align: center;
      background: #fafafa;
    }

    .footer p {
      font-size: 11.5px;
      color: #9ca3af;
      margin: 0;
    }

    a {
      color: #9ca3af;
      text-decoration: none;
    }

    @media (max-width: 600px) {
      .wrapper {
        margin: 0;
        border-radius: 0;
      }

      .body, .header, .footer {
        padding: 22px;
      }
    }
  </style>
</head>

<body>
  <div class="wrapper">

    <div class="header">
      <div class="brand">Community<span>Fix</span></div>
    </div>

    <div class="body">
      ${content}
    </div>

    <div class="footer">
      <p>
        © ${new Date().getFullYear()} CommunityFix · Built for better communities<br/>
        <a href="#">Unsubscribe</a> · <a href="#">Privacy</a>
      </p>
    </div>

  </div>
</body>
</html>
`;

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
  to,
  name,
  eventTitle,
  eventDate,
  eventAddress,
  qrToken,
}) => {
  const date = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const time = new Date(eventDate).toLocaleTimeString("en-BD", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const qrBuffer = await QRCode.toBuffer(qrToken, {
    width: 320,
    margin: 2,
    color: { dark: "#111827", light: "#ffffff" },
  });

  const content = `
  <div style="background:#f9fafb;padding:40px 12px;font-family:Arial,Helvetica,sans-serif;">
    
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;">

      <!-- Header -->
      <p style="margin:0;font-size:14px;color:#6b7280;">
        CommunityFix
      </p>

      <h2 style="margin:6px 0 18px;font-size:20px;color:#111827;">
        Your registration is confirmed
      </h2>

      <!-- Greeting -->
      <p style="margin:0 0 14px;font-size:14px;color:#374151;">
        Hi <strong>${name}</strong>,
      </p>

      <p style="margin:0 0 22px;font-size:14px;color:#4b5563;line-height:1.6;">
        You’re successfully registered for the event. Please use the QR code below for check-in.
      </p>

      <!-- Event Box -->
      <div style="padding:16px 18px;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">
          ${eventTitle}
        </p>
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">
          ${date} • ${time}
        </p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
          ${eventAddress}
        </p>
        <p style="margin-top:10px;font-size:12px;color:#16a34a;font-weight:600;">
          Free Entry
        </p>
      </div>

      <!-- QR -->
      <div style="text-align:center;margin-top:26px;">
        <p style="margin:0 0 12px;font-size:13px;color:#374151;font-weight:600;">
          Check-in QR Code
        </p>

        <span class="token-code">${qrToken}</span>

        <p style="margin-top:10px;font-size:12px;color:#6b7280;">
          Show qr attachment at the entrance
        </p>
      </div>

      <!-- Steps -->
      <div style="margin-top:26px;">
        <p style="font-size:13px;font-weight:600;color:#111827;margin-bottom:8px;">
          Next steps
        </p>

        <p style="margin:4px 0;font-size:13px;color:#6b7280;">
          1. Save your QR code
        </p>
        <p style="margin:4px 0;font-size:13px;color:#6b7280;">
          2. Arrive 10–15 minutes early
        </p>
        <p style="margin:4px 0;font-size:13px;color:#6b7280;">
          3. Show QR at entry
        </p>
      </div>

      <!-- Footer -->
      <div style="margin-top:28px;padding-top:14px;border-top:1px solid #eee;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">
          © ${new Date().getFullYear()} CommunityFix
        </p>
      </div>

    </div>
  </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `Registration confirmed — ${eventTitle}`,
    html: baseTemplate(content),

    attachments: [
      {
        filename: "qr-checkin.png",
        content: qrBuffer,
        cid: "qrImage"
      },
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