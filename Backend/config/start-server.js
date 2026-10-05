import { once } from "node:events";

export async function startServer(app, { port, initialize, isConnected = () => true, timeoutMs = 60000 }) {
    let initialized = false;
    app.locals.isReady = () => initialized && isConnected();
    const server = app.listen(port, "0.0.0.0");
    let timer;
    try {
        await once(server, "listening");
        console.log(`Server is listening on 0.0.0.0:${server.address().port}`);
        await Promise.race([
            Promise.resolve().then(initialize),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`Database/index initialization timed out after ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
        initialized = true;
        console.log("Startup complete: API is ready");
        return server;
    } catch (error) {
        server.close();
        server.closeAllConnections();
        throw error;
    } finally {
        clearTimeout(timer);
    }
}
