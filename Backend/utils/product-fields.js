export function productFields(body, partial = false) {
    const fields = {};
    for (const key of ["title", "description", "category"]) {
        if (body[key] === undefined && (partial || key === "category")) continue;
        if (typeof body[key] !== "string" || !body[key].trim()) throw new Error(`${key} is required`);
        fields[key] = body[key].trim();
    }
    for (const key of ["price", "stock", "lowStockThreshold"]) {
        if (body[key] === undefined && (partial || key !== "price")) continue;
        const raw = body[key];
        const value = Number(raw);
        if (!["number", "string"].includes(typeof raw) || String(raw).trim() === "" || !Number.isFinite(value) || value < 0 || (key !== "price" && !Number.isSafeInteger(value))) {
            throw new Error(`${key} must be a non-negative ${key === "price" ? "number" : "whole number"}`);
        }
        fields[key] = value;
    }
    return fields;
}
