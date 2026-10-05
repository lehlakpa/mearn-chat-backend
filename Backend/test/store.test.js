import { test, before, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { Writable } from "node:stream";
import bcrypt from "bcrypt";
import app from "../app.js";
import User from "../models/user.model.js";
import Product from "../models/Products.js";
import cloudinary from "../config/cloudinary.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import { productFields } from "../controllers/product.controller.js";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import { orderFields } from "../controllers/order.controller.js";

let server, base;
const id = "507f1f77bcf86cd799439011";
const admin = { _id: id, username: "owner", role: "admin" };
before(async () => {
    process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
    process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
    process.env.ADMIN_REGISTRATION_KEY = "test-private-registration-key";
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
afterEach(() => mock.restoreAll());
const request = (path, method = "GET", body, token) => fetch(base + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
});
test("customer and admin pages are served without exposing private keys", async () => {
    for (const path of ["/", "/admin", "/admin/login", "/admin/register"]) {
        const response = await request(path);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /<!doctype html>/);
        assert.ok(!html.includes(process.env.ADMIN_REGISTRATION_KEY));
    }
});
test("public product listing and details require no account", async () => {
    mock.method(Product, "find", filter => ({ sort: async () => [{ _id: id, title: "Cup", category: filter.category, stock: 4 }] }));
    const response = await request("/api/products?category=Home");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).products[0].category, "Home");
    mock.method(Product, "findById", async () => ({ _id: id, title: "Cup" }));
    assert.equal((await request(`/api/products/${id}`)).status, 200);
});
test("anonymous users and customers cannot manage inventory or view low stock", async () => {
    for (const [method, path] of [["POST", "/api/products"], ["PUT", `/api/products/${id}`], ["DELETE", `/api/products/${id}`], ["GET", "/api/products/low-stock"]]) {
        assert.equal((await request(path, method)).status, 401);
    }
    mock.method(User, "findById", async () => ({ ...admin, role: "customer" }));
    const token = generateAccessToken(admin);
    assert.equal((await request("/api/products", "POST", {}, token)).status, 403);
    assert.equal((await request("/api/admin/me", "GET", null, token)).status, 403);
});
test("registration validates required fields without a key", async () => {
    assert.equal((await request("/api/auth/register", "POST", { role: "admin" })).status, 400);
    assert.equal((await request("/api/auth/register", "POST", { adminKey: "wrong" })).status, 400);
});
test("public registration ignores client admin privileges and hashes the password", async () => {
    mock.method(User, "findOne", async () => null);
    let saved;
    mock.method(User.prototype, "save", async function () { saved = this; return this; });
    const response = await request("/api/auth/register", "POST", { name: "Owner", username: "Owner", phoneNumber: "9800000000", password: "strong-secret", adminKey: process.env.ADMIN_REGISTRATION_KEY, role: "admin" });
    assert.equal(response.status, 201);
    assert.equal(saved.role, "customer");
    assert.ok(await bcrypt.compare("strong-secret", saved.password));
    assert.equal((await response.json()).user.password, undefined);
});
test("registration works without a supplied key or server key", async () => {
    const legacyKey = process.env.ADMIN_REGISTRATION_KEY;
    delete process.env.ADMIN_REGISTRATION_KEY;
    mock.method(User, "findOne", async () => null);
    mock.method(User.prototype, "save", async function () {
        assert.equal(this.role, "customer");
        assert.equal(this.username, "owner");
        return this;
    });
    try {
        const response = await request("/api/auth/register", "POST", { name: "Owner", username: " Owner ", phoneNumber: "9800000000", password: "strong-secret" });
        assert.equal(response.status, 201);
        const data = await response.json();
        assert.match(data.message, /approve admin access/);
        assert.equal(data.accessToken, undefined);
        assert.equal(data.refreshToken, undefined);
    } finally { process.env.ADMIN_REGISTRATION_KEY = legacyKey; }
});

test("approved admins can login and refresh", async () => {
    const user = { ...admin, password: await bcrypt.hash("secret123", 4), save: async () => {} };
    mock.method(User, "findOne", () => ({ select: async () => user }));
    const response = await request("/api/auth/login", "POST", { username: "owner", password: "secret123" });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.accessToken, undefined);
    assert.equal(data.refreshToken, undefined);
    const cookie = response.headers.getSetCookie().find(value => value.startsWith("refreshToken=")).split(";")[0];
    assert.equal(user.refreshToken, cookie.slice("refreshToken=".length));
    mock.method(User, "findById", () => ({ select: async () => user }));
    assert.equal((await fetch(base + "/api/auth/refresh-token", { method: "POST", headers: { Cookie: cookie } })).status, 200);
});

