# Clothing E-commerce Backend

REST API for a clothing store. It covers accounts, the catalog, cart and checkout, Stripe payments, returns, reviews, coupons, and an admin dashboard.

Customers and admins are separate accounts. Protected routes expect a Bearer JWT with role `USER` or `ADMIN`.

## Tech stack

- Node.js and Express 5
- TypeScript
- PostgreSQL with Prisma
- Zod for request validation
- JWT authentication and bcrypt password hashing
- Stripe payments and webhooks
- Cloudinary image uploads (Multer)
- Nodemailer and PDFKit for order email and invoices
- Winston logging, Helmet, and express-rate-limit

## Local setup

You need Node.js 20+ and a running PostgreSQL database.

1. Install dependencies. `postinstall` generates the Prisma client.

```bash
npm install
```

2. Create the environment file and fill in real values. Secrets below the Stripe block are optional; the server starts without them, and those features return 503 until they are set.

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | API port. Defaults to `5000`. |
| `NODE_ENV` | No | `development`, `production`, or `test`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. | 
| `ADMIN_EMAIL` | No | Default admin email. Defaults to `anondo554@gmail.com`. |
| `ADMIN_PASSWORD` | No | Default admin password. Defaults to `12345678`. Created only when that email does not exist yet. |
| `ADMIN_FIRST_NAME` | No | Default admin first name. |
| `ADMIN_LAST_NAME` | No | Default admin last name. |
| `JWT_SECRET` | Yes | Access-token signing secret (at least 10 characters). |
| `JWT_EXPIRES_IN` | No | Access-token lifetime. Defaults to `7d`. |
| `JWT_REFRESH_SECRET` | Yes | Refresh-token secret (at least 10 characters). |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh-token lifetime. Defaults to `30d`. |
| `ALLOWED_ORIGINS` | No | Comma-separated browser origins. Defaults to `http://localhost:3000`. |
| `COOKIE_SECRET` | Yes | Cookie signing secret (at least 10 characters). |
| `STRIPE_SECRET_KEY` | No | Stripe secret key. Required to create payment intents. |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret. |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name. Required for product image upload. |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret. |
| `SMTP_HOST` | No | SMTP host. Required to send email. |
| `SMTP_PORT` | No | SMTP port. Defaults to `587`. |
| `SMTP_USER` | No | SMTP username. |
| `SMTP_PASS` | No | SMTP password. |
| `SMTP_FROM` | No | From address, for example `Store <orders@example.com>`. |

3. Start the API. On a new computer this creates the database named in `DATABASE_URL`, applies the tables, and creates the default admin.

```bash
npm run dev
```

The terminal prints `Default admin created` the first time, then `Admin already exists` on later starts. The account comes from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`.

Admin login is `POST /api/v1/auth/admin/login`.

`npm run seed` is optional. It adds a sample catalog (Men, Women, Accessories, plus Classic Oxford Shirt in S, M, L, and XL) and skips the admin if one already exists.

`npm run db:migrate` runs `prisma migrate dev` when you want a new migration file.

The server listens on `http://localhost:5000`. `GET /health` returns the process status.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Generates the Prisma client and compiles TypeScript. |
| `npm start` | Runs the compiled server. |
| `npm run db:studio` | Opens Prisma Studio. |

This repo is locked with pnpm. The same script names work as `pnpm install`, `pnpm db:push`, `pnpm seed`, and `pnpm dev`.

## API

Base path: `/api/v1`

Send `Authorization: Bearer <token>` on protected routes. JSON responses use `{ success, message, data }`. List routes add `meta`. Validation errors return `422`.

Login routes allow 10 failed attempts per IP every 15 minutes.

