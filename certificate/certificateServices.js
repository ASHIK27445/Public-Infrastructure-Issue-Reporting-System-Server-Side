// Pass in `certificateCollection` and `eventRegistrationCollection` from index.js

const puppeteer    = require("puppeteer");
const { v4: uuidv4 } = require("uuid");
const path         = require("path");
const fs           = require("fs");
const nodemailer   = require("nodemailer");
const cloudinary   = require("cloudinary").v2;

const { generateCertificateHTML } = require("../certificate/certificateTemplate");

const BASE_URL = process.env.CLIENT_URL || "http://localhost:5173";
const TEMP_DIR = path.join(__dirname, "../temp-certs");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

/* ─────────────────────────────────────────────
   CLOUDINARY CONFIG
   .env variables needed:
     CLOUDINARY_CLOUD_NAME=your_cloud_name
     CLOUDINARY_API_KEY=your_api_key
     CLOUDINARY_API_SECRET=your_api_secret
───────────────────────────────────────────── */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || "smtp.gmail.com",
  port:   Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

/* ══════════════════════════════════════════════
   generateOneCertificate
   registration → a document from eventRegistrationCollection
   event        → a document from eventCollection
══════════════════════════════════════════════ */
async function generateOneCertificate({
  registration,
  event,
  browser,
  certificateCollection,
  eventRegistrationCollection,
}) {
  const certId    = `CERT-${new Date().getFullYear()}-${uuidv4().slice(0, 4).toUpperCase()}`;
  const verifyUrl = `${BASE_URL}/verify/${certId}`;

  const html = generateCertificateHTML({
    recipientName: registration.name,
    eventTitle:    event.title,
    eventType:     event.eventType,
    eventDate:     event.date,
    eventAddress:  event.location?.address || "",
    role:          registration.role === "guest" ? "Guest" : "Volunteer",
    institution:   registration.institution || "",
    certId,
    verifyUrl,
    issuedAt:      new Date(),
  });

  // Render PDF locally (temporary, deleted right after upload)
  const tmpPath    = path.join(TEMP_DIR, `${certId}.pdf`);
  const ownBrowser = !browser;
  const br = browser || await puppeteer.launch({
    headless: "new",
    args:     ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await br.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    await page.pdf({
      path:            tmpPath,
      width:           "1122px",
      height:          "794px",
      printBackground: true,
      margin:          { top: "0", right: "0", bottom: "0", left: "0" },
    });
    await page.close();
  } finally {
    if (ownBrowser) await br.close();
  }

  // ── Upload to Cloudinary ──
  // resource_type "raw" is required for non-image files like PDFs.
  let pdfUrl = "", cloudinaryPublicId = "";
  try {
    const uploadResult = await cloudinary.uploader.upload(tmpPath, {
      resource_type: "raw",                              // PDF is not an image
      folder:        `certificates/${event._id}`,
      public_id:     certId,                              // becomes the filename
      overwrite:     false,
      type:          "upload",                            // publicly accessible URL
    });
    pdfUrl              = uploadResult.secure_url;
    cloudinaryPublicId   = uploadResult.public_id;
  } catch (e) {
    console.error("Cloudinary upload failed:", e.message);
    // Continue without a hosted PDF — cert is still saved, pdfUrl stays empty
  }

  // Cleanup local temp file
  try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }

  // Build certificate document
  const certDoc = {
    certId,
    recipientName:      registration.name,
    recipientEmail:     registration.email,
    eventId:             event._id,
    eventTitle:          event.title,
    eventType:           event.eventType,
    eventDate:           event.date,
    eventAddress:        event.location?.address || "",
    role:                registration.role === "guest" ? "Guest" : "Volunteer",
    institution:         registration.institution || "",
    registrationId:      registration._id,
    pdfUrl,
    cloudinaryPublicId,                                    // needed if you ever want to delete the file
    verifyUrl,
    issuedAt:            new Date(),
    emailSent:           false,
    emailSentAt:         null,
    createdAt:           new Date(),
  };

  const insertResult = await certificateCollection.insertOne(certDoc);
  certDoc._id = insertResult.insertedId;

  // Link certId back onto the registration doc
  await eventRegistrationCollection.updateOne(
    { _id: registration._id },
    { $set: { certificateId: certId, certificateIssuedAt: new Date() } }
  );

  return certDoc;
}

