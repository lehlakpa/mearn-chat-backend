import { test, before, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import app from "../app.js";
import User from "../models/user.model.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";

const admin = { _id: "507f1f77bcf86cd799439011", username: "owner", role: "admin" };
let server, base;
before(async () => {
    process.env.ACCESS_TOKEN_SECRET = randomBytes(32).toString("hex");
    process.env.REFRESH_TOKEN_SECRET = randomBytes(32).toString("hex");
    delete process.env.ACCESS_TOKEN_EXPIRES_IN;
    delete process.env.REFRESH_TOKEN_EXPIRES_IN;
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
afterEach(() => mock.restoreAll());

const request = (path, { body, authorization, cookie, origin } = {}) => fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(authorization === undefined ? {} : { Authorization: authorization }),
        ...(cookie === undefined ? {} : { Cookie: cookie }),
        ...(origin === undefined ? {} : { Origin: origin }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const refresh = token => request("/api/auth/refresh", { body: {}, cookie: token === undefined ? undefined : `refreshToken=${encodeURIComponent(token)}` });
const cookies = response => Object.fromEntries(response.headers.getSetCookie().map(value => value.split(";")[0].split("=")));
const protectedRequest = token => request("/api/admin/me", { authorization: `Bearer ${token}` });
const signed = (type, payload = {}, options = {}) => jwt.sign(
    { id: admin._id, tokenType: type, ...payload },
    type === "access" ? process.env.ACCESS_TOKEN_SECRET : process.env.REFRESH_TOKEN_SECRET,
    { algorithm: "HS256", expiresIn: "5m", ...options },
);

test("login, expired access, refresh, protected request and logout preserve the stored-token lifecycle", async () => {
    const user = { ...admin, password: await bcrypt.hash("secret123", 4), save: async () => {} };
    mock.method(User, "findOne", () => ({ select: async () => user }));
    mock.method(User, "findById", id => {
        assert.equal(id, admin._id);
        return { then: resolve => resolve(user), select: async () => user };
    });
    mock.method(User, "updateOne", async (filter, update) => {
        assert.equal(filter._id, admin._id);
        assert.equal(filter.refreshToken, user.refreshToken);
        user.refreshToken = update.$set.refreshToken;
    });
    const login = await request("/api/auth/login", { body: { username: "owner", password: "secret123" } });
    assert.equal(login.status, 200);
    const tokens = cookies(login);
    const data = await login.json();
    assert.equal(data.accessToken, undefined);
    assert.equal(data.refreshToken, undefined);
    for (const cookie of login.headers.getSetCookie()) {
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Strict/);
        assert.match(cookie, /Max-Age=/);
    }
    assert.ok(tokens.accessToken);
    assert.ok(tokens.refreshToken);
    assert.equal(user.refreshToken, tokens.refreshToken);
    assert.equal(data.user.password, undefined);
    assert.equal((await request("/api/admin/me", { cookie: `accessToken=${tokens.accessToken}` })).status, 200);
    const expired = await protectedRequest(signed("access", {}, { expiresIn: -1 }));
    assert.equal(expired.status, 401);
    assert.equal((await expired.json()).message, "Access token expired");
    const refreshed = await refresh(tokens.refreshToken);
    assert.equal(refreshed.status, 200);
    const newTokens = cookies(refreshed);
    assert.equal((await refreshed.json()).accessToken, undefined);
    assert.ok(newTokens.accessToken);
    assert.equal((await protectedRequest(newTokens.accessToken)).status, 200);
    assert.equal((await request("/api/auth/refresh-token", { body: {}, cookie: `refreshToken=${tokens.refreshToken}` })).status, 200);
    const logout = await request("/api/auth/logout", { body: {}, cookie: `refreshToken=${tokens.refreshToken}` });
    assert.equal(logout.status, 200);
    assert.equal(logout.headers.getSetCookie().length, 2);
    for (const cookie of logout.headers.getSetCookie()) assert.match(cookie, /Expires=Thu, 01 Jan 1970/);
    assert.equal(user.refreshToken, null);
    assert.equal((await refresh(tokens.refreshToken)).status, 401);
});

test("refresh rejects missing, malformed, expired, not-yet-valid and wrong-secret tokens", async () => {
    const lookup = mock.method(User, "findById", () => assert.fail("Invalid JWT must not reach the database"));
    for (const token of [undefined, null, "", 42, {}, "invalid", generateAccessToken(admin),
        signed("refresh", {}, { expiresIn: -1 }), signed("refresh", {}, { notBefore: "1h" }),
        jwt.sign({ id: admin._id, tokenType: "refresh" }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "7d" }),
        signed("refresh", { id: "not-a-mongo-id" }),
        jwt.sign({ id: admin._id, tokenType: "refresh" }, process.env.REFRESH_TOKEN_SECRET),
    ]) {
        assert.equal((await refresh(token)).status, 401);
    }
    const expired = await refresh(signed("refresh", {}, { expiresIn: -1 }));
    assert.equal((await expired.json()).message, "Refresh token expired");
    assert.equal(lookup.mock.callCount(), 0);
    const empty = await fetch(base + "/api/auth/refresh", { method: "POST" });
    assert.equal(empty.status, 401);
});

test("refresh checks account existence, current admin access and saved token", async () => {
    const token = generateRefreshToken(admin);
    for (const user of [null, { ...admin, role: "customer", refreshToken: token }, { ...admin, refreshToken: null }, { ...admin, refreshToken: "revoked" }]) {
        mock.method(User, "findById", () => ({ select: async () => user }));
        assert.equal((await refresh(token)).status, 401);
    }
});

test("database failures are generic 500 responses, not authentication failures", async () => {
    mock.method(User, "findById", () => {
        throw new Error("private database details");
    });
    for (const response of [await refresh(generateRefreshToken(admin)), await protectedRequest(generateAccessToken(admin))]) {
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { success: false, message: "Internal server error" });
    }
});

test("middleware accepts bearer scheme casing and rejects malformed headers and refresh tokens", async () => {
    mock.method(User, "findById", async () => admin);
    const access = generateAccessToken(admin);
    assert.equal((await request("/api/admin/me", { authorization: `bearer ${access}` })).status, 200);
    for (const authorization of [undefined, "Bearer", "Basic abc", `Bearer ${access} extra`, "Bearer invalid", `Bearer ${generateRefreshToken(admin)}`]) {
        assert.equal((await request("/api/admin/me", { authorization })).status, 401);
    }
    for (const token of [signed("access", { id: "bad" }), signed("access", {}, { notBefore: "1h" }),
        jwt.sign({ id: admin._id, tokenType: "access" }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "15m" })]) {
        assert.equal((await protectedRequest(token)).status, 401);
    }
});

