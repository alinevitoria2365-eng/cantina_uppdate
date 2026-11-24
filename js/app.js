  // ============================================================
// app.js - Lógica compartilhada do Sistema de Controle de Estoque e Pedidos
// ============================================================

// ===== DADOS INICIAIS =====
const DEFAULT_PRODUCTS = [
    { id: 1, nome: "Óleo", quantidade: 40, preco: 12.90 },
    { id: 2, nome: "Arroz", quantidade: 47, preco: 25.50 },
    { id: 3, nome: "Feijão", quantidade: 30, preco: 18.90 },
    { id: 4, nome: "Açúcar", quantidade: 25, preco: 8.50 },
    { id: 5, nome: "Café", quantidade: 20, preco: 15.00 },
    { id: 6, nome: "Macarrão", quantidade: 35, preco: 6.90 },
    { id: 7, nome: "Leite", quantidade: 50, preco: 7.50 },
    { id: 8, nome: "Farinha", quantidade: 28, preco: 5.90 },
    { id: 9, nome: "Carne Suína", quantidade: 30, preco: 28.00 },
    { id: 10, nome: "Batata", quantidade: 40, preco: 6.00 },
    { id: 11, nome: "Tomate", quantidade: 30, preco: 7.00 },
    { id: 12, nome: "Cebola", quantidade: 30, preco: 5.50 },
    { id: 13, nome: "Frango", quantidade: 35, preco: 19.50 },
    { id: 14, nome: "Repolho", quantidade: 25, preco: 4.00 },
    { id: 15, nome: "Cenoura", quantidade: 25, preco: 4.50 },
    { id: 16, nome: "Laranja", quantidade: 60, preco: 2.00 },
    { id: 17, nome: "Ovos", quantidade: 100, preco: 0.80 },
    { id: 18, nome: "Banana", quantidade: 60, preco: 2.50 },
    { id: 19, nome: "Molho de Tomate", quantidade: 30, preco: 4.20 }
];

const DEFAULT_ADMIN = { cpf: "12345678900", senha: "admin123" };
const DEFAULT_USER = { cpf: "98765432100", senha: "usuario123" };

// ===== INICIALIZAÇÃO DO localStorage =====
function initStorage() {
    if (!localStorage.getItem("products")) {
        localStorage.setItem("products", JSON.stringify(DEFAULT_PRODUCTS));
    } else {
        try {
            const current = JSON.parse(localStorage.getItem("products")) || [];
            const removidos = JSON.parse(localStorage.getItem("produtosRemovidos") || "[]");
            const removidosLower = removidos.map(r => String(r).toLowerCase().trim());
            let updated = false;
            DEFAULT_PRODUCTS.forEach(dp => {
                const foiRemovido = removidosLower.includes(dp.nome.toLowerCase().trim()) || removidos.includes(dp.id);
                if (!foiRemovido && !current.some(p => p.id === dp.id || p.nome.toLowerCase() === dp.nome.toLowerCase())) {
                    current.push(dp);
                    updated = true;
                }
            });
            if (updated) {
                localStorage.setItem("products", JSON.stringify(current));
            }
        } catch (e) {}
    }
    if (!localStorage.getItem("adminUser")) {
        localStorage.setItem("adminUser", JSON.stringify(DEFAULT_ADMIN));
    }
    if (!localStorage.getItem("usuarioUser")) {
        localStorage.setItem("usuarioUser", JSON.stringify(DEFAULT_USER));
    }
    if (!localStorage.getItem("cart")) {
        localStorage.setItem("cart", JSON.stringify([]));
    }
    if (!localStorage.getItem("orders")) {
        localStorage.setItem("orders", JSON.stringify([]));
    }
    if (!localStorage.getItem("movimentacoes")) {
        localStorage.setItem("movimentacoes", JSON.stringify([]));
    }
    if (!localStorage.getItem("logs")) {
        localStorage.setItem("logs", JSON.stringify([]));
    }
    if (!localStorage.getItem("baixasCardapio")) {
        localStorage.setItem("baixasCardapio", JSON.stringify([]));
    }
    if (!localStorage.getItem("cardapioDiaQuantidades")) {
        localStorage.setItem("cardapioDiaQuantidades", JSON.stringify({}));
    }
    if (!localStorage.getItem("cardapioQuantidadesMeta")) {
        localStorage.setItem("cardapioQuantidadesMeta", JSON.stringify({}));
    }
    if (!localStorage.getItem("cozinheiras")) {
        localStorage.setItem("cozinheiras", JSON.stringify([]));
    }
    if (!localStorage.getItem("cozinheirasRemovidas")) {
        localStorage.setItem("cozinheirasRemovidas", JSON.stringify([]));
    }
    if (!localStorage.getItem("produtosRemovidos")) {
        localStorage.setItem("produtosRemovidos", JSON.stringify([]));
    }
}

// ===== BAIXAS DO CARDÁPIO =====
function getBaixasCardapio() {
    const data = localStorage.getItem("baixasCardapio");
    return data ? JSON.parse(data) : [];
}

function saveBaixasCardapio(baixas) {
    localStorage.setItem("baixasCardapio", JSON.stringify(baixas));
}

function getUltimaBaixaDoDia(diaNome) {
    const baixas = getBaixasCardapio();
    const diaNorm = diaNome.toLowerCase().trim();
    for (let i = baixas.length - 1; i >= 0; i--) {
        if (baixas[i].diaNome && baixas[i].diaNome.toLowerCase().trim() === diaNorm) {
            return baixas[i];
        }
    }
    return null;
}

// ===== QUANTIDADES E SINCRONIZAÇÃO DO CARDÁPIO =====
function getCardapioQuantidades() {
    try {
        const data = localStorage.getItem("cardapioDiaQuantidades");
        return data ? JSON.parse(data) : {};
    } catch (e) {
        return {};
    }
}

function saveCardapioQuantidades(qtds, meta) {
    localStorage.setItem("cardapioDiaQuantidades", JSON.stringify(qtds));
    if (meta) {
        localStorage.setItem("cardapioQuantidadesMeta", JSON.stringify(meta));
    }
}

function getCardapioQuantidadesMeta() {
    try {
        const data = localStorage.getItem("cardapioQuantidadesMeta");
        return data ? JSON.parse(data) : {};
    } catch (e) {
        return {};
    }
}

