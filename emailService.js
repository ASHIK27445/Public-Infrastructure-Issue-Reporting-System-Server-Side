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
  const typeEmoji = {
    cleanup:"🧹", plantation:"🌳", repair:"🏗️",
    awareness:"📢", student:"🎓", meetup:"🤝"
  }[eventType] || "🤝";

  const formattedDate = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const formattedTime = new Date(eventDate).toLocaleTimeString("en-BD", {
    hour: "2-digit", minute: "2-digit",
  });

  const content = `
    <h1>You're registered</h1>
    <p>Hi <strong>${name}</strong>, your spot as <strong>${role}</strong> is confirmed.</p>

    <div class="card">
      <p class="muted">Event</p>
      <p style="margin-top:8px;font-weight:600;">
        ${typeEmoji} ${eventTitle}
      </p>
      <p style="margin-top:6px;">📅 ${formattedDate} • ${formattedTime}</p>
      <p>📍 ${eventAddress}</p>
      <p>👤 Role: ${role}</p>
    </div>

    ${qrToken ? `
      <div class="card" style="text-align:center;">
        <p class="muted">Attendance QR</p>
        <div style="font-family:monospace;font-size:14px;font-weight:600;color:#16a34a;margin-top:10px;">
          ${qrToken}
        </div>
      </div>
    ` : `
      <p class="muted">QR will be sent after confirmation.</p>
    `}

    ${registrationFee > 0 ? `
      <div class="card">
        <p class="muted">Payment required</p>
        <p style="margin-top:8px;font-weight:600;">৳${registrationFee}</p>

        <div style="text-align:center;margin-top:14px;">
          <a href="${paymentLink}" class="btn">
            Pay now
          </a>
        </div>
      </div>
    ` : `
      <div class="card">
        <p style="color:#16a34a;font-weight:600;margin:0;">
          Free registration confirmed
        </p>
      </div>
    `}
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `You're registered — ${eventTitle}`,
    html: baseTemplate(content),
  });
};