test("customer accounts cannot login or refresh into an admin session", async () => {
    const password = await bcrypt.hash("secret123", 4);
    mock.method(User, "findOne", () => ({ select: async () => ({ ...admin, role: "customer", password }) }));
    assert.equal((await request("/api/auth/login", "POST", { username: "owner", password: "secret123" })).status, 403);
    const refreshToken = generateRefreshToken(admin);
    mock.method(User, "findById", () => ({ select: async () => ({ ...admin, role: "customer", refreshToken }) }));
    assert.equal((await fetch(base + "/api/auth/refresh-token", { method: "POST", headers: { Cookie: `refreshToken=${refreshToken}` } })).status, 401);
});
test("inventory validation rejects negative, fractional and nonnumeric stock; permits zero price", () => {
    for (const stock of [-1, 1.5, "bad", "", null, true]) assert.throws(() => productFields({ stock }, true));
    assert.throws(() => productFields({ lowStockThreshold: -1 }, true));
    assert.throws(() => productFields({ price: "Infinity" }, true));
    assert.deepEqual(productFields({ price: "0", stock: "0", lowStockThreshold: "0", category: " Home " }, true), { price: 0, stock: 0, lowStockThreshold: 0, category: "Home" });
});
test("admin can set stock and price to zero and change category without replacing image", async () => {
    mock.method(User, "findById", async () => admin);
    const product = { image: { public_id: "old-image" }, save: async () => {} };
    mock.method(Product, "findById", async () => product);
    const response = await request(`/api/products/${id}`, "PUT", { stock: 0, price: 0, category: "Home", lowStockThreshold: 2 }, generateAccessToken(admin));
    assert.equal(response.status, 200);
    const result = (await response.json()).product;
    assert.equal(result.stock, 0);
    assert.equal(result.price, 0);
    assert.equal(result.category, "Home");
    assert.equal(result.image.public_id, "old-image");
});
test("low-stock route uses per-product thresholds with legacy defaults", async () => {
    mock.method(User, "findById", async () => admin);
    let filter;
    mock.method(Product, "find", query => { filter = query; return { sort: async () => [] }; });
    assert.equal((await request("/api/products/low-stock", "GET", null, generateAccessToken(admin))).status, 200);
    assert.deepEqual(filter, { $expr: { $lte: [{ $ifNull: ["$stock", 0] }, { $ifNull: ["$lowStockThreshold", 5] }] } });
});
test("admin image upload creates a product and invalid file types return JSON errors", async () => {
    mock.method(User, "findById", async () => admin);
    mock.method(cloudinary.uploader, "upload_stream", (options, callback) => new Writable({ write(chunk, encoding, done) { done(); }, final(done) { callback(null, { public_id: "new-image", secure_url: "https://example.com/image.png" }); done(); } }));
    mock.method(Product, "create", async data => ({ ...data, _id: id }));
    const form = new FormData();
    for (const [key, value] of Object.entries({ title: "Cup", description: "Ceramic cup", price: "50", category: "Home", stock: "3" })) form.set(key, value);
    form.set("image", new Blob(["image-bytes"], { type: "image/png" }), "cup.png");
    const options = { method: "POST", headers: { Authorization: `Bearer ${generateAccessToken(admin)}` }, body: form };
    const response = await fetch(base + "/api/products", options);
    assert.equal(response.status, 201);
    assert.equal((await response.json()).product.stock, 3);
    form.set("image", new Blob(["text"], { type: "text/plain" }), "bad.txt");
    const invalid = await fetch(base + "/api/products", options);
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).message, /Only JPEG/);
});