function getCardapioUltimaAlteracao() {
    try {
        const data = localStorage.getItem("cardapioUltimaAlteracao");
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

function saveCardapioUltimaAlteracao(info) {
    localStorage.setItem("cardapioUltimaAlteracao", JSON.stringify(info));
}

// ===== LOGS DE ATIVIDADE (auditoria: acessos e alterações) =====
function getLogs() {
    const data = localStorage.getItem("logs");
    return data ? JSON.parse(data) : [];
}

function saveLogs(logs) {
    localStorage.setItem("logs", JSON.stringify(logs));
}

function getLoggedInName() {
    const tipo = getLoggedInType();
    if (tipo === "admin") {
        const nome = localStorage.getItem("adminNome");
        return nome ? nome : "Administrador";
    }
    if (tipo === "usuario") {
        const nome = localStorage.getItem("usuarioNome");
        return nome ? nome : "Usuário";
    }
    return "Visitante";
}

function registrarLog(acao, detalhes) {
    const logs = getLogs();
    const agora = new Date();
    logs.push({
        id: Date.now() + Math.random(),
        data: agora.toLocaleDateString("pt-BR"),
        hora: agora.toLocaleTimeString("pt-BR"),
        usuario: getLoggedInName(),
        acao: acao,          // "login" | "entrada" | "saida" | "pedido" | "aprovado" | "rejeitado" | "alteracao"
        detalhes: detalhes
    });
    saveLogs(logs);
}

// ===== PRODUTOS =====
function getProducts() {
    const data = localStorage.getItem("products");
    return data ? JSON.parse(data) : DEFAULT_PRODUCTS;
}

function saveProducts(products) {
    localStorage.setItem("products", JSON.stringify(products));
    notificarAtualizacaoEstoque();
}

const _estoqueCallbacks = [];
let _estoqueSyncInicializado = false;
let _estoqueBroadcastChannel = null;

function _executarCallbacksEstoque() {
    _estoqueCallbacks.forEach(cb => {
        try { cb(); } catch (e) {}
    });
}

function notificarAtualizacaoEstoque() {
    try {
        window.dispatchEvent(new CustomEvent("estoqueAtualizado"));
    } catch (e) {}
    try {
        if (typeof BroadcastChannel !== "undefined") {
            if (!_estoqueBroadcastChannel) {
                _estoqueBroadcastChannel = new BroadcastChannel("cantina_estoque");
            }
            _estoqueBroadcastChannel.postMessage({ tipo: "atualizado", ts: Date.now() });
        }
    } catch (e) {}
}

function _iniciarSincronizacaoEstoque() {
    if (_estoqueSyncInicializado) return;
    _estoqueSyncInicializado = true;

    window.addEventListener("storage", function(e) {
        if (e.key === "products" || e.key === "produtosRemovidos") {
            _executarCallbacksEstoque();
        }
    });

    window.addEventListener("estoqueAtualizado", _executarCallbacksEstoque);

    window.addEventListener("pageshow", function(e) {
        if (e.persisted) {
            _executarCallbacksEstoque();
        }
    });

    document.addEventListener("visibilitychange", function() {
        if (!document.hidden) {
            _executarCallbacksEstoque();
        }
    });

    window.addEventListener("focus", _executarCallbacksEstoque);

    try {
        if (typeof BroadcastChannel !== "undefined") {
            if (!_estoqueBroadcastChannel) {
                _estoqueBroadcastChannel = new BroadcastChannel("cantina_estoque");
            }
            _estoqueBroadcastChannel.addEventListener("message", function() {
                _executarCallbacksEstoque();
            });
        }
    } catch (e) {}
}

function registrarAtualizacaoEstoque(callback) {
    if (typeof callback !== "function") return;
    _iniciarSincronizacaoEstoque();
    if (!_estoqueCallbacks.includes(callback)) {
        _estoqueCallbacks.push(callback);
    }
}

function getProductById(id) {
    const products = getProducts();
    return products.find(p => p.id === parseInt(id));
}

// ===== MOVIMENTAÇÕES (entradas e saídas) =====
function getMovimentacoes() {
    const data = localStorage.getItem("movimentacoes");
    return data ? JSON.parse(data) : [];
}

function saveMovimentacoes(mov) {
    localStorage.setItem("movimentacoes", JSON.stringify(mov));
}

function registrarMovimentacao(tipo, produto, quantidade, motivo) {
    const mov = getMovimentacoes();
    mov.push({
        id: Date.now() + Math.random(),
        tipo: tipo,            // "entrada" | "saida"
        produto: produto,
        quantidade: quantidade,
        data: new Date().toLocaleString("pt-BR"),
        responsavel: getLoggedInName(),
        motivo: motivo || getLoggedInName()
    });
    saveMovimentacoes(mov);
}

// ===== HISTÓRICO DE PEDIDOS (usado pelos relatórios) =====
function getHistoricoPedidos() {
    return getOrders();
}

function updateProductQuantity(id, delta) {
    const products = getProducts();
    const index = products.findIndex(p => p.id === parseInt(id));
    if (index !== -1) {
        const newQty = products[index].quantidade + delta;
        if (newQty >= 0) {
            products[index].quantidade = newQty;
            saveProducts(products);
            return true;
        }
    }
    return false;
}

let _lastProductListArgs = null;
let _productListSyncRegistrado = false;

function renderProductList(containerId, mode = "view", showActions = true) {
    _lastProductListArgs = { containerId, mode, showActions };
    if (!_productListSyncRegistrado) {
        _productListSyncRegistrado = true;
        registrarAtualizacaoEstoque(function() {
            if (_lastProductListArgs) {
                const { containerId: cid, mode: m, showActions: sa } = _lastProductListArgs;
                if (document.getElementById(cid)) {
                    renderProductList(cid, m, sa);
                }
            }
        });
    }

    const products = getProducts();
    const container = document.getElementById(containerId);
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <p>Nenhum produto cadastrado</p>
            </div>
        `;
        return;
    }

    let html = '<ul class="product-list">';
    products.forEach(p => {
        html += `
            <li class="product-item" data-id="${p.id}">
                <div class="product-info">
                    <span class="product-name">${p.nome}</span>
                    <span class="product-qty">Qtd: <strong id="qty-${p.id}">${p.quantidade}</strong><span id="qty-preview-${p.id}"></span></span>
                </div>
                <div class="product-actions">
        `;

if (mode === "entrada") {
            html += getQtyControlHTML(p.id, mode, "btn-primary");
} else if (mode === "saida") {
            html += getQtyControlHTML(p.id, mode, "btn-danger");
        } else if (mode === "pedido") {
            html += getQtyControlHTML(p.id, mode, "btn-primary");
            html += `
                    <button class="btn btn-sm btn-success" onclick="addToCart(${p.id})" style="width:47px;height:47px;padding:0;">🛒</button>
            `;
        }

        html += `
                </div>
            </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
    if (mode === "entrada" || mode === "saida") {
        updateConfirmButton(mode);
    }
}

// ===== ALTERAÇÕES PENDENTES (estado temporário para controles + / - ) =====
let pendingChanges = {};

function getPendingQty(id, mode) {
    return pendingChanges[`${mode}-${id}`] || 0;
}

function setPendingQty(id, mode, qty) {
    if (mode === "entrada") {
        if (qty === 0 || isNaN(qty)) {
            delete pendingChanges[`${mode}-${id}`];
        } else {
            pendingChanges[`${mode}-${id}`] = qty;
        }
        return;
    }
    if (qty <= 0 || isNaN(qty)) {
        delete pendingChanges[`${mode}-${id}`];
    } else {
        pendingChanges[`${mode}-${id}`] = qty;
    }
}

function hasPendingChanges(mode) {
    return Object.keys(pendingChanges).some(key => {
        if (!key.startsWith(`${mode}-`)) return false;
        const val = pendingChanges[key];
        return mode === "entrada" ? val !== 0 : val > 0;
    });
}

function getMinPendingQty(id, mode) {
    if (mode === "entrada") {
        const p = getProductById(id);
        return p ? -Number(p.quantidade || 0) : 0;
    }
    return 0;
}

function updateQtyPreview(id, mode) {
    const previewEl = document.getElementById(`qty-preview-${id}`);
    if (!previewEl) return;
    if (mode !== "entrada") {
        previewEl.innerHTML = "";
        return;
    }
    const delta = getPendingQty(id, mode);
    if (delta === 0) {
        previewEl.innerHTML = "";
        return;
    }
    const p = getProductById(id);
    const atual = p ? Number(p.quantidade || 0) : 0;
    const nova = Math.max(0, atual + delta);
    const cor = delta < 0 ? "#c53030" : "#276749";
    const sinal = delta > 0 ? `+${delta}` : `${delta}`;
    previewEl.innerHTML = ` <span style="color:${cor};font-weight:700;">(${sinal} → ${nova})</span>`;
}

function resetPendingChanges() {
    pendingChanges = {};
    document.querySelectorAll('[id^="change-qty-"]').forEach(el => {
        if (el.tagName === 'INPUT') {
            el.value = '0';
        } else {
            el.textContent = '0';
        }
    });
    document.querySelectorAll('[id^="qty-preview-"]').forEach(el => {
        el.innerHTML = '';
    });
}

function setQtyElementDisplay(id, val) {
    const el = document.getElementById(`change-qty-${id}`);
    if (!el) return;
    if (el.tagName === 'INPUT') {
        el.value = val;
    } else {
        el.textContent = val;
    }
}

function changeQty(id, delta, mode) {
    const minVal = getMinPendingQty(id, mode);
    const newVal = getPendingQty(id, mode) + delta;
    if (newVal >= minVal) {
        setPendingQty(id, mode, newVal);
        setQtyElementDisplay(id, newVal);
        updateQtyPreview(id, mode);
        if (mode === "entrada" || mode === "saida") {
            updateConfirmButton(mode);
        }
    }
}

function setQtyFromInput(id, rawValue, mode) {
    if (rawValue === "" || rawValue === "-") {
        setPendingQty(id, mode, 0);
        updateQtyPreview(id, mode);
        if (mode === "entrada" || mode === "saida") {
            updateConfirmButton(mode);
        }
        return;
    }
    const minVal = getMinPendingQty(id, mode);
    const parsed = parseInt(rawValue, 10);
    const val = isNaN(parsed) ? 0 : Math.max(minVal, parsed);
    setPendingQty(id, mode, val);
    updateQtyPreview(id, mode);
    if (mode === "entrada" || mode === "saida") {
        updateConfirmButton(mode);
    }
}

function normalizeQtyInput(id, inputEl, mode) {
    const val = getPendingQty(id, mode);
    inputEl.value = val;
    updateQtyPreview(id, mode);
}

function getQtyControlHTML(id, mode, btnClass) {
    const currentVal = getPendingQty(id, mode);
    const minVal = getMinPendingQty(id, mode);
    const minusBtnClass = mode === "entrada" ? "btn-danger" : btnClass;
    return `
        <div class="qty-control">
            <button type="button" class="btn btn-sm ${minusBtnClass} btn-icon" onclick="changeQty(${id}, -1, '${mode}')" style="width:42px;height:42px;font-size:18px;" title="Diminuir quantidade">−</button>
            <input type="number" id="change-qty-${id}" class="qty-input" value="${currentVal}" min="${minVal}" aria-label="Quantidade" oninput="setQtyFromInput(${id}, this.value, '${mode}')" onblur="normalizeQtyInput(${id}, this, '${mode}')">
            <button type="button" class="btn btn-sm ${btnClass} btn-icon" onclick="changeQty(${id}, 1, '${mode}')" style="width:42px;height:42px;font-size:18px;" title="Aumentar quantidade">+</button>
        </div>
    `;
}

function updateConfirmButton(mode) {
    const btnId = mode === "entrada" ? "confirm-entrada-btn" : "confirm-saida-btn";
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = !hasPendingChanges(mode);
}

// ===== ENTRADA (ADICIONAR ESTOQUE) =====
function adicionarNovoItemEstoque(nome, quantidade, preco = 0) {
    const nomeLimpo = String(nome || "").trim();
    if (!nomeLimpo) {
        return { ok: false, erro: "Informe o nome do item." };
    }

    const qtdNum = parseInt(quantidade, 10);
    const qtdFinal = isNaN(qtdNum) || qtdNum < 0 ? 0 : qtdNum;
    const precoNum = parseFloat(preco);
    const precoFinal = isNaN(precoNum) || precoNum < 0 ? 0 : precoNum;

    const products = getProducts();
    const existente = products.find(p => p.nome.toLowerCase().trim() === nomeLimpo.toLowerCase());
    if (existente) {
        return { ok: false, erro: `O item "${existente.nome}" já está cadastrado no estoque.` };
    }

    const novoId = products.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
    const novoProduto = {
        id: novoId,
        nome: nomeLimpo,
        quantidade: qtdFinal,
        preco: precoFinal
    };

    products.push(novoProduto);
    saveProducts(products);

    try {
        const removidos = JSON.parse(localStorage.getItem("produtosRemovidos") || "[]")
            .filter(r => String(r).toLowerCase().trim() !== nomeLimpo.toLowerCase());
        localStorage.setItem("produtosRemovidos", JSON.stringify(removidos));
    } catch (e) {}

    if (qtdFinal > 0) {
        registrarMovimentacao("entrada", nomeLimpo, qtdFinal, "Cadastro e entrada inicial");
        registrarLog("entrada", `Cadastrou o item "${nomeLimpo}" com entrada inicial de ${qtdFinal} unidade(s)`);
    } else {
        registrarLog("alteracao", `Cadastrou novo item no estoque: "${nomeLimpo}"`);
    }

    return { ok: true, produto: novoProduto };
}

function removerItemEstoque(id) {
    if (getLoggedInType() !== "admin") {
        return { ok: false, erro: "Apenas o administrador pode remover itens do estoque." };
    }

    const products = getProducts();
    const idNum = parseInt(id, 10);
    const produto = products.find(p => p.id === idNum);
    if (!produto) {
        return { ok: false, erro: "Item não encontrado no estoque." };
    }

    try {
        const removidos = JSON.parse(localStorage.getItem("produtosRemovidos") || "[]");
        const nomeLower = produto.nome.toLowerCase().trim();
        if (!removidos.some(r => String(r).toLowerCase().trim() === nomeLower || r === produto.id)) {
            removidos.push(produto.nome);
            localStorage.setItem("produtosRemovidos", JSON.stringify(removidos));
        }
    } catch (e) {}

    const atualizados = products.filter(p => p.id !== idNum);
    saveProducts(atualizados);

    registrarLog("alteracao", `Removeu o item "${produto.nome}" do estoque (saldo anterior: ${produto.quantidade} un.)`);
    return { ok: true, produto };
}

// ===== SAÍDA (REMOVER ESTOQUE) =====
function removeStock(id) {
    const qty = getPendingQty(id, "saida");
    if (qty <= 0) {
        alert("Selecione uma quantidade para remover.");
        return;
    }
    const product = getProductById(id);
    if (qty > product.quantidade) {
        alert(`Quantidade insuficiente! Estoque atual: ${product.quantidade}`);
        return;
    }
    if (updateProductQuantity(id, -qty)) {
        const updated = getProductById(id);
        const qtyEl = document.getElementById(`qty-${id}`);
        if (qtyEl) qtyEl.textContent = updated.quantidade;
        setPendingQty(id, "saida", 0);
        setQtyElementDisplay(id, 0);
        updateConfirmButton("saida");
        showToast(`${product.nome}: -${qty} unidades removidas!`);
    } else {
        alert("Erro ao remover estoque.");
    }
}

// ===== CONFIRMAR ENTRADA / EDIÇÃO DE ESTOQUE (aumentar e diminuir) =====
function confirmEntrada() {
    if (!hasPendingChanges("entrada")) {
        alert("Nenhuma alteração para confirmar.");
        return;
    }

    const products = getProducts();
    const applied = [];
    products.forEach(p => {
        const qty = getPendingQty(p.id, "entrada");
        if (qty > 0 && updateProductQuantity(p.id, qty)) {
            registrarMovimentacao("entrada", p.nome, qty, "Entrada / Edição de estoque");
            applied.push({ produto: p, qty });
        } else if (qty < 0 && updateProductQuantity(p.id, qty)) {
            const qtdReduzida = Math.abs(qty);
            registrarMovimentacao("saida", p.nome, qtdReduzida, "Redução / Edição de estoque");
            applied.push({ produto: p, qty });
        }
    });

    if (applied.length > 0) {
        let totalAdded = 0;
        let totalRemoved = 0;
        applied.forEach(a => {
            if (a.qty > 0) {
                totalAdded += a.qty;
                registrarLog("entrada", `Entrada de ${a.qty} unidade(s) do produto "${a.produto.nome}" no estoque`);
            } else if (a.qty < 0) {
                const absQty = Math.abs(a.qty);
                totalRemoved += absQty;
                registrarLog("saida", `Redução de ${absQty} unidade(s) do produto "${a.produto.nome}" na edição de estoque`);
            }
        });

        const partes = [];
        if (totalAdded > 0) partes.push(`+${totalAdded} adicionada(s)`);
        if (totalRemoved > 0) partes.push(`-${totalRemoved} reduzida(s)`);
        showToast(`✅ Estoque atualizado! ${partes.join(" e ")}.`);
        resetPendingChanges();
        renderProductList("product-list", "entrada");
    } else {
        alert("Erro ao confirmar alterações no estoque.");
    }
}

// ===== CONFIRMAR SAÍDA =====
function confirmSaida() {
    if (!hasPendingChanges("saida")) {
        alert("Nenhuma alteração para confirmar.");
        return;
    }

    const products = getProducts();
    const applied = [];
    let error = false;

    products.forEach(p => {
        const qty = getPendingQty(p.id, "saida");
        if (qty > 0) {
            if (qty <= p.quantidade) {
                updateProductQuantity(p.id, -qty);
                registrarMovimentacao("saida", p.nome, qty, "Saída manual");
                applied.push({ produto: p, qty });
            } else {
                error = true;
                alert(`Estoque insuficiente para ${p.nome}! Disponível: ${p.quantidade}`);
            }
        }
    });

    if (error) return;

    const totalRemoved = applied.reduce((sum, a) => sum + a.qty, 0);
    if (totalRemoved > 0) {
        // Registrar alterações no histórico de atividades
        applied.forEach(a => {
            registrarLog("saida", `Saída de ${a.qty} unidade(s) do produto "${a.produto.nome}" do estoque`);
        });
        showToast(`✅ Saída confirmada! ${totalRemoved} unidades removidas do estoque.`);
        resetPendingChanges();
        renderProductList("product-list", "saida");
    } else {
        alert("Nenhuma alteração para confirmar.");
    }
}

// ===== CARRINHO =====
function getCart() {
    const data = localStorage.getItem("cart");
    return data ? JSON.parse(data) : [];
}

function saveCart(cart) {
    localStorage.setItem("cart", JSON.stringify(cart));
}

function addToCart(id) {
    const qty = getPendingQty(id, "pedido");
    if (qty <= 0) {
        alert("Selecione uma quantidade para adicionar ao carrinho.");
        return;
    }

    const product = getProductById(id);
    if (!product) return;

    if (qty > product.quantidade) {
        alert(`Estoque insuficiente para ${product.nome}! Disponível: ${product.quantidade}`);
        return;
    }

    let cart = getCart();
    const existingIndex = cart.findIndex(item => item.id === product.id);

    if (existingIndex !== -1) {
        cart[existingIndex].quantidade += qty;
    } else {
        cart.push({ id: product.id, nome: product.nome, quantidade: qty, preco: product.preco });
    }

    saveCart(cart);
    setPendingQty(id, "pedido", 0);
    const changeEl = document.getElementById(`change-qty-${id}`);
    if (changeEl) changeEl.textContent = '0';

    updateCartBadge();
    showToast(`🛒 ${product.nome}: +${qty} no carrinho!`);
}

function updateCartBadge() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.quantidade, 0);
    let badge = document.getElementById("cart-badge");
    if (!badge) {
        badge = document.createElement("div");
        badge.id = "cart-badge";
        badge.className = "cart-badge";
        document.body.appendChild(badge);
    }
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? "flex" : "none";
}

