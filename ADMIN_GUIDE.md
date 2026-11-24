# World Vista admin guide

This guide covers the day-to-day admin tasks. Every action listed here is recorded in **Admin → Audit log**.

## USD Credits (Finance admin)

A USD credit is World Vista credit that a member can spend only on World Vista tour and course packages. It is not cash. Members can't withdraw it, transfer it, or swap it for USDT.

1. Go to **USD Credits** and click **Generate USD Credit**.
2. Search for the member by Member ID, email or name.
3. Enter the amount and an internal reason. Members never see the reason.
4. Confirm with your password. The credit is created as **Pending**, and the member can't spend it yet.
5. *(Optional)* Click **Send** to tell the member a credit is on its way. They get an in-app notice and an email.
6. When the money has actually arrived, click **Approve** and enter the funding or payment reference.
   - A different admin must approve credits you generated. A Super Admin can approve their own.
   - The credit is added to the member's available balance, and the member is notified.
7. To cancel a credit, click **Void** and give a reason.
   - You can void a credit only while the member still has that amount unspent.
   - If they've already spent it, cancel the package activation first.

## Package Activations (Finance or Support admin)

Members use their credit from **Tour Packages → Pay with credit** or **Academy → Enrol with USD credit**. The credit is deducted once, and the member gets a receipt.

- **Courses** become active immediately.
- **Tours** wait as **Pending approval** until you check dates and hotels with the supplier.
  - Click **Approve** to confirm. The booking moves to *Confirmed* and the member is notified.
  - Click **Cancel** (reason and password required) to cancel. Leave "refund to credit" ticked to return the amount to the member's balance.

## Bookings (Enquiries)

When a member clicks **Book Now**, a booking request is created (reference `BKG-…`). Manage it in **Enquiries**: update the status, add internal notes, or send a Razorpay payment link.

## Courses → Timetable

Open a course and click **Timetable**. Here you can:
- Add, edit or remove classes.
- Add the live link before each class and the recording afterwards. Only enrolled students can see these links.
- See each student's progress.

## Packages

Each package has:
- A service charge per traveller.
- A day-by-day itinerary.
- A "Can be paid with USD credit" switch. USD-priced packages only.

## Genealogy (Support admin)

- Pick a top-level member, then search by Member ID, name or email. Switch between the **Binary placement** and **Sponsor tree** views.
- **Correct placement** (Super Admin only) moves a member and their whole downline into an empty slot.
  - A reason and your password are required.
  - Moves that would place a member under their own downline are blocked.
  - Sponsor (referral) links never change.

## Reports

**Reports** shows daily, monthly and yearly summaries. You can download CSV files (they open in Excel) for:
- members
- enquiries
- payments
- credits
- the credit ledger
- activations
- enrolments
- the audit log

## Commission settings (Super Admin)

The commission engine is **off** until a Super Admin opens **Commission settings** and saves with two things:
- The owner-approval box ticked. This records the written approval required by requirements §23, with your name and the time, in the audit log.
- Your password.

When you first switch it on, all existing active packages are processed.

**Default rules** (requirements §4, §5 and §21, all editable):

| Setting | Default |
|---|---|
| Direct commission | 10% of the package price, excluding service charges |
| Binary commission | 10% of matched (weaker-leg) volume |
| Weekly binary cap | $1,500 per member. Excess is forfeited and never carried forward. |
| Unmatched volume | Carries into the next week |
| Week | Monday 00:00 to Sunday 23:59, Asia/Kolkata (IST) |
| Week closing | Automatic, checked hourly. You can also use **Close finished weeks now**. Each member-week is paid at most once. |
| Withdrawals | 5% fee, minimum $10, maximum $10,000, 48-hour hold after an address change |

**When commissions happen:**
- A sale counts when its package activation becomes **Active**: courses immediately, tours when you approve them.
- Cancelling an active package reverses that sale's volume and direct commission with linked entries.

## Binary weeks & cap / Reward audit

- **Binary weeks** shows every member's weekly figures: carry-in, volume, matched, calculated, payable and over-cap. Filter it to show only members who reached the cap.
- **Reward audit** lists every income entry with its full calculation log.
- CSV exports: income, binary-weeks, rank-rewards and withdrawals.

## Ranks

- A Super Admin edits thresholds and rewards.
- The Ambassador threshold ($25,000) is lower than Navigator's ($50,000), as supplied in the requirements. The page flags this until you confirm or change it.
- When a member qualifies, their reward is created as *Pending review*. Approve it to credit their income, or reject it with a note.

## Withdrawals (Finance admin)

Members request USDT (BNB Smart Chain, BEP20) payouts to their saved address. Address changes need an email code and start the security hold.

**Statuses:** the member sees *Pending* until you finish. You can mark a request *Processing* internally.

**To complete a request:**
1. Send the USDT from your wallet.
2. Click **Complete payout**.
3. Paste the transaction hash.
4. Tick the box confirming the transfer was sent.
5. Enter your password.

**To reject a request**, enter a reason. The reserved amount goes back to the member's balance.

## Not built: needs a written legal opinion

- **Shareholder packages** (fixed 6–10% monthly returns, 200% offer) and the **15-level income** calculated on them.

Requirements §22 says not to launch or collect funds for these until legal and financial advisers approve the model. Their specifications are recorded under **Modules pending approval**.
