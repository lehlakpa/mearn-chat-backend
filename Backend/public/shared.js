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
export async function api(path, options = {}) {
    const response = await fetch(path, options);
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.message || "Request failed. Please try again.");
        error.status = response.status;
        throw error;
    }
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
