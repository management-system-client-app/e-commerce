ALTER TYPE "CheckoutPaymentMethod" ADD VALUE 'BKASH';
ALTER TYPE "CheckoutPaymentMethod" ADD VALUE 'NAGAD';

ALTER TABLE "StoreSetting" ADD COLUMN "bkashNumber" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "nagadNumber" TEXT;

DROP INDEX IF EXISTS "Payment_transactionId_idx";

CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");