function renderCartList(containerId) {
    const cart = getCart();
    const container = document.getElementById(containerId);
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🛒</div>
                <p>Carrinho vazio</p>
                <p style="font-size:13px;margin-top:8px;">Adicione produtos pelo estoque da cozinha</p>
            </div>
        `;
        return;
    }

    let html = '<ul class="product-list">';
    cart.forEach(item => {
        html += `
            <li class="cart-item">
                <div class="item-detail">
                    <span class="item-name">${item.nome}</span>
                    <span class="item-qty">Qtd: ${item.quantidade}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <button class="btn btn-sm btn-danger" onclick="removeFromCart(${item.id})" style="width:36px;height:36px;padding:0;">🗑️</button>
                </div>
            </li>`;
    });
    html += '</ul>';

    container.innerHTML = html;
}

function removeFromCart(id) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== id);
    saveCart(cart);
    renderCartList("cart-list");
    updateCartBadge();
    showToast("Item removido do carrinho.");
}

function confirmarPedido() {
    const cart = getCart();
    if (cart.length === 0) {
        alert("Carrinho vazio! Adicione produtos antes de confirmar.");
        return;
    }

    // Verificar se há estoque suficiente
    let success = true;
    cart.forEach(item => {
        const product = getProductById(item.id);
        if (!product || product.quantidade < item.quantidade) {
            success = false;
            alert(`Estoque insuficiente para ${item.nome}! Disponível: ${product ? product.quantidade : 0}`);
        }
    });

    if (!success) return;

    // Salvar como pedido pendente (sem dar baixa no estoque automaticamente)
    const total = cart.reduce((sum, item) => sum + (item.quantidade * item.preco), 0);
    const novoPedido = {
        id: Date.now(),
        data: new Date().toLocaleString("pt-BR"),
        itens: JSON.parse(JSON.stringify(cart)),
        total: total,
        status: "pendente" // pendente | aprovado | rejeitado
    };

    const orders = getOrders();
    orders.push(novoPedido);
    saveOrders(orders);

    // Registrar pedido no histórico de atividades
    registrarLog("pedido", `Confirmou o pedido #${novoPedido.id} (${cart.map(item => `${item.nome} x${item.quantidade}`).join(', ')}) - Total: R$ ${total.toFixed(2)}`);

    showToast(`✅ Pedido #${novoPedido.id} enviado para o administrador!`);
    saveCart([]);
    updateCartBadge();

    const container = document.getElementById("cart-list");
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <p>Pedido enviado com sucesso!</p>
                <p style="font-size:13px;margin-top:8px;">Aguardando aprovação do administrador.</p>
                <p style="font-size:13px;color:#1a4fbf;">Nº do Pedido: #${novoPedido.id}</p>
            </div>
        `;
    }
}

// ===== PEDIDOS (ORDERS) =====
function getOrders() {
    const data = localStorage.getItem("orders");
    return data ? JSON.parse(data) : [];
}

function saveOrders(orders) {
    localStorage.setItem("orders", JSON.stringify(orders));
}

function getOrderById(id) {
    const orders = getOrders();
    return orders.find(o => o.id === parseInt(id));
}

function approveOrder(orderId) {
    const orders = getOrders();
    const index = orders.findIndex(o => o.id === parseInt(orderId));
    if (index === -1) return false;

    const order = orders[index];
    
    // Dar baixa no estoque
    let success = true;
    order.itens.forEach(item => {
        const product = getProductById(item.id);
        if (!product || product.quantidade < item.quantidade) {
            success = false;
            alert(`Estoque insuficiente para ${item.nome}! Disponível: ${product ? product.quantidade : 0}`);
        }
    });

    if (!success) return false;

    order.itens.forEach(item => {
        updateProductQuantity(item.id, -item.quantidade);
        registrarMovimentacao("saida", item.nome, item.quantidade, `Pedido #${orderId}`);
    });

    order.status = "aprovado";
    saveOrders(orders);
    // Registrar aprovação no histórico de atividades
    registrarLog("aprovado", `Aprovou o pedido #${orderId} e deu baixa no estoque`);
    showToast(`✅ Pedido #${orderId} aprovado! Estoque atualizado.`);
    return true;
}

