const state = {
  token: localStorage.getItem("pinturas_token"),
  client: JSON.parse(localStorage.getItem("pinturas_client") || "null"),
  adminToken: sessionStorage.getItem("pinturas_admin_token"),
  adminEmail: sessionStorage.getItem("pinturas_admin_email"),
  adminClientId: null,
  adminConversations: [],
  cart: [],
  register: false,
};

const $ = (id) => document.getElementById(id);
const userCartKey = (clientId) => `pinturas_cart_${clientId}`;
const isAdmin = () => Boolean(state.adminToken);

function loadUserCart(clientId) {
  try {
    const cart = JSON.parse(localStorage.getItem(userCartKey(clientId)) || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function persistCart() {
  if (!state.token || !state.client?.Id_Cli) return;
  localStorage.setItem(userCartKey(state.client.Id_Cli), JSON.stringify(state.cart));
}

function restoreCart() {
  localStorage.removeItem("pinturas_cart");
  if (isAdmin()) {
    state.token = null;
    state.client = null;
    state.cart = [];
    localStorage.removeItem("pinturas_token");
    localStorage.removeItem("pinturas_client");
    return;
  }
  if (!state.token || !state.client?.Id_Cli) {
    state.token = null;
    state.client = null;
    state.cart = [];
    localStorage.removeItem("pinturas_token");
    localStorage.removeItem("pinturas_client");
    return;
  }
  state.cart = loadUserCart(state.client.Id_Cli);
}

function clearLocalSession() {
  state.token = null;
  state.client = null;
  state.cart = [];
  localStorage.removeItem("pinturas_token");
  localStorage.removeItem("pinturas_client");
  localStorage.removeItem("pinturas_cart");
  sessionStorage.removeItem("pinturas_checkout_cart");
  clearChatMessages();
  updateHeader();
  renderCart();
}

const api = async (url, options = {}) => {
  const response = await fetch(`/api${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (response.status === 401 && state.token) clearLocalSession();
  if (!response.ok) throw new Error(data.erro || "Ocorreu um erro.");
  return data;
};

const adminApi = async (url, options = {}) => {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(state.adminToken ? { Authorization: `Bearer ${state.adminToken}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`/api${url}`, { ...options, headers });
  const data = await response.json();
  if (response.status === 401 && state.adminToken) logoutAdmin();
  if (!response.ok) throw new Error(data.erro || "Ocorreu um erro.");
  return data;
};

function navigate(screen) {
  if (!$("screen-" + screen)) screen = "home";
  if (isAdmin() && screen === "profile") screen = "store";
  if (isAdmin() && screen === "help") screen = "home";
  updateHeader();
  document.querySelectorAll(".screen").forEach((element) => {
    element.classList.toggle("active", element.id === `screen-${screen}`);
  });
  document.querySelectorAll("[data-screen]").forEach((element) => {
    element.classList.toggle("active-link", element.dataset.screen === screen);
  });
  history.replaceState(null, "", `#${screen}`);

  if (screen === "store") loadCatalog();
  if (screen === "cart") {
    if (isAdmin()) loadAdminOrders();
    else {
      loadOrders();
      renderCart();
    }
  }
  if (screen === "chat" && isAdmin()) {
    loadAdminConversations();
    if (state.adminClientId) loadAdminMessages();
  } else if (screen === "chat" && state.token) {
    loadChat();
    loadOrders();
  }
  if (screen === "chat") loadPublicFeedbacks();
  if (screen === "profile") loadProfile();
}

function updateHeader() {
  const administrator = isAdmin();
  $("loginButton").classList.toggle("hidden", Boolean(state.token || administrator));
  $("logoutButton").classList.toggle("hidden", !state.token && !administrator);
  $("logoutButton").textContent = administrator ? "Sair do ateliê" : "Sair";
  $("profileButton").classList.toggle("hidden", !state.token || administrator);
  $("adminProductPanel").classList.toggle("hidden", !administrator);
  $("customerChatLayout").classList.toggle("hidden", administrator);
  $("adminInboxPanel").classList.toggle("hidden", !administrator);
  $("customerCartLayout").classList.toggle("hidden", administrator);
  $("customerOrdersPanel").classList.toggle("hidden", administrator);
  $("adminOrdersWorkspace").classList.toggle("hidden", !administrator);
  $("chatTitle").innerHTML = administrator
    ? "Mensagens dos<br /><em>clientes.</em>"
    : "Vamos criar algo<br /><em>seu?</em>";
  $("chatDescription").textContent = administrator
    ? "Acompanhe as conversas e responda às encomendas enviadas pelos clientes."
    : "Conte para a Sophi o que você imaginou. Vocês combinam referências, tamanho, materiais e prazo diretamente por aqui.";
  $("cartTitle").innerHTML = administrator
    ? "Pedidos do<br /><em>ateliê.</em>"
    : "Carrinho e<br /><em>rastreio.</em>";
  $("cartDescription").textContent = administrator
    ? "Acompanhe os pedidos em andamento e consulte os que já foram concluídos."
    : "Confira suas peças originais, finalize o pedido e acompanhe o caminho até sua casa.";
  const cartNavigation = document.querySelector('[data-screen="cart"]');
  const cartBadge = $("cartBadge");
  cartNavigation.textContent = administrator ? "Pedidos " : "Carrinho ";
  cartNavigation.append(cartBadge);
  $("homeCartShortcutTitle").textContent = administrator ? "Pedidos" : "Seu carrinho";
  $("homeCartShortcutDescription").textContent = administrator
    ? "Acompanhe pedidos em andamento e concluídos."
    : "Revise suas peças, pedidos e rastreios.";
  document.querySelectorAll('[data-screen="help"]').forEach((element) => {
    element.classList.toggle("hidden", administrator);
  });
  const initial = state.client?.nome?.[0]?.toUpperCase() || "S";
  $("profileButton").textContent = initial;
  $("profileInitial").textContent = initial;
  const photo = state.client?.foto;
  const photoImage = $("profileAvatarImage");
  if (photoImage) {
    photoImage.classList.toggle("hidden", !photo);
    if (photo) photoImage.src = photo;
    else photoImage.removeAttribute("src");
    $("profileInitial").classList.toggle("hidden", Boolean(photo));
  }
}

function showFeedback(id, message) {
  $(id).textContent = message;
}

function clearChatMessages() {
  $("messages").innerHTML = '<div class="message received"><strong>Sophi <small>agora</small></strong><p>Oi! Me conte qual pintura você está imaginando.</p></div>';
}

function openAuth(register = false) {
  state.register = register;
  $("authTitle").textContent = register
    ? "Criar sua conta"
    : "Entrar na sua conta";
  $("nameField").classList.toggle("hidden", !register);
  $("name").required = register;
  $("authForm").querySelector("button[type=submit]").innerHTML = register
    ? "Criar conta <span>↗</span>"
    : "Entrar <span>↗</span>";
  $("authSwitch").innerHTML = register
    ? "Já tem uma conta? <button>Entrar</button>"
    : "Ainda não tem conta? <button>Cadastre-se</button>";
  $("recoverLink").classList.toggle("hidden", register);
  $("authFeedback").textContent = "";
  $("authDialog").showModal();
}

function saveSession(data) {
  clearChatMessages();
  if (data.role === "admin") {
    state.token = null;
    state.client = null;
    state.cart = [];
    localStorage.removeItem("pinturas_token");
    localStorage.removeItem("pinturas_client");
    state.adminToken = data.token;
    state.adminEmail = data.email;
    sessionStorage.setItem("pinturas_admin_token", data.token);
    sessionStorage.setItem("pinturas_admin_email", data.email);
    $("authDialog").close();
    updateHeader();
    navigate("store");
    return;
  }
  state.adminToken = null;
  state.adminEmail = null;
  sessionStorage.removeItem("pinturas_admin_token");
  sessionStorage.removeItem("pinturas_admin_email");
  state.token = data.token;
  state.client = data.cliente;
  state.cart = loadUserCart(state.client.Id_Cli);
  localStorage.setItem("pinturas_token", state.token);
  localStorage.setItem("pinturas_client", JSON.stringify(state.client));
  localStorage.removeItem("pinturas_cart");
  updateHeader();
  renderCart();
  $("authDialog").close();
  navigate("profile");
  loadOrders();
  loadChat();
}

function formatDate(value) {
  if (!value) return "não informado";
  return new Date(value.replace(" ", "T")).toLocaleDateString("pt-BR");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function loadCatalog() {
  const catalog = await api("/catalogo");
  $("catalogGrid").innerHTML = catalog
    .map(
      (item, index) => `
        <article class="art-card">
          <div class="art-image ${["one", "two", "three"][index % 3]}">
            ${item.foto
              ? `<img src="${escapeHTML(item.foto)}" alt="${escapeHTML(item.titulo)}" loading="lazy" />`
              : `<div class="art-frame">${escapeHTML(item.titulo.split(" ")[0])}</div>`}
          </div>
          <div class="art-card-info">
            <div>
              <h3>${escapeHTML(item.titulo)}</h3>
              <small>${escapeHTML(item.tamanho || "tamanho sob consulta")} · ${escapeHTML(item.des_material || "tela")}</small>
              <strong class="art-price">${Number(item.preco_u) > 0 ? formatCurrency(item.preco_u) : "Preço sob consulta"}</strong>
            </div>
            ${isAdmin()
              ? `<button class="remove-button" data-remove-product="${item.id_quadro}" title="Retirar quadro da venda">Retirar da venda</button>`
              : `<button class="order-button" data-add-cart="${item.id_quadro}">Adicionar</button>`}
          </div>
        </article>`,
    )
    .join("");

  document.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.addCart, catalog));
  });
  document.querySelectorAll("[data-remove-product]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Retirar este quadro da venda?")) return;
      button.disabled = true;
      try {
        await adminApi(`/catalogo/${button.dataset.removeProduct}`, { method: "DELETE" });
        await loadCatalog();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    });
  });
}

