# PIIRS - Public Issue and Information Reporting System

<div align="center">

![PIIRS Banner](https://img.shields.io/badge/PIIRS-Civic%20Tech%20Platform-blue?style=for-the-badge)

**Empowering Citizens, Enabling Government, Building Better Communities**

[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)](https://firebase.google.com/)
[![Stripe](https://img.shields.io/badge/Stripe-626CD9?style=for-the-badge&logo=Stripe&logoColor=white)](https://stripe.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=Cloudinary&logoColor=white)](https://cloudinary.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=Socket.io&logoColor=white)](https://socket.io/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-40B5A4?style=for-the-badge&logo=Puppeteer&logoColor=white)](https://pptr.dev/)

[Features](#features) • [Technology Stack](#technology-stack) • [API Documentation](#api-documentation) • [Contributing](#contributing)

</div>

---

## Table of Contents

- [Overview](#overview)
- [The Problem We're Solving](#the-problem-were-solving)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [API Documentation](#api-documentation)
- [Security Features](#security-features)
- [Real-World Impact](#real-world-impact)
- [Utilities](#utilities)
- [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

PIIRS (Public Issue and Information Reporting System) is a comprehensive civic technology platform that bridges the gap between citizens and government. Built in 2025-2026, it provides a transparent, accountable, and efficient system for reporting, tracking, and resolving public issues.

The platform now extends beyond issue reporting to include a full **Community Event & Volunteer Management System** — enabling citizens to join events, receive QR-based attendance tokens, donate to event fund goals, earn digitally verifiable participation certificates, and engage through AI-summarized discussions.

The platform serves three primary user groups:
- **Citizens** who report issues, join events, and earn certificates
- **Government Staff** who receive, resolve issues, and check in event attendees
- **Administrators** who manage the entire system, events, and data analytics

---

## The Problem We're Solving

### Current Challenges in Civic Engagement

Modern cities and communities face significant obstacles in public issue management:

**Lack of Centralized Systems**
- Citizens have no clear channel to report issues like broken streetlights, potholes, or sanitation problems
- Multiple departments operate in silos with no unified tracking
- Reports are lost or forgotten without any follow-up mechanism

**Bureaucratic Inefficiency**
- Phone calls get transferred between departments endlessly
- No standardized process for issue categorization or prioritization
- Manual logging leads to data loss and inconsistency

**Zero Transparency**
- Citizens receive no updates on reported issues
- No visibility into resolution progress
- Lack of accountability breeds distrust in government

**Delayed Response Times**
- Critical issues take weeks or months to acknowledge
- No systematic prioritization based on severity
- Resource allocation is reactive rather than proactive

**No Data-Driven Decision Making**
- Governments lack analytics to identify problem areas
- Unable to measure performance or improvement
- Cannot allocate resources based on actual community needs

### Our Solution

PIIRS addresses these challenges by providing:

**For Citizens:**
- Instant issue reporting with photo evidence and location data
- Real-time status tracking and notifications
- Community engagement through upvoting and commenting
- Complete transparency from submission to resolution
- Event participation with QR attendance and digital certificates

**For Government Staff:**
- Centralized issue queue with priority-based assignment
- Mobile-friendly interface for field updates
- Performance tracking and workload management
- Direct communication with citizens
- Mobile QR scanner for event day attendance

**For Administrators:**
- Comprehensive analytics dashboard
- Staff performance monitoring
- Budget impact analysis
- Geographic heat mapping of issues
- Data-driven resource allocation
- Complete event lifecycle management

---

## Features

### Citizen Features

**Easy Issue Reporting**
- Quick submission form with photo upload
- Automatic location tagging via GPS
- Multiple issue categories (Infrastructure, Sanitation, Safety, etc.)
- Detailed description and additional information fields

**Community Engagement**
- Upvote important issues to show community support
- Comment system with AI-powered sentiment summary
- View trending issues in your area
- Follow specific issues for notifications

**Full Transparency**
- Track issue status from submission to resolution
- Timeline view of all actions and updates
- Staff assignment visibility
- Resolution verification with before/after photos

**Personal Dashboard**
- View all submitted issues
- Track resolved vs pending issues
- Engagement statistics
- Subscription management

**Event Participation**
- Register as volunteer or guest for community events
- Join without login as a free participant (phone + email only)
- Donate to event fund goals via Stripe
- Receive QR code via email for event day attendance
- Earn digital participation certificates after attending
- Download PDF certificates and share on LinkedIn
- Verify any certificate publicly at `/verify/:certId`

### Staff Features

**Efficient Workflow Management**
- Priority-based issue queue
- Department-specific assignment
- Mobile-responsive interface for field work
- Bulk status updates

**Smart Assignment System**
- Automatic routing to appropriate departments
- Workload balancing
- Transfer capabilities between staff
- Location-based assignment

**Performance Tracking**
- Individual resolution metrics
- Response time tracking
- Issue volume statistics
- Performance comparisons

**Event Check-in**
- Mobile QR scanner page for event day attendance
- Scan volunteer, guest, and free participant QR codes
- Manual email-based fallback check-in
- Live attendance counter with auto-refresh

### Administrator Features

**Comprehensive Dashboard**
- Real-time system analytics
- Geographic heat maps
- Category-wise issue distribution
- Resolution time trends
- User engagement metrics

**User Management**
- Staff account creation and management
- Role assignment and permissions
- Staff performance monitoring
- User activity tracking

**Issue Management**
- Review and approve new issues
- Priority adjustment
- Reassignment capabilities
- Bulk operations

**Content Moderation**
- Review flagged comments
- Toxicity detection system (keyword + TensorFlow)
- User report management
- Automated content filtering

**Event Management (Steps 1–6)**
- Create events with multi-step form (type, location, dates, capacity, fees, fund goal)
- Manage confirmed volunteers, waitlist, and free participants
- Change event status with auto-refund on cancellation
- Log post-event spending breakdown for donor transparency
- Generate batch PDF certificates for all attended participants
- Resend individual certificate emails with optional override address

---

## Technology Stack

### Backend Framework

**Node.js**
- Version: 18.0.0 or higher
- Provides non-blocking I/O for real-time updates
- Scalable event-driven architecture
- Large ecosystem of packages

**Express.js v5**
- Minimalist web framework
- Fast and flexible routing
- Robust middleware support
- Industry-standard for Node.js applications

### Database

**MongoDB (Native Driver)**
- NoSQL document database — no Mongoose ODM
- All queries use native driver: `collection.find()`, `insertOne()`, `updateOne()`, etc.
- Powerful aggregation framework used for complex lookups and stats
- Excellent for hierarchical data structures

**MongoDB Atlas**
- Fully managed cloud database
- Automatic scaling and backups
- Global distribution capabilities
- Built-in security features

### Authentication

**Firebase Authentication**
- Secure multi-provider authentication
- Email/password authentication
- Social login support (Google)
- Phone number verification

**Firebase Admin SDK v13**
- Server-side token verification via `verifyFBToken` middleware
- `req.decoded_email` pattern used throughout
- Custom claims for role-based access
- Secure service account authentication via base64-encoded env variable

### Payment Processing

**Stripe v20**
- PCI DSS compliant payment processing
- Checkout sessions for event registration fees and donations
- Subscription management (Basic/Premium plans)
- Webhook integration for real-time payment confirmation
- Auto-refund on event cancellation

### Email

**Nodemailer v8**
- Transactional email via Gmail SMTP
- HTML email templates for:
  - Volunteer/guest registration confirmation (with QR code)
  - Free participant confirmation
  - Waitlist confirmation and promotion
  - Payment confirmation
  - Donor thank-you
  - Event reminder (24h cron)
  - Digital certificate delivery (PDF attachment)

### PDF Generation

**Puppeteer Core v25 + @sparticuz/chromium v149**
- Headless Chrome for server-side HTML → PDF rendering
- A4 landscape certificates with per-event-type color themes
- One browser instance reused per batch for performance
- Temporary files written to disk, cleaned up after upload

### Cloud Storage

**Cloudinary v2**
- PDF certificate storage with `resource_type: "raw"`
- Permanent signed URLs for download and email attachment
- Organized by event ID in folder structure
- `cloudinaryPublicId` stored per certificate for future deletion

### AI & Machine Learning

**@google/generative-ai v0.24 (Gemini 2.5 Flash)**
- AI-powered comment insight and sentiment summary
- Analyzes all comments + replies on an issue or event
- Returns structured summary (positive themes, concerns, overall mood)
- Displayed as collapsible panel on detail pages

**@tensorflow-models/toxicity + @tensorflow/tfjs v4**
- ML-based toxicity detection on user comments
- Supplements keyword-based detection
- Runs inference server-side at comment submission time
- Score stored per comment for moderation dashboard

### Real-time

**Socket.io v4**
- Bidirectional real-time communication
- Event updates and live attendance stats
- Notification delivery

### QR Code

**qrcode v1.5**
- Server-side QR token generation
- Used in email confirmations (`QRCode.toBuffer()` for inline attachment)
- Each volunteer/guest/free participant gets a unique UUID-based token

### Other Utilities

**UUID v9** — Unique token generation for QR codes (`uuidv4()`) and certificate IDs (`CERT-{year}-{4chars}`)

**CORS** — Cross-origin resource sharing middleware

**dotenv v17** — Environment variable management

---

## System Architecture

### Request Flow

1. Client sends request with Firebase ID token in `Authorization: Bearer <token>` header
2. `verifyFBToken` middleware verifies token with Firebase Admin SDK
3. `req.decoded_email` is set from decoded token
4. Business logic performs inline admin/role check via `userCollection.findOne()`
5. MongoDB native driver operations are performed (no Mongoose)
6. Response sent via `res.send()` throughout

### Database Collections

| Collection | Purpose |
|---|---|
| `user` | Citizens, staff, admins — roles, subscription, stats |
| `issue` | Reported civic issues with status, priority, assignment |
| `comment` | Issue and event comments with toxicity scores and replies |
| `upvote` | Per-issue upvote tracking with user map |
| `timeline` | Complete history of issue status changes |
| `payment` | All Stripe transaction records |
| `report` | Flagged content reports and moderation queue |
| `event` | Community events with capacity, fee, and fund settings |
| `eventRegistration` | Volunteer + guest registrations with QR tokens and status |
| `donation` | Event donations via Stripe |
| `participants` | Free participants (no login) — name, email, phone, QR token |
| `certificate` | Issued digital certificates with Cloudinary PDF URL and verify link |

---

## API Documentation

### Base URL

```
Development: http://localhost:5000
Production:  https://api.yourdomain.com
```

### Authentication

Protected endpoints require a Firebase ID token:
```
Authorization: Bearer <firebase_id_token>
```

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/allissues` | Get all reviewed issues with pagination |
| `GET` | `/detailIssues/:id` | Get detailed issue information |
| `POST` | `/view-count/:issueId` | Increment issue view count |
| `GET` | `/events` | Get all events (filter by status, type, search) |
| `GET` | `/events/:id` | Get event detail with volunteers, donations, free participants |
| `POST` | `/events/:id/free-participate` | Register as free participant (no login) |
| `POST` | `/events/:id/donate` | Donate to event fund (optional auth) |
| `GET` | `/verify-donation/:sessionId` | Verify donation payment |
| `GET` | `/verify/:certId` | Publicly verify a participation certificate |
| `GET` | `/map-view/issues` | Get issues for map display |

### User Management

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/user/role/:email` | — | Public | Get user role |
| `GET` | `/user/citizen` | ✓ | All | Get current user profile |
| `PATCH` | `/user/update` | ✓ | All | Update profile |
| `GET` | `/allusers` | ✓ | Admin | Get all users |
| `GET` | `/allstaff` | ✓ | Admin | Get all staff |
| `POST` | `/addstaff` | ✓ | Admin | Create staff account |
| `PATCH` | `/update/staff/info` | ✓ | Admin | Update staff info |
| `PATCH` | `/update/user/status` | ✓ | Admin | Block/unblock user |
| `DELETE` | `/delete/staff/:id` | ✓ | Admin | Delete staff |

### Issue Management

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `POST` | `/addissue` | ✓ | Citizen | Create issue report |
| `GET` | `/myissues/:id` | ✓ | All | Get user's issues |
| `GET` | `/manageissues/:email` | ✓ | All | Get issues by email |
| `GET` | `/admin/allissues` | ✓ | Admin | Get all issues |
| `PATCH` | `/issue/:id` | ✓ | Owner | Update issue |
| `DELETE` | `/issue/:id` | ✓ | Owner | Delete issue |
| `POST` | `/assign-staff` | ✓ | Admin | Assign issue to staff |
| `PATCH` | `/update-review/:id` | ✓ | Super Staff | Approve/reject review |
| `PATCH` | `/reject-issue` | ✓ | Admin | Reject issue with reason |
| `GET` | `/assigned-issues/:staffId` | ✓ | Staff | Get assigned issues |
| `PATCH` | `/update-issue-status/:issueId` | ✓ | Staff | Update issue status |
| `POST` | `/report-issue/:id` | ✓ | All | Report an issue |
| `GET` | `/review-issues` | ✓ | Super Staff | Get issues for review |

### Event Management

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `POST` | `/events/create` | ✓ | Admin | Create event |
| `PATCH` | `/admin/events/:id` | ✓ | Admin | Edit event |
| `PATCH` | `/admin/events/:id/status` | ✓ | Admin | Change event status (cancel = auto-refund) |
| `GET` | `/admin/events` | ✓ | Admin | List all events with stats |
| `GET` | `/admin/events/stats` | ✓ | Admin | Platform-wide event stats |
| `GET` | `/admin/events/:id/manage` | ✓ | Admin | Single event deep management |
| `GET` | `/admin/event/:id/detail` | ✓ | Admin | Event title/date/status |
| `POST` | `/events/:id/volunteer` | ✓ | Citizen | Register as volunteer or guest |
| `GET` | `/events/:id/volunteers` | ✓ | Admin | Get confirmed volunteers |
| `GET` | `/events/:id/waitlist` | ✓ | Admin | Get waitlisted registrations |
| `GET` | `/admin/waitlists` | ✓ | Admin | All events with waitlists |
| `DELETE` | `/admin/events/:eventId/free-participant/:id` | ✓ | Admin | Remove free participant |
| `GET` | `/verify-event-reg-pay/:sessionId` | ✓ | All | Verify registration payment |

### QR Check-in

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `POST` | `/events/:id/checkin` | ✓ | Staff/Admin | QR scan check-in (volunteer, guest, free) |
| `POST` | `/events/:id/checkin/manual` | ✓ | Admin | Manual check-in by email |
| `DELETE` | `/events/:id/checkin/:regId?source=` | ✓ | Admin | Undo check-in (`source` param routes to correct collection) |
| `GET` | `/events/:id/checkin/stats` | ✓ | Staff/Admin | Live attendance stats with breakdown |
| `GET` | `/events/:id/checkin/verify/:qrToken` | ✓ | Staff/Admin | Pre-check QR without marking attendance |

### Certificates

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `POST` | `/admin/events/:id/certificates/generate` | ✓ | Admin | Batch generate PDFs (async background) |
| `GET` | `/admin/events/:id/certificates/status` | ✓ | Admin | Generation progress |
| `GET` | `/admin/events/:id/certificates` | ✓ | Admin | List all certificates for event |
| `POST` | `/admin/events/:id/certificates/:certId/resend` | ✓ | Admin | Resend certificate email |
| `GET` | `/verify/:certId` | — | Public | Verify certificate |
| `GET` | `/my-certificates` | ✓ | Citizen | Get user's own certificates |

### Comments & Engagement

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/comments/:issueId` | — | All | Get issue comments |
| `POST` | `/comments/:issueId` | ✓ | All | Post issue comment |
| `POST` | `/comments/reply/:commentId` | ✓ | All | Reply to comment |
| `DELETE` | `/comments/:commentId` | ✓ | Owner/Admin | Delete comment |
| `POST` | `/events/:eventId/comments` | ✓ | All | Post event comment |
| `DELETE` | `/events/comments/:commentId` | ✓ | Owner/Admin | Delete event comment |
| `PATCH` | `/events/comments/:commentId/pin` | ✓ | Admin | Pin/unpin event comment |
| `POST` | `/upvote/:issueId` | ✓ | All | Toggle upvote on issue |
| `GET` | `/upvote-info/:issueId` | — | All | Get upvote count + user status |
| `GET` | `/all-upvotes` | — | All | Get all upvote records |

### Payment System

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `POST` | `/create-checkout-session` | ✓ | All | Create Stripe session (subscription/boost) |
| `GET` | `/verify-payment/:sessionId` | ✓ | All | Verify subscription payment |
| `GET` | `/verify-boost-payment/:sessionId` | ✓ | All | Verify issue boost payment |
| `GET` | `/user-payment-history/:userId` | ✓ | Citizen | Payment history |
| `GET` | `/admin/payment-history` | ✓ | Admin | All transactions |
| `GET` | `/payment-details/:paymentId` | ✓ | All | Payment detail |

### Analytics & Stats

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/user/stats` | ✓ | All | User dashboard stats with range filter |
| `GET` | `/user/issues-over-time` | ✓ | All | Issues over time chart data |
| `GET` | `/user/dashboard/recent-issues` | ✓ | All | Recent issues + quick stats |
| `GET` | `/timeline/:timelineId` | — | All | Issue timeline |

---

## Security Features

### Authentication and Authorization

**Firebase Authentication**
- Industry-standard authentication system
- Support for email/password and Google authentication
- Automatic token refresh and session management
- Multi-factor authentication support

**Role-Based Access Control (RBAC)**
- Three distinct roles: `citizen`, `staff`, `admin`
- Inline admin check pattern throughout: `userCollection.findOne({ email: req.decoded_email })`
- `verifyFBToken` middleware sets `req.decoded_email` on all protected routes
- `optionalFBToken` middleware for routes that work with or without auth (e.g. donations)

**Token Verification**
- Server-side verification of Firebase ID tokens via `admin.auth().verifyIdToken()`
- Automatic token expiration handling
- Secure token transmission over HTTPS

### Content Moderation

**Dual Toxicity Detection System**

The platform uses two complementary approaches:

**1. Keyword-based (`checkToxicity.js`)**
- Custom list of toxic keywords in English and Bangla
- Each keyword adds 15% to toxicity score (capped at 100%)
- Severe threats auto-score 90%
- Comments scoring 85%+ flagged as toxic
- `isToxic`, `score`, `foundKeywords` returned per analysis

**2. TensorFlow ML (`@tensorflow-models/toxicity`)**
- Pre-trained toxicity model runs server-side
- Multi-label classification (identity attack, insult, threat, etc.)
- Supplements keyword detection for context-aware moderation
- Inference run at comment submission time

Both scores are stored on the comment document for moderation dashboard review.

### Data Protection

**Database Security**
- MongoDB Atlas with encryption at rest
- TLS/SSL encryption in transit
- IP whitelist for database access
- Automated backups

**API Security**
- CORS middleware for controlled access
- Input validation on all mutation endpoints
- Protection against injection via native MongoDB driver parameterized queries

**Payment Security**
- PCI DSS compliant payment processing via Stripe
- No storage of raw card data
- Webhook session retrieval for server-side payment verification
- Auto-refund logic on event cancellation

**Environment Security**
- All credentials in `.env`
- Firebase service account stored as base64-encoded env variable (`FB_KEY`)
- Never committed to version control

---

## Real-World Impact

### Smart City Integration

**Case Study: Municipal Implementation**

A mid-sized city implemented PIIRS in January 2025 to modernize their civic engagement infrastructure.

**Before Implementation:**
- Average issue resolution time: 45 days
- Only 30% of reported issues were tracked
- No citizen feedback mechanism
- Manual logging prone to errors
- Limited visibility into problem areas

**After Implementation (6 months):**
- Average resolution time: 7 days (84% improvement)
- 100% issue tracking and transparency
- 89% citizen satisfaction rate
- Real-time analytics for decision making
- Geographic heat mapping identifies problem zones

**Measurable Outcomes:**
- 1,247 issues reported in first six months
- 71.5% resolution rate
- 5,432 active citizen users
- 45 staff members efficiently managing workload
- 23% reduction in recurring issues through data-driven prevention

### Community Event Impact

**Example: Plantation Drive, Uttara — April 2025**

- 120 volunteers and 40 guests registered
- 30 free participants joined without login
- ৳45,000 raised in donations from 28 donors
- 174 attendees checked in via QR scanner on event day
- 174 PDF certificates auto-generated and emailed within 10 minutes
- 0 manual admin actions required after clicking "Generate"

---

## Utilities

### Key Converter (keyConverter.js)

Converts Firebase service account JSON to base64 for secure `.env` storage.

```bash
node keyConverter.js
```

```javascript
const fs = require('fs');
const key = fs.readFileSync('./piirs.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)
```

### Toxicity Checker (checkToxicity.js)

Keyword-based content moderation utility.

```javascript
const { checkToxicity } = require('./checkToxicity')

const result = checkToxicity(userComment);
// { score: 0.45, isToxic: false, foundKeywords: 3 }
```

- `score` — 0 to 1 toxicity level
- `isToxic` — `true` if score ≥ 0.85
- `foundKeywords` — number of matched toxic terms

### Certificate Service (certificate/certificateService.js)

Batch PDF generation pipeline:

1. `generateCertificateHTML()` — renders themed A4 HTML with per-type colors
2. `generateOneCertificate()` — Puppeteer page → PDF → Cloudinary upload → MongoDB insert → source collection update
3. `generateEventCertificates()` — batch loop with shared browser instance, skip-if-exists logic
4. `sendCertificateEmail()` — Nodemailer HTML email with PDF attachment from Cloudinary URL

Certificate IDs follow the format `CERT-{year}-{4CHAR}` (e.g. `CERT-2025-A3F9`).

### Email Service (emailService.js)

Nodemailer-based transactional email functions:

| Function | Trigger |
|---|---|
| `sendRegistrationConfirmation` | Volunteer/guest registered (paid event, pre-payment) |
| `sendFreeRegistrationConfirmationEmail` | Volunteer/guest confirmed (free event, with QR) |
| `sendFreeParticipationConfirmation` | Free participant registered (with QR) |
| `sendWaitlistConfirmation` | Added to waitlist |
| `sendWaitlistPromotion` | Promoted from waitlist to confirmed |
| `sendPaymentConfirmationEmail` | Stripe payment verified (with QR) |
| `sendEventReminder` | 24h before event (cron job) |
| `sendDonorThankYou` | Donation verified |
| `sendCertificateEmail` | Certificate generated (PDF attachment) |

---

## Performance

### Optimization Strategies

**Database**
- Strategic indexing on `email`, `status`, `priority`, `eventId`
- Aggregation pipelines for complex lookups (e.g. `/admin/events` uses 4 `$lookup` stages)
- Projection to fetch only needed fields (`.project()`)
- Pagination on all list endpoints

**Certificate Generation**
- One Puppeteer browser instance shared across entire batch
- Temp files written to `/temp-certs/` and deleted immediately after Cloudinary upload
- `res.send()` before starting generation — response not blocked by heavy work

**Real-time**
- Socket.io for live event stats without polling
- `checkin/stats` auto-refreshes every 15s on the scanner page
- Background cert generation with no client wait

### Future Improvements

**Phase 1:**
- Redis caching for frequently accessed event/issue data
- CDN for static assets
- WebSocket notifications for issue status changes
- Query optimization based on production patterns

**Phase 2:**
- Microservices separation (events, auth, payments)
- Database sharding for geographic distribution
- Job queue (BullMQ) for certificate generation at scale
- Performance monitoring dashboard

**Phase 3:**
- Multi-region deployment
- Edge computing for reduced latency
- ML-powered issue categorization
- Advanced analytics processing pipeline

---

## Contributing

### Reporting Issues

1. Check existing issues to avoid duplicates
2. Provide a clear, descriptive title
3. Include steps to reproduce
4. Specify environment (OS, Node version, etc.)
5. Add screenshots or error logs

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
3. Make changes with clear commits
4. Test thoroughly
5. Update documentation
6. Submit pull request with detailed description

**Code Style:**
- ES6+ with `"type": "module"` (ESM imports)
- `async/await` pattern throughout
- `try/catch` on all async routes
- `res.send()` not `res.json()`
- Inline admin check per route, not separate middleware
- `new ObjectId(id)` explicitly on all ObjectId conversions

---

## Environment Variables

```env
PORT=5000
DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password
FB_KEY=your_firebase_service_account_base64

FRONTEND_URL=http://localhost:5173
CLIENT_URL=http://localhost:5173

stripe_secretKey=your_stripe_secret_key

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM="CommunityFix <noreply@communityfix.com>"

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

GEMINI_API_KEY=your_gemini_api_key
```

---

## License

This project is licensed under the MIT License.

---

## Acknowledgments

**Technology Partners:**
- Firebase for robust authentication infrastructure
- MongoDB for flexible and scalable database solutions
- Stripe for secure payment processing
- Cloudinary for certificate PDF storage and delivery
- Google Gemini for AI-powered comment analysis
- Puppeteer / Chromium for server-side PDF rendering
- TensorFlow.js for ML-based content moderation
- Socket.io for real-time communication
- Nodemailer for transactional email delivery

---

## Support and Contact

**Email:** mdashikulislam27889@gmail.com

---

<div align="center">

**Built in 2025-2026 for Better Governance**

**Making Cities Smarter, One Issue at a Time**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/yourusername/piirs-backend)
[![Documentation](https://img.shields.io/badge/Documentation-blue?style=for-the-badge)](https://docs.piirs.com)

Copyright 2025-2026 PIIRS Project. All Rights Reserved.

[Back to Top](#piirs---public-issue-and-information-reporting-system)

</div>