function rejectOrder(orderId) {
    const orders = getOrders();
    const index = orders.findIndex(o => o.id === parseInt(orderId));
    if (index === -1) return false;

    orders[index].status = "rejeitado";
    saveOrders(orders);
    // Registrar rejeição no histórico de atividades
    registrarLog("rejeitado", `Rejeitou o pedido #${orderId}`);
    showToast(`❌ Pedido #${orderId} rejeitado.`);
    return true;
}

function updateOrderItem(orderId, productId, newQty) {
    const orders = getOrders();
    const orderIndex = orders.findIndex(o => o.id === parseInt(orderId));
    if (orderIndex === -1) return false;

    const order = orders[orderIndex];
    const itemIndex = order.itens.findIndex(i => i.id === parseInt(productId));
    if (itemIndex === -1) return false;

    // Capturar nome do item antes de qualquer alteração (para o log)
    const nomeItem = order.itens[itemIndex].nome;

    if (newQty <= 0) {
        order.itens.splice(itemIndex, 1);
    } else {
        order.itens[itemIndex].quantidade = newQty;
    }

    // Recalcular total
    order.total = order.itens.reduce((sum, item) => sum + (item.quantidade * item.preco), 0);
    saveOrders(orders);
    // Registrar alteração no histórico de atividades
    registrarLog("alteracao", `Alterou o item "${nomeItem}" do pedido #${orderId} para quantidade ${newQty <= 0 ? "0 (removido)" : newQty}`);
    showToast(`✏️ Pedido #${orderId} atualizado.`);
    return true;
}

