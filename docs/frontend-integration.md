# Frontend implementation contract

Use `http://localhost:3000` as the local API origin (or the actual backend deployment URL). Configure the origin for the frontend environment; do not assume local backend changes have already been deployed.

## Suggested frontend page routes

These are routes to implement in the frontend router, not additional backend API endpoints.

| Page route | Access | Behavior |
| --- | --- | --- |
| `/` | Public | Product cards, search, category filter, availability, details links |
| `/products/:id` | Public | Image, title, description, category, NPR price, stock availability |
| `/admin/login` | Public | Admin login form; successful login redirects to `/admin` |
| `/admin/register` | Public signup | Name, username, password, phone number; owner approval required for admin access |
| `/admin` | Admin | Product count, total units, low/out-of-stock count, category count |
| `/admin/products` | Admin | Inventory table, category/search/stock filters, edit actions |
| `/admin/products/new` | Admin | Create product with image upload |
| `/admin/products/:id/edit` | Admin | Edit product, category, stock and low-stock limit; image optional |
| `/admin/low-stock` | Admin | Products whose stock is at or below their low-stock limit |

Customers do not need login or registration. Do not put an auth guard around the customer routes. Validate admin sessions through `GET /api/admin/me`; the presence of a stored token alone is not authorization. The backend checks admin permissions on every protected request.

The bundled backend UI currently serves `/`, `/admin`, `/admin/login`, and `/admin/register`; its product details and editor use dialogs. The additional page paths above are for a separate frontend implementation. Configure that frontend host to serve its app on direct navigation to client routes.

## API routes

All paths below are relative to the API origin.

| Method | Path | Access | Success response |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | `201 { success, message, user }` |
| POST | `/api/auth/login` | Admin credentials | `{ success, message, user }` |
| POST | `/api/auth/refresh-token` | Refresh token | `{ success, message }` |
| POST | `/api/auth/logout` | Admin access cookie | `{ success, message }` |
| GET | `/api/admin/me` | Admin access cookie | `{ success, user: { id, username } }` |
| GET | `/api/products` | Public | `{ success, count, products }` |
| GET | `/api/products?category=Home` | Public | `{ success, count, products }` |
| GET | `/api/products/:id` | Public | `{ success, product }` |
| GET | `/api/products/low-stock` | Admin access cookie | `{ success, count, products }` |
| POST | `/api/products` | Admin access cookie | `201 { success, message, product }` |
| PUT | `/api/products/:id` | Admin access cookie | `{ success, message, product }` |
| DELETE | `/api/products/:id` | Admin access cookie | `{ success, message }` |

Browser calls use `credentials: "include"`. Login sets HTTP-only `accessToken` and `refreshToken` cookies; tokens are never returned in JSON or stored in browser storage. Bearer access headers remain supported for existing API clients.

## Authentication request bodies

Send these requests as JSON with `Content-Type: application/json`.

Registration:

```json
{
  "name": "Store Owner",
  "username": "owner",
  "password": "a-strong-password",
  "phoneNumber": "9800000000"
}
```

The password must be at least 6 characters and at most 72 UTF-8 bytes. Registration creates a non-admin (`customer`) account and returns no tokens. Remove the registration-key field and do not send or embed a key. Client-supplied `role` and `adminKey` cannot grant privileges. Registration works whether or not the old `ADMIN_REGISTRATION_KEY` environment variable is set.

After success, display the server response `message`: the store owner must approve admin access before dashboard login. The owner promotes a trusted account through MongoDB as documented in the root README. Unapproved accounts receive `403` on login and cannot refresh into an admin session. Existing approved admins continue to log in normally.

Login:

```json
{ "username": "owner", "password": "a-strong-password" }
```

Login returns `user: { id, name, username, phoneNumber }`. Registration also includes `createdAt`. Neither response includes a `role` property; use `/api/admin/me` to check access instead of expecting `user.role`.

Refresh and logout use POST with no request body and `credentials: "include"`. The server reads the refresh cookie automatically. `/api/auth/refresh` is an alias for `/api/auth/refresh-token`.

Access tokens expire after 15 minutes; refresh tokens expire after 7 days (configurable through the token expiry environment variables). Cookie lifetimes follow JWT expiry. On `401`, refresh once and retry the original request once. If refresh fails, return to login. Treat `403` as access denied. Logout revokes the stored refresh token and clears both cookies, even after access expiry. A copied access token remains valid until expiry.

Cookies use `HttpOnly`, `SameSite=Strict`, and `Secure` in production. Serve production over HTTPS. The bundled UI works on the same origin automatically. For a separate same-site frontend (for example localhost on another port), add its exact origin to `CORS_ORIGINS` and use `credentials: "include"` on every authentication/API request. Untrusted origins cannot make state-changing requests. Cross-site frontend hosting is not supported by this Strict-cookie configuration. Existing browser-storage sessions must log in again.

## Product fields

| Field | Type | Create | Edit | Rules |
| --- | --- | --- | --- | --- |
| `title` | string | Required | Optional | Nonblank |
| `description` | string | Required | Optional | Nonblank |
| `price` | number | Required | Optional | Finite, >= 0; zero is allowed |
| `category` | string | Optional | Optional | Nonblank if supplied; default `Uncategorized` |
| `stock` | integer | Optional | Optional | >= 0; default `0` |
| `lowStockThreshold` | integer | Optional | Optional | >= 0; default `5` |
| `image` | File | Required | Optional | JPEG, PNG, WebP; maximum 5 MB |

Use `multipart/form-data` for uploads. Do not manually set its `Content-Type`: the browser sets the boundary. A text-only update can also use JSON. Omitted fields are retained on edit. Omit `image` to keep the current image.

