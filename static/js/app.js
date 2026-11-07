(() => {
  "use strict";

  /* ================= Utilidades ================= */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const KEYS = { products: "pos_products", sales: "pos_sales" };
  const CUR = document.body.dataset.moneda || "Bs.";

  const load = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const fmt = (n) => `${CUR} ${Number(n).toFixed(2)}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));

  let toastTimer;
  const toast = (msg, type = "") => {
    const t = $("#toast");
    t.textContent = msg;
    t.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = "toast"), 2200);
  };

  /* ================= Estado ================= */
  let products = load(KEYS.products);
  let sales = load(KEYS.sales);
  let cart = []; // { id, qty }

  const getProduct = (id) => products.find((p) => p.id === id);
  const cartTotal = () =>
    cart.reduce((sum, l) => {
      const p = getProduct(l.id);
      return sum + (p ? p.precio * l.qty : 0);
    }, 0);

  /* ================= Navegación ================= */
  $$(".tab").forEach((btn) =>
    btn.addEventListener("click", () => {
      $$(".tab").forEach((b) => b.classList.toggle("active", b === btn));
      $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${btn.dataset.view}`));
      if (btn.dataset.view === "ventas") renderSales();
      if (btn.dataset.view === "productos") renderProductTable();
      if (btn.dataset.view === "venta") renderGrid();
    })
  );

  /* ================= VENTA: grilla ================= */
  const stockBadge = (p) => {
    if (p.stock === null) return "";
    if (p.stock === 0) return '<span class="badge out">Agotado</span>';
    if (p.stock <= 5) return `<span class="badge low">Quedan ${p.stock}</span>`;
    return `<span class="badge">Stock ${p.stock}</span>`;
  };

  function renderGrid() {
    const q = $("#posSearch").value.trim().toLowerCase();
    const list = products.filter(
      (p) => p.nombre.toLowerCase().includes(q) || (p.categoria || "").toLowerCase().includes(q)
    );
    const grid = $("#productGrid");
    if (!products.length) {
      grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Registra productos en la pestaña “Productos”.</p>';
      return;
    }
    if (!list.length) {
      grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Sin resultados.</p>';
      return;
    }
    grid.innerHTML = list
      .map(
        (p) => `
      <button class="product-card" data-id="${p.id}" ${p.stock === 0 ? "disabled" : ""}>
        <span class="name">${esc(p.nombre)}</span>
        <span class="cat">${esc(p.categoria || "Sin categoría")}</span>
        ${stockBadge(p)}
        <span class="price">${fmt(p.precio)}</span>
      </button>`
      )
      .join("");
  }

  $("#productGrid").addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (card) addToCart(card.dataset.id);
  });
  $("#posSearch").addEventListener("input", renderGrid);

  /* ================= VENTA: carrito ================= */
  function addToCart(id) {
    const p = getProduct(id);
    if (!p) return;
    const line = cart.find((l) => l.id === id);
    const nextQty = (line ? line.qty : 0) + 1;
    if (p.stock !== null && nextQty > p.stock) {
      toast(`Stock insuficiente de “${p.nombre}”`, "error");
      return;
    }
    if (line) line.qty = nextQty;
    else cart.push({ id, qty: 1 });
    renderCart();
  }

  function renderCart() {
    const box = $("#cartItems");
    // Quitar líneas de productos que ya no existan
    cart = cart.filter((l) => getProduct(l.id));

    if (!cart.length) {
      box.innerHTML = '<p class="empty">El carrito está vacío.</p>';
    } else {
      box.innerHTML = cart
        .map((l) => {
          const p = getProduct(l.id);
          return `
          <div class="cart-line" data-id="${p.id}">
            <div>
              <div class="l-name">${esc(p.nombre)}</div>
              <div class="l-unit">${fmt(p.precio)} c/u</div>
            </div>
            <div class="l-sub">${fmt(p.precio * l.qty)}</div>
            <div></div>
            <div class="qty">
              <button data-act="dec" aria-label="Menos">−</button>
              <span>${l.qty}</span>
              <button data-act="inc" aria-label="Más">+</button>
              <button data-act="del" class="del" aria-label="Quitar">✕</button>
            </div>
          </div>`;
        })
        .join("");
    }
    $("#cartTotal").textContent = fmt(cartTotal());
    $("#fabCount").textContent = cart.reduce((s, l) => s + l.qty, 0);
    updateChange();
  }

  $("#cartItems").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest(".cart-line").dataset.id;
    const line = cart.find((l) => l.id === id);
    const p = getProduct(id);
    if (!line || !p) return;

    if (btn.dataset.act === "inc") {
      if (p.stock !== null && line.qty + 1 > p.stock) {
        toast(`Stock insuficiente de “${p.nombre}”`, "error");
        return;
      }
      line.qty++;
    } else if (btn.dataset.act === "dec") {
      line.qty--;
      if (line.qty <= 0) cart = cart.filter((l) => l.id !== id);
    } else {
      cart = cart.filter((l) => l.id !== id);
    }
    renderCart();
  });

  function updateChange() {
    const total = cartTotal();
    const received = parseFloat($("#received").value);
    const el = $("#change");
    if (isNaN(received)) {
      el.textContent = fmt(0);
      el.classList.remove("neg");
      return;
    }
    const diff = received - total;
    el.textContent = fmt(Math.abs(diff));
    el.classList.toggle("neg", diff < 0);
    if (diff < 0) el.textContent = "Faltan " + fmt(Math.abs(diff));
  }
  $("#received").addEventListener("input", updateChange);

  $("#clearCart").addEventListener("click", () => {
    cart = [];
    $("#received").value = "";
    renderCart();
  });

  $("#fabCart").addEventListener("click", () =>
    $("#cartPanel").scrollIntoView({ behavior: "smooth", block: "start" })
  );

  $("#checkout").addEventListener("click", () => {
    if (!cart.length) return toast("El carrito está vacío", "error");

    const total = cartTotal();
    const rawReceived = $("#received").value;
    const received = rawReceived === "" ? total : parseFloat(rawReceived);
    if (received < total) return toast("El monto recibido es menor al total", "error");

    const items = cart.map((l) => {
      const p = getProduct(l.id);
      return { nombre: p.nombre, precio: p.precio, qty: l.qty, subtotal: p.precio * l.qty };
    });

    // Descontar stock
    cart.forEach((l) => {
      const p = getProduct(l.id);
      if (p.stock !== null) p.stock = Math.max(0, p.stock - l.qty);
    });

    sales.push({
      id: uid(),
      fecha: new Date().toISOString(),
      items,
      total,
      recibido: received,
      cambio: received - total,
    });

    save(KEYS.products, products);
    save(KEYS.sales, sales);

    toast(`Venta registrada · Cambio ${fmt(received - total)}`, "ok");
    cart = [];
    $("#received").value = "";
    renderCart();
    renderGrid();
  });

  /* ================= PRODUCTOS ================= */
  const form = $("#productForm");

  function resetForm() {
    form.reset();
    $("#pId").value = "";
    $("#formTitle").textContent = "Registrar producto";
    $("#saveProduct").textContent = "Guardar producto";
    $("#cancelEdit").hidden = true;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("#pId").value;
    const nombre = $("#pName").value.trim();
    const categoria = $("#pCategory").value.trim();
    const precio = parseFloat($("#pPrice").value);
    const stockRaw = $("#pStock").value;
    const stock = stockRaw === "" ? null : Math.max(0, parseInt(stockRaw, 10));

    if (!nombre) return toast("Ingresa el nombre", "error");
    if (isNaN(precio) || precio < 0) return toast("Precio inválido", "error");

    if (id) {
      const p = getProduct(id);
      Object.assign(p, { nombre, categoria, precio, stock });
      toast("Producto actualizado", "ok");
    } else {
      products.push({ id: uid(), nombre, categoria, precio, stock });
      toast("Producto registrado", "ok");
    }
    save(KEYS.products, products);
    resetForm();
    renderProductTable();
    renderGrid();
    renderCart();
  });

  $("#cancelEdit").addEventListener("click", resetForm);

  function renderProductTable() {
    const q = $("#prodSearch").value.trim().toLowerCase();
    const list = products
      .filter((p) => p.nombre.toLowerCase().includes(q) || (p.categoria || "").toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    $("#prodEmpty").hidden = products.length > 0;
    $("#productTable tbody").innerHTML = list
      .map(
        (p) => `
      <tr data-id="${p.id}">
        <td data-label="Producto"><strong>${esc(p.nombre)}</strong></td>
        <td data-label="Categoría">${esc(p.categoria || "—")}</td>
        <td data-label="Precio">${fmt(p.precio)}</td>
        <td data-label="Stock">${p.stock === null ? "Sin control" : p.stock}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-act="edit">Editar</button>
          <button class="btn btn-danger btn-sm" data-act="delete">Eliminar</button>
        </td>
      </tr>`
      )
      .join("");
  }
  $("#prodSearch").addEventListener("input", renderProductTable);

  $("#productTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const p = getProduct(id);
    if (!p) return;

    if (btn.dataset.act === "edit") {
      $("#pId").value = p.id;
      $("#pName").value = p.nombre;
      $("#pCategory").value = p.categoria || "";
      $("#pPrice").value = p.precio;
      $("#pStock").value = p.stock === null ? "" : p.stock;
      $("#formTitle").textContent = "Editar producto";
      $("#saveProduct").textContent = "Actualizar producto";
      $("#cancelEdit").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (confirm(`¿Eliminar “${p.nombre}”?`)) {
      products = products.filter((x) => x.id !== id);
      save(KEYS.products, products);
      renderProductTable();
      renderGrid();
      renderCart();
      toast("Producto eliminado");
    }
  });

  $("#loadSamples").addEventListener("click", () => {
    const samples = [
      ["Gaseosa 2L", "Bebidas", 12, 24],
      ["Agua 600ml", "Bebidas", 5, 48],
      ["Pan de batalla", "Panadería", 1, null],
      ["Arroz 1kg", "Abarrotes", 9.5, 30],
      ["Aceite 1L", "Abarrotes", 18, 15],
      ["Galletas", "Snacks", 3.5, 40],
    ];
    samples.forEach(([nombre, categoria, precio, stock]) =>
      products.push({ id: uid(), nombre, categoria, precio, stock })
    );
    save(KEYS.products, products);
    renderProductTable();
    renderGrid();
    toast("Productos de ejemplo cargados", "ok");
  });

  /* ================= HISTORIAL ================= */
  const fmtDate = (iso) =>
    new Date(iso).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" });

  function renderSales() {
    const today = new Date().toDateString();
    const todaySales = sales.filter((s) => new Date(s.fecha).toDateString() === today);

    $("#statTodayCount").textContent = todaySales.length;
    $("#statTodayTotal").textContent = fmt(todaySales.reduce((a, s) => a + s.total, 0));
    $("#statAllTotal").textContent = fmt(sales.reduce((a, s) => a + s.total, 0));

    $("#salesEmpty").hidden = sales.length > 0;
    $("#salesList").innerHTML = [...sales]
      .reverse()
      .map(
        (s) => `
      <article class="sale">
        <div class="sale-head">
          <span>${fmtDate(s.fecha)}</span>
          <span class="total">${fmt(s.total)}</span>
        </div>
        <small>Recibido ${fmt(s.recibido)} · Cambio ${fmt(s.cambio)}</small>
        <ul>
          ${s.items.map((i) => `<li>${i.qty} × ${esc(i.nombre)} — ${fmt(i.subtotal)}</li>`).join("")}
        </ul>
      </article>`
      )
      .join("");
  }

  $("#exportCsv").addEventListener("click", () => {
    if (!sales.length) return toast("No hay ventas para exportar", "error");
    const rows = [["Fecha", "Producto", "Cantidad", "Precio", "Subtotal", "Total venta"]];
    sales.forEach((s) =>
      s.items.forEach((i) =>
        rows.push([fmtDate(s.fecha), i.nombre, i.qty, i.precio.toFixed(2), i.subtotal.toFixed(2), s.total.toFixed(2)])
      )
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `ventas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("#clearSales").addEventListener("click", () => {
    if (!sales.length) return;
    if (confirm("¿Borrar todo el historial de ventas? Esta acción no se puede deshacer.")) {
      sales = [];
      save(KEYS.sales, sales);
      renderSales();
      toast("Historial borrado");
    }
  });

  /* ================= Init ================= */
  renderGrid();
  renderCart();
  renderProductTable();
  renderSales();
})();