function addToCart(id, catalog) {
  if (isAdmin()) return;
  const item = catalog.find((entry) => String(entry.id_quadro) === String(id));
  if (!item || state.cart.some((entry) => String(entry.id_quadro) === String(item.id_quadro))) {
    navigate("cart");
    return;
  }

  state.cart.push(item);
  persistCart();
  updateCartBadge();
  navigate("cart");
}

function updateCartBadge() {
  $("cartBadge").textContent = state.cart.length;
}

function renderCart() {
  updateCartBadge();
  $("cartCount").textContent = `${state.cart.length} ${state.cart.length === 1 ? "item" : "itens"}`;
  $("cartList").innerHTML = state.cart.length
    ? state.cart
        .map(
          (item) => `
            <div class="cart-row">
              <div class="cart-thumb">${item.foto
                ? `<img src="${escapeHTML(item.foto)}" alt="" />`
                : `<span>${escapeHTML(item.titulo.split(" ")[0])}</span>`}</div>
              <div class="cart-info"><strong>${escapeHTML(item.titulo)}</strong><small>${escapeHTML(item.tamanho || "tamanho sob consulta")} · ${Number(item.preco_u) > 0 ? formatCurrency(item.preco_u) : "preço sob consulta"}</small></div>
              <button class="remove-button" data-remove-cart="${item.id_quadro}" title="Remover do carrinho">×</button>
            </div>`,
        )
        .join("")
    : '<div class="empty-state">Seu carrinho está vazio.<br />Encontre uma peça original na loja.</div>';
  $("cartFooter").classList.toggle("hidden", !state.cart.length);
  $("cartTotal").textContent = formatCurrency(
    state.cart.reduce((total, item) => total + Number(item.preco_u || 0), 0),
  );

  document.querySelectorAll("[data-remove-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      state.cart = state.cart.filter((item) => String(item.id_quadro) !== button.dataset.removeCart);
      persistCart();
      renderCart();
    });
  });
}

