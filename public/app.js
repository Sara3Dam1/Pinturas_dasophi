const state = {
  token: localStorage.getItem("pinturas_token"),
  client: JSON.parse(localStorage.getItem("pinturas_client") || "null"),
  cart: JSON.parse(localStorage.getItem("pinturas_cart") || "[]"),
  register: false,
};

const $ = (id) => document.getElementById(id);

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
  if (!response.ok) throw new Error(data.erro || "Ocorreu um erro.");
  return data;
};

function navigate(screen) {
  document.querySelectorAll(".screen").forEach((element) => {
    element.classList.toggle("active", element.id === `screen-${screen}`);
  });
  document.querySelectorAll("[data-screen]").forEach((element) => {
    element.classList.toggle("active-link", element.dataset.screen === screen);
  });
  history.replaceState(null, "", `#${screen}`);

  if (screen === "cart") {
    loadOrders();
    renderCart();
  }
  if (screen === "chat" && state.token) loadChat();
  if (screen === "profile") loadProfile();
}

function updateHeader() {
  $("loginButton").classList.toggle("hidden", Boolean(state.token));
  $("logoutButton").classList.toggle("hidden", !state.token);
  $("profileButton").classList.toggle("hidden", !state.token);
  if (state.client) {
    const initial = state.client.nome?.[0]?.toUpperCase() || "S";
    $("profileButton").textContent = initial;
    $("profileInitial").textContent = initial;
  }
}

function showFeedback(id, message) {
  $(id).textContent = message;
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
  state.token = data.token;
  state.client = data.cliente;
  localStorage.setItem("pinturas_token", state.token);
  localStorage.setItem("pinturas_client", JSON.stringify(state.client));
  updateHeader();
  $("authDialog").close();
  navigate("profile");
  loadOrders();
  loadChat();
}

function formatDate(value) {
  return new Date(value.replace(" ", "T")).toLocaleDateString("pt-BR");
}

async function loadCatalog() {
  const catalog = await api("/catalogo");
  $("catalogGrid").innerHTML = catalog
    .map(
      (item, index) => `
        <article class="art-card">
          <div class="art-image ${["one", "two", "three"][index % 3]}">
            <div class="art-frame">${item.titulo.split(" ")[0]}</div>
          </div>
          <div class="art-card-info">
            <div>
              <h3>${item.titulo}</h3>
              <small>${item.tamanho || "tamanho sob consulta"} · ${item.des_material || "tela"}</small>
            </div>
            <button class="order-button" data-add-cart="${item.id_quadro}">Adicionar</button>
          </div>
        </article>`,
    )
    .join("");

  document.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.addCart, catalog));
  });
}

