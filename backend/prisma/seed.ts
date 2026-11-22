import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INCLUSIONS = ["Verified hotel lodging", "Daily breakfast", "Airport transfers", "Guided sightseeing per itinerary"];
const EXCLUSIONS = ["Service charge (quoted separately)", "International airfare", "Visa fees", "Travel insurance", "Personal expenses"];
const CANCELLATION = "Cancellation and refund terms are confirmed in writing at the time of booking. See the Travel Cancellation & Refund Policy.";

const packages = [
  { slug: "sri-lanka", name: "Sri Lanka", destination: "Sri Lanka", price: 500, chargeNote: "+ service charge", nights: 3, days: 4, hotelCategory: "4 & 5-Star Luxury", tag: "4 & 5-Star Luxury",
    summary: "Sigiriya rock fortress citadel, emerald Nuwara Eliya tea trails, golden beaches, and colonial heritage." },
  { slug: "oman", name: "Oman", destination: "Oman", price: 500, chargeNote: "+ service charge", nights: 3, days: 4, hotelCategory: "4 & 5-Star Luxury", tag: "4 & 5-Star Luxury",
    summary: "Sultan Qaboos Grand Mosque, Muscat royal waterfront, Wahiba Sands desert safaris, and Arabian Gulf fjords." },
  { slug: "malaysia", name: "Malaysia", destination: "Malaysia", price: 500, chargeNote: "+ service charge", nights: 3, days: 4, hotelCategory: "4 & 5-Star Luxury", tag: "4 & 5-Star Luxury",
    summary: "Iconic Kuala Lumpur Petronas Towers, Batu Caves shrines, Genting Highlands, and Langkawi island beaches." },
  { slug: "dubai-elite", name: "Dubai Elite", destination: "United Arab Emirates", price: 500, chargeNote: "+ charge", nights: 4, days: 5, hotelCategory: "Luxury", tag: "Flagship Luxury",
    summary: "Palm Jumeirah luxury beachfront cabanas, private desert dune safaris, and Arabian Gulf yacht cruises." },
  { slug: "thailand", name: "Thailand", destination: "Thailand", price: 300, chargeNote: "+ charge", nights: 3, days: 4, hotelCategory: "Beach resort", tag: "Island Escape",
    summary: "Emerald island lagoons, private beach cabana villas, coral reef snorkelling, and vibrant culinary night markets." },
  { slug: "domestic-tours", name: "Domestic Tours", destination: "India", price: 120, chargeNote: "+ charge", nights: 2, days: 3, hotelCategory: "Heritage hotels", tag: "Heritage & Alpine",
    summary: "Manali pine valleys, Gulmarg snow gondolas, Jaipur Pink City royal havelis, and sunny Goa coastal beaches." },
];

const pages: { slug: string; title: string; isPolicy: boolean; body: string }[] = [
  {
    slug: "about",
    title: "About World Vista",
    isPolicy: false,
    body: `## Inspiring a More Meaningful Life

World Vista brings together curated travel and practical learning under one simple idea: **Travel • Learn • Experience**.

### Global destination network
Handpicked properties and bespoke itineraries across our destination network.

### Curated 3, 4 & 5-star hospitality
Premium properties with a 90-day departure validity window on eligible packages.

### Why travel matters
"The world is a book, and those who do not travel read only one page." — Saint Augustine

- **Mental & physical vitality** — travel lowers stress and restores balance.
- **Cognitive expansion & creativity** — exposure to diverse cultures sparks fresh thinking.
- **Unforgettable shared memories** — journeys forge deep family bonds.
- **Purpose & expanded perspective** — breaking routine helps us rediscover motivation.`,
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    isPolicy: true,
    body: `> DRAFT — pending legal approval before launch.

World Vista provides tourism and trading-education services subject to applicable terms and regulations. Financial market trading involves risk, including the potential loss of capital. Educational content is provided for educational purposes only and is not financial advice. Any figures shown are estimates only and are not guaranteed. Participants are encouraged to conduct independent research and seek professional financial and legal advice. World Vista shall operate in accordance with applicable laws and regulations, and participation in any service is subject to its respective terms and conditions.`,
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    isPolicy: true,
    body: `> DRAFT — to be replaced with text approved by qualified legal counsel.

### 1. Accounts
You must provide accurate information and keep your credentials secure. One account per person.

### 2. Tourism services
Package prices exclude service charges unless stated. Itineraries, hotels and availability are confirmed in writing at booking.

### 3. Education services
Courses are educational only and do not constitute financial advice.

### 4. Conduct
Members must not make income or earnings claims on behalf of World Vista.

### 5. Changes
We may update these terms. Members will be asked to accept material changes.`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    isPolicy: true,
    body: `> DRAFT — to be reviewed for compliance with the Digital Personal Data Protection Act, 2023 and other applicable law.

We collect the personal data you provide (name, email, mobile, country, address) to operate your account, respond to enquiries and deliver services. We do not sell personal data. You may request access, correction or deletion by contacting support.`,
  },
  {
    slug: "refund-policy",
    title: "Travel Cancellation & Refund Policy",
    isPolicy: true,
    body: `> DRAFT — confirm supplier terms before launch.

Cancellation charges depend on the package, supplier and time remaining before departure. The applicable terms are shared in writing with your booking confirmation.`,
  },
  {
    slug: "education-risk",
    title: "Education Risk Disclaimer",
    isPolicy: true,
    body: `Financial market trading involves risk. Educational purposes only. Past performance does not guarantee future results. Never trade with money you cannot afford to lose.`,
  },
  {
    slug: "grievance",
    title: "Grievance Redressal",
    isPolicy: false,
    body: `If you have a complaint, raise a support ticket from your member dashboard or email our grievance officer. We acknowledge complaints within 48 hours and aim to resolve them within 30 days.

**Grievance Officer:** _To be appointed_
**Email:** _To be confirmed_`,
  },
];