function checkoutCart() {
  if (isAdmin()) return;
  if (!state.token) return openAuth();
  if (!state.cart.length) return;
  $("checkoutStreet").value = state.client?.rua || "";
  $("checkoutHouseNumber").value = state.client?.numero_casa || "";
  $("checkoutNeighborhood").value = state.client?.bairro || "";
  $("checkoutCep").value = state.client?.cep || "";
  $("addressFeedback").textContent = "";
  $("addressDialog").showModal();
}

async function startCheckout(address) {
  try {
    const checkout = await api("/pagamentos/checkout", {
      method: "POST",
      body: JSON.stringify({
        itens: state.cart.map((item) => item.id_quadro),
        forma_pagamento: $("paymentMethod").value,
        endereco: address,
      }),
    });
    sessionStorage.setItem("pinturas_checkout_cart", JSON.stringify({
      clientId: state.client.Id_Cli,
      items: state.cart,
    }));
    window.location.assign(checkout.checkout_url);
  } catch (error) {
    showFeedback("checkoutFeedback", error.message);
  }
}

$("addressForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = {
    rua: $("checkoutStreet").value.trim(),
    numero_casa: $("checkoutHouseNumber").value.trim(),
    bairro: $("checkoutNeighborhood").value.trim(),
    cep: $("checkoutCep").value.trim(),
  };

  try {
    const profile = await api("/perfil", {
      method: "PATCH",
      body: JSON.stringify(address),
    });
    state.client = profile;
    localStorage.setItem("pinturas_client", JSON.stringify(profile));
    updateHeader();
    $("addressDialog").close();
    await startCheckout(address);
  } catch (error) {
    showFeedback("addressFeedback", error.message);
  }
});

