# Local Store

Express / MongoDB REST API for public products, customer orders, and admin inventory management. Host the frontend separately.

## Code structure

- `Backend/index.js`: validates configuration and starts the server.
- `Backend/app.js`: connects middleware and API routes.
- `Backend/routes/`: maps URLs to validation, authentication, and controllers.
- `Backend/controllers/UserController.js`: registration, login, refresh, and logout.
- `Backend/middleware/`: JWT authentication, input validation, CORS/origin checks, readiness, rate limits, and shared error responses.
- `Backend/utils/`: JWT/cookie helpers, product/order validation, image uploads, and `asyncHandler`/`ApiError`.
- `Backend/config/`: database, HTTP security options, environment checks, and startup readiness.

Request flow: route → validation/auth middleware → controller → response. Auth controllers throw `ApiError` for expected failures; `asyncHandler` sends errors to `errorHandler`. Existing API response fields stay unchanged for the frontend. `authcontrollers.js` re-exports the canonical `UserController.js` handlers for compatibility.

## Local setup

1. In `Backend`, run `npm install`.
2. Copy `.env.example` to `.env` if needed and configure MongoDB, JWT secrets, and Cloudinary.
3. Run `npm start` from `Backend`.
4. Open `http://localhost:3000/api/health` to check the API. `/` and `/admin` return JSON 404 responses.

Public product APIs require no account. Approved admins can authenticate to create and edit products, upload images, manage categories and stock, and query low-stock products. See [frontend integration](docs/frontend-integration.md) for connecting a separate frontend.

## Deploy on Render

Deploy this repository as a Node Web Service for the API. Host the frontend separately and configure it with the backend URL. For browser requests from another origin, configure `CORS_ORIGINS` and follow the cookie requirements below.

Create a Render Blueprint using the repository's `render.yaml`, or configure an existing Web Service with:

- Root Directory: `Backend`
- Build Command: `npm ci`
- Start Command: `node index.js`
- Health Check Path: `/api/health`
- Environment: `NODE_ENV=production`, `NODE_VERSION=22`

Set `MONGO_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in Render's environment settings. Use distinct random JWT secrets of at least 32 bytes. Never put these secrets in frontend files. Let Render supply `PORT`; the server binds to `0.0.0.0` using that value.

After deployment, open `/api/health` on the assigned Render URL to check the service. Frontend pages are not served by this backend. Updating `render.yaml` does not automatically reconfigure a manually created service; apply the settings above in its dashboard.

Startup opens `0.0.0.0:$PORT` before connecting to MongoDB and initializing order indexes. All API routes, including `/api/health`, return 503 until initialization completes, and when the database disconnects. Database server selection has a 15-second timeout; overall initialization has a 60-second deadline and exits on failure. Check earlier startup logs for missing secrets, database credentials/network access, or index initialization errors. Keep Render's health check at `/api/health` so it only routes traffic to a ready instance.

## Admin access

Registration is public and requires only name, username, password, and phone number. It always creates a `customer` account. Client-supplied `role` or `adminKey` cannot grant admin privileges. No key is required. Login and refresh remain admin-only.

To approve a trusted registered account (including the first admin), the store owner uses authenticated MongoDB access to the application database:

```javascript
db.users.updateOne({ username: "your-admin-username", role: "customer" }, { $set: { role: "admin" } })
```

Verify the account owner and username first, and check that one account was updated. That user can then log in normally. Existing admins retain access. There is no public promotion endpoint or automatic first-user promotion. Remove the unused `ADMIN_REGISTRATION_KEY` from the hosting environment after deploying this version.

Existing products default to category `Uncategorized`, stock `0`, and a low-stock limit of `5`; update their inventory through `PUT /api/products/:id`.

Public reads: `GET /api/products`, `GET /api/products/:id`. Admin-only writes: `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`; multipart images use the field `image` (JPEG/PNG/WebP, max 5 MB). Optional product fields are `category`, `stock`, and `lowStockThreshold`. `GET /api/products/low-stock` and `GET /api/admin/me` require an admin access cookie (or bearer access token). `GET /api/health` is the health endpoint. Existing `/api/auth/*` paths are retained.

Run `npm test` in `Backend` for the automated checks. Tests use isolated mocks and do not require a live database or Cloudinary account.

## Customer orders

Customers can place Cash on Delivery orders through the public API without logging in. Full name (`customerName`), contact number (`phoneNumber`), delivery location/address (`address`), and quantity are required. Email and notes are optional. The success receipt includes the order reference and total. Authenticated admins can retrieve orders and supplied contact details through the admin order API.

`POST /api/orders` creates an order and reserves stock in one MongoDB transaction. `GET /api/orders?page=1` lists up to 50 orders for authenticated admins. Transactions require MongoDB Atlas or a replica set/sharded cluster. The server initializes the unique order request-ID index at startup to avoid duplicate orders on retries. See [frontend integration](docs/frontend-integration.md#customer-order-form) for request/response fields and retry behavior. Admins update status with `PATCH /api/orders/:id/status` and JSON `{ "status": "confirmed" }`. Supported statuses are `pending` (default), `confirmed`, `cancelled`, and `delivered`. Orders move from pending to confirmed or cancelled, then from confirmed to delivered or cancelled. Cancelled and delivered orders are final. Cancellation restores stock in the same transaction, once only. Online payment and delivery pricing are not implemented.

## Security and deployment

Use Node.js 22 or newer and run npm ci from Backend so the committed package-lock.json fixes dependency versions. Development uses Node's built-in watch mode (npm run dev).

ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different, randomly generated secrets of at least 32 bytes. Startup rejects missing, short, placeholder, or identical secrets. Generate each separately with: node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))". Store them only in server environment settings. Existing sessions must log in again after this update because tokens now enforce access/refresh types.

Login is limited to 30 attempts per IP per 15 minutes, signup to 10 per hour, refresh to 60 per 15 minutes, and order submission to 20 per 15 minutes. Limits return JSON with HTTP 429 and Retry-After. These are per-process memory limits, reset on restart, and do not stop distributed abuse. For multiple instances use a shared limiter store or equivalent gateway protection. Public Cash on Delivery orders can still be abused to reserve stock; rate limiting reduces bulk abuse but does not verify buyers.

Behind a reverse proxy, configure TRUSTED_PROXIES with only that deployment's trusted proxy IP addresses/subnets, comma-separated. Do not trust arbitrary forwarded headers. Without this setting proxied visitors may share the proxy's rate budget. Verify client IP handling in the actual hosting environment before production rollout.

Security headers follow Express guidance: https://expressjs.com/en/advanced/best-practice-security/. Inline scripts and framing by other origins are blocked; API responses use no-store. JSON/form bodies are limited to 16 KB and multipart uploads have bounded file, field, and part counts. Use HTTPS and NODE_ENV=production in deployment. This code review and dependency audit do not replace a live infrastructure security assessment.

## JWT cookies

Login stores access and refresh JWTs in HTTP-only cookies; frontend clients should use cookie-based sessions. Access expires after 15 minutes and refresh after 7 days by default. Automatic refresh uses the refresh cookie; logout revokes refresh access and clears both cookies. Production uses Secure cookies and requires HTTPS. Existing sessions must log in again. `CORS_ORIGINS` lists exact allowed frontend origins. Browser authentication requires a same-site deployment because cookies use `SameSite=Strict`. See [authentication integration](docs/frontend-integration.md#authentication-request-bodies).
