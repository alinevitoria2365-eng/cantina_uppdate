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
const DEFAULT_COZINHEIRAS = ["Ana Maria", "Rose", "Paula", "Fabiana"];
const LISTA_ADMINS = ["Rita", "Maria", "Roberta"];

const SYNC_PREFIX = "__CANTINA_SYNC__:";
const SYNC_KEYS = [
    "cantina_updated_at",
    "cantina_auth_updated_at",
    "cozinheiras", "cozinheirasExtras", "cozinheirasRemovidas",
    "products", "movimentacoes", "orders", "logs", "cart",
    "baixasCardapio", "cardapioDiaQuantidades", "cardapioQuantidadesMeta",
    "cardapioData", "cardapioUltimaAlteracao", "ultimaAlteracaoSistema",
    "loggedIn", "adminNome", "usuarioNome"
];

const ARRAY_MERGE_KEYS = ["logs", "movimentacoes", "orders", "baixasCardapio"];
const STATE_DATA_KEYS = [
    "products", "cardapioData", "cardapioDiaQuantidades",
    "cardapioQuantidadesMeta", "cardapioUltimaAlteracao", "ultimaAlteracaoSistema",
    "cozinheirasRemovidas"
];
const AUTH_KEYS = ["loggedIn", "adminNome", "usuarioNome", "cart"];

let cantinaBroadcastChannel = null;
try {
    if (typeof BroadcastChannel !== "undefined") {
        cantinaBroadcastChannel = new BroadcastChannel("cantina_sync_channel");
        cantinaBroadcastChannel.onmessage = function(ev) {
            if (ev && ev.data && ev.data.type === "CANTINA_BROADCAST_STATE" && ev.data.state) {
                aplicarEstadoRecebido(ev.data.state, false);
            }
        };
    }
} catch (e) {}

// ===== COOKIES DE BACKUP (PERSISTÊNCIA EXTRA ENTRE SESSÕES) =====
function salvarCookieBackup(nome, valorObj) {
    try {
        const str = encodeURIComponent(JSON.stringify(valorObj));
        document.cookie = nome + "=" + str + "; path=/; max-age=31536000; SameSite=Lax";
    } catch (e) {}
}

function lerCookieBackup(nome) {
    try {
        const regex = new RegExp("(?:^|;\\s*)" + nome + "=([^;]+)");
        const match = document.cookie.match(regex);
        if (match && match[1]) {
            return JSON.parse(decodeURIComponent(match[1]));
        }
    } catch (e) {}
    return null;
}

function salvarBackupEstoqueCookie() {
    try {
        const ts = parseInt(localStorage.getItem("cantina_updated_at") || "0", 10);
        const prods = JSON.parse(localStorage.getItem("products") || "[]");
        const compactProds = prods.map(p => ({
            id: p.id,
            q: p.quantidade,
            u: p.ultimaAlteracao || null
        }));
        salvarCookieBackup("cantina_stock_bkp", { ts: ts, p: compactProds });
    } catch (e) {}
}

function restaurarBackupEstoqueCookieSeMaisRecente() {
    try {
        const bkp = lerCookieBackup("cantina_stock_bkp");
        if (!bkp || !bkp.ts || !Array.isArray(bkp.p)) return;
        const localTs = parseInt(localStorage.getItem("cantina_updated_at") || "0", 10);
        if (bkp.ts > localTs) {
            const baseProds = JSON.parse(localStorage.getItem("products") || "null") || JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
            bkp.p.forEach(item => {
                const idx = baseProds.findIndex(p => p.id === item.id);
                if (idx !== -1 && typeof item.q === "number") {
                    baseProds[idx].quantidade = item.q;
                    if (item.u) baseProds[idx].ultimaAlteracao = item.u;
                }
            });
            localStorage.setItem("products", JSON.stringify(baseProds));
            localStorage.setItem("cantina_updated_at", String(bkp.ts));
        }
    } catch (e) {}
}

// ===== LEITURA E ESCRITA DE ESTADO COMPLETO =====
function obterSnapshotLocalStorage() {
    const snap = {};
    try {
        SYNC_KEYS.forEach(k => {
            const val = localStorage.getItem(k);
            if (val !== null && val !== undefined) {
                snap[k] = val;
            }
        });
    } catch (e) {}
    return snap;
}

function lerEstadoWindowName() {
    try {
        if (typeof window !== "undefined" && typeof window.name === "string" && window.name.indexOf(SYNC_PREFIX) === 0) {
            return JSON.parse(window.name.slice(SYNC_PREFIX.length)) || {};
        }
    } catch (e) {}
    return {};
}

function mesclarArraysPorId(jsonA, jsonB) {
    let arrA = [];
    let arrB = [];
    try { arrA = JSON.parse(jsonA || "[]"); if (!Array.isArray(arrA)) arrA = []; } catch (e) { arrA = []; }
    try { arrB = JSON.parse(jsonB || "[]"); if (!Array.isArray(arrB)) arrB = []; } catch (e) { arrB = []; }

    if (arrA.length === 0) return arrB;
    if (arrB.length === 0) return arrA;

    const mapa = new Map();
    // Preferir a versão mais recente do mesmo ID (arrB sobrescreve arrA se atualizado)
    arrA.forEach(item => {
        if (item && item.id !== undefined) {
            mapa.set(String(item.id), item);
        }
    });
    arrB.forEach(item => {
        if (item && item.id !== undefined) {
            const key = String(item.id);
            const existente = mapa.get(key);
            if (!existente || (item.updatedAt || item.timestamp || 0) >= (existente.updatedAt || existente.timestamp || 0)) {
                mapa.set(key, item);
            }
        }
    });

    const unificado = Array.from(mapa.values());
    unificado.sort((a, b) => {
        const ta = a.timestamp || (typeof a.id === "number" ? a.id : 0);
        const tb = b.timestamp || (typeof b.id === "number" ? b.id : 0);
        return ta - tb;
    });
    return unificado;
}

function mesclarCozinheiras(estadoExterno) {
    try {
        const listasParaMesclar = [];
        try {
            const lsCoz = JSON.parse(localStorage.getItem("cozinheiras") || "null");
            if (Array.isArray(lsCoz)) listasParaMesclar.push(lsCoz);
        } catch (e) {}
        if (estadoExterno && estadoExterno.cozinheiras) {
            try {
                const extCoz = JSON.parse(estadoExterno.cozinheiras || "null");
                if (Array.isArray(extCoz)) listasParaMesclar.push(extCoz);
            } catch (e) {}
        }
        const ckCoz = lerCookieBackup("cantina_cozinheiras");
        if (Array.isArray(ckCoz)) listasParaMesclar.push(ckCoz);

        let removidas = [];
        try {
            const remLocal = JSON.parse(localStorage.getItem("cozinheirasRemovidas") || "[]") || [];
            const remExt = (estadoExterno && estadoExterno.cozinheirasRemovidas) ? (JSON.parse(estadoExterno.cozinheirasRemovidas) || []) : [];
            removidas = Array.from(new Set([...remLocal, ...remExt]));
        } catch (e) {
            removidas = [];
        }

        const unificada = [];
        const adicionarSeNaoExiste = (nome) => {
            const limpo = (nome || "").trim();
            if (!limpo) return;
            if (removidas.some(r => r.toLowerCase() === limpo.toLowerCase())) return;
            if (!unificada.some(u => u.toLowerCase() === limpo.toLowerCase())) {
                unificada.push(limpo);
            }
        };

        DEFAULT_COZINHEIRAS.forEach(adicionarSeNaoExiste);
        listasParaMesclar.forEach(lista => lista.forEach(adicionarSeNaoExiste));

        if (unificada.length > 0) {
            const jsonUnificada = JSON.stringify(unificada);
            localStorage.setItem("cozinheiras", jsonUnificada);
            salvarCookieBackup("cantina_cozinheiras", unificada);
        }
    } catch (e) {}
}