const faqs = [
  { q: "What is included in a tour package?", a: "Each package includes verified hotel lodging and the highlights listed on the package page. Service charges are extra and quoted at enquiry." },
  { q: "What does 90-day validity mean?", a: "Eligible packages can be used for departures within 90 days. Exact validity is confirmed in writing with your booking." },
  { q: "How do I book?", a: "Send an enquiry from the package page. Our travel team will confirm availability, dates, hotels and the final quote." },
  { q: "What does the Financial Markets Education course cover?", a: "A one-month programme with three classes per week covering a basic-to-advanced syllabus including Smart Money Concepts (order blocks, liquidity sweeps, break of structure)." },
  { q: "Is the course financial advice?", a: "No. The course is for educational purposes only. Trading involves risk, including loss of capital." },
];

const ownerQs = {
  R1: ["10% base: package selling price, business volume or other?", "Which packages qualify?"],
  R2: ["5% left and 5% right applied to which exact volume/commission amount?"],
  R3: ["What starts the 24-month clock?", "Per package or per member?", "Qualifying reward types?", "Inactive/refund rules?", "Does the deck's unlock rule (Free 3, Explorer 5, Pathfinder 10, Navigator 15) apply, or is it withdrawn?"],
  R4: ["Start date of the 12 months?", "Monthly maintenance test?", "Suspension/resume/cancellation if A/B volume falls?"],
  R5: ["One payout per rank?", "Higher rank full amount or difference only?", "Lifetime or period volume?"],
};

const LEGAL = "Requires written legal, tax and regulatory sign-off (spec §18) before any implementation.";