function addToCart(id, catalog) {
  const item = catalog.find((entry) => String(entry.id_quadro) === String(id));
  if (!item || state.cart.some((entry) => entry.id_quadro === item.id_quadro)) {
    navigate("cart");
    return;
  }

  state.cart.push(item);
  localStorage.setItem("pinturas_cart", JSON.stringify(state.cart));
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
              <div class="cart-thumb"><span>${item.titulo.split(" ")[0]}</span></div>
              <div class="cart-info"><strong>${item.titulo}</strong><small>${item.tamanho || "tamanho sob consulta"} · original da artista</small></div>
              <button class="remove-button" data-remove-cart="${item.id_quadro}" title="Remover do carrinho">×</button>
            </div>`,
        )
        .join("")
    : '<div class="empty-state">Seu carrinho está vazio.<br />Encontre uma peça original na loja.</div>';
  $("cartFooter").classList.toggle("hidden", !state.cart.length);
  $("cartTotal").textContent = state.cart.length;

  document.querySelectorAll("[data-remove-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      state.cart = state.cart.filter((item) => String(item.id_quadro) !== button.dataset.removeCart);
      localStorage.setItem("pinturas_cart", JSON.stringify(state.cart));
      renderCart();
    });
  });
}

async function checkoutCart() {
  if (!state.token) {
    openAuth();
    return;
  }
  if (!state.cart.length) return;

  try {
    const orders = [];
    for (const item of state.cart) {
      orders.push(await api("/pedidos", {
        method: "POST",
        body: JSON.stringify({ id_qua: item.id_quadro }),
      }));
    }
    state.cart = [];
    localStorage.setItem("pinturas_cart", JSON.stringify(state.cart));
    renderCart();
    await loadOrders();
    alert(`Pedido criado. Código: ${orders[0].codigo_rastreamento}`);
  } catch (error) {
    alert(error.message);
  }
}

async function loadOrders() {
  if (!state.token) {
    $("ordersList").textContent = "Entre para visualizar seus pedidos.";
    return;
  }
  try {
    const orders = await api("/pedidos");
    $("ordersList").innerHTML = orders.length
      ? orders.map((order) => `
          <div class="order-row">
            <div><strong>${order.titulo}</strong><small>${order.codigo_rastreamento || "sem código"} · ${order.previsao_entrega ? `previsão ${formatDate(order.previsao_entrega)}` : "em análise"}</small></div>
            <span class="order-status">${order.descricao_status}<br /><button class="dialog-link feedback-action" data-feedback="${order.id_ped}">Avaliar</button></span>
          </div>`).join("")
      : '<div class="empty-state">Você ainda não tem pedidos.<br />Finalize uma compra para começar.</div>';
    document.querySelectorAll("[data-feedback]").forEach((button) => {
      button.addEventListener("click", () => sendFeedback(button.dataset.feedback));
    });
  } catch (error) {
    $("ordersList").textContent = error.message;
  }
}

async function sendFeedback(id) {
  const rating = Number(prompt("De 1 a 5, qual sua avaliação?"));
  if (!rating) return;
  const comment = prompt("Conte um pouco sobre sua experiência:") || "";
  try {
    await api(`/pedidos/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify({ avaliacao: rating, comentario: comment }),
    });
    alert("Obrigada pela avaliação.");
  } catch (error) {
    alert(error.message);
  }
}

async function loadChat() {
  if (!state.token) return;
  const messages = await api("/chat");
  $("messages").innerHTML = messages
    .map((message) => `
      <div class="message ${message.remetente === "cliente" ? "sent" : "received"}">
        <strong>${message.remetente === "cliente" ? state.client.nome : "Sophi"} <small>${formatDate(message.data_envio)}</small></strong>
        <p>${message.texto}</p>
      </div>`)
    .join("");
  $("messages").scrollTop = $("messages").scrollHeight;
}

async function loadProfile() {
  if (!state.token) {
    openAuth();
    return;
  }
  const profile = await api("/perfil");
  $("profileName").value = profile.nome || "";
  $("profilePhone").value = profile.telefone || "";
  $("profileStreet").value = profile.rua || "";
  $("profileNeighborhood").value = profile.bairro || "";
}

document.querySelectorAll("[data-screen]").forEach((element) => {
  element.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(element.dataset.screen);
  });
});

$("loginButton").addEventListener("click", () => openAuth());
$("logoutButton").addEventListener("click", () => {
  state.token = null;
  state.client = null;
  localStorage.removeItem("pinturas_token");
  localStorage.removeItem("pinturas_client");
  updateHeader();
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
        rua: $("profileStreet").value,
        bairro: $("profileNeighborhood").value,
      }),
    });
    const photo = $("profilePhoto").files[0];
    if (photo) {
      const form = new FormData();
      form.append("foto", photo);
      await fetch("/api/perfil/foto", {
        method: "POST",
        headers: { Authorization: `Bearer ${state.token}` },
        body: form,
      });
    }
    state.client = client;
    localStorage.setItem("pinturas_client", JSON.stringify(client));
    updateHeader();
    showFeedback("profileFeedback", "Perfil atualizado.");
  } catch (error) {
    showFeedback("profileFeedback", error.message);
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
    $("trackingResult").innerHTML = `<p class="feedback">${order.descricao_status}. Previsão de entrega: ${formatDate(order.previsao_entrega)}.</p>`;
  } catch (error) {
    $("trackingResult").innerHTML = `<p class="feedback">${error.message}</p>`;
  }
});

updateHeader();
renderCart();
loadCatalog();
loadOrders();
navigate(location.hash.replace("#", "") || "home");