function aplicarEstadoRecebido(extState, dispararRefresh = true) {
    if (!extState || typeof extState !== "object") return false;
    let houveMudanca = false;
    try {
        const localTs = parseInt(localStorage.getItem("cantina_updated_at") || "0", 10);
        const extTs = parseInt(extState.cantina_updated_at || "0", 10);

        const localAuthTs = parseInt(localStorage.getItem("cantina_auth_updated_at") || "0", 10);
        const extAuthTs = parseInt(extState.cantina_auth_updated_at || "0", 10);

        // 1. Mesclar coleções de histórico por ID para nunca perder logs, movimentações, pedidos ou baixas
        ARRAY_MERGE_KEYS.forEach(k => {
            if (extState[k] !== undefined && extState[k] !== null) {
                const atualStr = localStorage.getItem(k);
                const mesclado = (extTs >= localTs)
                    ? mesclarArraysPorId(atualStr, extState[k])
                    : mesclarArraysPorId(extState[k], atualStr);
                const novoStr = JSON.stringify(mesclado);
                if (novoStr !== atualStr) {
                    localStorage.setItem(k, novoStr);
                    houveMudanca = true;
                }
            }
        });

        // 2. Atualizar dados de estado se o estado externo for mais recente (ou se o local ainda não existir)
        if (extTs > localTs) {
            STATE_DATA_KEYS.forEach(k => {
                if (extState[k] !== undefined && extState[k] !== null) {
                    if (localStorage.getItem(k) !== extState[k]) {
                        localStorage.setItem(k, extState[k]);
                        houveMudanca = true;
                    }
                }
            });
            localStorage.setItem("cantina_updated_at", String(extTs));
            houveMudanca = true;
        } else if (localTs === 0 && extTs === 0) {
            STATE_DATA_KEYS.forEach(k => {
                if (!localStorage.getItem(k) && extState[k] !== undefined && extState[k] !== null) {
                    localStorage.setItem(k, extState[k]);
                    houveMudanca = true;
                }
            });
        }

        // 3. Atualizar dados de autenticação/sessão se mais recentes
        if (extAuthTs > localAuthTs) {
            AUTH_KEYS.forEach(k => {
                if (extState[k] !== undefined && extState[k] !== null) {
                    localStorage.setItem(k, extState[k]);
                } else {
                    localStorage.removeItem(k);
                }
            });
            localStorage.setItem("cantina_auth_updated_at", String(extAuthTs));
            houveMudanca = true;
        } else if (localAuthTs === 0 && extAuthTs === 0) {
            AUTH_KEYS.forEach(k => {
                if (!localStorage.getItem(k) && extState[k]) {
                    localStorage.setItem(k, extState[k]);
                }
            });
        }

        // 4. Mesclar cozinheiras
        mesclarCozinheiras(extState);

        // Atualizar window.name com o estado consolidado
        const consolidado = obterSnapshotLocalStorage();
        window.name = SYNC_PREFIX + JSON.stringify(consolidado);

        if (houveMudanca && dispararRefresh) {
            dispararAtualizacaoTelas();
        }
    } catch (e) {}
    return houveMudanca;
}

function salvarEstadoWindowName(marcarAlteracaoDados = false, marcarAlteracaoAuth = false) {
    try {
        if (typeof window === "undefined") return;
        const agora = Date.now();
        if (marcarAlteracaoDados) {
            localStorage.setItem("cantina_updated_at", String(agora));
            salvarBackupEstoqueCookie();
        }
        if (marcarAlteracaoAuth) {
            localStorage.setItem("cantina_auth_updated_at", String(agora));
        }

        const state = obterSnapshotLocalStorage();
        window.name = SYNC_PREFIX + JSON.stringify(state);

        // Enviar para o Hub de persistência (iframe index.html) quando em subpasta
        enviarEstadoParaSyncHub(state);

        // Enviar via BroadcastChannel para outras abas abertas
        if (cantinaBroadcastChannel) {
            try {
                cantinaBroadcastChannel.postMessage({ type: "CANTINA_BROADCAST_STATE", state: state });
            } catch (e) {}
        }
    } catch (e) {}
}

function sincronizarStorageEntrePaginas() {
    try {
        restaurarBackupEstoqueCookieSeMaisRecente();
        const winState = lerEstadoWindowName();
        aplicarEstadoRecebido(winState, false);
    } catch (e) {}
}

// ===== HUB CENTRAL DE PERSISTÊNCIA ENTRE PASTAS (FUNCIONA EM file:// E http://) =====
let syncHubIframe = null;
let syncHubReady = false;
let pendingHubState = null;

function isSyncHubFrame() {
    try {
        return typeof window !== "undefined" && window.location && window.location.search.indexOf("sync_hub=1") !== -1;
    } catch (e) {
        return false;
    }
}

