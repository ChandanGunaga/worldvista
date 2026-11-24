-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('PENDING', 'APPROVED', 'VOIDED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('CREDIT_APPROVED', 'ACTIVATION_DEBIT', 'ACTIVATION_REFUND', 'CREDIT_REVERSAL');

-- CreateEnum
CREATE TYPE "ActivationKind" AS ENUM ('TOUR', 'COURSE');

-- CreateEnum
CREATE TYPE "ActivationStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'CANCELLED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "creditEligible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TourPackage" ADD COLUMN     "creditEligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "itinerary" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "serviceCharge" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CourseSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "instructor" TEXT,
    "liveUrl" TEXT,
    "recordingUrl" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsdCredit" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "CreditStatus" NOT NULL DEFAULT 'PENDING',
    "internalNote" TEXT NOT NULL,
    "fundingRef" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsdCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "creditId" TEXT,
    "activationId" TEXT,
    "reversesId" TEXT,
    "actorId" TEXT,
    "memo" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageActivation" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ActivationKind" NOT NULL,
    "packageId" TEXT,
    "courseId" TEXT,
    "enquiryId" TEXT,
    "itemName" TEXT NOT NULL,
    "travellers" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "serviceCharge" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "ActivationStatus" NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageActivation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseSession_courseId_startsAt_idx" ON "CourseSession"("courseId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProgress_enrollmentId_sessionId_key" ON "SessionProgress"("enrollmentId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "UsdCredit_reference_key" ON "UsdCredit"("reference");

-- CreateIndex
CREATE INDEX "UsdCredit_userId_status_idx" ON "UsdCredit"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_txId_key" ON "CreditLedgerEntry"("txId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_reversesId_key" ON "CreditLedgerEntry"("reversesId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_userId_createdAt_idx" ON "CreditLedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PackageActivation_receiptNo_key" ON "PackageActivation"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "PackageActivation_idempotencyKey_key" ON "PackageActivation"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PackageActivation_enquiryId_key" ON "PackageActivation"("enquiryId");

-- CreateIndex
CREATE INDEX "PackageActivation_userId_idx" ON "PackageActivation"("userId");

-- CreateIndex
CREATE INDEX "PackageActivation_status_idx" ON "PackageActivation"("status");

-- AddForeignKey
ALTER TABLE "CourseSession" ADD CONSTRAINT "CourseSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProgress" ADD CONSTRAINT "SessionProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProgress" ADD CONSTRAINT "SessionProgress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CourseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsdCredit" ADD CONSTRAINT "UsdCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "UsdCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "PackageActivation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "CreditLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageActivation" ADD CONSTRAINT "PackageActivation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageActivation" ADD CONSTRAINT "PackageActivation_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TourPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageActivation" ADD CONSTRAINT "PackageActivation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageActivation" ADD CONSTRAINT "PackageActivation_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
