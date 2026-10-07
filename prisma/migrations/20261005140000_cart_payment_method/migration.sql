CREATE TYPE "CheckoutPaymentMethod" AS ENUM ('COD', 'STRIPE');

ALTER TABLE "Cart" ADD COLUMN "paymentMethod" "CheckoutPaymentMethod";
