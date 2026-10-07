-- AlterTable
ALTER TABLE "PasswordResetToken" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "PasswordResetToken" ADD COLUMN "adminId" TEXT;

-- CreateIndex
CREATE INDEX "PasswordResetToken_adminId_idx" ON "PasswordResetToken"("adminId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One owner: a customer or an admin, never both and never neither.
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_owner_check" CHECK (
  ("userId" IS NOT NULL AND "adminId" IS NULL) OR
  ("userId" IS NULL AND "adminId" IS NOT NULL)
);
