export function validateSecrets(env = process.env) {
    for (const key of ["JWT_SECRET", "JWT_REFRESH_SECRET"]) {
        if (typeof env[key] !== "string" || Buffer.byteLength(env[key]) < 32 || /your.*secret|replace.*secret/i.test(env[key])) {
            throw new Error(`${key} must be a random secret of at least 32 bytes`);
        }
    }
    if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) throw new Error("JWT secrets must be different");
}