function removeOrderItem(orderId, productId) {
    return updateOrderItem(orderId, productId, 0);
}

function renderAdminOrderList(containerId) {
    const orders = getOrders();
    const container = document.getElementById(containerId);
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>Nenhum pedido recebido</p>
                <p style="font-size:13px;margin-top:8px;">Os pedidos dos usuários aparecerão aqui</p>
            </div>
        `;
        return;
    }

    // Ordenar: pendentes primeiro, depois por data mais recente
    const sorted = [...orders].sort((a, b) => {
        if (a.status === "pendente" && b.status !== "pendente") return -1;
        if (a.status !== "pendente" && b.status === "pendente") return 1;
        return b.id - a.id;
    });

    let html = '';
    sorted.forEach(order => {
        const statusClass = order.status === "aprovado" ? "status-approved" : 
                            order.status === "rejeitado" ? "status-rejected" : "status-pending";
        const statusLabel = order.status === "aprovado" ? "✅ Aprovado" :
                            order.status === "rejeitado" ? "❌ Rejeitado" : "⏳ Pendente";

        html += `
            <div class="order-card" style="background:#f7fafc;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #e2e8f0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <strong style="font-size:16px;color:#2d3748;">Pedido #${order.id}</strong>
                    <span class="${statusClass}" style="font-size:13px;padding:4px 10px;border-radius:20px;font-weight:600;">${statusLabel}</span>
                </div>
                <div style="font-size:13px;color:#718096;margin-bottom:8px;">📅 ${order.data}</div>
                <div style="font-size:13px;color:#4a5568;margin-bottom:4px;">
                    ${order.itens.map(item => `${item.nome} x${item.quantidade}`).join(', ')}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                    <strong style="color:#2d3748;">Total: R$ ${order.total.toFixed(2)}</strong>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-outline" onclick="showOrderDetail(${order.id})" style="padding:6px 12px;font-size:12px;">👁️ Detalhes</button>
        `;

        if (order.status === "pendente") {
            html += `
                        <button class="btn btn-sm btn-success" onclick="if(confirm('Aprovar pedido #${order.id}?')){approveOrder(${order.id});renderAdminOrderList('${containerId}');}" style="padding:6px 12px;font-size:12px;">✅ Aprovar</button>
                        <button class="btn btn-sm btn-danger" onclick="if(confirm('Rejeitar pedido #${order.id}?')){rejectOrder(${order.id});renderAdminOrderList('${containerId}');}" style="padding:6px 12px;font-size:12px;">❌ Rejeitar</button>
            `;
        }

        html += `
                    </div>
                </div>
            </div>`;
    });

    container.innerHTML = html;
}

function showOrderDetail(orderId) {
    const order = getOrderById(orderId);
    if (!order) {
        alert("Pedido não encontrado.");
        return;
    }

    const container = document.getElementById("order-detail");
    if (!container) return;

    // Esconder a lista e mostrar o detalhe
    document.getElementById("order-list-container").style.display = "none";
    document.getElementById("order-detail-container").style.display = "block";

    const statusClass = order.status === "aprovado" ? "status-approved" : 
                        order.status === "rejeitado" ? "status-rejected" : "status-pending";
    const statusLabel = order.status === "aprovado" ? "✅ Aprovado" :
                        order.status === "rejeitado" ? "❌ Rejeitado" : "⏳ Pendente";

    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="color:#2d3748;font-size:18px;">Pedido #${order.id}</h3>
            <span class="${statusClass}" style="font-size:13px;padding:4px 10px;border-radius:20px;font-weight:600;">${statusLabel}</span>
        </div>
        <div style="font-size:13px;color:#718096;margin-bottom:16px;">📅 ${order.data}</div>
        <ul class="product-list">
    `;

    order.itens.forEach((item, idx) => {
        const product = getProductById(item.id);
        const stockAvailable = product ? product.quantidade : 0;
        html += `
            <li class="cart-item" style="background:#f7fafc;border-radius:12px;padding:14px 16px;margin-bottom:8px;border:1px solid #e2e8f0;">
                <div class="item-detail">
                    <span class="item-name" style="font-weight:600;color:#2d3748;">${item.nome}</span>
                    <span class="item-qty" style="font-size:14px;color:#718096;">
                        Qtd: <strong>${item.quantidade}</strong> | 
                        R$ ${item.preco.toFixed(2)} | 
                        Sub: R$ ${(item.quantidade * item.preco).toFixed(2)}
                    </span>
                    <span style="font-size:12px;color:#718096;">📦 Estoque: ${stockAvailable} unidades</span>
                </div>
        `;

        if (order.status === "pendente") {
            html += `
                <div style="display:flex;align-items:center;gap:6px;margin-top:8px;">
                    <button class="btn btn-sm btn-outline" onclick="alterarItemPedido(${order.id}, ${item.id}, -1)" style="width:32px;height:32px;padding:0;font-size:16px;">−</button>
                    <span style="font-weight:600;min-width:20px;text-align:center;">${item.quantidade}</span>
                    <button class="btn btn-sm btn-outline" onclick="alterarItemPedido(${order.id}, ${item.id}, 1)" style="width:32px;height:32px;padding:0;font-size:16px;">+</button>
                    <button class="btn btn-sm btn-danger" onclick="if(confirm('Remover ${item.nome} do pedido?')){removeOrderItem(${order.id}, ${item.id});showOrderDetail(${order.id});}" style="width:32px;height:32px;padding:0;font-size:14px;margin-left:4px;">🗑️</button>
                </div>
            `;
        }

        html += `</li>`;
    });

    html += '</ul>';

    html += `
        <div class="cart-total" style="background:linear-gradient(135deg,#1a4fbf,#12305c);border-radius:12px;padding:16px;color:#fff;margin-top:16px;">
            <span style="font-size:16px;font-weight:500;">Total do Pedido</span>
            <span style="font-size:20px;font-weight:700;">R$ ${order.total.toFixed(2)}</span>
        </div>
    `;

    if (order.status === "pendente") {
        html += `
            <div style="display:flex;gap:12px;margin-top:16px;">
                <button class="btn btn-success" onclick="if(confirm('Aprovar pedido #${order.id}?')){approveOrder(${order.id});showOrderDetail(${order.id});}" style="flex:1;">✅ Aprovar</button>
                <button class="btn btn-danger" onclick="if(confirm('Rejeitar pedido #${order.id}?')){rejectOrder(${order.id});voltarListaPedidos();}" style="flex:1;">❌ Rejeitar</button>
            </div>
        `;
    }

    html += `
        <div style="margin-top:16px;text-align:center;">
            <button class="btn btn-outline" onclick="voltarListaPedidos()" style="display:inline-flex;width:auto;">← Voltar para lista</button>
        </div>
    `;

    container.innerHTML = html;
}

