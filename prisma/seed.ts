import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../src/utils/bcrypt";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const ADMIN_EMAIL = "anondo554@gmail.com";
const ADMIN_PASSWORD = "12345678";

const categories = [
  { name: "Men", slug: "men", sortOrder: 1 },
  { name: "Women", slug: "women", sortOrder: 2 },
  { name: "Accessories", slug: "accessories", sortOrder: 3 },
] as const;

const sizes = [
  { name: "S", slug: "s", sortOrder: 1 },
  { name: "M", slug: "m", sortOrder: 2 },
  { name: "L", slug: "l", sortOrder: 3 },
  { name: "XL", slug: "xl", sortOrder: 4 },
] as const;

const seed = async (): Promise<void> => {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

const existingAdmin = await prisma.admin.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });

  if (!existingAdmin) {
    await prisma.admin.create({
      data: {
        firstName: "Anondo",
        lastName: "Admin",
        email: ADMIN_EMAIL,
        passwordHash,
        role: "SUPER_ADMIN",
      },
    });
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: category,
    });
  }

  const men = await prisma.category.findUniqueOrThrow({ where: { slug: "men" } });

  const brand = await prisma.brand.upsert({
    where: { slug: "atelier" },
    update: { name: "Atelier", isActive: true },
    create: {
      name: "Atelier",
      slug: "atelier",
      description: "House label for sample catalog items",
    },
  });

  const color = await prisma.color.upsert({
    where: { slug: "navy" },
    update: { name: "Navy", hexCode: "#1B2838" },
    create: { name: "Navy", slug: "navy", hexCode: "#1B2838" },
  });

  const fabric = await prisma.fabric.upsert({
    where: { slug: "cotton" },
    update: { name: "Cotton", composition: "100% cotton" },
    create: { name: "Cotton", slug: "cotton", composition: "100% cotton" },
  });

  const product = await prisma.product.upsert({
    where: { slug: "classic-oxford-shirt" },
    update: {
      name: "Classic Oxford Shirt",
      status: "ACTIVE",
      basePrice: 49,
      brandId: brand.id,
      categoryId: men.id,
    },
    create: {
      name: "Classic Oxford Shirt",
      slug: "classic-oxford-shirt",
      description: "A sample cotton oxford shirt used to exercise the catalog.",
      status: "ACTIVE",
      gender: "MEN",
      basePrice: 49,
      brandId: brand.id,
      categoryId: men.id,
      publishedAt: new Date(),
    },
  });

  for (const size of sizes) {
    const savedSize = await prisma.size.upsert({
      where: { slug: size.slug },
      update: { name: size.name, sortOrder: size.sortOrder },
      create: size,
    });

    const sku = `OXF-NAVY-${size.name}`;

    await prisma.productVariant.upsert({
      where: { sku },
      update: { isActive: true },
      create: {
        productId: product.id,
        sizeId: savedSize.id,
        colorId: color.id,
        fabricId: fabric.id,
        sku,
        stock: 25,
        price: 49,
      },
    });
  }

  console.log("Seed complete");
  console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log("Categories: Men, Women, Accessories");
  console.log("Sample product: Classic Oxford Shirt (S, M, L, XL)");
};

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
