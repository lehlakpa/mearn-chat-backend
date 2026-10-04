export function validateSecrets(env = process.env) {
    for (const key of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) {
        if (typeof env[key] !== "string" || Buffer.byteLength(env[key]) < 32 || /your.*secret|replace.*secret/i.test(env[key])) {
            throw new Error(`${key} must be a random secret of at least 32 bytes`);
        }
    }
    if (env.ACCESS_TOKEN_SECRET === env.REFRESH_TOKEN_SECRET) throw new Error("JWT secrets must be different");
}