const modules = [
  {
    key: "SHAREHOLDER_PACKAGES", name: "Shareholder Packages", category: "Investment",
    sourceSpec: {
      packages: [
        { name: "Silver", amount: 100, monthlyRate: "6%", term: "34 months" },
        { name: "Gold", amount: 500, monthlyRate: "6%", term: "34 months" },
        { name: "Platinum", amount: 1000, monthlyRate: "6%", term: "34 months" },
        { name: "Emerald", amount: 5000, monthlyRate: "7%", term: "29 months" },
        { name: "Diamond", amount: 10000, monthlyRate: "8%", term: "25 months" },
        { name: "Crown", amount: 20000, monthlyRate: "10%", term: "20 months" },
      ],
      cap: "200% cumulative (deck p.12)",
      note: "6% x 34 months = 204%, which conflicts with the 200% cap.",
    },
    openQuestions: ["Exact 200% cap stop rule, especially 6% for 34 months", LEGAL,
      "Fixed monthly returns on deposited money may fall under the Banning of Unregulated Deposit Schemes Act, 2019 and SEBI collective-investment rules: obtain a legal opinion first."],
  },
  { key: "REWARD_1", name: "Reward 1 — Package Activation Bonus", category: "Affiliate", sourceSpec: { rate: "10%", rule: "On activation of an eligible package" }, openQuestions: [...ownerQs.R1, LEGAL] },
  { key: "REWARD_2", name: "Reward 2 — Binary Matching Bonus", category: "Affiliate", sourceSpec: { rate: "10% total (5% left + 5% right)", weeklyCap: "$1,500 (earlier owner brief)" }, openQuestions: [...ownerQs.R2, LEGAL] },
  {
    key: "REWARD_3", name: "Reward 3 — Shareholder Royalty", category: "Affiliate",
    sourceSpec: { levels: { "1": "1.00%", "2-5": "0.50% each", "6-10": "0.25% each", "11-15": "0.10% each" }, duration: "24 months", eligibility: "Shareholder-package members only" },
    openQuestions: [...ownerQs.R3, LEGAL],
  },
  {
    key: "REWARD_4", name: "Reward 4 — Leadership Bonus", category: "Affiliate",
    sourceSpec: { ranks: [{ rank: "Globe Leader", ab: "$100,000 / $100,000", monthly: "$500", months: 12 }, { rank: "Ambassador", ab: "$250,000 / $250,000", monthly: "$1,000", months: 12 }] },
    openQuestions: [...ownerQs.R4, LEGAL],
  },
  {
    key: "REWARD_5", name: "Reward 5 — Rank Rewards", category: "Affiliate",
    sourceSpec: {
      ranks: [
        ["Voyager", 2500, 50], ["Discoverer", 5000, 100], ["Explorer", 10000, 200], ["Pathfinder", 25000, 500], ["Navigator", 50000, 1000],
        ["Globe Leader", 100000, 2000], ["Ambassador", 250000, 5000], ["Travel Elite", 500000, 10000], ["Crown Legend", 1000000, 20000],
      ].map(([rank, volumeEachSide, bonus]) => ({ rank, volumeEachSide, bonus })),
    },
    openQuestions: [...ownerQs.R5, LEGAL],
  },
  { key: "LEVEL_INCOME_SOURCE", name: "15-Level Income (deck p.14)", category: "Affiliate", sourceSpec: { note: "Recorded only. Do not build a second 15-level engine (spec §8)." }, openQuestions: ["Withdrawn, or merged into Reward 3?"] },
  { key: "BINARY_ENGINE", name: "Binary Volume Engine", category: "Affiliate", sourceSpec: { cycle: "Weekly, closes Friday", weeklyCap: "$1,500" }, openQuestions: ["Eligible volume definition and values", "Week boundary / time zone", "$1,500 cap interaction", "Refunds and carry-forward expiry", LEGAL] },
  { key: "WALLET_LEDGER", name: "USD Wallet & Ledger", category: "Finance", sourceSpec: { balances: ["available", "pending", "locked", "paid", "reversed"] }, openQuestions: ["Depends on approval of a funded product or reward", LEGAL] },
  { key: "MEMBER_TRANSFERS", name: "Member-to-Member Transfers", category: "Finance", sourceSpec: { rule: "Downline only; crossline blocked" }, openQuestions: ["Transfer fee?", LEGAL] },
  {
    key: "WITHDRAWALS", name: "USDT (BEP20) Withdrawals", category: "Finance",
    sourceSpec: { fee: "5%", minimum: "$10", memberCycle: "Friday + 24–48h", shareholderWindow: "1st–3rd monthly", activation: "$10 affiliate min; $120 annual reactivation" },
    openQuestions: ["5% fee on all withdrawal types?", "Friday payout vs monthly shareholder window", "Network fees", "KYC/AML and crypto (VDA) reporting obligations", LEGAL],
  },
];

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@worldvista.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      memberId: "WV000001",
      fullName: "World Vista Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  for (const [i, p] of packages.entries()) {
    const data = { ...p, inclusions: INCLUSIONS, exclusions: EXCLUSIONS, cancellationPolicy: CANCELLATION, validityDays: 90, sortOrder: i, imageUrl: `/images/packages/${p.slug}.jpg` };
    await prisma.tourPackage.upsert({ where: { slug: p.slug }, update: {}, create: data });
  }

  await prisma.course.upsert({
    where: { slug: "financial-markets-mastery" },
    update: {},
    create: {
      slug: "financial-markets-mastery",
      title: "Financial Market Mastery",
      tuition: 120,
      duration: "1 Month",
      schedule: "3 Classes / Week",
      topics: ["Market structure fundamentals", "Smart Money Concepts", "Order blocks", "Liquidity sweeps", "Break of structure (BOS)", "Risk management", "Trading psychology"],
      syllabus: "Basic to Advanced Institutional Syllabus",
      disclaimer: "Financial market trading involves risk. Educational purposes only.",
      imageUrl: "/images/education.jpg",
    },
  });

  for (const p of pages) {
    const existing = await prisma.page.findUnique({ where: { slug: p.slug } });
    if (existing) continue;
    const page = await prisma.page.create({ data: p });
    if (p.isPolicy) await prisma.policyVersion.create({ data: { pageId: page.id, version: 1, body: p.body } });
  }

  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({ data: faqs.map((f, i) => ({ question: f.q, answer: f.a, sortOrder: i })) });
  }

  await prisma.setting.upsert({
    where: { key: "contact" },
    update: {},
    create: { key: "contact", value: { email: "support@worldvista.example", phone: "To be confirmed", whatsapp: "", address: "To be confirmed", hours: "Mon–Sat, 10:00–18:00 IST" } },
  });
  await prisma.setting.upsert({
    where: { key: "company" },
    update: {},
    create: { key: "company", value: { legalName: "World Vista (legal entity name to be confirmed)", registration: "", gstin: "" } },
  });

  for (const m of modules) {
    await prisma.moduleConfig.upsert({ where: { key: m.key }, update: { sourceSpec: m.sourceSpec, openQuestions: m.openQuestions, name: m.name }, create: m });
  }

  console.log(`Seed complete. Super admin: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