test("tokens have minimal consistent payloads, separate secrets and configurable expiry", () => {
    const access = jwt.verify(generateAccessToken(admin), process.env.ACCESS_TOKEN_SECRET);
    const refreshToken = generateRefreshToken(admin);
    const refreshPayload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    assert.equal(access.exp - access.iat, 15 * 60);
    assert.equal(refreshPayload.exp - refreshPayload.iat, 7 * 24 * 60 * 60);
    assert.deepEqual(Object.keys(access).sort(), ["exp", "iat", "id", "tokenType", "username"]);
    assert.deepEqual(Object.keys(refreshPayload).sort(), ["exp", "iat", "id", "jti", "tokenType"]);
    // A new login must replace the previous session even within the same second.
    assert.notEqual(generateRefreshToken(admin), refreshToken);
    process.env.ACCESS_TOKEN_EXPIRES_IN = "30s";
    process.env.REFRESH_TOKEN_EXPIRES_IN = "1h";
    try {
        const shortAccess = jwt.decode(generateAccessToken(admin));
        const shortRefresh = jwt.decode(generateRefreshToken(admin));
        assert.equal(shortAccess.exp - shortAccess.iat, 30);
        assert.equal(shortRefresh.exp - shortRefresh.iat, 3600);
    } finally {
        delete process.env.ACCESS_TOKEN_EXPIRES_IN;
        delete process.env.REFRESH_TOKEN_EXPIRES_IN;
    }
});

test("refresh requires a cookie and cross-origin mutations are rejected", async () => {
    const token = generateRefreshToken(admin);
    assert.equal((await request("/api/auth/refresh", { body: { refreshToken: token } })).status, 401);
    for (const path of ["/api/auth/login", "/api/auth/refresh", "/api/auth/logout", "/api/products"]) {
        assert.equal((await request(path, { body: {}, origin: "https://untrusted.example" })).status, 403);
    }
    assert.equal((await request("/api/auth/logout", { body: {}, origin: base })).status, 200);
    assert.equal((await request("/api/admin/me", { cookie: "accessToken=%E0%A4%A" })).status, 401);
});

test("production cookies are secure and their lifetimes match configured JWT expiry", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.ACCESS_TOKEN_EXPIRES_IN = "30s";
    process.env.REFRESH_TOKEN_EXPIRES_IN = "1h";
    try {
        const user = { ...admin, password: await bcrypt.hash("secret123", 4), save: async () => {} };
        mock.method(User, "findOne", () => ({ select: async () => user }));
        const response = await request("/api/auth/login", { body: { username: "owner", password: "secret123" } });
        assert.equal(response.status, 200);
        const [access, refreshCookie] = response.headers.getSetCookie();
        assert.match(access, /Path=\/api;/);
        assert.match(refreshCookie, /Path=\/api\/auth;/);
        for (const [cookie, seconds] of [[access, 30], [refreshCookie, 3600]]) {
            assert.match(cookie, /; Secure;/);
            const maxAge = Number(/Max-Age=(\d+)/.exec(cookie)[1]);
            assert.ok(maxAge > seconds - 3 && maxAge <= seconds);
        }
    } finally {
        if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
        delete process.env.ACCESS_TOKEN_EXPIRES_IN;
        delete process.env.REFRESH_TOKEN_EXPIRES_IN;
    }
});