function alterarItemPedido(orderId, productId, delta) {
    const order = getOrderById(orderId);
    if (!order) return;

    const item = order.itens.find(i => i.id === parseInt(productId));
    if (!item) return;

    const newQty = item.quantidade + delta;
    if (newQty < 0) return;

    if (updateOrderItem(orderId, productId, newQty)) {
        showOrderDetail(orderId);
    }
}

function voltarListaPedidos() {
    document.getElementById("order-list-container").style.display = "block";
    document.getElementById("order-detail-container").style.display = "none";
    renderAdminOrderList("order-list");
}

// Lista oficial de colaboradoras da cantina / cozinha
const LISTA_USUARIOS = ["Fátima", "Ana", "Elaine", "Lúcia", "Lurdes"];

function getListaUsuarios() {
    return LISTA_USUARIOS;
}

// Lista oficial de administradoras da cantina / gestão
const LISTA_ADMINS = ["Rita", "Maria", "Roberta"];

function getListaAdmins() {
    return LISTA_ADMINS;
}

// ===== LOGIN =====
function fazerLogin(cpf, senha, tipo, nomeUsuario) {
    if (tipo === "usuario") {
        const nomeFinal = nomeUsuario || localStorage.getItem("usuarioNome") || "Usuário";
        localStorage.setItem("loggedIn", "usuario");
        localStorage.setItem("usuarioNome", nomeFinal);
        localStorage.setItem("ultimoUsuarioLogado", nomeFinal);
        const agora = new Date();
        const logs = getLogs();
        logs.push({
            id: Date.now() + Math.random(),
            data: agora.toLocaleDateString("pt-BR"),
            hora: agora.toLocaleTimeString("pt-BR"),
            usuario: nomeFinal,
            acao: "login",
            detalhes: "Entrou no sistema"
        });
        saveLogs(logs);
        return true;
    }

    if (tipo === "admin") {
        const nomeFinal = nomeUsuario || localStorage.getItem("adminNome") || "Administrador";
        localStorage.setItem("loggedIn", "admin");
        localStorage.setItem("adminNome", nomeFinal);
        localStorage.removeItem("usuarioNome");
        const agora = new Date();
        const logs = getLogs();
        logs.push({
            id: Date.now() + Math.random(),
            data: agora.toLocaleDateString("pt-BR"),
            hora: agora.toLocaleTimeString("pt-BR"),
            usuario: nomeFinal,
            acao: "login",
            detalhes: "Entrou no sistema (Gestão)"
        });
        saveLogs(logs);
        return true;
    }
    return false;
}

