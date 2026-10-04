# Local Store

Express / MongoDB store with a public product catalog and an admin inventory dashboard.

## Run

1. In `Backend`, run `npm install`.
2. Copy `.env.example` to `.env` if needed and configure MongoDB, JWT secrets, and Cloudinary.
3. Run `npm start` from `Backend`.
4. Open `http://localhost:3000/` for customers or `/admin` for administration.

Customers can browse/search products, filter categories and view product details without an account. Approved admins can log in, add products with images, edit products/categories, update stock and set a per-product low-stock limit. The category field accepts a new category or an existing suggestion. A stock quantity at or below the limit appears in the low-stock filter, including out-of-stock products.

## Deploy on Render

Deploy this repository as one Node Web Service. Express serves both the frontend in `Backend/public` and the API. The frontend uses relative `/api/...` URLs, so it automatically calls the same Render domain; no frontend `.env` or `VITE_API_URL` is needed.

Create a Render Blueprint using the repository's `render.yaml`, or configure an existing Web Service with:

- Root Directory: `Backend`
- Build Command: `npm ci`
- Start Command: `node index.js`
- Health Check Path: `/api/health`
- Environment: `NODE_ENV=production`, `NODE_VERSION=22`

Set `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in Render's environment settings. Use distinct random JWT secrets of at least 32 bytes. Never put these secrets in frontend files. Let Render supply `PORT`; the server binds to `0.0.0.0` using that value.

After deployment, open the assigned Render URL for the storefront, `/admin` for the dashboard, and `/api/health` to check the service. Updating `render.yaml` does not automatically reconfigure a manually created service; apply the settings above in its dashboard.

Startup waits for MongoDB and order indexes before opening the port. A port scan timeout can therefore indicate a database/startup failure. Check the earlier startup logs and confirm the MongoDB connection settings and network access permit the Render service to connect.

## Admin access

Registration is public and requires only name, username, password, and phone number. It always creates a `customer` account. Client-supplied `role` or `adminKey` cannot grant admin privileges. No key is required. Login and refresh remain admin-only.

To approve a trusted registered account (including the first admin), the store owner uses authenticated MongoDB access to the application database:

```javascript
db.users.updateOne({ username: "your-admin-username", role: "customer" }, { $set: { role: "admin" } })
```

Verify the account owner and username first, and check that one account was updated. That user can then log in normally. Existing admins retain access. There is no public promotion endpoint or automatic first-user promotion. Remove the unused `ADMIN_REGISTRATION_KEY` from the hosting environment after deploying this version.

Existing products default to category `Uncategorized`, stock `0`, and a low-stock limit of `5`; update their inventory in the dashboard.

Public reads: `GET /api/products`, `GET /api/products/:id`. Admin-only writes: `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`; multipart images use the field `image` (JPEG/PNG/WebP, max 5 MB). Optional product fields are `category`, `stock`, and `lowStockThreshold`. `GET /api/products/low-stock` and `GET /api/admin/me` require an admin bearer token. `GET /api/health` is the health endpoint. Existing `/api/auth/*` paths are retained.

Run `npm test` in `Backend` for the automated checks. Tests use isolated mocks and do not require a live database or Cloudinary account.

## Customer orders

Customers can select **View details → Order now**, enter their delivery address and quantity, and place a Cash on Delivery order without logging in. Name, phone number, email and notes are optional. The success receipt includes the order reference and total. Admins can view supplied contact details and orders in the **Incoming orders** table.

`POST /api/orders` creates an order and reserves stock in one MongoDB transaction. `GET /api/orders?page=1` lists up to 50 orders for authenticated admins. Transactions require MongoDB Atlas or a replica set/sharded cluster. The server initializes the unique order request-ID index at startup to avoid duplicate orders on retries. See [frontend integration](docs/frontend-integration.md#customer-order-form) for request/response fields and retry behavior. Online payment, delivery pricing, cancellation and fulfillment status changes are not implemented.

## Security and deployment

Use Node.js 22 or newer and run npm ci from Backend so the committed package-lock.json fixes dependency versions. Development uses Node's built-in watch mode (npm run dev).

JWT_SECRET and JWT_REFRESH_SECRET must be different, randomly generated secrets of at least 32 bytes. Startup rejects missing, short, placeholder, or identical secrets. Generate each separately with: node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))". Store them only in server environment settings. Existing sessions must log in again after this update because tokens now enforce access/refresh types.

Login is limited to 30 attempts per IP per 15 minutes, signup to 10 per hour, refresh to 60 per 15 minutes, and order submission to 20 per 15 minutes. Limits return JSON with HTTP 429 and Retry-After. These are per-process memory limits, reset on restart, and do not stop distributed abuse. For multiple instances use a shared limiter store or equivalent gateway protection. Public Cash on Delivery orders can still be abused to reserve stock; rate limiting reduces bulk abuse but does not verify buyers.

Behind a reverse proxy, configure TRUSTED_PROXIES with only that deployment's trusted proxy IP addresses/subnets, comma-separated. Do not trust arbitrary forwarded headers. Without this setting proxied visitors may share the proxy's rate budget. Verify client IP handling in the actual hosting environment before production rollout.

Security headers follow Express guidance: https://expressjs.com/en/advanced/best-practice-security/. Inline scripts and framing by other origins are blocked; API responses use no-store. JSON/form bodies are limited to 16 KB and multipart uploads have bounded file, field, and part counts. Use HTTPS and NODE_ENV=production in deployment. This code review and dependency audit do not replace a live infrastructure security assessment.
