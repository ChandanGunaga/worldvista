# World Vista — More Meaningful Life

Monorepo for the World Vista public website, member portal and admin panel.

| Part | Stack | Port |
|---|---|---|
| `backend/` | Node 22, Express 4, TypeScript, Prisma 6, PostgreSQL | 4000 |
| `frontend/` | Next.js 14 (App Router), Tailwind CSS | 3000 |

The frontend proxies `/api/*` to the backend (see `frontend/next.config.mjs`), so the httpOnly session cookie works same-origin.

## Run locally

```bash
# 1. Database
createdb worldvista

# 2. Backend
cd backend
cp .env.example .env          # set DATABASE_URL, JWT_SECRET (openssl rand -hex 32), seed admin creds
npm install
npx prisma migrate dev        # creates tables
npm run db:seed               # packages, course, policies, FAQs, module register, super admin
npm run dev                   # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

Without SMTP configured, emails (including OTP codes) are printed to the **backend console** in development. In production SMTP is mandatory.

**Admin login:** `/login` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, then the emailed 6-digit code (admins always use email MFA). Change the password immediately.

## What's built

**Public site:** Home, About (+ roadmap), Tour Packages (6 cards + detail + enquiry), Financial Markets Education, AI & Financial Markets, FAQs, Contact, versioned legal pages. No shareholder/income/reward content appears publicly (spec §1).

**Member portal** (`/dashboard`): overview, profile & security (password change, OTP-verified email change with old-address notification), referral links (left/right), team (sponsor list + binary tree, own-downline only), tour enquiries, course enrolment, support tickets, notifications, and a "Wallet & Programs" page showing those features as not available.

**Admin panel** (`/admin`): role-based (Super / Finance / Support / Content), member search & suspend (reason + password re-entry), enquiries, packages, courses & enrolments, CMS pages (policy edits create new versions; members' accepted versions are recorded), FAQs, settings, tickets, staff & roles, CSV reports, compensation module register, and a hash-chained tamper-evident audit log with integrity check.

**Security:** bcrypt passwords, httpOnly JWT cookie with token-version revocation, OTP hashing + expiry + attempt limits + resend cooldown, rate limiting, Helmet, zod validation on every input, CSV formula-injection guard, honeypot on public forms.

**Integrations** (each switches on when its keys are set; status in Admin → Integrations):
- **Razorpay payments:** admin sends a payment link from an enquiry, and members pay course tuition. Signature-verified checkout plus a webhook; each payment is processed exactly once.
- **Image uploads:** Cloudinary when configured, otherwise local disk (`/uploads`). File type is checked by content, max 5 MB.
- **Email** via any SMTP (Brevo, SES…); **WhatsApp** via Twilio; **Sentry** error monitoring.

**Deployment:** see **[DEPLOYMENT.md](DEPLOYMENT.md)**. Two routes are supported: Vercel + Railway, or a single VPS with `docker compose` and automatic HTTPS (Caddy). Also included: `scripts/backup-db.sh` for backups and GitHub Actions CI.

## Deliberately NOT built: compensation & payout engines

Shareholder packages (6–10% monthly yields), Affiliate Rewards 1–5, binary matching, wallet ledger, member transfers and USDT/BEP20 withdrawals exist only as **specification records** in `ModuleConfig` (Admin → Compensation modules). The API cannot set them active, and no code calculates, credits or pays anything. See spec §18: legal/regulatory sign-off is required first.

## Owner decisions still open
- Binary placement rule: currently **auto spillover down the outer leg of the chosen side** (`backend/src/lib/genealogy.ts`). Confirm or change.
- Tour itineraries, hotels, cancellation terms and company facts are unverified (`verified=false` on packages).
- Legal page text is marked DRAFT and needs counsel-approved wording.
- Package images were extracted from the presentation deck. Confirm licences, and replace the low-resolution ones (~370px wide) with high-res photos via Admin → Packages.