```js
const form = new FormData();
form.set("title", values.title);
form.set("description", values.description);
form.set("price", String(values.price));
form.set("category", values.category);
form.set("stock", String(values.stock));
form.set("lowStockThreshold", String(values.lowStockThreshold));
if (selectedFile) form.set("image", selectedFile);

const response = await fetch(
  `${API_BASE}/api/products${editingId ? `/${encodeURIComponent(editingId)}` : ""}`,
  {
    method: editingId ? "PUT" : "POST",
    credentials: "include",
    body: form,
  },
);
const data = await response.json();
if (!response.ok) throw new Error(data.message || "Unable to save product");
// data.product is the saved product. Refresh the inventory and summary cards.
```

Product responses contain `_id` (not `id`), `title`, `description`, `price`, `category`, `stock`, `lowStockThreshold`, `image: { url, public_id }`, `createdAt`, and `updatedAt`. Display the uploaded image using `product.image.url`.

## Categories, search and stock

There is no separate category CRUD endpoint or category model. Categories are strings stored on products. Build category options from unique categories in `GET /api/products`. The admin category input should accept a new name and suggest existing names. Changing a product's category uses `PUT /api/products/:id`; it does not rename that category on other products.

The category API filter is an exact match. Encode query values with `URLSearchParams`. Search by title/description is currently client-side; the backend does not implement a `search` query or pagination.

```js
const quantity = product.stock ?? 0;
const limit = product.lowStockThreshold ?? 5;
const availability = quantity === 0
  ? "Out of stock"
  : quantity <= limit ? "Low stock" : "In stock";
```

Low-stock results include out-of-stock products and products exactly at their limit. For old products use category `Uncategorized`, stock `0`, and limit `5` as fallbacks. Dashboard counts can be derived from the full product list. No separate stock adjustment endpoint exists: edit the absolute quantity through the product update route.

## UI and error handling

- Show loading, empty and error states; keep form values after a failed save.
- Disable submit during upload/save to prevent duplicate requests.
- Show `message` from non-success JSON responses (`{ success: false, message }`).
- Handle `400` for invalid input/upload/ID, `401` for invalid sessions, `403` for denied admin access, `404` for missing products, and `500` for server failures. Invalid login credentials currently return `400`.
- Render product text through normal framework text bindings, not raw HTML.
- Validate file type/size and stock inputs before submitting, while retaining backend validation.
- Single-product orders are supported as described below. Cart, online payment, cancellation and fulfillment status updates are not implemented.

## Customer order form

The bundled customer page includes **View details → Order now**. For a separate frontend, implement the form in a dialog or a `/products/:id/order` page. No customer login is required.

`POST /api/orders` is public and accepts JSON:

```json
{
  "productId": "507f1f77bcf86cd799439011",
  "quantity": 2,
  "customerName": "Customer Name",
  "phoneNumber": "9800000000",
  "email": "customer@example.com",
  "address": "Street, ward, city, delivery landmark",
  "notes": "Call on arrival",
  "requestId": "ac739f61-65bd-40db-b391-7c5b50579198"
}
```

Generate `requestId` using `crypto.randomUUID()` once for each new order. Reuse the same ID and unchanged request body when retrying a failed or interrupted submission. Do not generate a new ID on every retry. The backend deduplicates by this ID; reusing it with different order details returns `409`. Production frontend pages should be served over HTTPS for `crypto.randomUUID()` (localhost also works).

Required fields: `productId`, integer `quantity` (1–10000), `address` (max 500 characters), and UUID v4 `requestId`. `customerName` (max 100 characters), `phoneNumber` (max 25 characters), `email` (max 254 characters), and `notes` (max 1000 characters) are optional and may be omitted or blank. If supplied, the phone must have 7–15 digits (spaces, +, parentheses and hyphens allowed), and email must be a valid email address. The admin order list includes the optional contact details; public receipts do not expose them.

Prices are read from the product on the server. Client-supplied price, total, payment or status fields are not used. Payment is Cash on Delivery and initial status is `pending`. Stock is deducted when the order is accepted. Order creation and stock reservation run in one MongoDB transaction, so a failed save rolls back the reservation; the stock condition prevents overselling.

Success (`201`, or `200` for a repeat submission) returns:

```json
{
  "success": true,
  "message": "Order placed successfully. Pay on delivery.",
  "order": {
    "id": "order-mongodb-id",
    "productTitle": "Ceramic Cup",
    "quantity": 2,
    "unitPrice": 150,
    "total": 300,
    "status": "pending",
    "paymentMethod": "cash_on_delivery"
  }
}
```

Show the reference and product total after success, clear/hide the form, and refresh product availability. Disable repeat submission while saving. A `409` also indicates insufficient stock or an unavailable/deleted product; show the response message and refresh availability. On a network/`500` error retry the unchanged request with the same request ID. No online payment or automatic customer notification is sent.

Admins can read orders via `GET /api/orders?page=1` with a bearer token. Response: `{ success, orders, page, hasMore }`, with up to 50 orders per page, newest first. Orders contain `_id`, customer contact/address/notes, product snapshot, quantity, unit price, total, payment method, status and timestamps. Customer data is not publicly readable. The bundled admin dashboard has an Incoming orders table with refresh and pagination.

MongoDB must support transactions (Atlas, a replica set, or a sharded cluster). A standalone MongoDB server is insufficient. Startup initializes the Order model and its unique request-ID index before accepting requests. No additional environment variables are needed for orders.

## Security update

Handle HTTP 429 by showing the server message and waiting for Retry-After before retrying. Oversized JSON/form requests return 413 (16 KB limit). Existing sessions need login again after the token-type update. Limits and deployment proxy configuration are documented in the root README.