function renderOrders(target, orders, emptyText) {
  target.innerHTML = orders.length
    ? orders.map((order) => {
        const delivered = order.descricao_status === "Entregue" && order.data_entrega_confirmada;
        const action = order.descricao_status === "Enviado"
          ? `<button class="dialog-link" data-confirm-delivery="${Number(order.id_ped)}">Confirmar recebimento</button>`
          : delivered && !order.avaliacao_feedback
            ? `<button class="dialog-link" data-feedback="${Number(order.id_ped)}">Avaliar com foto</button>`
            : order.avaliacao_feedback
              ? "Avaliação publicada"
              : "";
        return `
          <div class="order-row">
            <div><strong>${escapeHTML(order.titulo)}</strong><small>${order.codigo_rastreamento ? `Correios: ${escapeHTML(order.codigo_rastreamento)}` : "Rastreio após a postagem"} · ${order.previsao_entrega ? `previsão ${formatDate(order.previsao_entrega)}` : "prazo em análise"}</small></div>
            <span class="order-status">${escapeHTML(order.descricao_status)}${action ? `<br />${action}` : ""}</span>
          </div>`;
      }).join("")
    : `<div class="empty-state">${emptyText}</div>`;
  target.querySelectorAll("[data-feedback]").forEach((button) => {
    button.addEventListener("click", () => sendFeedback(button.dataset.feedback));
  });
  target.querySelectorAll("[data-confirm-delivery]").forEach((button) => {
    button.addEventListener("click", () => confirmDelivery(button.dataset.confirmDelivery));
  });
}

async function loadOrders() {
  if (isAdmin()) {
    await loadAdminOrders();
    return;
  }
  if (!state.token) {
    $("ordersList").textContent = "Entre para visualizar seus pedidos.";
    $("chatOrdersList").textContent = "Entre para consultar pedidos e avaliações.";
    return;
  }
  try {
    const orders = await api("/pedidos");
    renderOrders($("ordersList"), orders, "Você ainda não tem pedidos.<br />Finalize uma compra para começar.");
    renderOrders($("chatOrdersList"), orders, "Seus pedidos e avaliações aparecerão aqui.");
  } catch (error) {
    $("ordersList").textContent = error.message;
    $("chatOrdersList").textContent = error.message;
  }
}