function inicializarSyncHub() {
    if (typeof window === "undefined") return;

    // Escutar mensagens de sincronização
    window.addEventListener("message", function(event) {
        const data = event.data;
        if (!data || typeof data !== "object") return;

        if (data.type === "CANTINA_HUB_SAVE" && data.state) {
            aplicarEstadoRecebido(data.state, !isSyncHubFrame());
            if (isSyncHubFrame() && event.source) {
                try {
                    event.source.postMessage({
                        type: "CANTINA_HUB_STATE",
                        state: obterSnapshotLocalStorage()
                    }, "*");
                } catch (e) {}
            }
        } else if (data.type === "CANTINA_HUB_PULL") {
            if (event.source) {
                try {
                    event.source.postMessage({
                        type: "CANTINA_HUB_STATE",
                        state: obterSnapshotLocalStorage()
                    }, "*");
                } catch (e) {}
            }
        } else if (data.type === "CANTINA_HUB_STATE" && data.state) {
            const localTs = parseInt(localStorage.getItem("cantina_updated_at") || "0", 10);
            const hubTs = parseInt(data.state.cantina_updated_at || "0", 10);
            aplicarEstadoRecebido(data.state, true);
            // Se o estado local era mais novo que o do hub, atualiza o hub também
            if (localTs > hubTs) {
                enviarEstadoParaSyncHub(obterSnapshotLocalStorage());
            }
        }
    });

    // Se este frame é o próprio hub oculto (index.html?sync_hub=1), envia seu estado imediatamente para a página pai
    if (isSyncHubFrame()) {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: "CANTINA_HUB_STATE",
                    state: obterSnapshotLocalStorage()
                }, "*");
            }
        } catch (e) {}
        return;
    }

    // Se estamos em /admin/ ou /usuario/, cria um iframe invisível para ../index.html?sync_hub=1
    const pathname = (window.location.pathname || "").replace(/\\/g, "/");
    const isSubfolder = pathname.indexOf("/admin/") !== -1 || pathname.indexOf("/usuario/") !== -1;
    if (!isSubfolder) return;

    const criarIframe = () => {
        if (document.getElementById("cantina-sync-hub-iframe")) return;
        if (!document.body) return;
        const iframe = document.createElement("iframe");
        iframe.id = "cantina-sync-hub-iframe";
        iframe.src = "../index.html?sync_hub=1";
        iframe.style.cssText = "display:none !important;width:0 !important;height:0 !important;border:0 !important;position:absolute;pointer-events:none;";
        iframe.setAttribute("aria-hidden", "true");
        iframe.onload = function() {
            syncHubReady = true;
            try {
                if (pendingHubState) {
                    iframe.contentWindow.postMessage({ type: "CANTINA_HUB_SAVE", state: pendingHubState }, "*");
                    pendingHubState = null;
                } else {
                    const localTs = parseInt(localStorage.getItem("cantina_updated_at") || "0", 10);
                    if (localTs > 0) {
                        iframe.contentWindow.postMessage({ type: "CANTINA_HUB_SAVE", state: obterSnapshotLocalStorage() }, "*");
                    } else {
                        iframe.contentWindow.postMessage({ type: "CANTINA_HUB_PULL" }, "*");
                    }
                }
            } catch (e) {}
        };
        document.body.appendChild(iframe);
        syncHubIframe = iframe;
    };

    if (document.body) {
        criarIframe();
    } else {
        document.addEventListener("DOMContentLoaded", criarIframe);
    }
}

function enviarEstadoParaSyncHub(state) {
    try {
        if (isSyncHubFrame()) return;
        if (syncHubIframe && syncHubReady && syncHubIframe.contentWindow) {
            syncHubIframe.contentWindow.postMessage({
                type: "CANTINA_HUB_SAVE",
                state: state || obterSnapshotLocalStorage()
            }, "*");
        } else {
            pendingHubState = state || obterSnapshotLocalStorage();
        }
    } catch (e) {}
}

