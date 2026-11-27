import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import app from "../app.js";
import { validateSecrets } from "../config/security.js";
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from "../utils/token.js";

let server, base;
before(async () => {
    process.env.ACCESS_TOKEN_SECRET = "test-secret";
    process.env.REFRESH_TOKEN_SECRET = "test-secret";
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test("access and refresh tokens cannot be interchanged even with equal secrets", () => {
    const user = { _id: "507f1f77bcf86cd799439011", username: "owner" };
    const access = generateAccessToken(user), refresh = generateRefreshToken(user);
    assert.equal(verifyAccessToken(access).id, user._id);
    assert.equal(verifyRefreshToken(refresh).id, user._id);
    assert.throws(() => verifyAccessToken(refresh));
    assert.throws(() => verifyRefreshToken(access));
});

test("startup rejects absent, short, or shared JWT secrets", () => {
    assert.throws(() => validateSecrets({}));
    assert.throws(() => validateSecrets({ ACCESS_TOKEN_SECRET: "short", REFRESH_TOKEN_SECRET: "b".repeat(32) }));
    assert.throws(() => validateSecrets({ ACCESS_TOKEN_SECRET: "a".repeat(32), REFRESH_TOKEN_SECRET: "a".repeat(32) }));
    assert.doesNotThrow(() => validateSecrets({ ACCESS_TOKEN_SECRET: "a".repeat(32), REFRESH_TOKEN_SECRET: "b".repeat(32) }));
});

test("responses prevent framing, MIME sniffing, inline scripts and API caching", async () => {
    const response = await fetch(base + "/api/health");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("content-security-policy"), /script-src 'self'/);
});

test("oversized request bodies return a bounded JSON error", async () => {
    const response = await fetch(base + "/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "a".repeat(17000) }),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).success, false);
});

test("CORS preflight permits authenticated order-status PATCH requests", async () => {
    const previous = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = "https://store.example";
    try {
        const response = await fetch(base + "/api/orders/507f1f77bcf86cd799439011/status", {
            method: "OPTIONS",
            headers: {
                Origin: "https://store.example",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        });
        assert.equal(response.status, 204);
        assert.equal(response.headers.get("access-control-allow-origin"), "https://store.example");
        assert.match(response.headers.get("access-control-allow-methods"), /\bPATCH\b/);
        assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    } finally {
        if (previous === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = previous;
    }
});

test("login brute force and spoofed forwarding headers hit the same rate limit", async () => {
    for (let i = 0; i < 31; i++) {
        const response = await fetch(base + "/api/auth/login", {
            method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": `192.0.2.${i + 1}` }, body: "{}",
        });
        assert.equal(response.status, i < 30 ? 400 : 429);
        if (i === 30) assert.ok(Number(response.headers.get("retry-after")) > 0);
    }
});