function renderAdminOrders(target, orders, emptyText) {
  target.innerHTML = orders.length
    ? orders.map((order) => {
        const canShip = ["Pagamento aprovado", "Em producao"].includes(order.descricao_status);
        const tracking = order.codigo_rastreamento
          ? `Correios: ${escapeHTML(order.codigo_rastreamento)} · previsão ${formatDate(order.previsao_entrega)}`
          : "Sem código de rastreio";
        return `
          <article class="admin-order-card">
            <div class="admin-order-heading">
              <strong>${escapeHTML(order.titulo)}</strong>
              <span class="order-status">${escapeHTML(order.descricao_status)}</span>
            </div>
            <p>${escapeHTML(order.cliente_nome)} · ${escapeHTML(order.cliente_email)}</p>
            <small>Pedido #${Number(order.id_ped)} · ${formatDate(order.data_pedido)} · ${formatCurrency(order.preco_u)}</small>
            <small>${tracking}</small>
            ${canShip ? `
              <form class="admin-shipping-form" data-admin-shipping="${Number(order.id_ped)}">
                <label>Código dos Correios<input name="codigo_rastreamento" maxlength="40" required /></label>
                <button class="button dark" type="submit">Registrar envio</button>
                <p class="feedback" data-shipping-feedback></p>
              </form>` : ""}
          </article>`;
      }).join("")
    : `<p class="empty-state">${emptyText}</p>`;

  target.querySelectorAll("[data-admin-shipping]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      const feedback = form.querySelector("[data-shipping-feedback]");
      button.disabled = true;
      try {
        await adminApi(`/pedidos/${form.dataset.adminShipping}/envio`, {
          method: "PATCH",
          body: JSON.stringify({
            codigo_rastreamento: form.elements.codigo_rastreamento.value.trim(),
          }),
        });
        await loadAdminOrders();
      } catch (error) {
        feedback.textContent = error.message;
        button.disabled = false;
      }
    });
  });
}

async function loadAdminOrders() {
  try {
    const orders = await adminApi("/admin/pedidos");
    const completed = orders.filter((order) => ["Entregue", "Cancelado"].includes(order.descricao_status));
    const active = orders.filter((order) => !["Entregue", "Cancelado"].includes(order.descricao_status));
    $("adminActiveOrderCount").textContent = `${active.length} ${active.length === 1 ? "pedido" : "pedidos"}`;
    $("adminCompletedOrderCount").textContent = `${completed.length} ${completed.length === 1 ? "pedido" : "pedidos"}`;
    renderAdminOrders($("adminActiveOrders"), active, "Nenhum pedido em andamento.");
    renderAdminOrders($("adminCompletedOrders"), completed, "Nenhum pedido concluído.");
    await loadAdminFeedbacks();
  } catch (error) {
    $("adminActiveOrders").innerHTML = `<p class="feedback">${escapeHTML(error.message)}</p>`;
    $("adminCompletedOrders").innerHTML = `<p class="feedback">${escapeHTML(error.message)}</p>`;
  }
}

async function loadAdminFeedbacks() {
  try {
    const feedbacks = await adminApi("/admin/feedbacks");
    $("adminFeedbackCount").textContent = `${feedbacks.length} ${feedbacks.length === 1 ? "avaliação" : "avaliações"}`;
    $("adminFeedbackList").innerHTML = feedbacks.length
      ? feedbacks.map((feedback) => `
          <article class="admin-feedback-item">
            <div class="admin-feedback-media">${feedback.foto
              ? `<img src="${escapeHTML(feedback.foto)}" alt="Foto do quadro ${escapeHTML(feedback.titulo)}" loading="lazy" />`
              : '<span>Sem foto</span>'}</div>
            <div class="admin-feedback-content">
              <div class="admin-feedback-heading">
                <div><strong>${escapeHTML(feedback.titulo)}</strong><small>${escapeHTML(feedback.cliente_nome)} · ${escapeHTML(feedback.cliente_email)}</small></div>
                <span class="review-rating" aria-label="${Number(feedback.avaliacao)} de 5 estrelas">${"★".repeat(Number(feedback.avaliacao))}</span>
              </div>
              <p>${escapeHTML(feedback.comentario || "Sem comentário.")}</p>
              <small>Pedido #${Number(feedback.id_ped)} · ${formatDate(feedback.data_pedido)}</small>
            </div>
          </article>`).join("")
      : '<p class="empty-state">Nenhuma avaliação publicada ainda.</p>';
  } catch (error) {
    $("adminFeedbackList").innerHTML = `<p class="feedback">${escapeHTML(error.message)}</p>`;
  }
}

