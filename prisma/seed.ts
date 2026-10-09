import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "../src/app/config/env";
import { hashPassword } from "../src/utils/bcrypt";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const ADMIN_EMAIL = env.ADMIN_EMAIL;
const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

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
        firstName: env.ADMIN_FIRST_NAME,
        lastName: env.ADMIN_LAST_NAME,
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

  const women = await prisma.category.findUniqueOrThrow({ where: { slug: "women" } });
  const medium = await prisma.size.findUniqueOrThrow({ where: { slug: "m" } });
  const productImages = [
    "/uploads/ecommerce/products/2abbfa02-2069-48ef-bebf-0e36603ce517.jpg",
    "/uploads/ecommerce/products/3daa0ad6-5590-455a-836e-26d10751559e.jpg",
  ];
  const demoProducts = [
    { name: "Relaxed Linen Shirt", slug: "demo-relaxed-linen-shirt", gender: "MEN" as const, categoryId: men.id, price: 1290, compareAtPrice: 1790 },
    { name: "Everyday Cotton Kurti", slug: "demo-everyday-cotton-kurti", gender: "WOMEN" as const, categoryId: women.id, price: 1490, compareAtPrice: 1990 },
    { name: "Classic Printed Panjabi", slug: "demo-printed-panjabi", gender: "MEN" as const, categoryId: men.id, price: 1890, compareAtPrice: 2490 },
    { name: "Soft Knit Cardigan", slug: "demo-knit-cardigan", gender: "WOMEN" as const, categoryId: women.id, price: 1690, compareAtPrice: 2290 },
    { name: "Weekend Polo Shirt", slug: "demo-weekend-polo-shirt", gender: "MEN" as const, categoryId: men.id, price: 990, compareAtPrice: 1390 },
    { name: "Printed Summer Dress", slug: "demo-summer-dress", gender: "WOMEN" as const, categoryId: women.id, price: 1790, compareAtPrice: 2390 },
  ];

  for (const [index, item] of demoProducts.entries()) {
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        status: "ACTIVE",
        gender: item.gender,
        fit: "REGULAR",
        basePrice: item.price,
        compareAtPrice: item.compareAtPrice,
        brandId: brand.id,
        categoryId: item.categoryId,
        publishedAt: new Date(),
        createdAt: new Date(),
      },
      create: {
        name: item.name,
        slug: item.slug,
        description: "Sample sale item for testing the storefront product carousel.",
        status: "ACTIVE",
        gender: item.gender,
        fit: "REGULAR",
        basePrice: item.price,
        compareAtPrice: item.compareAtPrice,
        brandId: brand.id,
        categoryId: item.categoryId,
        tags: ["demo", "sale"],
        publishedAt: new Date(),
      },
    });

    await prisma.productImage.upsert({
      where: { id: `demo-image-${item.slug}` },
      update: {
        url: productImages[index % productImages.length],
        alt: item.name,
        isPrimary: true,
      },
      create: {
        id: `demo-image-${item.slug}`,
        productId: product.id,
        url: productImages[index % productImages.length],
        alt: item.name,
        isPrimary: true,
      },
    });

    await prisma.productVariant.upsert({
      where: { sku: `DEMO-${item.slug.toUpperCase()}-M` },
      update: {
        productId: product.id,
        sizeId: medium.id,
        colorId: color.id,
        fabricId: fabric.id,
        price: item.price,
        compareAtPrice: item.compareAtPrice,
        stock: 12,
        isActive: true,
      },
      create: {
        productId: product.id,
        sizeId: medium.id,
        colorId: color.id,
        fabricId: fabric.id,
        sku: `DEMO-${item.slug.toUpperCase()}-M`,
        price: item.price,
        compareAtPrice: item.compareAtPrice,
        stock: 12,
      },
    });
  }

  const campaignImages = [
    "/uploads/ecommerce/home/f00ab7f9-7575-424a-98b3-34cf13993ee7.jpg",
    "/uploads/ecommerce/home/e559f165-dca7-40d1-8163-c7c8591f2b81.jpg",
    "/uploads/ecommerce/home/d41b1d4b-af3b-470d-b555-1672efbfee3e.jpg",
    "/uploads/ecommerce/home/4a81a04d-818d-4597-aa96-e41aa575fe5c.jpg",
    "/uploads/ecommerce/home/1e90f9cf-643c-4956-a4f9-b8d044a54200.jpg",
    "/uploads/ecommerce/home/16fe2a82-628c-459b-8ecb-c39bc0d7b333.jpg",
    "/uploads/ecommerce/home/154ba077-4669-4e45-8f83-5e18416af0b5.jpg",
  ];

  for (let index = 0; index < 9; index += 1) {
    const id = `demo-home-campaign-${String(index + 1).padStart(2, "0")}`;
    await prisma.homeBlock.upsert({
      where: { id },
      update: {
        kind: "CAMPAIGN",
        title: `Demo campaign ${index + 1}`,
        imageUrl: campaignImages[index % campaignImages.length],
        linkUrl: "/shop",
        sortOrder: -100 + index,
        isActive: true,
      },
      create: {
        id,
        kind: "CAMPAIGN",
        title: `Demo campaign ${index + 1}`,
        imageUrl: campaignImages[index % campaignImages.length],
        linkUrl: "/shop",
        sortOrder: -100 + index,
      },
    });
  }

  console.log("Seed complete");
  console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log("Categories: Men, Women, Accessories");
  console.log("Sample product: Classic Oxford Shirt (S, M, L, XL)");
  console.log("Demo storefront: six sale products and nine campaign tiles");
};

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
