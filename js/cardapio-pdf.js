/* =====================================================================
   IMPORTAÇÃO DE CARDÁPIO EM PDF (ADMIN)
   Lê o arquivo PDF no navegador via PDF.js, extrai dias, datas e pratos,
   identifica ingredientes do estoque e atualiza o Cardápio da Semana.
   ===================================================================== */

(function () {
    const PDFJS_VERSION = "3.11.174";
    const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    const PDFJS_WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

    const DIAS_PADRAO = [
        { nome: "Segunda", aliases: ["segunda", "segunda-feira", "seg"] },
        { nome: "Terça",   aliases: ["terca", "terça", "terca-feira", "terça-feira", "ter"] },
        { nome: "Quarta",  aliases: ["quarta", "quarta-feira", "qua"] },
        { nome: "Quinta",  aliases: ["quinta", "quinta-feira", "qui"] },
        { nome: "Sexta",   aliases: ["sexta", "sexta-feira", "sex"] }
    ];

    const INGREDIENTES_CONHECIDOS = [
        { nome: "Arroz",          padrao: 5,  unidade: "kg/pct", keywords: ["arroz"] },
        { nome: "Feijão",         padrao: 3,  unidade: "kg/pct", keywords: ["feijao", "feijão"] },
        { nome: "Macarrão",       padrao: 6,  unidade: "kg/pct", keywords: ["macarrao", "macarrão", "espaguete", "parafuso", "massa"] },
        { nome: "Molho de Tomate",padrao: 4,  unidade: "un",     keywords: ["molho de tomate", "extrato de tomate", "polpa de tomate"] },
        { nome: "Óleo",           padrao: 2,  unidade: "un",     keywords: ["oleo", "óleo", "refogado", "frito", "omelete", "arroz", "feijao", "feijão"] },
        { nome: "Ovos",           padrao: 30, unidade: "un",     keywords: ["ovo", "ovos", "omelete"] },
        { nome: "Frango",         padrao: 6,  unidade: "kg",     keywords: ["frango", "coxa", "sobrecoxa", "peito de frango", "ave"] },
        { nome: "Carne Suína",    padrao: 5,  unidade: "kg",     keywords: ["suina", "suína", "suino", "suíno", "porco", "lombo", "pernil"] },
        { nome: "Carne Bovina",   padrao: 5,  unidade: "kg",     keywords: ["carne bovina", "bovina", "carne moida", "carne moída", "acem", "acém", "patinho", "musculo", "músculo"] },
        { nome: "Cenoura",        padrao: 2,  unidade: "kg",     keywords: ["cenoura"] },
        { nome: "Batata",         padrao: 6,  unidade: "kg",     keywords: ["batata"] },
        { nome: "Tomate",         padrao: 3,  unidade: "kg",     keywords: ["tomate"] },
        { nome: "Cebola",         padrao: 2,  unidade: "kg",     keywords: ["cebola"] },
        { nome: "Repolho",        padrao: 3,  unidade: "kg",     keywords: ["repolho"] },
        { nome: "Banana",         padrao: 35, unidade: "un",     keywords: ["banana"] },
        { nome: "Laranja",        padrao: 35, unidade: "un",     keywords: ["laranja"] },
        { nome: "Leite",          padrao: 4,  unidade: "L",      keywords: ["leite", "mingau", "vitamina", "bebida lactea", "bebida láctea"] },
        { nome: "Farinha",        padrao: 2,  unidade: "kg",     keywords: ["farinha", "fuba", "fubá", "polenta", "bolo", "torta"] },
        { nome: "Açúcar",         padrao: 2,  unidade: "kg",     keywords: ["acucar", "açúcar", "doce"] },
        { nome: "Café",           padrao: 1,  unidade: "pct",    keywords: ["cafe", "café"] }
    ];

    let pdfjsLoadingPromise = null;
    let estadoImportacao = null;

    function normalizarTexto(str) {
        return String(str || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function escaparHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function carregarPdfJs() {
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
            return Promise.resolve(window.pdfjsLib);
        }
        if (pdfjsLoadingPromise) return pdfjsLoadingPromise;

        pdfjsLoadingPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = PDFJS_CDN;
            script.async = true;
            script.onload = () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
                    resolve(window.pdfjsLib);
                } else {
                    pdfjsLoadingPromise = null;
                    reject(new Error("Biblioteca PDF.js não foi inicializada corretamente."));
                }
            };
            script.onerror = () => {
                pdfjsLoadingPromise = null;
                reject(new Error("Não foi possível carregar o leitor de PDF. Verifique sua conexão com a internet."));
            };
            document.head.appendChild(script);
        });

        return pdfjsLoadingPromise;
    }

    function identificarDiaCabecalho(texto) {
        const norm = normalizarTexto(texto).replace(/[^a-z-]/g, "");
        if (!norm) return null;
        for (const d of DIAS_PADRAO) {
            if (d.aliases.includes(norm)) return d.nome;
        }
        return null;
    }

    function detectarIngredientesPorItens(itens) {
        const textoGeral = normalizarTexto((itens || []).join(" "));
        if (!textoGeral || textoGeral === "feriado") return [];

        const encontrados = [];
        const nomesAdicionados = new Set();

        for (const ref of INGREDIENTES_CONHECIDOS) {
            const bateu = ref.keywords.some(kw => textoGeral.includes(normalizarTexto(kw)));
            if (bateu && !nomesAdicionados.has(ref.nome.toLowerCase())) {
                nomesAdicionados.add(ref.nome.toLowerCase());
                encontrados.push({
                    nome: ref.nome,
                    quantidadePadrao: ref.padrao,
                    unidade: ref.unidade
                });
            }
        }

        if (typeof getProducts === "function") {
            const produtos = getProducts() || [];
            for (const prod of produtos) {
                const pNorm = normalizarTexto(prod.nome);
                if (pNorm.length >= 3 && textoGeral.includes(pNorm) && !nomesAdicionados.has(prod.nome.toLowerCase())) {
                    nomesAdicionados.add(prod.nome.toLowerCase());
                    encontrados.push({
                        nome: prod.nome,
                        quantidadePadrao: 2,
                        unidade: "un"
                    });
                }
            }
        }

        return encontrados;
    }

    function agruparItensPorLinha(items, yTol = 4.5) {
        if (!items || items.length === 0) return [];
        const ordenados = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
        const linhas = [];

        for (const it of ordenados) {
            let linha = linhas.find(l => Math.abs(l.y - it.y) <= yTol);
            if (!linha) {
                linha = { y: it.y, items: [] };
                linhas.push(linha);
            }
            linha.items.push(it);
        }

        return linhas.map(l => {
            l.items.sort((a, b) => a.x - b.x);
            const texto = l.items.map(i => i.str).join(" ").replace(/\s+/g, " ").trim();
            return { y: l.y, texto, items: l.items };
        }).filter(l => l.texto.length > 0);
    }

    function ehInicioDePrato(linhaTexto, linhaAnteriorTexto) {
        if (!linhaAnteriorTexto) return true;
        const t = linhaTexto.trim();
        if (/^[(\-–—]/.test(t)) return false;
        if (/^[a-záéíóúâêôãõç]/.test(t)) return false;
        if (linhaAnteriorTexto.trim().endsWith(",") || linhaAnteriorTexto.trim().endsWith("(")) return false;

        const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
        if (letras.length >= 3 && letras === letras.toUpperCase()) {
            // Se a linha anterior terminou parênteses ou é outro prato em maiúsculas
            if (linhaAnteriorTexto.includes(")") || !linhaAnteriorTexto.includes("(")) {
                return true;
            }
        }
        return false;
    }

    function montarPratosDeLinhas(linhas) {
        const pratos = [];
        let atual = "";
        let yAnterior = null;

        for (const l of linhas) {
            const txt = l.texto.trim();
            if (!txt) continue;

            // Ignorar rótulos auxiliares da tabela
            if (/^(clique|itens|baixa|ajustado)/i.test(txt)) continue;

            const gapGrande = yAnterior !== null && Math.abs(yAnterior - l.y) > 16;
            if (!atual) {
                atual = txt;
            } else if (gapGrande || ehInicioDePrato(txt, atual)) {
                pratos.push(atual.replace(/\s+/g, " ").trim());
                atual = txt;
            } else {
                atual += " " + txt;
            }
            yAnterior = l.y;
        }

        if (atual) {
            pratos.push(atual.replace(/\s+/g, " ").trim());
        }

        return pratos;
    }

    function extrairPorColunasTabela(todosItens) {
        const linhas = agruparItensPorLinha(todosItens, 5);
        let linhaCabecalho = null;
        let colunas = [];

        for (const l of linhas) {
            const encontrados = [];
            for (const it of l.items) {
                const diaNome = identificarDiaCabecalho(it.str);
                if (diaNome && !encontrados.some(e => e.nome === diaNome)) {
                    encontrados.push({ nome: diaNome, x: it.x, y: it.y });
                }
            }
            if (encontrados.length >= 3) {
                linhaCabecalho = l;
                colunas = encontrados.sort((a, b) => a.x - b.x);
                break;
            }
        }

        if (!linhaCabecalho || colunas.length < 3) return null;

        // Definir limites X de cada coluna pelos pontos médios
        const faixas = colunas.map((col, idx) => {
            const minX = idx === 0 ? col.x - 35 : (colunas[idx - 1].x + col.x) / 2;
            const maxX = idx === colunas.length - 1 ? col.x + 220 : (col.x + colunas[idx + 1].x) / 2;
            return { nome: col.nome, minX, maxX };
        });

        // Limite inferior Y (antes da tabela de nutrientes ou notas de rodapé)
        let minYConteudo = -Infinity;
        for (const l of linhas) {
            if (l.y < linhaCabecalho.y - 25) {
                const norm = normalizarTexto(l.texto);
                if (
                    norm.includes("ensino medio") ||
                    norm.includes("ensino fundamental") ||
                    norm.includes("kcal") ||
                    /^1\.\s*os produtos/.test(norm) ||
                    norm.startsWith("notas:")
                ) {
                    minYConteudo = Math.max(minYConteudo, l.y + 4);
                }
            }
        }

        const regexData = /\b\d{1,2}\s*\/\s*(?:[a-zç]{3}|\d{1,2}(?:\/\d{2,4})?)\b/i;

        const diasResultado = DIAS_PADRAO.map(dp => {
            const faixa = faixas.find(f => f.nome === dp.nome);
            if (!faixa) {
                return { nome: dp.nome, data: "", itens: [], ingredientes: [] };
            }

            const itensColuna = todosItens.filter(it =>
                it.y < linhaCabecalho.y - 4 &&
                it.y > minYConteudo &&
                it.x >= faixa.minX &&
                it.x < faixa.maxX
            );

            const linhasCol = agruparItensPorLinha(itensColuna, 4.5);
            let dataEncontrada = "";
            const linhasPratos = [];

            for (const lc of linhasCol) {
                const mData = lc.texto.match(regexData);
                if (!dataEncontrada && mData && lc.texto.length <= 20) {
                    dataEncontrada = mData[0].replace(/\s+/g, "");
                    continue;
                }
                linhasPratos.push(lc);
            }

            const itens = montarPratosDeLinhas(linhasPratos);
            return {
                nome: dp.nome,
                data: dataEncontrada,
                itens: itens.length > 0 ? itens : ["(Sem itens identificados)"],
                ingredientes: detectarIngredientesPorItens(itens)
            };
        });

        return diasResultado;
    }

    function extrairPorTextoSequencial(textoCompleto) {
        const linhas = textoCompleto
            .split(/\r?\n/)
            .map(l => l.replace(/\s+/g, " ").trim())
            .filter(Boolean);

        const mapaDias = {};
        DIAS_PADRAO.forEach(d => {
            mapaDias[d.nome] = { nome: d.nome, data: "", itens: [], ingredientes: [] };
        });

        let diaAtual = null;
        const regexData = /\b\d{1,2}\s*\/\s*(?:[a-zç]{3}|\d{1,2}(?:\/\d{2,4})?)\b/i;

        for (const linha of linhas) {
            const norm = normalizarTexto(linha);

            if (norm.includes("ensino medio") || norm.includes("kcal") || /^1\.\s*os produtos/.test(norm)) {
                diaAtual = null;
                continue;
            }

            let encontrouDia = null;
            for (const dp of DIAS_PADRAO) {
                for (const al of dp.aliases) {
                    const re = new RegExp(`^${al}\\b`, "i");
                    if (re.test(norm)) {
                        encontrouDia = dp.nome;
                        break;
                    }
                }
                if (encontrouDia) break;
            }

            if (encontrouDia) {
                diaAtual = encontrouDia;
                const mData = linha.match(regexData);
                if (mData && !mapaDias[diaAtual].data) {
                    mapaDias[diaAtual].data = mData[0].replace(/\s+/g, "");
                }
                const resto = linha
                    .replace(/^(segunda|terca|terça|quarta|quinta|sexta)(-feira)?/i, "")
                    .replace(regexData, "")
                    .replace(/^[:\-\s–—]+/, "")
                    .trim();
                if (resto) mapaDias[diaAtual].itens.push(resto);
            } else if (diaAtual) {
                const mData = linha.match(regexData);
                if (mData && !mapaDias[diaAtual].data && linha.length <= 18) {
                    mapaDias[diaAtual].data = mData[0].replace(/\s+/g, "");
                } else {
                    mapaDias[diaAtual].itens.push(linha);
                }
            }
        }

        return DIAS_PADRAO.map(d => {
            const reg = mapaDias[d.nome];
            reg.ingredientes = detectarIngredientesPorItens(reg.itens);
            return reg;
        });
    }

    async function analisarArquivoPdf(file) {
        const pdfjsLib = await carregarPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const todosItensPagina1 = [];
        const todasLinhasTexto = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const itensPagina = textContent.items
                .filter(it => it.str && it.str.trim().length > 0)
                .map(it => ({
                    str: it.str,
                    x: it.transform[4],
                    y: it.transform[5]
                }));

            if (pageNum === 1) {
                todosItensPagina1.push(...itensPagina);
            }

            const linhasPagina = agruparItensPorLinha(itensPagina, 5);
            linhasPagina.forEach(l => todasLinhasTexto.push(l.texto));
        }

        const textoBruto = todasLinhasTexto.join("\n");

        // Extrair título e semana
        let titulo = "";
        let semana = "";

        for (const l of todasLinhasTexto) {
            if (!titulo && /card[aá]pio/i.test(l) && l.length >= 10 && l.length <= 90) {
                titulo = l.toUpperCase();
            }
            if (!semana) {
                const mSem = l.match(/\bsemana\s*[:\-]?\s*(\d{1,2})\b/i);
                if (mSem) semana = mSem[1];
            }
        }

        if (!titulo) {
            titulo = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").toUpperCase();
        }
        if (!semana) {
            semana = (typeof CARDAPIO !== "undefined" && CARDAPIO.semana) ? CARDAPIO.semana : "1";
        }

        let dias = extrairPorColunasTabela(todosItensPagina1);
        let metodo = "tabela";

        const diasComConteudo = dias ? dias.filter(d => d.itens.length > 0 && d.itens[0] !== "(Sem itens identificados)").length : 0;
        if (!dias || diasComConteudo < 2) {
            dias = extrairPorTextoSequencial(textoBruto);
            metodo = "texto";
        }

        return {
            arquivoNome: file.name,
            titulo,
            semana,
            dias,
            textoBruto,
            metodo
        };
    }

    function garantirModalImportacaoPdf() {
        if (document.getElementById("pdfImportOverlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "pdfImportOverlay";
        overlay.className = "pdf-import-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "Importar Cardápio em PDF");
        overlay.innerHTML = `
            <div class="pdf-import-modal">
                <div class="pdf-import-header">
                    <div>
                        <h3 class="pdf-import-title">📄 Importar Cardápio (PDF)</h3>
                        <p class="pdf-import-subtitle">Faça o upload do PDF recebido para atualizar o Cardápio da Semana no sistema.</p>
                    </div>
                    <button type="button" class="cardapio-fechar" id="pdfImportFechar" aria-label="Fechar">&times;</button>
                </div>
                <div class="pdf-import-body" id="pdfImportBody"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById("pdfImportFechar").addEventListener("click", fecharImportarCardapioPdf);
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) fecharImportarCardapioPdf();
        });
    }

    function renderizarTelaUpload(erroMsg = "") {
        const body = document.getElementById("pdfImportBody");
        if (!body) return;

        body.innerHTML = `
            ${erroMsg ? `<div class="pdf-import-alert erro">⚠️ ${escaparHtml(erroMsg)}</div>` : ""}
            <div class="pdf-dropzone" id="pdfDropzone">
                <div class="pdf-dropzone-icon">📥</div>
                <div class="pdf-dropzone-title">Arraste e solte o arquivo PDF aqui</div>
                <div class="pdf-dropzone-desc">ou clique no botão abaixo para selecionar do seu computador</div>
                <input type="file" id="pdfFileInput" accept=".pdf,application/pdf" style="display:none;">
                <button type="button" class="pdf-btn-primary" id="pdfSelectBtn">Selecionar Arquivo PDF</button>
            </div>
            <div class="pdf-import-dica">
                <strong>💡 Como funciona:</strong> O sistema lê automaticamente os dias da semana (Segunda a Sexta), datas, pratos e identifica os ingredientes do estoque para baixa. Você poderá revisar e ajustar antes de confirmar.
            </div>
        `;

        const fileInput = document.getElementById("pdfFileInput");
        const selectBtn = document.getElementById("pdfSelectBtn");
        const dropzone = document.getElementById("pdfDropzone");

        selectBtn.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", () => {
            if (fileInput.files && fileInput.files[0]) {
                processarArquivoSelecionado(fileInput.files[0]);
            }
        });

        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        });
        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("dragover");
        });
        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) processarArquivoSelecionado(file);
        });
    }

    function renderizarCarregando(nomeArquivo) {
        const body = document.getElementById("pdfImportBody");
        if (!body) return;
        body.innerHTML = `
            <div class="pdf-loading">
                <div class="pdf-spinner"></div>
                <div class="pdf-loading-title">Lendo cardápio em PDF...</div>
                <div class="pdf-loading-sub">${escaparHtml(nomeArquivo)}</div>
            </div>
        `;
    }

    function renderizarPreview() {
        const body = document.getElementById("pdfImportBody");
        if (!body || !estadoImportacao) return;

        const { arquivoNome, titulo, semana, dias, textoBruto } = estadoImportacao;

        const cardsHtml = dias.map((d, idx) => {
            const itensTexto = (d.itens || []).join("\n");
            const ingsResumo = (d.ingredientes || []).length > 0
                ? d.ingredientes.map(i => `<span class="pdf-ing-chip">${escaparHtml(i.nome)} (${i.quantidadePadrao} ${escaparHtml(i.unidade)})</span>`).join("")
                : `<span class="pdf-ing-vazio">Nenhum ingrediente mapeado automaticamente</span>`;

            return `
                <div class="pdf-day-card">
                    <div class="pdf-day-card-header">
                        <strong>${escaparHtml(d.nome)}</strong>
                        <input type="text" class="pdf-input-data" data-dia-idx="${idx}" value="${escaparHtml(d.data || "")}" placeholder="Ex: 23/nov">
                    </div>
                    <label class="pdf-field-label">Pratos / Itens (um por linha):</label>
                    <textarea class="pdf-textarea-itens" data-dia-idx="${idx}" rows="4">${escaparHtml(itensTexto)}</textarea>
                    <div class="pdf-day-ings">
                        <span class="pdf-field-label">Ingredientes detectados para baixa:</span>
                        <div class="pdf-ing-chips" id="pdf-ings-dia-${idx}">${ingsResumo}</div>
                    </div>
                </div>
            `;
        }).join("");

        body.innerHTML = `
            <div class="pdf-import-alert sucesso">
                ✅ PDF <strong>${escaparHtml(arquivoNome)}</strong> lido com sucesso! Revise os dados abaixo antes de atualizar o sistema.
            </div>

            <div class="pdf-meta-row">
                <div class="pdf-meta-field pdf-meta-titulo">
                    <label class="pdf-field-label" for="pdfInputTitulo">Título do Cardápio:</label>
                    <input type="text" id="pdfInputTitulo" class="pdf-input" value="${escaparHtml(titulo)}">
                </div>
                <div class="pdf-meta-field pdf-meta-semana">
                    <label class="pdf-field-label" for="pdfInputSemana">Semana:</label>
                    <input type="text" id="pdfInputSemana" class="pdf-input" value="${escaparHtml(semana)}">
                </div>
            </div>

            <div class="pdf-preview-grid">
                ${cardsHtml}
            </div>

            <details class="pdf-raw-details">
                <summary>🔍 Ver texto bruto extraído do PDF</summary>
                <pre class="pdf-raw-pre">${escaparHtml(textoBruto)}</pre>
            </details>

            <div class="pdf-import-actions">
                <button type="button" class="pdf-btn-secondary" id="pdfTrocarArquivoBtn">← Escolher outro PDF</button>
                <div class="pdf-import-actions-right">
                    <button type="button" class="pdf-btn-secondary" id="pdfCancelarBtn">Cancelar</button>
                    <button type="button" class="pdf-btn-confirm" id="pdfConfirmarBtn">✅ Atualizar Cardápio no Sistema</button>
                </div>
            </div>
        `;

        // Atualizar ingredientes detectados dinamicamente quando o admin editar os pratos
        body.querySelectorAll(".pdf-textarea-itens").forEach(textarea => {
            textarea.addEventListener("input", () => {
                const idx = Number(textarea.getAttribute("data-dia-idx"));
                const itens = textarea.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                const ings = detectarIngredientesPorItens(itens);
                estadoImportacao.dias[idx].itens = itens;
                estadoImportacao.dias[idx].ingredientes = ings;

                const container = document.getElementById(`pdf-ings-dia-${idx}`);
                if (container) {
                    container.innerHTML = ings.length > 0
                        ? ings.map(i => `<span class="pdf-ing-chip">${escaparHtml(i.nome)} (${i.quantidadePadrao} ${escaparHtml(i.unidade)})</span>`).join("")
                        : `<span class="pdf-ing-vazio">Nenhum ingrediente mapeado automaticamente</span>`;
                }
            });
        });

        document.getElementById("pdfTrocarArquivoBtn").addEventListener("click", () => renderizarTelaUpload());
        document.getElementById("pdfCancelarBtn").addEventListener("click", fecharImportarCardapioPdf);
        document.getElementById("pdfConfirmarBtn").addEventListener("click", confirmarImportacaoPdf);
    }

    async function processarArquivoSelecionado(file) {
        if (!file) return;
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        if (!isPdf) {
            renderizarTelaUpload("Por favor, selecione um arquivo no formato PDF (.pdf).");
            return;
        }

        renderizarCarregando(file.name);
        try {
            estadoImportacao = await analisarArquivoPdf(file);
            renderizarPreview();
        } catch (err) {
            console.error("Erro ao importar PDF:", err);
            renderizarTelaUpload(err && err.message ? err.message : "Erro ao processar o arquivo PDF.");
        }
    }

    function confirmarImportacaoPdf() {
        if (!estadoImportacao) return;

        const tituloEl = document.getElementById("pdfInputTitulo");
        const semanaEl = document.getElementById("pdfInputSemana");
        const titulo = (tituloEl ? tituloEl.value.trim() : "") || estadoImportacao.titulo;
        const semana = (semanaEl ? semanaEl.value.trim() : "") || estadoImportacao.semana;

        const diasFinais = estadoImportacao.dias.map((d, idx) => {
            const dataEl = document.querySelector(`.pdf-input-data[data-dia-idx="${idx}"]`);
            const itensEl = document.querySelector(`.pdf-textarea-itens[data-dia-idx="${idx}"]`);
            const dataVal = dataEl ? dataEl.value.trim() : d.data;
            const itensVal = itensEl
                ? itensEl.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
                : d.itens;
            const itensLimpos = itensVal.filter(i => i !== "(Sem itens identificados)");

            return {
                nome: d.nome,
                data: dataVal,
                itens: itensLimpos.length > 0 ? itensLimpos : ["(Sem itens)"],
                ingredientes: detectarIngredientesPorItens(itensLimpos)
            };
        });

        const base = typeof DEFAULT_CARDAPIO !== "undefined"
            ? JSON.parse(JSON.stringify(DEFAULT_CARDAPIO))
            : JSON.parse(JSON.stringify(CARDAPIO));

        const novoCardapio = {
            ...base,
            versao: typeof CARDAPIO_VERSION !== "undefined" ? CARDAPIO_VERSION : "pdf-import",
            importadoPdf: true,
            arquivoOrigem: estadoImportacao.arquivoNome,
            importadoEm: new Date().toISOString(),
            titulo,
            semana,
            dias: diasFinais
        };

        // Tornar o cardápio do PDF o cardápio fixo oficial do sistema
        if (typeof saveCardapioFixoPadrao === "function") {
            saveCardapioFixoPadrao(novoCardapio);
        } else {
            localStorage.setItem("cardapioFixoData", JSON.stringify(novoCardapio));
        }

        // Limpar ajustes manuais antigos de quantidades para o novo cardápio
        if (typeof diaQuantidades !== "undefined") diaQuantidades = {};
        if (typeof diaQuantidadesMeta !== "undefined") diaQuantidadesMeta = {};
        if (typeof salvarQuantidadesStorage === "function") salvarQuantidadesStorage();

        if (typeof saveCardapioData === "function") {
            saveCardapioData(novoCardapio, `Importou cardápio fixo via PDF (${estadoImportacao.arquivoNome})`);
        } else {
            localStorage.setItem("cardapioData", JSON.stringify(novoCardapio));
        }

        fecharImportarCardapioPdf();

        if (typeof showToast === "function") {
            showToast("✅ Cardápio do PDF definido como fixo e atualizado em todo o sistema!");
        }

        if (typeof abrirCardapio === "function") {
            abrirCardapio();
        }
    }

    window.abrirImportarCardapioPdf = function () {
        garantirModalImportacaoPdf();
        estadoImportacao = null;
        renderizarTelaUpload();
        document.getElementById("pdfImportOverlay").classList.add("aberto");
        document.body.style.overflow = "hidden";
    };

    window.fecharImportarCardapioPdf = function () {
        const overlay = document.getElementById("pdfImportOverlay");
        if (overlay) overlay.classList.remove("aberto");
        document.body.style.overflow = "";
    };

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            const overlay = document.getElementById("pdfImportOverlay");
            if (overlay && overlay.classList.contains("aberto")) {
                fecharImportarCardapioPdf();
            }
        }
    });
})();
