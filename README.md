# Local Store

Express / MongoDB store with a public product catalog and an admin inventory dashboard.

## Run

1. In `Backend`, run `npm install`.
2. Copy `.env.example` to `.env` if needed and configure MongoDB, JWT secrets, Cloudinary, and a private random `ADMIN_REGISTRATION_KEY`.
3. Run `npm start` from `Backend`.
4. Open `http://localhost:3000/` for customers or `/admin` for administration.

Customers can browse/search products, filter categories and view product details without an account. Admins can register with the private registration key, log in, add products with images, edit products/categories, update stock and set a per-product low-stock limit. The category field accepts a new category or an existing suggestion. A stock quantity at or below the limit appears in the low-stock filter, including out-of-stock products.

## Admin access

Registration creates only admin accounts and requires `adminKey` matching the server environment variable `ADMIN_REGISTRATION_KEY`. Registration is disabled if that variable is unset. Keep the key private; it must never be embedded in frontend assets. Configure it in the hosting environment when deploying.

Existing users are **not automatically promoted**. A store owner can explicitly promote a trusted existing account in MongoDB, for example `db.users.updateOne({ username: "your-admin-username" }, { $set: { role: "admin" } })`, or register a new admin username with the key. Existing products default to category `Uncategorized`, stock `0`, and a low-stock limit of `5`; update their inventory in the dashboard.

Public reads: `GET /api/products`, `GET /api/products/:id`. Admin-only writes: `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`; multipart images use the field `image` (JPEG/PNG/WebP, max 5 MB). Optional product fields are `category`, `stock`, and `lowStockThreshold`. `GET /api/products/low-stock` and `GET /api/admin/me` require an admin bearer token. `GET /api/health` is the health endpoint. Existing `/api/auth/*` paths are retained.

Run `npm test` in `Backend` for the automated checks. Tests use isolated mocks and do not require a live database or Cloudinary account.

## Customer orders

Customers can select **View details → Order now**, enter their delivery address and quantity, and place a Cash on Delivery order without logging in. Name, phone number, email and notes are optional. The success receipt includes the order reference and total. Admins can view supplied contact details and orders in the **Incoming orders** table.

`POST /api/orders` creates an order and reserves stock in one MongoDB transaction. `GET /api/orders?page=1` lists up to 50 orders for authenticated admins. Transactions require MongoDB Atlas or a replica set/sharded cluster. The server initializes the unique order request-ID index at startup to avoid duplicate orders on retries. See [frontend integration](docs/frontend-integration.md#customer-order-form) for request/response fields and retry behavior. Online payment, delivery pricing, cancellation and fulfillment status changes are not implemented.