const sendFreeRegistrationConfirmationEmail = async ({
  to, name, eventTitle, eventDate, eventAddress,
  eventType, role, qrToken,
}) => {
  const typeEmoji = {
    cleanup:"🧹", plantation:"🌳", repair:"🏗️",
    awareness:"📢", student:"🎓", meetup:"🤝"
  }[eventType] || "🤝";

  const formattedDate = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const formattedTime = new Date(eventDate).toLocaleTimeString("en-BD", {
    hour: "2-digit", minute: "2-digit",
  });

  const content = `
    <h1>Registration confirmed</h1>
    <p>Hi <strong>${name}</strong>, your free registration is confirmed.</p>

    <div class="card">
      <p style="font-weight:600;">
        ${typeEmoji} ${eventTitle}
      </p>
      <p class="muted" style="margin-top:6px;">
        📅 ${formattedDate} • ${formattedTime}
      </p>
      <p class="muted">📍 ${eventAddress}</p>
      <p class="muted">Role: ${role}</p>
    </div>

    <div class="card" style="text-align:center;">
      <p class="muted">QR Token</p>
      <div style="font-family:monospace;font-weight:600;color:#16a34a;margin-top:10px;">
        ${qrToken}
      </div>
    </div>

    <div class="card">
      <p style="color:#16a34a;font-weight:600;margin:0;">
        No payment required
      </p>
    </div>

    <p class="muted">Bring your QR code on event day.</p>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `Confirmed — ${eventTitle}`,
    html: baseTemplate(content),
  });
};

const sendPaymentConfirmationEmail = async ({
  to, name, eventTitle, eventDate, eventAddress, amount, qrToken,
}) => {
  const formattedDate = new Date(eventDate).toLocaleDateString("en-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const content = `
    <h1>Payment confirmed</h1>
    <p>Hi <strong>${name}</strong>, we’ve received your payment of <strong>৳${amount}</strong>.</p>

    <div class="card">
      <p style="font-weight:600;">${eventTitle}</p>
      <p class="muted">📅 ${formattedDate}</p>
      <p class="muted">📍 ${eventAddress}</p>
      <p>💳 Paid: ৳${amount}</p>
    </div>

    <div class="card" style="text-align:center;">
      <p class="muted">Attendance QR</p>
      <div style="font-family:monospace;font-weight:600;color:#16a34a;margin-top:10px;">
        ${qrToken}
      </div>
    </div>

    <p class="muted">
      You’re all set. See you at the event.
    </p>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `Payment confirmed — ${eventTitle}`,
    html: baseTemplate(content),
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
    <h1>You're on the waitlist</h1>
    <p>Hi <strong>${name}</strong>, all volunteer spots for <strong>${eventTitle}</strong> are currently full.</p>

    <div class="card">
      <p class="muted" style="margin-bottom:8px;">Waitlist status</p>
      <h2 style="font-size:28px;color:#16a34a;margin-bottom:10px;">#${waitlistPosition}</h2>
      <p>${formattedDate}</p>
      <p>${eventAddress}</p>
    </div>

    <p class="muted">
      You’ll be notified automatically if a spot opens up. No action is needed right now.
    </p>

    <div class="card" style="background:#f9fafb;text-align:center;">
      <p style="font-size:13px;color:#6b7280;margin:0;">
        💡 Tip: Spots open quickly — keep an eye on your inbox
      </p>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `Waitlist #${waitlistPosition} — ${eventTitle}`,
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
    <h1>Good news — a spot opened</h1>
    <p>Hi <strong>${name}</strong>, a spot just opened for <strong>${eventTitle}</strong>.</p>

    <div class="card">
      <p class="muted">Event details</p>
      <p style="margin-top:6px;">📅 ${formattedDate}</p>
      <p>📍 ${eventAddress}</p>
      <p style="margin-top:10px;">
        <strong>QR Token:</strong> <span style="color:#16a34a;font-weight:600;">${qrToken}</span>
      </p>
    </div>

    <p class="muted">
      This spot is reserved for a limited time. Confirm before it expires.
    </p>

    <div style="text-align:center;margin-top:20px;">
      <a href="${registrationFee > 0 ? paymentLink : '#'}"
         style="
           display:inline-block;
           padding:12px 18px;
           background:#111827;
           color:#fff;
           border-radius:10px;
           font-size:14px;
           font-weight:600;
           text-decoration:none;
         ">
        ${registrationFee > 0
          ? `Complete Payment ৳${registrationFee}`
          : `Confirm Your Spot`}
      </a>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `Spot opened — ${eventTitle}`,
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
    <h1>Event reminder</h1>
    <p>Hi <strong>${name}</strong>, your event <strong>${eventTitle}</strong> is tomorrow.</p>

    <div class="card">
      <p class="muted">Schedule</p>
      <p style="margin-top:8px;">⏰ ${formattedTime}</p>
      <p>📍 ${eventAddress}</p>
    </div>

    ${equipmentList?.length > 0 ? `
      <div class="card">
        <p class="muted">Bring with you</p>
        <ul style="margin-top:10px; padding-left:18px;">
          ${equipmentList.map(item => `
            <li style="margin-bottom:6px; color:#374151; font-size:13.5px;">
              ${item}
            </li>
          `).join("")}
        </ul>
      </div>
    ` : ""}

    <div class="card" style="text-align:center;">
      <p class="muted" style="margin-bottom:10px;">Check-in QR</p>
      <p style="font-size:13px;color:#6b7280;margin-bottom:12px;">
        Keep this ready at arrival
      </p>
      <div style="font-family:monospace;font-size:14px;font-weight:600;color:#16a34a;">
        ${qrToken}
      </div>
    </div>

    <p class="muted">We’re looking forward to seeing you.</p>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `Tomorrow — ${eventTitle}`,
    html: baseTemplate(content),
  });
};

/* ─────────────────────────────────────────────
   5. DONOR THANK-YOU
───────────────────────────────────────────── */
const sendDonorThankYou = async ({ to, name, eventTitle, amount }) => {
  const content = `
    <h1>Thank you</h1>
    <p>Hi <strong>${name}</strong>, we’ve received your donation for <strong>${eventTitle}</strong>.</p>

    <div class="card">
      <p class="muted">Contribution</p>
      <h2 style="font-size:24px;color:#16a34a;margin-top:6px;">
        ৳${amount}
      </h2>
    </div>

    <div class="card">
      <p class="muted">Impact</p>
      <p style="margin-top:8px;">
        Your support helps fund tools, materials, and on-ground execution for this event.
      </p>
    </div>

    <p class="muted">
      After the event, you’ll receive a transparent breakdown and impact update.
    </p>

    <p style="margin-top:18px;">
      Thank you for supporting your community 💚
    </p>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to,
    subject: `Thank you for your support — ${eventTitle}`,
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