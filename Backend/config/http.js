export function helmetOptions() {
    const production = process.env.NODE_ENV === "production";
    return {
        contentSecurityPolicy: {
            directives: {
                "img-src": ["'self'", "https:", "http:", "blob:"],
                "upgrade-insecure-requests": production ? [] : null,
            },
        },
        crossOriginResourcePolicy: { policy: "cross-origin" },
        strictTransportSecurity: production ? undefined : false,
    };
}

export function configureProxy(app) {
    if (!process.env.TRUSTED_PROXIES) return;
    // Trust only proxy IPs/subnets controlled by the deployment operator.
    const proxies = process.env.TRUSTED_PROXIES.split(",").map(value => value.trim());
    app.set("trust proxy", proxies);
}
