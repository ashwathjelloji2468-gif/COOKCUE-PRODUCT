-- CreateTable
CREATE TABLE "OnboardingApplication" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
    "applicantName" TEXT NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "contractorName" TEXT,
    "kitchenName" TEXT,
    "location" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "emailVerificationToken" TEXT,
    "emailVerificationTokenExpiresAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "rejectionReason" TEXT,
    "assignedContractorId" TEXT,
    "assignedKitchenId" TEXT,
    "assignedRole" TEXT,
    "activationToken" TEXT,
    "activationTokenExpiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "activatedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationNotificationLog" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipient" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'APPROVAL_WELCOME',
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicationId" TEXT,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingApplication_emailVerificationToken_key" ON "OnboardingApplication"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingApplication_activationToken_key" ON "OnboardingApplication"("activationToken");

-- CreateIndex
CREATE INDEX "OnboardingApplication_applicantEmail_idx" ON "OnboardingApplication"("applicantEmail");

-- CreateIndex
CREATE INDEX "OnboardingApplication_status_idx" ON "OnboardingApplication"("status");

-- CreateIndex
CREATE INDEX "ApplicationNotificationLog_applicationId_idx" ON "ApplicationNotificationLog"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationNotificationLog_status_idx" ON "ApplicationNotificationLog"("status");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_acknowledgedAt_idx" ON "InAppNotification"("userId", "acknowledgedAt");

-- AddForeignKey
ALTER TABLE "ApplicationNotificationLog" ADD CONSTRAINT "ApplicationNotificationLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OnboardingApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OnboardingApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