async function loadPublicFeedbacks() {
  try {
    const feedbacks = await api("/pedidos/feedbacks");
    $("feedbackGallery").innerHTML = feedbacks.length
      ? feedbacks.map((feedback) => `
          <article class="review-item">
            <img src="${escapeHTML(feedback.foto)}" alt="Foto do quadro ${escapeHTML(feedback.titulo)}" loading="lazy" />
            <div><strong>${escapeHTML(feedback.titulo)}</strong><span class="review-rating" aria-label="${Number(feedback.avaliacao)} de 5 estrelas">${"★".repeat(Number(feedback.avaliacao))}</span><p>${escapeHTML(feedback.comentario)}</p><small>${formatDate(feedback.data_pedido)}</small></div>
          </article>`).join("")
      : '<p class="empty-state">Nenhuma avaliação publicada ainda.</p>';
  } catch {
    $("feedbackGallery").innerHTML = '<p class="empty-state">Não foi possível carregar as avaliações.</p>';
  }
}

async function confirmDelivery(id) {
  try {
    await api(`/pedidos/${id}/confirmar-entrega`, { method: "PATCH" });
    await loadOrders();
    await loadPublicFeedbacks();
  } catch (error) {
    alert(error.message);
  }
}

function sendFeedback(id) {
  $("feedbackOrderId").value = id;
  $("feedbackForm").reset();
  $("feedbackOrderId").value = id;
  $("feedbackFormStatus").textContent = "";
  $("feedbackDialog").showModal();
}

