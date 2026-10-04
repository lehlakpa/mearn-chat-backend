import { $, api, esc, money, stock, status, image, setCategories, matches } from "./shared.js";
let products = [];
let detailProduct, orderProduct, orderRequestId, pendingOrderBody;
function render() {
    const visible = products.filter(matches);
    $("#message").textContent = visible.length ? `${visible.length} products to explore` : "No products found. Try another search or category.";
    $("#products").innerHTML = visible.map(p => `<article class="card">${image(p)}<div class="card-body"><span class="eyebrow">${esc(p.category || "Uncategorized")}</span><h2>${esc(p.title)}</h2><p class="description">${esc(p.description)}</p>${status(p)}<div class="card-bottom"><span class="price">${money(p.price)}</span><button data-id="${esc(p._id)}">View details ↗</button></div></div></article>`).join("");
}
$("#search").addEventListener("input", render);
$("#category").addEventListener("change", render);
$("#close-detail").onclick = () => $("#detail").close();
$("#products").addEventListener("click", async event => {
    const button = event.target.closest("button[data-id]");
    if (!button) return;
    button.disabled = true;
    try {
        const { product: p } = await api(`/api/products/${encodeURIComponent(button.dataset.id)}`);
        detailProduct = p;
        $("#detail-content").innerHTML = `${image(p)}<p class="eyebrow">${esc(p.category || "Uncategorized")}</p><h2>${esc(p.title)}</h2><p class="price">${money(p.price)}</p>${status(p)}<p>${stock(p)} units available</p><p class="description">${esc(p.description)}</p><button id="order-product-button" ${stock(p) === 0 ? "disabled" : ""}>${stock(p) === 0 ? "Out of stock" : "Order now"}</button>`;
        $("#detail").showModal();
    } catch (error) { $("#message").textContent = error.message; }
    finally { button.disabled = false; }
});
$("#detail-content").addEventListener("click", event => {
    if (!event.target.closest("#order-product-button") || !detailProduct || stock(detailProduct) < 1) return;
    orderProduct = detailProduct;
    orderRequestId = crypto.randomUUID();
    pendingOrderBody = null;
    $("#order-form").reset();
    $("#order-form").querySelectorAll("input, textarea").forEach(input => { input.disabled = false; });
    $("#place-order").textContent = "Place order";
    $("#order-form").hidden = false;
    $("#order-form").elements.quantity.max = Math.min(stock(orderProduct), 10000);
    $("#order-message").textContent = "";
    $("#order-message").classList.remove("error");
    $("#order-product").textContent = `${orderProduct.title} · ${money(orderProduct.price)} each`;
    $("#order-total").textContent = money(orderProduct.price);
    $("#detail").close();
    $("#order-dialog").showModal();
});
$("#order-form").elements.quantity.addEventListener("input", event => {
    const quantity = Number(event.target.value);
    $("#order-total").textContent = Number.isSafeInteger(quantity) && quantity > 0 ? money(Math.round(orderProduct.price * quantity * 100) / 100) : "—";
});
$("#close-order").onclick = () => $("#order-dialog").close();
$("#order-dialog").addEventListener("cancel", event => {
    if ($("#place-order").disabled) event.preventDefault();
});
$("#order-form").addEventListener("submit", async event => {
    event.preventDefault();
    // Keep the exact payload when a network failure leaves the result unknown.
    pendingOrderBody ??= { ...Object.fromEntries(new FormData(event.target)), quantity: Number(event.target.elements.quantity.value), productId: orderProduct._id, requestId: orderRequestId };
    event.target.querySelectorAll("input, textarea").forEach(input => { input.disabled = true; });
    $("#place-order").disabled = $("#close-order").disabled = true;
    $("#order-message").classList.remove("error");
    $("#order-message").textContent = "Placing your order…";
    try {
        const { order } = await api("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pendingOrderBody) });
        $("#order-form").hidden = true;
        $("#order-message").textContent = `Order received! Reference: ${order.id}. ${order.quantity} × ${order.productTitle}. Total: ${money(order.total)}. Pay on delivery. Keep this reference for your records.`;
        try {
            ({ products } = await api("/api/products"));
            setCategories(products);
            render();
        } catch { $("#message").textContent = "Order received. Refresh the page to see updated stock."; }
    } catch (error) {
        $("#order-message").classList.add("error");
        if ([400, 409].includes(error.status)) {
            pendingOrderBody = null;
            event.target.querySelectorAll("input, textarea").forEach(input => { input.disabled = false; });
            $("#order-message").textContent = error.message;
        } else {
            $("#order-message").textContent = "Could not confirm your order. Use Retry order here to safely check or submit the same order.";
            $("#place-order").textContent = "Retry order";
        }
    } finally { $("#place-order").disabled = $("#close-order").disabled = false; }
});
try {
    ({ products } = await api("/api/products"));
    setCategories(products);
    render();
} catch { $("#message").textContent = "Unable to load products. Please refresh to try again."; $("#message").classList.add("error"); }
