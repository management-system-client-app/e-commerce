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

3. Create the `ecommerce` database, then sync the schema and seed sample data.

```bash
npm run db:push
npm run seed
```

`npm run db:migrate` runs `prisma migrate dev` when you want a new migration file. For a local database, `npm run db:push` applies the current `prisma/schema.prisma`.

The seed creates this admin and a sample catalog (Men, Women, Accessories, plus Classic Oxford Shirt in S, M, L, and XL):

- Email: `anondo554@gmail.com`
- Password: `12345678`

4. Start the API.

```bash
npm run dev
```

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
| `POST` | `/api/v1/auth/logout` | User or admin | Revoke the current token. |
| `GET` | `/api/v1/users/me` | User or admin | Current account. |
| `GET` | `/api/v1/users/:id` | Admin | Fetch one customer. |

### Catalog

Product create accepts JSON, or `multipart/form-data` with a `data` JSON field and up to five `images` (JPEG, PNG, or WebP). Image files are stored in Cloudinary and saved on the product.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/products` | Admin | Create a product. |
| `GET` | `/api/v1/products` | Public | List products. Includes category. |
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
| `POST` | `/api/v1/cart/items` | User | Add or increase a variant. |
| `DELETE` | `/api/v1/cart/items/:itemId` | User | Remove a cart line. |
| `POST` | `/api/v1/orders` | User | Place an order from the cart. |
| `GET` | `/api/v1/orders` | User or admin | List own orders, or all orders for an admin. |
| `GET` | `/api/v1/orders/:id` | User or admin | Order detail. |
| `PATCH` | `/api/v1/orders/:id/status` | Admin | Change order status. |

### Payments, returns, and reviews

A successful Stripe payment marks the payment `PAID` and the order `CONFIRMED`. A failed payment leaves the order pending so the customer can retry. The webhook must receive the raw body and a `stripe-signature` header.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/payments/create-intent` | User | Create a Stripe Payment Intent for a pending order. |
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