// ===== INICIALIZAÇÃO DO localStorage =====
function initStorage() {
    sincronizarStorageEntrePaginas();
    if (!localStorage.getItem("products")) {
        localStorage.setItem("products", JSON.stringify(DEFAULT_PRODUCTS));
    } else {
        try {
            const current = JSON.parse(localStorage.getItem("products")) || [];
            let updated = false;
            DEFAULT_PRODUCTS.forEach(dp => {
                if (!current.some(p => p.id === dp.id || p.nome.toLowerCase() === dp.nome.toLowerCase())) {
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
        localStorage.setItem("cozinheiras", JSON.stringify(DEFAULT_COZINHEIRAS));
    }
    salvarEstadoWindowName(false, false);
}

// ===== BAIXAS DO CARDÁPIO =====
function getBaixasCardapio() {
    sincronizarStorageEntrePaginas();
    const data = localStorage.getItem("baixasCardapio");
    return data ? JSON.parse(data) : [];
}

function saveBaixasCardapio(baixas) {
    localStorage.setItem("baixasCardapio", JSON.stringify(baixas));
    salvarEstadoWindowName(true, false);
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
    salvarEstadoWindowName(true, false);
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
    salvarUltimaAlteracaoSistema(info);
    salvarEstadoWindowName(true, false);
}

function getUltimaAlteracaoSistema() {
    try {
        const data = localStorage.getItem("ultimaAlteracaoSistema");
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

function salvarUltimaAlteracaoSistema(info) {
    try {
        localStorage.setItem("ultimaAlteracaoSistema", JSON.stringify(info));
    } catch (e) {}
}

// ===== LOGS DE ATIVIDADE (auditoria: acessos e alterações) =====
function getLogs() {
    sincronizarStorageEntrePaginas();
    const data = localStorage.getItem("logs");
    return data ? JSON.parse(data) : [];
}

function saveLogs(logs) {
    localStorage.setItem("logs", JSON.stringify(logs));
    salvarEstadoWindowName(true, false);
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
    return localStorage.getItem("adminNome") || localStorage.getItem("usuarioNome") || "Usuário";
}

function getLoggedInPerfilLabel() {
    const tipo = getLoggedInType();
    if (tipo === "admin") return "Administrador";
    if (tipo === "usuario") return "Usuário";
    const nome = getLoggedInName();
    if (LISTA_ADMINS.includes(nome) || nome === "Administrador") return "Administrador";
    return "Usuário";
}

function isPerfilUsuario(nomeOuPerfil) {
    if (!nomeOuPerfil) return false;
    if (nomeOuPerfil === "Usuário" || nomeOuPerfil === "usuario") return true;
    if (nomeOuPerfil === "Administrador" || nomeOuPerfil === "admin" || LISTA_ADMINS.includes(nomeOuPerfil)) return false;
    return true;
}

function registrarLog(acao, detalhes, idFixo) {
    const logs = getLogs();
    const agora = new Date();
    const usuario = getLoggedInName();
    const perfil = getLoggedInPerfilLabel();
    const dataStr = agora.toLocaleDateString("pt-BR");
    const horaStr = agora.toLocaleTimeString("pt-BR");

    const novoLog = {
        id: idFixo || (Date.now() + Math.random()),
        timestamp: Date.now(),
        updatedAt: Date.now(),
        data: dataStr,
        hora: horaStr,
        usuario: usuario,
        perfil: perfil,
        acao: acao,          // "login" | "entrada" | "saida" | "pedido" | "aprovado" | "rejeitado" | "alteracao"
        detalhes: detalhes
    };

    if (idFixo) {
        const idx = logs.findIndex(l => String(l.id) === String(idFixo));
        if (idx !== -1) {
            logs[idx] = novoLog;
        } else {
            logs.push(novoLog);
        }
    } else {
        logs.push(novoLog);
    }

    if (acao !== "login") {
        salvarUltimaAlteracaoSistema({
            id: novoLog.id,
            timestamp: novoLog.timestamp,
            usuario: usuario,
            perfil: perfil,
            dataHora: `${dataStr} às ${horaStr}`,
            acao: acao,
            resumo: detalhes
        });
    }

    saveLogs(logs);
    return novoLog.id;
}

function removerLogPorId(idFixo) {
    if (!idFixo) return;
    const logs = getLogs().filter(l => String(l.id) !== String(idFixo));
    saveLogs(logs);
}

// ===== PRODUTOS =====
function getProducts() {
    sincronizarStorageEntrePaginas();
    const data = localStorage.getItem("products");
    return data ? JSON.parse(data) : JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
}

function saveProducts(products) {
    localStorage.setItem("products", JSON.stringify(products));
    salvarEstadoWindowName(true, false);
}

function getProductById(id) {
    const products = getProducts();
    return products.find(p => p.id === parseInt(id));
}

// ===== MOVIMENTAÇÕES (entradas e saídas) =====
function getMovimentacoes() {
    sincronizarStorageEntrePaginas();
    const data = localStorage.getItem("movimentacoes");
    return data ? JSON.parse(data) : [];
}

function saveMovimentacoes(mov) {
    localStorage.setItem("movimentacoes", JSON.stringify(mov));
    salvarEstadoWindowName(true, false);
}

function registrarMovimentacao(tipo, produto, quantidade, motivo, extra = {}) {
    const mov = getMovimentacoes();
    const idFixo = extra.idFixo;
    const registro = {
        id: idFixo || (Date.now() + Math.random()),
        timestamp: Date.now(),
        updatedAt: Date.now(),
        tipo: tipo,            // "entrada" | "saida"
        produto: produto,
        quantidade: quantidade,
        estoqueAnterior: extra.estoqueAnterior !== undefined ? extra.estoqueAnterior : undefined,
        estoqueAtual: extra.estoqueAtual !== undefined ? extra.estoqueAtual : undefined,
        data: new Date().toLocaleString("pt-BR"),
        responsavel: getLoggedInName(),
        perfil: getLoggedInPerfilLabel(),
        motivo: motivo || getLoggedInName()
    };

    if (idFixo) {
        const idx = mov.findIndex(m => String(m.id) === String(idFixo));
        if (idx !== -1) {
            mov[idx] = registro;
        } else {
            mov.push(registro);
        }
    } else {
        mov.push(registro);
    }

    saveMovimentacoes(mov);
    return registro.id;
}

function removerMovimentacaoPorId(idFixo) {
    if (!idFixo) return;
    const mov = getMovimentacoes().filter(m => String(m.id) !== String(idFixo));
    saveMovimentacoes(mov);
}

function obterTimestampMovimentacao(m) {
    if (!m) return 0;
    if (typeof m.timestamp === "number" && m.timestamp > 0) return m.timestamp;
    if (typeof m.id === "number" && m.id > 1000000000000) return Math.floor(m.id);
    if (typeof m.data === "string") {
        const match = m.data.match(/(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
        if (match) {
            const dia = parseInt(match[1], 10);
            const mes = parseInt(match[2], 10) - 1;
            const ano = parseInt(match[3], 10);
            const hora = parseInt(match[4] || "0", 10);
            const min = parseInt(match[5] || "0", 10);
            const seg = parseInt(match[6] || "0", 10);
            return new Date(ano, mes, dia, hora, min, seg).getTime();
        }
    }
    return 0;
}

function getMovimentacoesUltimosDias(dias = 7) {
    const mov = getMovimentacoes();
    const agora = Date.now();
    const limite = agora - (dias * 24 * 60 * 60 * 1000);
    return mov.filter(m => {
        const ts = obterTimestampMovimentacao(m);
        return ts >= limite && ts <= agora + 60000;
    });
}

// ===== HISTÓRICO DE PEDIDOS (usado pelos relatórios) =====
function getHistoricoPedidos() {
    return getOrders();
}

function updateProductQuantity(id, delta, metaInfo) {
    const products = getProducts();
    const index = products.findIndex(p => p.id === parseInt(id));
    if (index !== -1) {
        const oldQty = products[index].quantidade;
        const newQty = oldQty + delta;
        if (newQty >= 0) {
            const agora = new Date();
            products[index].quantidade = newQty;
            products[index].ultimaAlteracao = metaInfo || {
                delta: delta,
                estoqueAnterior: oldQty,
                estoqueAtual: newQty,
                usuario: getLoggedInName(),
                perfil: getLoggedInPerfilLabel(),
                data: agora.toLocaleDateString("pt-BR"),
                hora: agora.toLocaleTimeString("pt-BR"),
                timestamp: Date.now()
            };
            saveProducts(products);
            return true;
        }
    }
    return false;
}

function setProductQuantityDirect(id, newQty, oldQtyRef, deltaRef) {
    const products = getProducts();
    const index = products.findIndex(p => p.id === parseInt(id));
    if (index !== -1 && newQty >= 0) {
        const agora = new Date();
        products[index].quantidade = newQty;
        if (deltaRef !== 0) {
            products[index].ultimaAlteracao = {
                delta: deltaRef,
                estoqueAnterior: oldQtyRef,
                estoqueAtual: newQty,
                usuario: getLoggedInName(),
                perfil: getLoggedInPerfilLabel(),
                data: agora.toLocaleDateString("pt-BR"),
                hora: agora.toLocaleTimeString("pt-BR"),
                timestamp: Date.now()
            };
        }
        saveProducts(products);
        return true;
    }
    return false;
}

function formatarBadgeUltimaAlteracaoProduto(p) {
    if (!p || !p.ultimaAlteracao || !p.ultimaAlteracao.delta) return "";
    const u = p.ultimaAlteracao;
    const sinal = u.delta > 0 ? `+${u.delta}` : `${u.delta}`;
    const corBg = u.delta > 0 ? "#f0fff4" : "#fff5f5";
    const corBorda = u.delta > 0 ? "#c6f6d5" : "#fed7d7";
    const corTexto = u.delta > 0 ? "#276749" : "#c53030";
    const iconePerfil = isPerfilUsuario(u.perfil || u.usuario) ? "👩‍🍳" : "🛡️";
    return `
        <div style="margin-top:4px;font-size:11.5px;background:${corBg};border:1px solid ${corBorda};color:${corTexto};padding:3px 8px;border-radius:8px;display:inline-block;font-weight:600;">
            🔄 Última alteração: <strong>${sinal} un.</strong> (${u.estoqueAnterior} → ${u.estoqueAtual}) por ${iconePerfil} <strong>${u.usuario}</strong> (${u.data} às ${u.hora})
        </div>
    `;
}

// ===== SESSÃO DE AJUSTES EM TEMPO REAL (+ / -) =====
// Cada clique em (+) ou (−) nas telas de Entrada, Saída e Estoque já salva imediatamente no localStorage
// e atualiza o registro da sessão atual, garantindo que nada seja perdido mesmo se fechar o navegador!
let pendingChanges = {};
let sessionStockBatch = {}; // chave: `${mode}-${id}` -> { baseQty, delta, movId, logId }

function getPendingQty(id, mode) {
    return pendingChanges[`${mode}-${id}`] || 0;
}

function setPendingQty(id, mode, qty) {
    const key = `${mode}-${id}`;
    if (qty === 0) {
        delete pendingChanges[key];
    } else {
        pendingChanges[key] = qty;
    }
}

function hasPendingChanges(mode) {
    return Object.keys(pendingChanges).some(key => key.startsWith(`${mode}-`) && pendingChanges[key] !== 0);
}

function resetPendingChanges() {
    pendingChanges = {};
    sessionStockBatch = {};
    document.querySelectorAll('[id^="change-qty-"]').forEach(el => {
        el.textContent = '0';
    });
}

function aplicarAjusteTempoRealEstoque(id, novoValorControle, mode) {
    const key = `${mode}-${id}`;
    const prod = getProductById(id);
    if (!prod) return false;

    if (!sessionStockBatch[key]) {
        sessionStockBatch[key] = {
            baseQty: prod.quantidade,
            delta: 0,
            movId: "mov-sess-" + Date.now() + "-" + id + "-" + Math.random().toString(36).slice(2, 7),
            logId: "log-sess-" + Date.now() + "-" + id + "-" + Math.random().toString(36).slice(2, 7)
        };
    }

    const batch = sessionStockBatch[key];
    // No modo "saida", o controle mostra números positivos (1, 2, 3...) que representam retirada (-1, -2, -3...)
    const stockDelta = mode === "saida" ? -novoValorControle : novoValorControle;
    const novoEstoque = batch.baseQty + stockDelta;

    if (novoEstoque < 0) {
        alert(`Estoque insuficiente para ${prod.nome}! Disponível: ${batch.baseQty}`);
        return false;
    }

    batch.delta = stockDelta;
    setProductQuantityDirect(id, novoEstoque, batch.baseQty, stockDelta);

    const responsavel = getLoggedInName();
    const perfil = getLoggedInPerfilLabel();

    if (stockDelta === 0) {
        removerMovimentacaoPorId(batch.movId);
        removerLogPorId(batch.logId);
    } else if (stockDelta > 0) {
        const origem = mode === "estoque" ? `Ajuste no Estoque (${perfil})` : `Entrada de Estoque (${perfil})`;
        registrarMovimentacao("entrada", prod.nome, stockDelta, origem, {
            idFixo: batch.movId,
            estoqueAnterior: batch.baseQty,
            estoqueAtual: novoEstoque
        });
        registrarLog(
            "entrada",
            `${responsavel} (${perfil}) adicionou +${stockDelta} un. de "${prod.nome}" no estoque (Estoque: ${batch.baseQty} → ${novoEstoque})`,
            batch.logId
        );
    } else {
        const qtdSaida = Math.abs(stockDelta);
        const origem = mode === "estoque" ? `Ajuste no Estoque (${perfil})` : `Saída de Estoque (${perfil})`;
        registrarMovimentacao("saida", prod.nome, qtdSaida, origem, {
            idFixo: batch.movId,
            estoqueAnterior: batch.baseQty,
            estoqueAtual: novoEstoque
        });
        registrarLog(
            "saida",
            `${responsavel} (${perfil}) retirou -${qtdSaida} un. de "${prod.nome}" do estoque (Estoque: ${batch.baseQty} → ${novoEstoque})`,
            batch.logId
        );
    }

    // Atualizar elementos visuais na linha do produto
    const qtyEl = document.getElementById(`qty-${id}`);
    if (qtyEl) {
        qtyEl.textContent = novoEstoque;
    }
    const previewEl = document.getElementById(`preview-change-${id}`);
    if (previewEl) {
        if (stockDelta > 0) {
            previewEl.innerHTML = `<span style="color:#276749;font-weight:700;font-size:12px;background:#f0fff4;padding:2px 8px;border-radius:6px;border:1px solid #c6f6d5;">✅ Salvo: +${stockDelta} un. (${batch.baseQty} → ${novoEstoque})</span>`;
        } else if (stockDelta < 0) {
            previewEl.innerHTML = `<span style="color:#c53030;font-weight:700;font-size:12px;background:#fff5f5;padding:2px 8px;border-radius:6px;border:1px solid #fed7d7;">✅ Salvo: ${stockDelta} un. (${batch.baseQty} → ${novoEstoque})</span>`;
        } else {
            previewEl.innerHTML = "";
        }
    }

    return true;
}

function changeQty(id, delta, mode) {
    const atual = getPendingQty(id, mode);
    const newVal = atual + delta;

    if (mode === "pedido") {
        if (newVal >= 0) {
            const prod = getProductById(id);
            if (prod && newVal > prod.quantidade) {
                alert(`Estoque insuficiente para ${prod.nome}! Disponível: ${prod.quantidade}`);
                return;
            }
            setPendingQty(id, mode, newVal);
            const el = document.getElementById(`change-qty-${id}`);
            if (el) el.textContent = newVal;
        }
        return;
    }

    if (mode === "entrada" || mode === "saida") {
        if (newVal < 0) return;
        if (!aplicarAjusteTempoRealEstoque(id, newVal, mode)) return;
        setPendingQty(id, mode, newVal);
        const el = document.getElementById(`change-qty-${id}`);
        if (el) el.textContent = newVal > 0 && mode === "entrada" ? `+${newVal}` : newVal;
        updateConfirmButton(mode);
        return;
    }

    if (mode === "estoque") {
        if (!aplicarAjusteTempoRealEstoque(id, newVal, mode)) return;
        setPendingQty(id, mode, newVal);
        const el = document.getElementById(`change-qty-${id}`);
        if (el) el.textContent = newVal > 0 ? `+${newVal}` : newVal;
        updateConfirmButton(mode);
        return;
    }
}

function getQtyControlHTML(id, mode, btnClass) {
    const val = getPendingQty(id, mode);
    const displayVal = (val > 0 && (mode === "entrada" || mode === "estoque")) ? `+${val}` : val;
    return `
        <div class="qty-control">
            <button type="button" class="btn btn-sm ${btnClass} btn-icon" onclick="changeQty(${id}, -1, '${mode}')" style="width:42px;height:42px;font-size:18px;">−</button>
            <span id="change-qty-${id}">${displayVal}</span>
            <button type="button" class="btn btn-sm ${btnClass} btn-icon" onclick="changeQty(${id}, 1, '${mode}')" style="width:42px;height:42px;font-size:18px;">+</button>
        </div>
    `;
}

function updateConfirmButton(mode) {
    const btnId = mode === "entrada" ? "confirm-entrada-btn" : (mode === "saida" ? "confirm-saida-btn" : "confirm-estoque-btn");
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = !hasPendingChanges(mode);
}

function renderProductList(containerId, mode = "view", showActions = true) {
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
        const badgeUltimaAlt = formatarBadgeUltimaAlteracaoProduto(p);
        html += `
            <li class="product-item" data-id="${p.id}">
                <div class="product-info">
                    <span class="product-name">${p.nome}</span>
                    <span class="product-qty">Qtd em Estoque: <strong id="qty-${p.id}">${p.quantidade}</strong></span>
                    <div id="preview-change-${p.id}" style="margin-top:2px;"></div>
                    ${badgeUltimaAlt}
                </div>
                <div class="product-actions">
        `;

        if (mode === "entrada") {
            html += getQtyControlHTML(p.id, mode, "btn-primary");
        } else if (mode === "saida") {
            html += getQtyControlHTML(p.id, mode, "btn-danger");
        } else if (mode === "estoque") {
            html += getQtyControlHTML(p.id, mode, "btn-primary");
        } else if (mode === "pedido") {
            html += getQtyControlHTML(p.id, mode, "btn-primary");
            html += `
                    <button type="button" class="btn btn-sm btn-success" onclick="addToCart(${p.id})" title="Adicionar ao carrinho" style="width:47px;height:47px;padding:0;">🛒</button>
            `;
        }

        html += `
                </div>
            </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
    if (mode === "entrada" || mode === "saida" || mode === "estoque") {
        updateConfirmButton(mode);
    }
}

// ===== CONFIRMAR ENTRADA / SAÍDA / ESTOQUE =====
function confirmEntrada() {
    if (!hasPendingChanges("entrada")) {
        alert("Nenhuma alteração pendente para confirmar.");
        return;
    }

    const resumoItens = [];
    let totalAdded = 0;
    Object.keys(sessionStockBatch).forEach(key => {
        if (key.startsWith("entrada-")) {
            const id = parseInt(key.split("-")[1], 10);
            const batch = sessionStockBatch[key];
            const prod = getProductById(id);
            if (batch && batch.delta > 0 && prod) {
                totalAdded += batch.delta;
                resumoItens.push(`${prod.nome}: +${batch.delta} (${batch.baseQty} → ${prod.quantidade})`);
            }
        }
    });

    resetPendingChanges();
    renderProductList("product-list", "entrada");
    showToast(`✅ Entrada salva e confirmada! (${resumoItens.join(", ") || totalAdded + " un."})`);
}

function confirmSaida() {
    if (!hasPendingChanges("saida")) {
        alert("Nenhuma alteração pendente para confirmar.");
        return;
    }

    const resumoItens = [];
    let totalRemoved = 0;
    Object.keys(sessionStockBatch).forEach(key => {
        if (key.startsWith("saida-")) {
            const id = parseInt(key.split("-")[1], 10);
            const batch = sessionStockBatch[key];
            const prod = getProductById(id);
            if (batch && batch.delta < 0 && prod) {
                const qtd = Math.abs(batch.delta);
                totalRemoved += qtd;
                resumoItens.push(`${prod.nome}: -${qtd} (${batch.baseQty} → ${prod.quantidade})`);
            }
        }
    });

    resetPendingChanges();
    renderProductList("product-list", "saida");
    showToast(`✅ Saída salva e confirmada! (${resumoItens.join(", ") || totalRemoved + " un."})`);
}

function confirmEstoqueAjuste() {
    if (!hasPendingChanges("estoque")) {
        showToast("✅ Todas as quantidades já estão salvas no estoque!");
        return;
    }

    const resumoItens = [];
    Object.keys(sessionStockBatch).forEach(key => {
        if (key.startsWith("estoque-")) {
            const id = parseInt(key.split("-")[1], 10);
            const batch = sessionStockBatch[key];
            const prod = getProductById(id);
            if (batch && batch.delta !== 0 && prod) {
                const sinal = batch.delta > 0 ? `+${batch.delta}` : `${batch.delta}`;
                resumoItens.push(`${prod.nome}: ${sinal} (${batch.baseQty} → ${prod.quantidade})`);
            }
        }
    });

    resetPendingChanges();
    renderProductList("product-list", "estoque");
    showToast(`✅ Estoque atualizado e salvo! (${resumoItens.join(", ")})`);
}

// ===== CARRINHO =====
function getCart() {
    sincronizarStorageEntrePaginas();
    const data = localStorage.getItem("cart");
    return data ? JSON.parse(data) : [];
}

function saveCart(cart) {
    localStorage.setItem("cart", JSON.stringify(cart));
    salvarEstadoWindowName(false, true);
}

function addToCart(id) {
    const qty = getPendingQty(id, "pedido");
    if (qty <= 0) {
        alert("Selecione uma quantidade com (+) para adicionar ao carrinho.");
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

function adicionarPendentesAoCarrinhoEIr() {
    const products = getProducts();
    let cart = getCart();
    let adicionouAlgum = false;

    products.forEach(p => {
        const qty = getPendingQty(p.id, "pedido");
        if (qty > 0 && qty <= p.quantidade) {
            const idx = cart.findIndex(item => item.id === p.id);
            if (idx !== -1) {
                cart[idx].quantidade += qty;
            } else {
                cart.push({ id: p.id, nome: p.nome, quantidade: qty, preco: p.preco });
            }
            setPendingQty(p.id, "pedido", 0);
            adicionouAlgum = true;
        }
    });

    if (adicionouAlgum) {
        saveCart(cart);
        updateCartBadge();
    }
    window.location.href = "carrinho.html";
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
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeFromCart(${item.id})" style="width:36px;height:36px;padding:0;">🗑️</button>
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

    let success = true;
    cart.forEach(item => {
        const product = getProductById(item.id);
        if (!product || product.quantidade < item.quantidade) {
            success = false;
            alert(`Estoque insuficiente para ${item.nome}! Disponível: ${product ? product.quantidade : 0}`);
        }
    });

    if (!success) return;

    const total = cart.reduce((sum, item) => sum + (item.quantidade * item.preco), 0);
    const responsavel = getLoggedInName();
    const novoPedido = {
        id: Date.now(),
        timestamp: Date.now(),
        updatedAt: Date.now(),
        solicitante: responsavel,
        data: new Date().toLocaleString("pt-BR"),
        itens: JSON.parse(JSON.stringify(cart)),
        total: total,
        status: "pendente" // pendente | aprovado | rejeitado
    };

    const orders = getOrders();
    orders.push(novoPedido);
    saveOrders(orders);

    registrarLog("pedido", `${responsavel} enviou o pedido #${novoPedido.id} (${cart.map(item => `${item.nome} x${item.quantidade}`).join(', ')}) - Total: R$ ${total.toFixed(2)}`);

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
    sincronizarStorageEntrePaginas();
    const data = localStorage.getItem("orders");
    return data ? JSON.parse(data) : [];
}

function saveOrders(orders) {
    localStorage.setItem("orders", JSON.stringify(orders));
    salvarEstadoWindowName(true, false);
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

    let success = true;
    order.itens.forEach(item => {
        const product = getProductById(item.id);
        if (!product || product.quantidade < item.quantidade) {
            success = false;
            alert(`Estoque insuficiente para ${item.nome}! Disponível: ${product ? product.quantidade : 0}`);
        }
    });

    if (!success) return false;

    const detalhesBaixa = [];
    order.itens.forEach(item => {
        const prodAntes = getProductById(item.id);
        const estAnt = prodAntes ? prodAntes.quantidade : 0;
        const estNovo = estAnt - item.quantidade;
        updateProductQuantity(item.id, -item.quantidade);
        registrarMovimentacao("saida", item.nome, item.quantidade, `Pedido #${orderId}`, {
            estoqueAnterior: estAnt,
            estoqueAtual: estNovo
        });
        detalhesBaixa.push(`${item.nome}: -${item.quantidade} (${estAnt} → ${estNovo})`);
    });

    order.status = "aprovado";
    order.updatedAt = Date.now();
    saveOrders(orders);
    registrarLog("aprovado", `Aprovou o pedido #${orderId} e deu baixa no estoque: ${detalhesBaixa.join(", ")}`);
    showToast(`✅ Pedido #${orderId} aprovado! Estoque atualizado.`);
    return true;
}

function rejectOrder(orderId) {
    const orders = getOrders();
    const index = orders.findIndex(o => o.id === parseInt(orderId));
    if (index === -1) return false;

    orders[index].status = "rejeitado";
    orders[index].updatedAt = Date.now();
    saveOrders(orders);
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

    const nomeItem = order.itens[itemIndex].nome;
    const oldQty = order.itens[itemIndex].quantidade;

    if (newQty <= 0) {
        order.itens.splice(itemIndex, 1);
    } else {
        order.itens[itemIndex].quantidade = newQty;
    }

    order.total = order.itens.reduce((sum, item) => sum + (item.quantidade * item.preco), 0);
    order.updatedAt = Date.now();
    saveOrders(orders);
    registrarLog("alteracao", `Alterou o item "${nomeItem}" do pedido #${orderId} (de ${oldQty} para ${newQty <= 0 ? "0 - removido" : newQty})`);
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
                <div style="font-size:13px;color:#718096;margin-bottom:8px;">📅 ${order.data} ${order.solicitante ? `• 👩‍🍳 Solicitante: <strong>${order.solicitante}</strong>` : ""}</div>
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
        <div style="font-size:13px;color:#718096;margin-bottom:16px;">📅 ${order.data} ${order.solicitante ? `• 👩‍🍳 Solicitante: <strong>${order.solicitante}</strong>` : ""}</div>
        <ul class="product-list">
    `;

    order.itens.forEach((item) => {
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
                    <span style="font-size:12px;color:#718096;">📦 Estoque atual: <strong>${stockAvailable}</strong> unidades</span>
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

// ===== COLABORADORAS DA CANTINA / COZINHA =====
const LISTA_USUARIOS = ["Ana Maria", "Rose", "Paula", "Fabiana"];

function getListaUsuarios() {
    sincronizarStorageEntrePaginas();
    try {
        const data = localStorage.getItem("cozinheiras");
        if (data) {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {}
    return [...LISTA_USUARIOS];
}

function saveListaUsuarios(lista) {
    localStorage.setItem("cozinheiras", JSON.stringify(lista));
    salvarCookieBackup("cantina_cozinheiras", lista);
    salvarEstadoWindowName(true, false);
}

function getInicialCozinheira(nome, listaCompleta, indiceAtual) {
    const limpo = (nome || "").trim();
    if (!limpo) return "?";
    const primeira = limpo.charAt(0).toUpperCase();
    if (Array.isArray(listaCompleta) && typeof indiceAtual === "number") {
        const conflitoAnterior = listaCompleta.slice(0, indiceAtual).some(
            n => (n || "").trim().charAt(0).toUpperCase() === primeira
        );
        if (conflitoAnterior && limpo.length > 1) {
            return primeira + limpo.charAt(1).toLowerCase();
        }
    }
    return primeira;
}

function adicionarCozinheira(nome) {
    const nomeLimpo = (nome || "").trim();
    if (!nomeLimpo) {
        return { sucesso: false, mensagem: "Por favor, digite o nome da cozinheira." };
    }

    const lista = getListaUsuarios();
    const jaExiste = lista.some(u => u.toLowerCase() === nomeLimpo.toLowerCase());
    if (jaExiste) {
        return { sucesso: false, mensagem: `A cozinheira "${nomeLimpo}" já está cadastrada!` };
    }

    lista.push(nomeLimpo);
    try {
        const removidas = JSON.parse(localStorage.getItem("cozinheirasRemovidas") || "[]") || [];
        const novasRemovidas = removidas.filter(r => r.toLowerCase() !== nomeLimpo.toLowerCase());
        localStorage.setItem("cozinheirasRemovidas", JSON.stringify(novasRemovidas));
    } catch (e) {}
    saveListaUsuarios(lista);
    registrarLog("alteracao", `Cadastrou nova cozinheira: "${nomeLimpo}"`);
    return { sucesso: true, nome: nomeLimpo, mensagem: `Cozinheira "${nomeLimpo}" cadastrada com sucesso!` };
}

function removerCozinheira(nome) {
    const nomeLimpo = (nome || "").trim();
    const lista = getListaUsuarios();
    if (lista.length <= 1) {
        return { sucesso: false, mensagem: "É necessário manter pelo menos uma cozinheira cadastrada." };
    }
    const novaLista = lista.filter(u => u.toLowerCase() !== nomeLimpo.toLowerCase());
    if (novaLista.length === lista.length) {
        return { sucesso: false, mensagem: "Cozinheira não encontrada." };
    }
    try {
        const removidas = JSON.parse(localStorage.getItem("cozinheirasRemovidas") || "[]") || [];
        if (!removidas.some(r => r.toLowerCase() === nomeLimpo.toLowerCase())) {
            removidas.push(nomeLimpo);
        }
        localStorage.setItem("cozinheirasRemovidas", JSON.stringify(removidas));
    } catch (e) {}
    saveListaUsuarios(novaLista);
    registrarLog("alteracao", `Removeu a cozinheira: "${nomeLimpo}"`);
    return { sucesso: true, mensagem: `Cozinheira "${nomeLimpo}" removida.` };
}

function renderizarCardsUsuarios(containerId, selectId, funcaoClick) {
    const container = document.getElementById(containerId);
    const select = selectId ? document.getElementById(selectId) : null;
    const usuarios = getListaUsuarios();

    if (container) {
        let html = "";
        usuarios.forEach((nome, idx) => {
            const inicial = getInicialCozinheira(nome, usuarios, idx);
            const nomeAttr = nome.replace(/"/g, "&quot;");
            const nomeJs = nome.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            html += `
                <button type="button" class="cv-user-card" data-nome="${nomeAttr}" onclick="${funcaoClick}('${nomeJs}', this)">
                    <div class="cv-user-avatar">
                        <span class="cv-user-initial">${inicial}</span>
                        <span class="cv-user-badge">👩‍🍳</span>
                    </div>
                    <div class="cv-user-info">
                        <span class="cv-user-name">${nome}</span>
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
                </button>
            `;
        });
        container.innerHTML = html;
    }

    if (select) {
        let optionsHtml = '<option value="" disabled selected>Escolha seu nome...</option>';
        usuarios.forEach(nome => {
            const nomeAttr = nome.replace(/"/g, "&quot;");
            optionsHtml += `<option value="${nomeAttr}">${nome}</option>`;
        });
        select.innerHTML = optionsHtml;
    }
}

function getListaAdmins() {
    return LISTA_ADMINS;
}

// ===== LOGIN =====
function fazerLogin(cpf, senha, tipo, nomeUsuario) {
    if (tipo === "usuario") {
        const nomeFinal = nomeUsuario || localStorage.getItem("usuarioNome") || "Usuário";
        localStorage.setItem("loggedIn", "usuario");
        localStorage.setItem("usuarioNome", nomeFinal);
        localStorage.setItem("cantina_auth_updated_at", String(Date.now()));
        const agora = new Date();
        const logs = getLogs();
        logs.push({
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            data: agora.toLocaleDateString("pt-BR"),
            hora: agora.toLocaleTimeString("pt-BR"),
            usuario: nomeFinal,
            perfil: "Usuário",
            acao: "login",
            detalhes: "Entrou no sistema (Cozinha)"
        });
        saveLogs(logs);
        salvarEstadoWindowName(false, true);
        showToast(`✅ Bem-vinda, ${nomeFinal}!`);
        return true;
    }

    if (tipo === "admin") {
        const nomeFinal = nomeUsuario || localStorage.getItem("adminNome") || "Administrador";
        localStorage.setItem("loggedIn", "admin");
        localStorage.setItem("adminNome", nomeFinal);
        localStorage.removeItem("usuarioNome");
        localStorage.setItem("cantina_auth_updated_at", String(Date.now()));
        const agora = new Date();
        const logs = getLogs();
        logs.push({
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            data: agora.toLocaleDateString("pt-BR"),
            hora: agora.toLocaleTimeString("pt-BR"),
            usuario: nomeFinal,
            perfil: "Administrador",
            acao: "login",
            detalhes: "Entrou no sistema (Gestão)"
        });
        saveLogs(logs);
        salvarEstadoWindowName(false, true);
        showToast(`✅ Bem-vinda, ${nomeFinal}!`);
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
    salvarEstadoWindowName(false, true);
    showToast("👋 Sessão encerrada.");
    const isSubfolder = window.location.pathname.includes("/admin/") || window.location.pathname.includes("/usuario/");
    window.location.href = isSubfolder ? "../index.html" : "index.html";
}

// ===== PAINEL DE AVISOS / ALTERAÇÕES PARA O ADMINISTRADOR =====
function getAlteracoesRecentesSistema(limite = 10) {
    const logs = getLogs();
    return logs.filter(l => l.acao !== "login").slice(-limite).reverse();
}

function renderizarResumoAlteracoesAdmin(containerId, limite = 4) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const alteracoes = getAlteracoesRecentesSistema(limite);
    const todosLogsAlteracoes = getLogs().filter(l => l.acao !== "login");

    // Atualizar badges nos botões do Menu Admin se existirem
    const badgeLogsMenu = document.getElementById("badgeLogsAdmin");
    if (badgeLogsMenu) {
        if (todosLogsAlteracoes.length > 0) {
            badgeLogsMenu.style.display = "inline-flex";
            badgeLogsMenu.textContent = `${todosLogsAlteracoes.length} registro(s)`;
        } else {
            badgeLogsMenu.style.display = "none";
        }
    }

    const badgePedidosMenu = document.getElementById("badgePedidosAdmin");
    if (badgePedidosMenu) {
        const pendentes = getOrders().filter(o => o.status === "pendente").length;
        if (pendentes > 0) {
            badgePedidosMenu.style.display = "inline-flex";
            badgePedidosMenu.textContent = `⏳ ${pendentes} pendente(s)`;
        } else {
            badgePedidosMenu.style.display = "none";
        }
    }

    if (alteracoes.length === 0) {
        container.innerHTML = "";
        container.style.display = "none";
        return;
    }

    container.style.display = "block";
    const mapIcone = {
        entrada: "📥",
        saida: "📤",
        pedido: "🛒",
        aprovado: "✅",
        rejeitado: "❌",
        alteracao: "✏️"
    };

    let itensHtml = alteracoes.map(alt => {
        const icone = mapIcone[alt.acao] || "🔔";
        const isUser = isPerfilUsuario(alt.perfil || alt.usuario);
        const tagPerfil = isUser ? `👩‍🍳 ${alt.usuario} (Usuário)` : `🛡️ ${alt.usuario} (Admin)`;
        const bgItem = alt.acao === "entrada" ? "#f0fff4" : (alt.acao === "saida" ? "#fff5f5" : "#ffffff");
        const borderItem = alt.acao === "entrada" ? "#c6f6d5" : (alt.acao === "saida" ? "#fed7d7" : "#dbe4f5");

        return `
            <div style="background:${bgItem};border:1px solid ${borderItem};border-radius:10px;padding:10px 12px;margin-bottom:8px;text-align:left;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
                    <span style="font-size:12px;font-weight:700;color:#12305c;">${icone} ${tagPerfil}</span>
                    <span style="font-size:11px;color:#718096;">📅 ${alt.data} às ${alt.hora}</span>
                </div>
                <div style="font-size:13px;color:#2d3748;font-weight:600;line-height:1.35;">
                    ${alt.detalhes}
                </div>
            </div>
        `;
    }).join("");

    container.innerHTML = `
        <div style="background:#f0f5ff;border:1.5px solid #bcd2f8;border-radius:16px;padding:14px;margin:12px 0 18px;text-align:left;box-shadow:0 4px 12px rgba(18,48,92,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="font-family:'Playfair Display',Georgia,serif;font-size:15.5px;font-weight:700;color:#12305c;">
                    🔔 Últimas Alterações no Sistema
                </span>
                <span style="background:#1a4fbf;color:#fff;font-size:11px;font-weight:700;padding:2px 9px;border-radius:12px;">
                    ${todosLogsAlteracoes.length} total
                </span>
            </div>
            ${itensHtml}
            <div style="text-align:right;margin-top:6px;">
                <a href="logs.html" style="font-size:12.5px;font-weight:700;color:#1a4fbf;text-decoration:none;">
                    Ver histórico completo de alterações →
                </a>
            </div>
        </div>
    `;
}

// ===== ATUALIZAÇÃO AUTOMÁTICA DE TELAS ABERTAS =====
function dispararAtualizacaoTelas() {
    try {
        if (typeof atualizarDashboard === "function") atualizarDashboard();
        if (typeof renderizarLogs === "function") renderizarLogs();
        if (typeof renderizarResumoAlteracoesAdmin === "function") {
            renderizarResumoAlteracoesAdmin("painel-alteracoes-admin", 3);
        }
        if (typeof carregarResumoGeral === "function") {
            carregarResumoGeral();
            if (typeof loadReportEstoqueAtual === "function") loadReportEstoqueAtual();
            if (typeof loadReportEstoqueBaixo === "function") loadReportEstoqueBaixo();
            if (typeof loadReportEntradas === "function") loadReportEntradas();
            if (typeof loadReportSaidas === "function") loadReportSaidas();
            if (typeof loadReportPedidos === "function") loadReportPedidos();
            if (typeof loadReportMaisMovimentados === "function") loadReportMaisMovimentados();
        }
        if (typeof renderizarEstoquePagina === "function") renderizarEstoquePagina();
        if (typeof renderAdminOrderList === "function" && document.getElementById("order-list")) {
            const detailContainer = document.getElementById("order-detail-container");
            if (!detailContainer || detailContainer.style.display === "none") {
                renderAdminOrderList("order-list");
            }
        }
        if (typeof atualizarBadgesMenu === "function") atualizarBadgesMenu();
        if (typeof atualizarTelasCardapioAbertas === "function") atualizarTelasCardapioAbertas();
        updateCartBadge();
    } catch (e) {}
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

// ===== INIT ON PAGE LOAD & REAL-TIME LISTENERS =====
initStorage();
inicializarSyncHub();

document.addEventListener("DOMContentLoaded", function() {
    initStorage();
    inicializarSyncHub();
    if (!isSyncHubFrame()) {
        updateCartBadge();
        dispararAtualizacaoTelas();
    }
});

window.addEventListener("pageshow", function() {
    sincronizarStorageEntrePaginas();
    if (!isSyncHubFrame()) dispararAtualizacaoTelas();
});

window.addEventListener("focus", function() {
    sincronizarStorageEntrePaginas();
    if (!isSyncHubFrame()) dispararAtualizacaoTelas();
});

document.addEventListener("visibilitychange", function() {
    if (!document.hidden) {
        sincronizarStorageEntrePaginas();
        if (!isSyncHubFrame()) dispararAtualizacaoTelas();
    }
});

window.addEventListener("storage", function() {
    salvarEstadoWindowName(false, false);
    if (!isSyncHubFrame()) dispararAtualizacaoTelas();
});