### Auth and users

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/users/register` | Public | Create a customer account. |
| `POST` | `/api/v1/auth/login` | Public | Customer login. Returns a token. |
| `POST` | `/api/v1/auth/admin/login` | Public | Admin login. Returns a token. |
| `POST` | `/api/v1/auth/forgot-password` | Public | Email a 6-digit customer reset code. Unknown emails get the same response. |
| `POST` | `/api/v1/auth/admin/forgot-password` | Public | Email a 6-digit admin reset code. Unknown emails get the same response. |
| `POST` | `/api/v1/auth/reset-password` | Public | Set a new password with the email and the 6-digit code. |
| `POST` | `/api/v1/auth/logout` | User or admin | Revoke the current token. |
| `GET` | `/api/v1/users/me` | User or admin | Current account. |
| `PATCH` | `/api/v1/users/me` | User or admin | Update the signed-in profile. Customers can change name, phone, avatar, and password. |
| `GET` | `/api/v1/users/:id` | Admin | Fetch one customer. |

### Catalog

Product create accepts JSON, or `multipart/form-data` with a `data` JSON field and up to five `images` (JPEG, PNG, or WebP). Image files are stored in Cloudinary and saved on the product.

Catalog options live under `/api/v1/catalog`. Each create response includes `data.id`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/catalog` | Public | Brands, categories, sizes, and fabrics in one response. Each item includes `id`. |
| `POST` | `/api/v1/catalog/brands` | Admin | Create a brand. |
| `GET` | `/api/v1/catalog/brands` | Public | List brands. |
| `POST` | `/api/v1/catalog/categories` | Admin | Create a category. Optional `parentId` nests it. |
| `GET` | `/api/v1/catalog/categories` | Public | List categories. |
| `POST` | `/api/v1/catalog/sizes` | Admin | Create a size. |
| `GET` | `/api/v1/catalog/sizes` | Public | List sizes. |
| `POST` | `/api/v1/catalog/fabrics` | Admin | Create a fabric. |
| `GET` | `/api/v1/catalog/fabrics` | Public | List fabrics. |
| `POST` | `/api/v1/products` | Admin | Create a product. Optional `sizes` adds size, fabric, and stock in the same request. SKU is generated when omitted. |
| `GET` | `/api/v1/products` | Public | List products. Each product includes `variants[].id` for the cart. |
| `GET` | `/api/v1/products/:id` | Public | Product detail, images, and variants. |
| `PATCH` | `/api/v1/products/:id` | Admin | Update a product. |
| `DELETE` | `/api/v1/products/:id` | Admin | Delete a product and its variants. Blocked when a variant is on an order or exchange. |
| `POST` | `/api/v1/variants` | Admin | Create a variant. Requires `productId`. |
| `GET` | `/api/v1/variants` | Public | List variants. |
| `GET` | `/api/v1/variants/:id` | Public | Variant detail. |
| `PATCH` | `/api/v1/variants/:id` | Admin | Update a variant. |
| `DELETE` | `/api/v1/variants/:id` | Admin | Delete a variant. |

### Cart and orders

Checkout copies the cart into an order and decrements stock. When an admin cancels a pending, confirmed, or processing order, those units go back to stock.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/cart` | User | Current cart. |
| `POST` | `/api/v1/cart/items` | User | Add to cart. Send `productId` when the product has one variant, or `variantId` from `variants[].id`. |
| `POST` | `/api/v1/cart/payment` | User | Save `COD` or `STRIPE` on the cart. Required before an order. |
| `DELETE` | `/api/v1/cart/items/:itemId` | User | Remove a cart line. |
| `POST` | `/api/v1/orders` | User | Place an order from the cart. Uses the saved payment method. Cash on delivery confirms the order. Stripe returns `checkoutUrl`. If the card page cannot be created, the order is cancelled and stock is returned. |
| `GET` | `/api/v1/orders` | User or admin | List own orders, or all orders for an admin. |
| `GET` | `/api/v1/orders/:id` | User or admin | Order detail. |
| `PATCH` | `/api/v1/orders/:id/status` | Admin | Change order status. |

### Payments, returns, and reviews

A successful Stripe payment marks the payment `PAID` and the order `CONFIRMED`. A failed payment leaves the order pending so the customer can retry. The webhook must receive the raw body and a `stripe-signature` header.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/payments/create-intent` | User | Create a Stripe Payment Intent for a pending order. |
| `POST` | `/api/v1/payments/checkout` | User | Create a Stripe Checkout page. Open `data.url` in the browser. Cash on delivery orders are rejected. |
| `POST` | `/api/v1/payments/cod/collect` | Admin | Mark a cash on delivery payment as collected. |
| `POST` | `/api/v1/payments/webhook` | Public | Stripe webhook. |
| `POST` | `/api/v1/returns` | User | Request a return or exchange for a delivered order. |
| `GET` | `/api/v1/returns` | User or admin | List returns. |
| `GET` | `/api/v1/returns/:id` | User or admin | Return detail. |
| `PATCH` | `/api/v1/returns/:id/review` | Admin | Approve or reject a return. |
| `POST` | `/api/v1/reviews` | User | Review a purchased product. One review per product. |
| `GET` | `/api/v1/reviews/products/:productId` | Public | Reviews, count, and average rating. |

### Coupons and dashboard

`POST /api/v1/coupons/apply` checks that a coupon is active and returns the discount. It does not change the order.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/coupons` | Admin | Create a coupon. |
| `GET` | `/api/v1/coupons` | Admin | List coupons. |
| `GET` | `/api/v1/coupons/:id` | Admin | Coupon detail. |
| `PATCH` | `/api/v1/coupons/:id` | Admin | Update a coupon. |
| `DELETE` | `/api/v1/coupons/:id` | Admin | Delete an unused coupon. |
| `POST` | `/api/v1/coupons/apply` | User | Validate a coupon and calculate the discount. |
| `GET` | `/api/v1/dashboard` | Admin | Revenue, orders by status, and active customers. |
