import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import app from "../app.js";
import { startServer } from "../config/start-server.js";

function captureServer() {
    let server;
    const listen = app.listen;
    mock.method(app, "listen", function (...args) {
        server = listen.apply(this, args);
        return server;
    });
    return () => server;
}

test("port opens before initialization; APIs stay unavailable until ready and during disconnects", async () => {
    const getServer = captureServer();
    let finish, connected = true;
    const initialization = new Promise(resolve => { finish = resolve; });
    const started = startServer(app, { port: 0, initialize: () => initialization, isConnected: () => connected });
    const server = getServer();
    try {
        await once(server, "listening");
        assert.equal(server.address().address, "0.0.0.0");
        const base = `http://127.0.0.1:${server.address().port}`;
        for (const path of ["/api/health", "/api/products", "/api/admin/me"]) {
            assert.equal((await fetch(base + path)).status, 503);
        }
        finish();
        await started;
        assert.equal((await fetch(base + "/api/health")).status, 200);
        connected = false;
        assert.equal((await fetch(base + "/api/health")).status, 503);
        connected = true;
        assert.equal((await fetch(base + "/api/health")).status, 200);
    } finally {
        finish();
        await started;
        await new Promise(resolve => server.close(resolve));
        mock.restoreAll();
        delete app.locals.isReady;
    }
});

test("initialization errors and timeouts close the listener and report the cause", async () => {
    for (const [initialize, expected] of [
        [() => { throw new Error("Database unavailable"); }, /Database unavailable/],
        [() => new Promise(() => {}), /initialization timed out/],
    ]) {
        const getServer = captureServer();
        try {
            await assert.rejects(startServer(app, { port: 0, initialize, timeoutMs: 25 }), expected);
            assert.equal(getServer().listening, false);
            assert.equal(app.locals.isReady(), false);
        } finally {
            mock.restoreAll();
            delete app.locals.isReady;
        }
    }
});
