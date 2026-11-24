-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('DIRECT', 'BINARY', 'RANK', 'REVERSAL', 'WITHDRAWAL_HOLD', 'WITHDRAWAL_RELEASE');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'CHANGE_WALLET';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "walletAddress" TEXT,
ADD COLUMN     "walletChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VolumeEntry" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "leg" "Side" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "weekKey" TEXT NOT NULL,
    "activationId" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "reversal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolumeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeEntry" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "IncomeType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "activationId" TEXT,
    "weekKey" TEXT,
    "withdrawalId" TEXT,
    "achievementId" TEXT,
    "reversesId" TEXT,
    "calc" JSONB,
    "memo" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idemKey" TEXT,

    CONSTRAINT "IncomeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BinaryWeek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "leftCarryIn" DECIMAL(14,2) NOT NULL,
    "rightCarryIn" DECIMAL(14,2) NOT NULL,
    "leftVolume" DECIMAL(14,2) NOT NULL,
    "rightVolume" DECIMAL(14,2) NOT NULL,
    "matched" DECIMAL(14,2) NOT NULL,
    "rate" DECIMAL(6,3) NOT NULL,
    "calculated" DECIMAL(14,2) NOT NULL,
    "payable" DECIMAL(14,2) NOT NULL,
    "capped" DECIMAL(14,2) NOT NULL,
    "cap" DECIMAL(14,2) NOT NULL,
    "leftCarryOut" DECIMAL(14,2) NOT NULL,
    "rightCarryOut" DECIMAL(14,2) NOT NULL,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,

    CONSTRAINT "BinaryWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "leftVolume" DECIMAL(14,2) NOT NULL,
    "rightVolume" DECIMAL(14,2) NOT NULL,
    "reward" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rankId" TEXT NOT NULL,
    "qualifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftVolume" DECIMAL(14,2) NOT NULL,
    "rightVolume" DECIMAL(14,2) NOT NULL,
    "reward" DECIMAL(14,2) NOT NULL,
    "rewardStatus" "RewardStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "RankAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "fee" DECIMAL(14,2) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'USDT-BEP20',
    "address" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "rejectReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolumeEntry_beneficiaryId_weekKey_idx" ON "VolumeEntry"("beneficiaryId", "weekKey");

-- CreateIndex
CREATE UNIQUE INDEX "VolumeEntry_activationId_beneficiaryId_reversal_key" ON "VolumeEntry"("activationId", "beneficiaryId", "reversal");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeEntry_txId_key" ON "IncomeEntry"("txId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeEntry_achievementId_key" ON "IncomeEntry"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeEntry_reversesId_key" ON "IncomeEntry"("reversesId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeEntry_idemKey_key" ON "IncomeEntry"("idemKey");

-- CreateIndex
CREATE INDEX "IncomeEntry_userId_createdAt_idx" ON "IncomeEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "IncomeEntry_type_idx" ON "IncomeEntry"("type");

-- CreateIndex
CREATE INDEX "BinaryWeek_weekKey_idx" ON "BinaryWeek"("weekKey");

-- CreateIndex
CREATE UNIQUE INDEX "BinaryWeek_userId_weekKey_key" ON "BinaryWeek"("userId", "weekKey");

-- CreateIndex
CREATE UNIQUE INDEX "Rank_name_key" ON "Rank"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RankAchievement_userId_rankId_key" ON "RankAchievement"("userId", "rankId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_reference_key" ON "Withdrawal"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_txHash_key" ON "Withdrawal"("txHash");

-- CreateIndex
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");

-- AddForeignKey
ALTER TABLE "VolumeEntry" ADD CONSTRAINT "VolumeEntry_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolumeEntry" ADD CONSTRAINT "VolumeEntry_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "PackageActivation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeEntry" ADD CONSTRAINT "IncomeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeEntry" ADD CONSTRAINT "IncomeEntry_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "PackageActivation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeEntry" ADD CONSTRAINT "IncomeEntry_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeEntry" ADD CONSTRAINT "IncomeEntry_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "RankAchievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeEntry" ADD CONSTRAINT "IncomeEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "IncomeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinaryWeek" ADD CONSTRAINT "BinaryWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankAchievement" ADD CONSTRAINT "RankAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankAchievement" ADD CONSTRAINT "RankAchievement_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "Rank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
