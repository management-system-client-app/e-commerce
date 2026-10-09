ALTER TYPE "PaymentProvider" ADD VALUE 'ROCKET';

ALTER TYPE "CheckoutPaymentMethod" ADD VALUE 'ROCKET';

ALTER TABLE "StoreSetting" ADD COLUMN "rocketNumber" TEXT;
