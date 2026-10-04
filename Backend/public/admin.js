import { $, api, esc, money, stock, low, status, image, categories, setCategories, matches } from "./shared.js";
let products = [], editingId = null, registering = location.pathname === "/admin/register", previewUrl;
let accessToken = sessionStorage.getItem("adminAccessToken");
let refreshToken = sessionStorage.getItem("adminRefreshToken");
let ordersPage = 1;
const message = (text, error = false) => { $("#message").textContent = text; $("#message").classList.toggle("error", error); };
function clearSession() {
    accessToken = refreshToken = null;
    sessionStorage.removeItem("adminAccessToken");
    sessionStorage.removeItem("adminRefreshToken");
    $("#editor").close();
    $("#dashboard").hidden = $("#logout").hidden = true;
    $("#auth").hidden = false;
    $("#orders").replaceChildren();
}
async function authorized(path, options = {}, retry = true) {
    try { return await api(path, { ...options, headers: { ...options.headers, Authorization: `Bearer ${accessToken}` } }); }
    catch (error) {
        if (error.status === 401 && refreshToken && retry) {
            try {
                const data = await api("/api/auth/refresh-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) });
                accessToken = data.accessToken;
                sessionStorage.setItem("adminAccessToken", accessToken);
            } catch (refreshError) { clearSession(); throw refreshError; }
            return authorized(path, options, false);
        }
        if ([401, 403].includes(error.status)) clearSession();
        throw error;
    }
}
function authMode() {
    document.querySelectorAll(".registration").forEach(label => {
        label.hidden = !registering;
        label.querySelector("input").required = registering;
        label.querySelector("input").disabled = !registering;
    });
    $("#auth-title").textContent = registering ? "Create admin account." : "Welcome back.";
    $("#auth-submit").textContent = registering ? "Register admin" : "Login to dashboard";
    $("#auth-form").elements.password.autocomplete = registering ? "new-password" : "current-password";
    $("#login-tab").setAttribute("aria-pressed", String(!registering));
    $("#register-tab").setAttribute("aria-pressed", String(registering));
}
$("#login-tab").onclick = () => { registering = false; authMode(); };
$("#register-tab").onclick = () => { registering = true; authMode(); };
$("#auth-form").addEventListener("submit", async event => {
    event.preventDefault();
    $("#auth-submit").disabled = true;
    try {
        const data = await api(`/api/auth/${registering ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
        if (registering) {
            registering = false;
            event.target.reset();
            authMode();
            message("Admin account created. Login to continue.");
        } else {
            accessToken = data.accessToken; refreshToken = data.refreshToken;
            sessionStorage.setItem("adminAccessToken", accessToken);
            sessionStorage.setItem("adminRefreshToken", refreshToken);
            event.target.reset();
            await dashboard();
        }
    } catch (error) { message(error.message, true); }
    finally { $("#auth-submit").disabled = false; }
});
$("#logout").onclick = async () => {
    try { await authorized("/api/auth/logout", { method: "POST" }); }
    catch { /* Local logout should still work when offline. */ }
    clearSession(); message("Logged out.");
};
function render() {
    const visible = products.filter(p => matches(p) && ($("#stock-filter").value === "low" ? low(p) : $("#stock-filter").value === "out" ? stock(p) === 0 : true));
    $("#inventory").innerHTML = visible.map(p => `<tr><td><div class="product-cell">${image(p)}<strong>${esc(p.title)}</strong></div></td><td>${esc(p.category || "Uncategorized")}</td><td>${money(p.price)}</td><td>${stock(p)}</td><td>${status(p)}</td><td><button class="secondary" data-edit="${esc(p._id)}">Edit</button></td></tr>`).join("");
    $("#empty").hidden = visible.length > 0;
    $("#total-products").textContent = products.length;
    $("#total-stock").textContent = products.reduce((total, p) => total + stock(p), 0);
    $("#total-low").textContent = products.filter(low).length;
    $("#total-categories").textContent = categories(products).length;
}
async function loadInventory() {
    ({ products } = await api("/api/products"));
    setCategories(products);
    $("#categories").innerHTML = categories(products).map(c => `<option value="${esc(c)}"></option>`).join("");
    render();
}
async function dashboard() {
    await authorized("/api/admin/me");
    await loadInventory();
    $("#auth").hidden = true;
    $("#dashboard").hidden = $("#logout").hidden = false;
    history.replaceState(null, "", "/admin");
    message("");
    await loadOrders(1);
}
async function loadOrders(page = ordersPage) {
    $("#refresh-orders").disabled = $("#previous-orders").disabled = $("#next-orders").disabled = true;
    $("#orders-message").textContent = "Loading orders…";
    try {
        const data = await authorized(`/api/orders?page=${page}`);
        ordersPage = data.page;
        $("#orders").innerHTML = data.orders.map(order => `<tr><td>${esc(order._id)}<br><small>${esc(new Date(order.createdAt).toLocaleString())}</small></td><td>${esc(order.customerName || "Name not provided")}<br>${esc(order.phoneNumber || "Phone not provided")}${order.email ? `<br>${esc(order.email)}` : ""}</td><td style="white-space:pre-wrap;min-width:220px;max-width:360px;overflow-wrap:anywhere">${esc(order.address)}${order.notes ? `<br><small>${esc(order.notes)}</small>` : ""}</td><td>${esc(order.productTitle)}</td><td>${order.quantity}</td><td>${money(order.total)}<br><small>Cash on Delivery</small></td><td><span class="badge">${esc(order.status)}</span></td></tr>`).join("");
        $("#orders-message").textContent = data.orders.length ? "Stock has already been deducted for these orders." : "No orders yet.";
        $("#orders-page").textContent = `Page ${ordersPage}`;
        $("#previous-orders").disabled = ordersPage === 1;
        $("#next-orders").disabled = !data.hasMore;
    } catch (error) { $("#orders-message").textContent = error.message; }
    finally { $("#refresh-orders").disabled = false; }
}
$("#refresh-orders").onclick = async () => {
    await loadOrders(1);
    try { await loadInventory(); } catch { message("Unable to refresh inventory.", true); }
};
$("#previous-orders").onclick = () => loadOrders(ordersPage - 1);
$("#next-orders").onclick = () => loadOrders(ordersPage + 1);
$("#search").addEventListener("input", render);
$("#category").addEventListener("change", render);
$("#stock-filter").addEventListener("change", render);
function openEditor(product) {
    editingId = product?._id || null;
    const form = $("#product-form");
    form.reset();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    $("#preview").hidden = true;
    $("#preview").removeAttribute("src");
    $("#form-message").textContent = "";
    $("#editor-title").textContent = product ? "Edit product" : "Add product";
    form.elements.image.required = !product;
    if (product) {
        for (const key of ["title", "description", "price", "category", "stock", "lowStockThreshold"]) form.elements[key].value = product[key] ?? ({ stock: 0, lowStockThreshold: 5, category: "Uncategorized" }[key] ?? "");
    }
    $("#editor").showModal();
}
$("#add-product").onclick = () => openEditor();
$("#close-editor").onclick = () => $("#editor").close();
$("#inventory").onclick = event => {
    const button = event.target.closest("button[data-edit]");
    if (button) openEditor(products.find(p => p._id === button.dataset.edit));
};
$("#product-form").elements.image.addEventListener("change", event => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = event.target.files[0];
    const invalid = file && (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    event.target.setCustomValidity(invalid ? "Choose a JPEG, PNG or WebP image up to 5 MB." : "");
    $("#preview").hidden = !file || invalid;
    if (file && !invalid) $("#preview").src = previewUrl = URL.createObjectURL(file);
    event.target.reportValidity();
});
$("#product-form").addEventListener("submit", async event => {
    event.preventDefault();
    const submit = event.target.querySelector('[type="submit"]');
    submit.disabled = true;
    $("#close-editor").disabled = true;
    $("#form-message").textContent = "Saving product…";
    try {
        const form = new FormData(event.target);
        if (!form.get("image").size) form.delete("image");
        await authorized(`/api/products${editingId ? `/${encodeURIComponent(editingId)}` : ""}`, { method: editingId ? "PUT" : "POST", body: form });
        $("#editor").close();
        message("Product saved successfully.");
        try { await loadInventory(); }
        catch { message("Product saved, but inventory could not refresh. Reload the page.", true); }
    } catch (error) {
        $("#form-message").textContent = error.message;
        $("#form-message").classList.add("error");
        if (!accessToken) message(error.message, true);
    } finally { submit.disabled = false; $("#close-editor").disabled = false; }
});
$("#editor").addEventListener("cancel", event => {
    if ($("#product-form").querySelector('[type="submit"]').disabled) event.preventDefault();
});
authMode();
if (accessToken) {
    try { await dashboard(); }
    catch (error) { clearSession(); message(error.message, true); }
} else clearSession();
