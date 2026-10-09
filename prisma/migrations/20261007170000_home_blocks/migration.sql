CREATE TYPE "HomeBlockKind" AS ENUM ('BANNER', 'CAMPAIGN', 'NEW_ARRIVAL');

CREATE TABLE "HomeBlock" (
    "id" TEXT NOT NULL,
    "kind" "HomeBlockKind" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "categoryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomeBlock_kind_isActive_sortOrder_idx" ON "HomeBlock"("kind", "isActive", "sortOrder");

CREATE INDEX "HomeBlock_categoryId_idx" ON "HomeBlock"("categoryId");

ALTER TABLE "HomeBlock" ADD CONSTRAINT "HomeBlock_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