const orderBody = (overrides = {}) => ({ productId: id, quantity: 2, customerName: "Customer", phoneNumber: "9800000000", address: "Kathmandu, Nepal", notes: "Call on arrival", requestId: "ac739f61-65bd-40db-b391-7c5b50579198", ...overrides });
function mockOrderStore() {
    const session = { testSession: true };
    mock.method(mongoose.connection, "transaction", async callback => callback(session));
    mock.method(Order, "findOne", () => ({ select: async () => null }));
    return session;
}
test("order validation rejects missing address, invalid contact values, IDs and quantities", async () => {
    for (const overrides of [{ quantity: 0 }, { quantity: -1 }, { quantity: 1.5 }, { quantity: "2" }, { quantity: 10001 }, { productId: "bad" }, { customerName: {} }, { email: "not-an-email" }, { email: "x".repeat(255) }, { address: " " }, { phoneNumber: "letters-only" }, { requestId: "not-a-uuid" }]) {
        assert.throws(() => orderFields(orderBody(overrides)));
    }
    assert.equal((await request("/api/orders", "POST", orderBody({ quantity: 0 }))).status, 400);
});
test("orders accept omitted or blank contact details and persist an optional email", async () => {
    mockOrderStore();
    mock.method(Product, "findOneAndUpdate", async () => ({ _id: id, title: "Cup", price: 150 }));
    let saved;
    mock.method(Order, "create", async orders => {
        const order = new Order(orders[0]);
        await order.validate();
        saved = order;
        return [order];
    });
    for (const overrides of [
        { customerName: undefined, phoneNumber: undefined, email: undefined },
        { customerName: " ", phoneNumber: " ", email: " " },
        { customerName: undefined, phoneNumber: undefined, email: " customer@example.com " },
    ]) {
        const response = await request("/api/orders", "POST", orderBody(overrides));
        assert.equal(response.status, 201);
        assert.equal(saved.customerName, "");
        assert.equal(saved.phoneNumber, "");
        assert.equal(saved.email, overrides.email?.trim() || "");
        assert.equal((await response.json()).order.email, undefined);
    }
});
test("customer order reserves stock and calculates price on the server in one transaction", async () => {
    const session = mockOrderStore();
    let reservation, saved;
    mock.method(Product, "findOneAndUpdate", async (query, update, options) => {
        reservation = { query, update, options };
        return { _id: id, title: "Cup", price: 150, stock: 3 };
    });
    mock.method(Order, "create", async (orders, options) => {
        assert.equal(options.session, session);
        saved = { ...orders[0], _id: id, status: "pending", paymentMethod: "cash_on_delivery" };
        return [saved];
    });
    const response = await request("/api/orders", "POST", orderBody({ price: 1, total: 1, status: "paid" }));
    assert.equal(response.status, 201);
    assert.deepEqual(reservation.query, { _id: id, stock: { $gte: 2 } });
    assert.deepEqual(reservation.update, { $inc: { stock: -2 } });
    assert.equal(reservation.options.session, session);
    const receipt = (await response.json()).order;
    assert.equal(receipt.total, 300);
    assert.equal(receipt.unitPrice, 150);
    assert.equal(receipt.phoneNumber, undefined);
    assert.equal(receipt.address, undefined);
    assert.equal(saved.customerName, "Customer");
    assert.equal(saved.phoneNumber, "9800000000");
});
test("unavailable stock rejects the order without inserting an order", async () => {
    mockOrderStore();
    mock.method(Product, "findOneAndUpdate", async () => null);
    const create = mock.method(Order, "create", async () => assert.fail("Must not create an order without stock"));
    const response = await request("/api/orders", "POST", orderBody());
    assert.equal(response.status, 409);
    assert.equal(create.mock.callCount(), 0);
});
test("retrying an order returns the same receipt without reserving stock twice", async () => {
    mockOrderStore();
    let saved, reservations = 0;
    mock.method(Order, "findOne", () => ({ select: async () => saved }));
    mock.method(Product, "findOneAndUpdate", async () => { reservations++; return { _id: id, title: "Cup", price: 150 }; });
    mock.method(Order, "create", async orders => { saved = { ...orders[0], _id: id }; return [saved]; });
    assert.equal((await request("/api/orders", "POST", orderBody())).status, 201);
    assert.equal((await request("/api/orders", "POST", orderBody())).status, 200);
    assert.equal(reservations, 1);
    assert.equal((await request("/api/orders", "POST", orderBody({ quantity: 3 }))).status, 409);
    assert.equal(reservations, 1);
});
test("order persistence failures propagate out of the transaction for rollback", async () => {
    mockOrderStore();
    let stock = 5;
    mock.method(mongoose.connection, "transaction", async callback => {
        const initial = stock;
        try { return await callback({}); }
        catch (error) { stock = initial; throw error; }
    });
    mock.method(Product, "findOneAndUpdate", async () => { stock -= 2; return { _id: id, title: "Cup", price: 150 }; });
    mock.method(Order, "create", async () => { throw new Error("Simulated order write failure"); });
    const response = await request("/api/orders", "POST", orderBody());
    assert.equal(response.status, 500);
    assert.equal(stock, 5);
});
test("only admins can read customer orders, with bounded pagination", async () => {
    assert.equal((await request("/api/orders")).status, 401);
    mock.method(User, "findById", async () => ({ ...admin, role: "customer" }));
    const token = generateAccessToken(admin);
    assert.equal((await request("/api/orders", "GET", null, token)).status, 403);
    mock.method(User, "findById", async () => admin);
    let skip, limit;
    const query = { select() { return this; }, sort() { return this; }, skip(value) { skip = value; return this; }, async limit(value) { limit = value; return Array.from({ length: 51 }, () => ({ customerName: "Customer" })); } };
    mock.method(Order, "find", () => query);
    const response = await request("/api/orders?page=2", "GET", null, token);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.orders.length, 50);
    assert.equal(data.hasMore, true);
    assert.equal(skip, 50);
    assert.equal(limit, 51);
    assert.equal((await request("/api/orders?page=-1", "GET", null, token)).status, 400);
});
