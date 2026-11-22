# Going live: step-by-step

Pick **one** hosting option. Option A is the easiest and has free or low-cost tiers. Option B suits a single server you control.

Before either option, put the code on GitHub (step 0).

---

## 0. Put the code on GitHub (5 min)

1. Create a **private** repository at https://github.com/new (e.g. `worldvista`), with no README.
2. In this folder, run:
   ```bash
   git remote add origin https://github.com/<your-username>/worldvista.git
   git push -u origin main
   ```
   GitHub then runs the checks in `.github/workflows/ci.yml` on every push.

---

## Option A: Vercel (website) + Railway (API + database)

### A1. Database and API on Railway
1. Sign up at https://railway.com with GitHub.
2. **New Project → Deploy PostgreSQL.**
3. In the same project: **New → GitHub Repo →** pick `worldvista`. In the service **Settings**, set **Root Directory** to `backend`. Railway uses `backend/Dockerfile` automatically.
4. Open the service's **Variables** and add:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable) |
   | `JWT_SECRET` | output of `openssl rand -hex 32` |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | `https://yourdomain.com` |
   | `TRUST_PROXY` | `2` |
   | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | your admin login |
   | SMTP / Razorpay / Cloudinary / Twilio / Sentry | see "Integrations" below |
5. **Settings → Networking → Generate Domain.** Note the URL, e.g. `https://worldvista-api.up.railway.app`.
6. Seed the database once. In the service, open **⋯ → Shell** (or run `railway run` locally) and enter:
   ```bash
   npx tsx prisma/seed.ts
   ```
7. **Uploads:** add **Cloudinary** (recommended). Without it, uploaded images live on the container disk and are lost on redeploy. The alternative is attaching a Railway Volume at `/app/uploads`.

### A2. Website on Vercel
1. Sign up at https://vercel.com with GitHub → **Add New Project →** `worldvista`.
2. Set **Root Directory** to `frontend`. The framework is auto-detected as Next.js.
3. Add the environment variable `API_URL` = your Railway URL from A1.5, with no trailing slash.
4. Click **Deploy**.

### A3. Domain
1. In Vercel: **Project → Settings → Domains →** add `yourdomain.com` and `www.yourdomain.com`, then follow the DNS instructions at your registrar. HTTPS is automatic.
2. Set `FRONTEND_URL` on Railway to `https://yourdomain.com` and redeploy.

The browser only ever talks to your domain. Vercel forwards `/api/*` and `/uploads/*` to Railway, so login cookies work without any CORS setup.

---

## Option B: one VPS with Docker (DigitalOcean / Lightsail / Hetzner, ~$6–12/month)

1. Create an Ubuntu 24.04 server (2 GB RAM recommended). Point your domain's **A record** to its IP.
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Run:
   ```bash
   git clone https://github.com/<you>/worldvista.git /opt/worldvista && cd /opt/worldvista
   cp .env.example .env && nano .env        # fill in DOMAIN, passwords, SMTP, keys
   docker compose up -d --build
   docker compose exec api npx tsx prisma/seed.ts   # first time only
   ```
   Caddy obtains HTTPS certificates automatically.
4. **Backups:** add the cron line shown at the top of `scripts/backup-db.sh`, and copy the `backups/` folder off the server regularly.
5. **Updates:** `git pull && docker compose up -d --build`

---

## Integrations (turn each on by adding its keys)

Check status any time in **Admin → Integrations**.

### Email: Brevo (free 300/day) or Amazon SES
1. Sign up at https://www.brevo.com → **SMTP & API → SMTP**.
2. Set `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM=World Vista <no-reply@yourdomain.com>`.
3. Verify your domain in Brevo (add its SPF/DKIM DNS records) so emails don't land in spam.

### Payments: Razorpay
1. Sign up at https://razorpay.com and complete KYC. Use **Test Mode** keys first.
2. **Settings → API Keys →** set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. **Settings → Webhooks → Add:**
   - URL: `https://yourdomain.com/api/webhooks/razorpay`
   - Events: `payment.captured`, `payment.failed`, `order.paid`
   - Secret: any long random string → set it as `RAZORPAY_WEBHOOK_SECRET`
4. To accept **USD**, ask Razorpay to enable International Payments. Otherwise quote in INR.
5. **How it works:** Admin → Enquiries → Manage → "Send a payment link". The customer pays on `/pay/...`, and the enquiry is confirmed automatically. Members can also pay course tuition from their dashboard. Issue refunds from the Razorpay dashboard.

### Images: Cloudinary (free tier)
Sign up at https://cloudinary.com → Dashboard → set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

### WhatsApp: Twilio
1. Sign up at https://www.twilio.com → Messaging → WhatsApp. Use the sandbox first; production requires a WhatsApp Business sender and approved message templates.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM` (e.g. `+14155238886`).
3. Messages are sent for enquiry received, status changes, payment links and receipts, but only when the customer gave a phone number.

### Error alerts: Sentry (free tier)
Create a Node.js project at https://sentry.io and set `SENTRY_DSN`.

---

## Launch checklist
- [ ] Sign in as admin and **change the password** (Profile & Security).
- [ ] Admin → Settings: real contact details and company legal name.
- [ ] Admin → Content pages: replace the DRAFT legal text with lawyer-approved text.
- [ ] Admin → Packages: upload high-resolution photos, confirm hotels and itineraries, tick "verified".
- [ ] Send a Razorpay **test-mode** payment end to end, then switch to live keys.
- [ ] Register a test member and confirm the verification email arrives (check spam).
- [ ] Confirm a backup file is created, and test a restore once.
