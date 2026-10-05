export function noCache(req, res, next) {
    res.set("Cache-Control", "no-store");
    next();
}

export function requireReady(req, res, next) {
    const isReady = req.app.locals.isReady;
    if (isReady && !isReady()) {
        return res.status(503).json({ success: false, message: "Service is not ready. Please try again shortly." });
    }
    next();
}