function isLoggedIn() {
    return localStorage.getItem("loggedIn") !== null;
}

function getLoggedInType() {
    return localStorage.getItem("loggedIn");
}

function logout() {
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("usuarioNome");
    localStorage.removeItem("adminNome");
    localStorage.removeItem("cart");
    showToast("👋 Sessão encerrada.");
    const isSubfolder = window.location.pathname.includes("/admin/") || window.location.pathname.includes("/usuario/");
    window.location.href = isSubfolder ? "../index.html" : "index.html";
}

// ===== TOAST NOTIFICATION =====
function showToast(message) {
    const existing = document.querySelector(".toast-notification");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast-notification";
toast.innerHTML = message;
    const hasFixedBar = document.querySelector(".fixed-bottom-bar");
    toast.style.cssText = `
        position: fixed;
        bottom: ${hasFixedBar ? "96px" : "24px"};
        left: 50%;
        transform: translateX(-50%);
        background: #2d3748;
        color: #fff;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        z-index: 9999;
        animation: slideUp 0.3s ease;
        max-width: 90%;
        text-align: center;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s";
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ===== PERSISTÊNCIA DUPLA (localStorage + IndexedDB) =====
const CHAVES_PERSISTENTES = [
    "products",
    "produtosRemovidos",
    "movimentacoes",
    "logs",
    "orders",
    "baixasCardapio",
    "cardapioDiaQuantidades",
    "cardapioQuantidadesMeta",
    "cardapioData",
    "cardapioFixoData",
    "cardapioUltimaAlteracao",
    "cozinheiras",
    "cozinheirasRemovidas",
    "adminUser",
    "usuarioUser",
    "ultimoUsuarioLogado"
];

let _cantinaDbPromise = null;
let _restaurandoBackup = false;

function abrirCantinaDB() {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    if (_cantinaDbPromise) return _cantinaDbPromise;

    _cantinaDbPromise = new Promise(resolve => {
        try {
            const req = indexedDB.open("cantina_persistencia_db", 1);
            req.onupgradeneeded = function(e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("dados")) {
                    db.createObjectStore("dados", { keyPath: "chave" });
                }
            };
            req.onsuccess = function(e) {
                resolve(e.target.result);
            };
            req.onerror = function() {
                resolve(null);
            };
        } catch (e) {
            resolve(null);
        }
    });
    return _cantinaDbPromise;
}

function salvarBackupIndexedDB(chave, valor) {
    if (_restaurandoBackup || !CHAVES_PERSISTENTES.includes(chave)) return;
    abrirCantinaDB().then(db => {
        if (!db) return;
        try {
            const tx = db.transaction("dados", "readwrite");
            tx.objectStore("dados").put({ chave: chave, valor: valor, atualizadoEm: Date.now() });
        } catch (e) {}
    });
}

function backupTudoIndexedDB() {
    abrirCantinaDB().then(db => {
        if (!db) return;
        try {
            const tx = db.transaction("dados", "readwrite");
            const store = tx.objectStore("dados");
            CHAVES_PERSISTENTES.forEach(chave => {
                const val = localStorage.getItem(chave);
                if (val !== null) {
                    store.put({ chave: chave, valor: val, atualizadoEm: Date.now() });
                }
            });
        } catch (e) {}
    });
}

function restaurarBackupIndexedDB(chavesAusentesAntes) {
    const ausentesSet = new Set(Array.isArray(chavesAusentesAntes) ? chavesAusentesAntes : []);
    return abrirCantinaDB().then(db => {
        if (!db) return false;
        return new Promise(resolve => {
            try {
                const tx = db.transaction("dados", "readonly");
                const req = tx.objectStore("dados").getAll();
                req.onsuccess = function() {
                    const registros = req.result || [];
                    let restaurouAlgo = false;
                    _restaurandoBackup = true;
                    try {
                        registros.forEach(item => {
                            if (item && CHAVES_PERSISTENTES.includes(item.chave) && item.valor != null) {
                                const atual = localStorage.getItem(item.chave);
                                if (atual === null || ausentesSet.has(item.chave)) {
                                    localStorage.setItem(item.chave, item.valor);
                                    restaurouAlgo = true;
                                }
                            }
                        });
                    } finally {
                        _restaurandoBackup = false;
                    }
                    resolve(restaurouAlgo);
                };
                req.onerror = function() { resolve(false); };
            } catch (e) {
                resolve(false);
            }
        });
    });
}

(function instalarInterceptadorPersistencia() {
    if (typeof window === "undefined" || typeof Storage === "undefined") return;
    try {
        const originalSetItem = Storage.prototype.setItem;
        if (!originalSetItem._cantinaPatched) {
            Storage.prototype.setItem = function(key, value) {
                originalSetItem.apply(this, arguments);
                if (this === window.localStorage) {
                    salvarBackupIndexedDB(String(key), String(value));
                }
            };
            Storage.prototype.setItem._cantinaPatched = true;
        }
    } catch (e) {}

    window.addEventListener("pagehide", backupTudoIndexedDB);
    window.addEventListener("beforeunload", backupTudoIndexedDB);
})();

// ===== INIT ON PAGE LOAD =====
document.addEventListener("DOMContentLoaded", function() {
    const chavesAusentesAntes = CHAVES_PERSISTENTES.filter(k => localStorage.getItem(k) === null);
    initStorage();
    updateCartBadge();
    if (navigator.storage && typeof navigator.storage.persist === "function") {
        navigator.storage.persist().catch(function() {});
    }
    restaurarBackupIndexedDB(chavesAusentesAntes).then(restaurou => {
        if (restaurou) {
            _executarCallbacksEstoque();
            if (typeof atualizarNotificacoesSininho === "function") atualizarNotificacoesSininho();
            if (typeof atualizarBadgesMenu === "function") atualizarBadgesMenu();
        }
        backupTudoIndexedDB();
    });
});



// ===== COZINHEIRAS (cadastro, remoção e exibição no login) =====
const COZINHEIRAS_PADRAO = ["Ana Maria", "Rose", "Paula", "Fabiana"];

function lerListaStorage(chave) {
    try {
        const data = localStorage.getItem(chave);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function getCozinheiras() {
    return lerListaStorage("cozinheiras");
}

function saveCozinheiras(arr) {
    localStorage.setItem("cozinheiras", JSON.stringify(arr));
}

function getCozinheirasRemovidas() {
    return lerListaStorage("cozinheirasRemovidas");
}

function saveCozinheirasRemovidas(arr) {
    localStorage.setItem("cozinheirasRemovidas", JSON.stringify(arr));
}

function nomeDaCozinheira(c) {
    return ((typeof c === "string" ? c : (c && c.nome)) || "").trim();
}

function getCozinheirasAtivas() {
    const removidas = getCozinheirasRemovidas().map(n => n.toLowerCase());
    const ativas = [];
    const vistos = new Set();

    COZINHEIRAS_PADRAO.forEach(nome => {
        const key = nome.toLowerCase();
        if (!removidas.includes(key) && !vistos.has(key)) {
            vistos.add(key);
            ativas.push({ nome: nome, padrao: true });
        }
    });

    getCozinheiras().forEach(c => {
        const nome = nomeDaCozinheira(c);
        if (!nome) return;
        const key = nome.toLowerCase();
        if (!removidas.includes(key) && !vistos.has(key)) {
            vistos.add(key);
            ativas.push({ nome: nome, padrao: false });
        }
    });

    return ativas;
}

function adicionarCozinheira(nome) {
    const nomeLimpo = (nome || "").trim();
    if (!nomeLimpo) {
        throw new Error("Informe o nome da cozinheira");
    }
    if (getCozinheirasAtivas().some(c => c.nome.toLowerCase() === nomeLimpo.toLowerCase())) {
        throw new Error("Já existe uma cozinheira cadastrada com este nome");
    }

    const removidas = getCozinheirasRemovidas().filter(n => n.toLowerCase() !== nomeLimpo.toLowerCase());
    saveCozinheirasRemovidas(removidas);

    const ehPadrao = COZINHEIRAS_PADRAO.some(n => n.toLowerCase() === nomeLimpo.toLowerCase());
    if (!ehPadrao) {
        const lista = getCozinheiras();
        lista.push({ nome: nomeLimpo });
        saveCozinheiras(lista);
    }

    registrarLog("alteracao", `Cadastrou nova cozinheira: "${nomeLimpo}"`);
}

function removerCozinheira(nome) {
    const nomeLimpo = (nome || "").trim();
    if (!nomeLimpo) return false;

    const lista = getCozinheiras().filter(c => nomeDaCozinheira(c).toLowerCase() !== nomeLimpo.toLowerCase());
    saveCozinheiras(lista);

    const removidas = getCozinheirasRemovidas();
    if (!removidas.some(n => n.toLowerCase() === nomeLimpo.toLowerCase())) {
        removidas.push(nomeLimpo);
        saveCozinheirasRemovidas(removidas);
    }

    registrarLog("alteracao", `Removeu a cozinheira: "${nomeLimpo}"`);
    return true;
}

function renderCozinheirasExtras(containerId, selectId, onSelectFnName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const select = selectId ? document.getElementById(selectId) : null;
    const removidas = getCozinheirasRemovidas().map(n => n.toLowerCase());

    // Esconde as cozinheiras removidas pelo administrador
    Array.from(container.querySelectorAll(".cv-user-card")).forEach(el => {
        const nomeCard = (el.getAttribute("data-nome") || "").trim().toLowerCase();
        if (removidas.includes(nomeCard)) el.remove();
    });
    if (select) {
        Array.from(select.options).forEach(opt => {
            if (opt.value && removidas.includes(opt.value.trim().toLowerCase())) opt.remove();
        });
    }

    // Adiciona as cozinheiras cadastradas
    getCozinheiras().forEach(c => {
        const nome = nomeDaCozinheira(c);
        if (!nome || removidas.includes(nome.toLowerCase())) return;

        const jaExiste = Array.from(container.querySelectorAll(".cv-user-card"))
            .some(el => (el.getAttribute("data-nome") || "").toLowerCase() === nome.toLowerCase());
        if (jaExiste) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cv-user-card";
        btn.setAttribute("data-nome", nome);
        btn.addEventListener("click", function() {
            if (typeof window[onSelectFnName] === "function") {
                window[onSelectFnName](nome, btn);
            }
        });

        btn.innerHTML = `
            <div class="cv-user-avatar">
                <span class="cv-user-initial"></span>
                <span class="cv-user-badge">👩‍🍳</span>
            </div>
            <div class="cv-user-info">
                <span class="cv-user-name"></span>
                <span class="cv-user-sub">Colaboradora da Cozinha</span>
            </div>
            <div class="cv-user-indicator">
                <span class="cv-user-radio">
                    <svg class="cv-check-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </span>
                <span class="cv-user-arrow">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1a4fbf" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 L16 12 L9 18"/></svg>
                </span>
            </div>
        `;
        btn.querySelector(".cv-user-initial").textContent = nome.charAt(0).toUpperCase();
        btn.querySelector(".cv-user-name").textContent = nome;
        container.appendChild(btn);

        if (select && !Array.from(select.options).some(o => o.value.toLowerCase() === nome.toLowerCase())) {
            const opt = document.createElement("option");
            opt.value = nome;
            opt.textContent = nome;
            select.appendChild(opt);
        }
    });
}

// ===== MENSAGEM DE BOAS-VINDAS (retângulo azul) =====
function showWelcomeBanner(nome, callback) {
    const existing = document.querySelector(".cv-welcome-rect");
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.className = "cv-welcome-rect";
    banner.textContent = `Bem-vinda ${nome}!`;
    banner.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a4fbf 0%, #12305c 100%);
        color: #ffffff;
        padding: 20px 36px;
        border-radius: 14px;
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 22px;
        font-weight: 700;
        box-shadow: 0 16px 40px rgba(18, 48, 92, 0.45);
        border: 2px solid rgba(255, 255, 255, 0.28);
        z-index: 10000;
        text-align: center;
        min-width: 240px;
        max-width: 90vw;
    `;
    document.body.appendChild(banner);

    if (typeof callback === "function") {
        setTimeout(callback, 1100);
    }
}