$("feedbackForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData();
  form.append("avaliacao", $("feedbackRating").value);
  form.append("comentario", $("feedbackComment").value.trim());
  const photo = $("feedbackPhoto").files[0];
  if (photo) form.append("foto", photo);

  try {
    const response = await fetch(`/api/pedidos/${encodeURIComponent($("feedbackOrderId").value)}/feedback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
      body: form,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.erro || "Não foi possível publicar a avaliação.");
    $("feedbackDialog").close();
    await loadOrders();
    await loadPublicFeedbacks();
  } catch (error) {
    showFeedback("feedbackFormStatus", error.message);
  }
});

async function loadChat() {
  if (!state.token) return;
  clearChatMessages();
  try {
    const messages = await api("/chat");
    $("messages").innerHTML = messages
      .map((message) => `
        <div class="message ${message.remetente === "cliente" ? "sent" : "received"}">
          <strong>${escapeHTML(message.remetente === "cliente" ? state.client.nome : "Sophi")} <small>${formatDate(message.data_envio)}</small></strong>
          <p>${escapeHTML(message.texto)}</p>
        </div>`)
      .join("");
    $("messages").scrollTop = $("messages").scrollHeight;
  } catch {
    clearChatMessages();
  }
}

async function loadProfile() {
  if (!state.token) {
    openAuth();
    return;
  }
  const profile = await api("/perfil");
  state.client = profile;
  localStorage.setItem("pinturas_client", JSON.stringify(profile));
  updateHeader();
  $("profileName").value = profile.nome || "";
  $("profilePhone").value = profile.telefone || "";
  $("profileCep").value = profile.cep || "";
  $("profileCpf").value = profile.CPF || "";
  $("profileHouseNumber").value = profile.numero_casa || "";
  $("profileStreet").value = profile.rua || "";
  $("profileNeighborhood").value = profile.bairro || "";
}

function logoutAdmin() {
  state.adminToken = null;
  state.adminEmail = null;
  state.adminClientId = null;
  state.adminConversations = [];
  sessionStorage.removeItem("pinturas_admin_token");
  sessionStorage.removeItem("pinturas_admin_email");
  updateHeader();
  renderCart();
  navigate("home");
}

async function loadAdminConversations() {
  const target = $("adminConversationList");
  try {
    state.adminConversations = await adminApi("/admin/conversas");
    target.innerHTML = state.adminConversations.length
      ? state.adminConversations.map((conversation) => `
          <button class="admin-conversation-item ${Number(conversation.id_cli) === state.adminClientId ? "active" : ""}" type="button" data-admin-client="${Number(conversation.id_cli)}">
            <strong>${escapeHTML(conversation.nome)}</strong>
            <small>${escapeHTML(conversation.email)}</small>
            <span>${escapeHTML(conversation.ultima_mensagem)}</span>
          </button>`).join("")
      : '<p class="empty-state">Nenhuma mensagem recebida ainda.</p>';

    target.querySelectorAll("[data-admin-client]").forEach((button) => {
      button.addEventListener("click", () => {
        state.adminClientId = Number(button.dataset.adminClient);
        loadAdminConversations();
        loadAdminMessages();
      });
    });
  } catch (error) {
    target.innerHTML = `<p class="feedback">${escapeHTML(error.message)}</p>`;
  }
}

async function loadAdminMessages() {
  const conversation = state.adminConversations.find(
    (item) => Number(item.id_cli) === state.adminClientId,
  );
  if (!conversation) {
    $("adminConversation").classList.add("hidden");
    return;
  }

  $("adminConversation").classList.remove("hidden");
  $("adminConversationHeading").innerHTML = `
    <div><strong>${escapeHTML(conversation.nome)}</strong><small>${escapeHTML(conversation.email)}</small></div>`;
  try {
    const messages = await adminApi(
      `/admin/conversas/${state.adminClientId}/mensagens`,
    );
    $("adminMessages").innerHTML = messages.map((message) => `
      <div class="message ${message.remetente === "contratante" ? "sent" : "received"}">
        <strong>${message.remetente === "contratante" ? "Você" : escapeHTML(conversation.nome)} <small>${formatDate(message.data_envio)}</small></strong>
        <p>${escapeHTML(message.texto)}</p>
      </div>`).join("");
    $("adminMessages").scrollTop = $("adminMessages").scrollHeight;
  } catch (error) {
    $("adminMessages").innerHTML = `<p class="feedback">${escapeHTML(error.message)}</p>`;
  }
}

document.querySelectorAll("[data-screen]").forEach((element) => {
  element.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(element.dataset.screen);
  });
});

$("loginButton").addEventListener("click", () => openAuth());
$("adminRefreshButton").addEventListener("click", async () => {
  await loadAdminConversations();
  await loadAdminMessages();
});
$("adminProductForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("adminProductForm").querySelector("button[type=submit]");
  button.disabled = true;
  showFeedback("adminProductFeedback", "");
  try {
    const form = new FormData();
    form.append("titulo", $("adminProductTitle").value.trim());
    form.append("tamanho", $("adminProductSize").value.trim());
    form.append("preco_u", $("adminProductPrice").value);
    const photo = $("adminProductPhoto").files[0];
    if (photo) form.append("foto", photo);
    await adminApi("/catalogo", { method: "POST", body: form });
    $("adminProductForm").reset();
    showFeedback("adminProductFeedback", "Quadro adicionado à loja.");
    await loadCatalog();
  } catch (error) {
    showFeedback("adminProductFeedback", error.message);
  } finally {
    button.disabled = false;
  }
});
$("adminMessageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.adminClientId) return;
  const input = $("adminMessageInput");
  const text = input.value.trim();
  if (!text) return;
  try {
    await adminApi(`/admin/conversas/${state.adminClientId}/mensagens`, {
      method: "POST",
      body: JSON.stringify({ texto: text }),
    });
    input.value = "";
    await loadAdminConversations();
    await loadAdminMessages();
    showFeedback("adminMessageFeedback", "");
  } catch (error) {
    showFeedback("adminMessageFeedback", error.message);
  }
});
$("logoutButton").addEventListener("click", () => {
  if (isAdmin()) {
    logoutAdmin();
    return;
  }
  clearChatMessages();
  clearLocalSession();
  $("profileForm").reset();
  $("email").value = "";
  $("password").value = "";
  $("name").value = "";
  $("authFeedback").textContent = "";
  navigate("home");
});

document.querySelectorAll(".dialog-close").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

$("togglePassword").addEventListener("click", () => {
  $("password").type = $("password").type === "password" ? "text" : "password";
});

$("authSwitch").addEventListener("click", (event) => {
  if (event.target.tagName === "BUTTON") openAuth(!state.register);
});

$("recoverLink").addEventListener("click", async () => {
  const email = $("email").value;
  if (!email) return showFeedback("authFeedback", "Informe seu e-mail primeiro.");
  await api("/auth/recuperar", { method: "POST", body: JSON.stringify({ email }) });
  showFeedback("authFeedback", "Confira seu e-mail para recuperar o acesso.");
});

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api(state.register ? "/auth/register" : "/auth/login", {
      method: "POST",
      body: JSON.stringify({
        nome: state.register ? $("name").value : undefined,
        email: $("email").value,
        senha: $("password").value,
      }),
    });
    saveSession(data);
  } catch (error) {
    showFeedback("authFeedback", error.message);
  }
});

$("profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const client = await api("/perfil", {
      method: "PATCH",
      body: JSON.stringify({
        nome: $("profileName").value,
        telefone: $("profilePhone").value,
        CPF: $("profileCpf").value,
        numero_casa: $("profileHouseNumber").value,
        rua: $("profileStreet").value,
        bairro: $("profileNeighborhood").value,
        cep: $("profileCep").value,
      }),
    });
    state.client = client;
    localStorage.setItem("pinturas_client", JSON.stringify(client));
    updateHeader();
    showFeedback("profileFeedback", "Perfil atualizado.");
  } catch (error) {
    showFeedback("profileFeedback", error.message);
  }
});

$("profileAvatarButton").addEventListener("click", () => $("profilePhoto").click());

$("profilePhoto").addEventListener("change", async () => {
  const photo = $("profilePhoto").files[0];
  if (!photo) return;
  if (!state.token) return openAuth();

  const form = new FormData();
  form.append("foto", photo);
  try {
    const response = await fetch("/api/perfil/foto", {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
      body: form,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.erro || "Não foi possível atualizar a foto.");
    state.client = { ...state.client, foto: result.foto };
    localStorage.setItem("pinturas_client", JSON.stringify(state.client));
    updateHeader();
    showFeedback("profileFeedback", "Foto de perfil atualizada.");
  } catch (error) {
    showFeedback("profileFeedback", error.message);
  } finally {
    $("profilePhoto").value = "";
  }
});

$("chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.token) return openAuth();
  const input = $("chatInput");
  if (!input.value.trim()) return;
  try {
    await api("/chat", { method: "POST", body: JSON.stringify({ texto: input.value }) });
    input.value = "";
    loadChat();
  } catch (error) {
    alert(error.message);
  }
});

$("checkoutButton").addEventListener("click", checkoutCart);

$("trackingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const order = await api(`/pedidos/rastrear/${encodeURIComponent($("trackingCode").value)}`);
    $("trackingResult").innerHTML = `<p class="feedback">${escapeHTML(order.descricao_status)}. ${order.codigo_rastreamento ? `Código dos Correios: ${escapeHTML(order.codigo_rastreamento)}.` : "O código será informado quando o quadro for postado."} Previsão de entrega: ${formatDate(order.previsao_entrega)}.</p>`;
  } catch (error) {
    $("trackingResult").innerHTML = `<p class="feedback">${error.message}</p>`;
  }
});

restoreCart();
updateHeader();
renderCart();
loadCatalog();
loadOrders();
const [initialScreen, paymentReturn] = location.hash.replace("#", "").split("?");
navigate(initialScreen || "home");
if (paymentReturn) {
  const result = new URLSearchParams(paymentReturn).get("pagamento");
  if (result === "sucesso") {
    const checkout = JSON.parse(sessionStorage.getItem("pinturas_checkout_cart") || "null");
    if (checkout?.clientId === state.client?.Id_Cli) {
      state.cart = [];
      persistCart();
    }
    sessionStorage.removeItem("pinturas_checkout_cart");
    renderCart();
    loadOrders();
    showFeedback("checkoutFeedback", "Pagamento recebido. O pedido será atualizado após confirmação do Mercado Pago.");
  } else if (result === "pendente" || result === "falhou") {
    const checkout = JSON.parse(sessionStorage.getItem("pinturas_checkout_cart") || "null");
    if (checkout?.clientId === state.client?.Id_Cli && Array.isArray(checkout.items)) {
      state.cart = checkout.items;
      persistCart();
      renderCart();
    }
    sessionStorage.removeItem("pinturas_checkout_cart");
    showFeedback("checkoutFeedback", result === "pendente" ? "Pagamento pendente. Conclua ou confira as instruções do Mercado Pago." : "O pagamento não foi concluído. Você pode tentar novamente.");
  }
}