/* ══════════════════════════════════════════════
   generateEventCertificates (batch)
   attended = array of eventRegistration docs (waitlisted:false, attended:true)
══════════════════════════════════════════════ */
async function generateEventCertificates(
  event,
  attended,
  { certificateCollection, eventRegistrationCollection }
) {
  const results = { success: [], failed: [], skipped: [] };

  const browser = await puppeteer.launch({
    headless: "new",
    args:     ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    for (const reg of attended) {
      // Skip if a cert already exists for this registration
      const existing = await certificateCollection.findOne({ registrationId: reg._id });
      if (existing) {
        results.skipped.push({ name: reg.name, certId: existing.certId });
        continue;
      }

      try {
        const cert = await generateOneCertificate({
          registration: reg,
          event,
          browser,
          certificateCollection,
          eventRegistrationCollection,
        });
        results.success.push({ name: reg.name, certId: cert.certId, email: reg.email });
      } catch (err) {
        console.error(`Cert failed for ${reg.name}:`, err.message);
        results.failed.push({ name: reg.name, error: err.message });
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

/* ══════════════════════════════════════════════
   sendCertificateEmail
   cert = a document from certificateCollection
══════════════════════════════════════════════ */
async function sendCertificateEmail({ cert, eventTitle, certificateCollection }) {
  const html = `
<!DOCTYPE html><html><head><style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f3;margin:0;padding:0;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);}
  .hdr{background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 40px;text-align:center;}
  .logo{font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;}
  .logo span{color:#86efac;}
  .body{padding:36px 40px;}
  h1{font-size:22px;color:#111827;margin-bottom:8px;}
  p{font-size:15px;line-height:1.7;color:#374151;margin-bottom:16px;}
  .cert-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin:20px 0;}
  .cid{font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#16a34a;letter-spacing:1px;}
  .btn{display:inline-block;background:#16a34a;color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;margin:8px 0;}
  .ftr{background:#f9fafb;border-top:1px solid #f0f0f0;padding:24px 40px;text-align:center;}
  .ftr p{font-size:12px;color:#9ca3af;}
</style></head><body>
<div class="wrap">
  <div class="hdr"><div class="logo">Community<span>Fix</span></div></div>
  <div class="body">
    <h1>🏅 Your Certificate is Ready!</h1>
    <p>Hi <strong>${cert.recipientName}</strong>,</p>
    <p>
      Thank you for participating as a <strong>${cert.role}</strong> in
      <strong>${eventTitle}</strong>. Your digital certificate of participation
      is attached to this email and always available online.
    </p>
    <div class="cert-box">
      <p style="margin:0 0 6px;font-size:12px;color:#166534;font-weight:700;text-transform:uppercase;letter-spacing:1px">
        Certificate ID
      </p>
      <div class="cid">${cert.certId}</div>
      <p style="margin:8px 0 0;font-size:13px;color:#374151">
        Share this ID to let anyone verify your certificate instantly.
      </p>
    </div>
    <p style="text-align:center">
      <a href="${cert.verifyUrl}" class="btn">🔍 Verify Certificate Online</a>
    </p>
    <p style="font-size:13px;color:#6b7280">
      Verification URL: <a href="${cert.verifyUrl}" style="color:#16a34a">${cert.verifyUrl}</a>
    </p>
  </div>
  <div class="ftr"><p>CommunityFix · Civic Engagement Platform · Dhaka, Bangladesh</p></div>
</div>
</body></html>`;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || "CommunityFix <noreply@communityfix.com>",
    to:      cert.recipientEmail,
    subject: `🏅 Your Certificate — ${eventTitle}`,
    html,
    attachments: cert.pdfUrl
      ? [{ filename: `${cert.certId}-CommunityFix.pdf`, path: cert.pdfUrl, contentType: "application/pdf" }]
      : [],
  });

  await certificateCollection.updateOne(
    { _id: cert._id },
    { $set: { emailSent: true, emailSentAt: new Date() } }
  );
}

module.exports = {
  generateOneCertificate,
  generateEventCertificates,
  sendCertificateEmail,
};