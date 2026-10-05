export const $ = selector => document.querySelector(selector);
export const money = value => new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR" }).format(value);
export const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const stock = product => product.stock ?? 0;
export const low = product => stock(product) <= (product.lowStockThreshold ?? 5);
export const status = product => `<span class="badge ${stock(product) === 0 ? "out" : low(product) ? "low" : ""}">${stock(product) === 0 ? "Out of stock" : low(product) ? "Low stock" : "In stock"}</span>`;
export function image(product, className = "") {
    // Only render HTTP(S) images; never trust stored markup or URL schemes.
    try {
        const url = new URL(product.image?.url);
        if (["https:", "http:"].includes(url.protocol)) return `<img class="${className}" src="${esc(url.href)}" alt="${esc(product.title)}" loading="lazy">`;
    } catch {}
    return '<div class="placeholder">No image</div>';
}
const retryTimes = new Map();
function rateLimitError(retryAt) {
    const seconds = Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
    const error = new Error(`Too many requests. Please wait ${seconds < 60 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`} before trying again.`);
    error.status = 429;
    error.retryAt = retryAt;
    return error;
}
export async function api(path, options = {}) {
    const key = `${options.method || "GET"}:${path.split("?")[0]}`;
    if (retryTimes.get(key) > Date.now()) throw rateLimitError(retryTimes.get(key));
    retryTimes.delete(key);
    let response;
    try { response = await fetch(path, options); }
    catch { throw new Error("Unable to connect. Check your internet connection and try again."); }
    if (response.status === 429) {
        const header = response.headers.get("Retry-After");
        const seconds = header === null ? NaN : Number(header);
        const retryAt = Number.isFinite(seconds) ? Date.now() + Math.max(1, seconds) * 1000 : Date.parse(header);
        const until = Number.isFinite(retryAt) && retryAt > Date.now() ? retryAt : Date.now() + 60000;
        retryTimes.set(key, until);
        throw rateLimitError(until);
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const error = new Error(response.status === 413 ? "This submission is too large. Shorten the text or choose a smaller file." : data?.message || "Request failed. Please try again.");
        error.status = response.status;
        throw error;
    }
    if (!data) throw new Error("Unexpected server response. Please try again.");
    return data;
}
export function categories(products) {
    return [...new Set(products.map(p => p.category || "Uncategorized"))].sort();
}
export function setCategories(products) {
    const selected = $("#category").value;
    const names = categories(products);
    $("#category").innerHTML = '<option value="">All categories</option>' + names.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    if (names.includes(selected)) $("#category").value = selected;
}
export function matches(product) {
    const query = $("#search").value.toLowerCase().trim();
    return `${product.title} ${product.description}`.toLowerCase().includes(query) && (!$("#category").value || (product.category || "Uncategorized") === $("#category").value);
}
