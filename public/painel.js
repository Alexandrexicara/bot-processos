const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) {
    window.location.href = '/login.html';
}

// ── Seleção de processos ──
let processosSelecionados = new Set();
let processosData = []; // cache dos dados da tabela
let previewBlobUrl = null; // URL do preview atual

// Configurar UI baseado no tipo de usuário
function configurarUI() {
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-tipo').textContent = user.tipo;

    if (user.tipo === 'admin') {
        document.getElementById('menu-admin').classList.remove('hidden');
        document.getElementById('menu-cliente').classList.add('hidden');
        document.getElementById('col-usuario').classList.remove('hidden');
    } else {
        document.getElementById('menu-admin').classList.add('hidden');
        document.getElementById('menu-cliente').classList.remove('hidden');
        document.getElementById('col-usuario').classList.add('hidden');
    }
}

function mostrarSecao(secao, event) {
    document.querySelectorAll('.secao').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById('sec-' + secao).classList.add('active');
    if (event && event.target) {
        event.target.classList.add('active');
    }

    if (secao === 'usuarios') carregarUsuarios();
    if (secao === 'config') carregarConfig();
}

async function carregarProcessos() {
    try {
        const res = await fetch('/processos', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.status === 401 || res.status === 403) {
            logout();
            return;
        }

        const dados = await res.json();

        if (!Array.isArray(dados)) {
            console.warn('Resposta inesperada de /processos:', dados);
            return;
        }

        processosData = dados;
        const tbody = document.querySelector("#sec-processos tbody");
        tbody.innerHTML = "";

        dados.forEach(p => {
            const atualizado = p.atualizado_em ? new Date(p.atualizado_em).toLocaleString() : '-';
            const usuarioCol = user.tipo === 'admin' ? `<td>${p.usuario_email || '-'}</td>` : '';
            const checked = processosSelecionados.has(p.id) ? 'checked' : '';
            
            tbody.innerHTML += `
            <tr>
                <td class="checkbox-col">
                    <input type="checkbox" data-id="${p.id}" ${checked} onchange="atualizarSelecao()">
                </td>
                <td>${p.numero}</td>
                <td>${p.ultimo_status || '-'}</td>
                <td>${atualizado}</td>
                ${usuarioCol}
                <td style="display:flex; gap:4px; flex-wrap:wrap;">
                    <button onclick="verDetalhes(${p.id})" 
                            style="padding:4px 10px; font-size:11px; border-radius:4px; cursor:pointer;
                                   background:#007bff; color:#fff; border:none;">
                        👁️ Ver
                    </button>
                    <button onclick="previewPDF(${p.id}, '${p.numero}')" 
                            style="padding:4px 10px; font-size:11px; border-radius:4px; cursor:pointer;
                                   background:#FF5E00; color:#fff; border:none;">
                        👁️ PDF
                    </button>
                    <button onclick="baixarPDF(${p.id}, '${p.numero}')" 
                            style="padding:4px 10px; font-size:11px; border-radius:4px; cursor:pointer;
                                   background:#ff4444; color:#fff; border:none;">
                        📥
                    </button>
                    <button onclick="compartilharProcesso(${p.id}, '${p.numero}')" 
                            style="padding:4px 10px; font-size:11px; border-radius:4px; cursor:pointer;
                                   background:#25D366; color:#fff; border:none;">
                        📤
                    </button>
                </td>
            </tr>`;
        });
        
        atualizarSelecao();
    } catch (err) {
        console.error("Erro ao carregar processos:", err);
    }
}

// ── Seleção ──
function atualizarSelecao() {
    processosSelecionados.clear();
    document.querySelectorAll('#sec-processos tbody input[type="checkbox"]:checked').forEach(cb => {
        processosSelecionados.add(parseInt(cb.dataset.id));
    });
    
    const bar = document.getElementById('selecao-bar');
    const count = document.getElementById('selecao-count');
    
    if (processosSelecionados.size > 0) {
        bar.style.display = 'flex';
        count.textContent = processosSelecionados.size + ' selecionado(s)';
    } else {
        bar.style.display = 'none';
    }
}

function toggleSelecaoTodos(el) {
    document.querySelectorAll('#sec-processos tbody input[type="checkbox"]').forEach(cb => {
        cb.checked = el.checked;
    });
    atualizarSelecao();
}

function limparSelecao() {
    processosSelecionados.clear();
    document.querySelectorAll('#sec-processos input[type="checkbox"]').forEach(cb => cb.checked = false);
    atualizarSelecao();
}

async function previewSelecionados() {
    if (processosSelecionados.size === 0) return alert('Selecione pelo menos um processo');
    
    try {
        document.getElementById('preview-title').textContent = `📄 Visualizando ${processosSelecionados.size} processo(s)...`;
        mostrarPreviewLoading();
        
        const res = await fetch('/processos/selecionados/pdf', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token 
            },
            body: JSON.stringify({ ids: Array.from(processosSelecionados) })
        });
        if (!res.ok) throw new Error('Erro ao gerar PDF');
        await abrirPreview(res, `${processosSelecionados.size} processos selecionados`);
    } catch (err) {
        alert('Erro ao gerar PDF: ' + err.message);
        fecharPreview();
    }
}

async function baixarSelecionados() {
    if (processosSelecionados.size === 0) return alert('Selecione pelo menos um processo');
    
    try {
        const res = await fetch('/processos/selecionados/pdf', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token 
            },
            body: JSON.stringify({ ids: Array.from(processosSelecionados) })
        });
        if (!res.ok) throw new Error('Erro ao gerar PDF');
        downloadFromResponse(res, 'processos_selecionados.pdf');
    } catch (err) {
        alert('Erro ao gerar PDF: ' + err.message);
    }
}

// ── Preview PDF ──
function mostrarPreviewLoading() {
    document.getElementById('pdf-preview-modal').style.display = 'block';
    document.getElementById('pdf-preview-frame').srcdoc = `
        <html><body style="background:#222; color:#fff; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
            <div style="text-align:center;">
                <div style="font-size:40px; animation:spin 1s linear infinite; display:inline-block;">⚡</div>
                <p>Gerando PDF com dados completos...</p>
                <style>@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }</style>
            </div>
        </body></html>`;
}

async function abrirPreview(res, titulo) {
    const blob = await res.blob();
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    previewBlobUrl = URL.createObjectURL(blob);
    
    document.getElementById('preview-title').textContent = '📄 ' + titulo;
    document.getElementById('pdf-preview-frame').src = previewBlobUrl;
    document.getElementById('pdf-preview-modal').style.display = 'block';
}

function fecharPreview() {
    document.getElementById('pdf-preview-modal').style.display = 'none';
}

function baixarPDFdoPreview() {
    if (!previewBlobUrl) return;
    const a = document.createElement('a');
    a.href = previewBlobUrl;
    a.download = 'processo.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function imprimirPreview() {
    const frame = document.getElementById('pdf-preview-frame');
    if (frame.src && frame.src !== 'about:blank') {
        frame.contentWindow.print();
    }
}

async function previewPDF(id, numero) {
    try {
        document.getElementById('preview-title').textContent = `📄 Processo ${numero} — Gerando...`;
        mostrarPreviewLoading();
        
        const res = await fetch('/processos/' + id + '/pdf', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('Erro ao gerar PDF');
        await abrirPreview(res, `Processo ${numero}`);
    } catch (err) {
        fecharPreview();
        alert('Erro ao gerar PDF: ' + err.message);
    }
}

async function previewTodosPDF() {
    try {
        document.getElementById('preview-title').textContent = '📄 Exportando todos os processos...';
        mostrarPreviewLoading();
        
        const res = await fetch('/processos/todos/pdf', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('Erro ao gerar PDF');
        await abrirPreview(res, 'Todos os processos');
    } catch (err) {
        fecharPreview();
        alert('Erro ao exportar: ' + err.message);
    }
}

// ── Utils ──
async function downloadFromResponse(res, filename) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ── DETALHES DO PROCESSO ──
async function verDetalhes(id) {
    document.querySelectorAll('.secao').forEach(s => s.classList.remove('active'));
    document.getElementById('sec-detalhes').classList.add('active');
    document.getElementById('detalhes-content').innerHTML = '<div class="loading-spinner">⚡ Buscando dados atualizados na API...</div>';

    try {
        const res = await fetch('/processos/' + id + '/detalhes', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.status === 401 || res.status === 403) { logout(); return; }
        const data = await res.json();
        if (data.error) {
            document.getElementById('detalhes-content').innerHTML = `<p style="color:#ff4444;">Erro: ${data.error}</p>`;
            return;
        }
        renderizarDetalhes(data, id);
    } catch (err) {
        document.getElementById('detalhes-content').innerHTML = `<p style="color:#ff4444;">Erro ao carregar: ${err.message}</p>`;
    }
}

function renderizarDetalhes(p, id) {
    const d = p.detalhes || {};
    
    // ── Dados Básicos ──
    const camposBasicos = [
        ['Número', p.numero],
        ['Tribunal', d.tribunal || d.tribunal_descricao],
        ['Classe', d.classe],
        ['Assunto', d.assunto],
        ['Área', d.area],
        ['Grau', d.grau],
        ['Situação', d.situacao],
        ['Órgão Julgador', d.orgaoJulgador],
        ['Relator', d.relator],
        ['Valor da Causa', d.valor_causa],
        ['Sistema', d.sistema],
        ['Fonte', d.fonte || p.fonte],
        ['Segredo de Justiça', d.segredo_justica ? 'Sim' : ''],
        ['Estado', d.estado],
        ['Unidade', d.unidade],
        ['Data de Início', d.data],
        ['Última Movimentação', d.data_ultima_movimentacao || d.ultimo_status],
        ['Total Movimentações', d.quantidade_movimentacoes],
        ['Fase', d.fase],
        ['Origem', d.origem],
        ['Atualizado', p.atualizado_em ? new Date(p.atualizado_em).toLocaleString() : '-']
    ];

    let camposHTML = '';
    for (const [label, valor] of camposBasicos) {
        if (valor && valor !== '' && valor !== 'N/A' && valor !== '-' && valor !== false) {
            camposHTML += `<div class="detalhe-field"><span class="detalhe-label">${label}</span><span class="detalhe-valor">${valor}</span></div>`;
        }
    }

    // ── Polos ──
    let polosHTML = '';
    if (d.polo_ativo || d.polo_passivo) {
        polosHTML = `<div class="info-section"><h5>⚖️ Polos</h5>`;
        if (d.polo_ativo) polosHTML += `<div class="detalhe-field"><span class="detalhe-label">Polo Ativo (Autor)</span><span class="detalhe-valor">${d.polo_ativo}</span></div>`;
        if (d.polo_passivo) polosHTML += `<div class="detalhe-field"><span class="detalhe-label">Polo Passivo (Réu)</span><span class="detalhe-valor">${d.polo_passivo}</span></div>`;
        polosHTML += '</div>';
    }

    // ── Partes e Advogados ──
    let partesHTML = '';
    if (d.partes && d.partes.length > 0) {
        partesHTML = `<div class="info-section"><h5>👥 Partes e Advogados</h5>`;
        for (const parte of d.partes) {
            const tipo = parte.tipo || parte.polo || 'Parte';
            let doc = '';
            if (parte.cpf) doc = `CPF: ${parte.cpf}`;
            else if (parte.cnpj) doc = `CNPJ: ${parte.cnpj}`;
            
            partesHTML += `<div class="parte-item">
                <div class="parte-tipo">${tipo}</div>
                <div class="parte-nome">${parte.nome || 'N/A'}</div>
                ${doc ? `<div class="parte-doc">${doc}</div>` : ''}
                ${parte.advogados && parte.advogados.length > 0 ? `<div class="parte-adv">👨‍⚖️ Advogado(s): ${parte.advogados.join(', ')}</div>` : ''}
            </div>`;
        }
        partesHTML += '</div>';
    }

    // ── Informações Complementares ──
    let infoCompHTML = '';
    if (d.info_complementares && Object.keys(d.info_complementares).length > 0) {
        infoCompHTML = `<div class="info-section"><h5>📋 Informações Complementares</h5>`;
        for (const [chave, valor] of Object.entries(d.info_complementares)) {
            const label = chave.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            infoCompHTML += `<div class="detalhe-field"><span class="detalhe-label">${label}</span><span class="detalhe-valor">${valor}</span></div>`;
        }
        infoCompHTML += '</div>';
    }

    // ── Movimentações ──
    let movHTML = '';
    if (d.movimentacoes && d.movimentacoes.length > 0) {
        movHTML = `<div class="info-section"><h5>📋 Últimas Movimentações (${d.movimentacoes.length})</h5>`;
        for (const mov of d.movimentacoes.slice(0, 20)) {
            movHTML += `<div class="mov-item"><span class="mov-data">${mov.data || ''}</span> <span class="mov-desc">${mov.descricao || mov.texto || ''}</span></div>`;
        }
        movHTML += '</div>';
    }

    document.getElementById('detalhes-content').innerHTML = `
        <div class="acoes-bar">
            <button onclick="previewPDF(${id}, '${p.numero}')" class="btn-acao btn-pdf">👁️ Visualizar PDF</button>
            <button onclick="baixarPDF(${id}, '${p.numero}')" class="btn-acao" style="background:#cc0000; color:#fff;">📥 Baixar PDF</button>
            <button onclick="imprimirDetalhes()" class="btn-acao btn-imprimir">🖨️ Imprimir</button>
            <button onclick="compartilharProcesso(${id}, '${p.numero}')" class="btn-acao btn-compartilhar">📤 Compartilhar</button>
        </div>
        <div class="detalhe-card" id="detalhe-imprimivel">
            <h4>📄 Processo ${p.numero}</h4>
            <div class="info-section"><h5>📌 Dados do Processo</h5>${camposHTML}</div>
            ${polosHTML}
            ${partesHTML}
            ${infoCompHTML}
            ${movHTML}
        </div>
    `;
}

function voltarProcessos() {
    document.querySelectorAll('.secao').forEach(s => s.classList.remove('active'));
    document.getElementById('sec-processos').classList.add('active');
    document.querySelectorAll('.menu-btn')[0].classList.add('active');
}

async function baixarPDF(id, numero) {
    try {
        const res = await fetch('/processos/' + id + '/pdf', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('Erro ao gerar PDF');
        downloadFromResponse(res, 'processo_' + (numero || '').replace(/[^0-9]/g, '') + '.pdf');
    } catch (err) {
        alert('Erro ao gerar PDF: ' + err.message);
    }
}

function imprimirDetalhes() {
    const el = document.getElementById('detalhe-imprimivel');
    if (!el) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html><head><title>Processo - Impressão</title>
        <style>
            body { font-family: Arial; padding: 20px; color: #333; }
            .detalhe-card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
            .detalhe-field { display:flex; gap:10px; padding:8px 0; border-bottom:1px solid #eee; }
            .detalhe-label { color:#666; min-width:140px; font-weight:bold; }
            .parte-item { border:1px solid #ddd; padding:8px; margin:4px 0; border-radius:4px; }
            .parte-tipo { color:#FF5E00; font-weight:bold; font-size:11px; }
            .parte-adv { color:#0066cc; font-size:12px; }
            .mov-item { padding:4px 0; border-bottom:1px solid #eee; font-size:12px; }
            .mov-data { font-weight:bold; color:#FF5E00; }
            .info-section { margin-top:15px; }
            .info-section h5 { color:#333; border-bottom:1px solid #ddd; padding-bottom:4px; }
            h4 { color: #333; }
        </style></head><body>
        <h2>Processo Bot CNJ - Relatório</h2>
        <p>Impresso em: ${new Date().toLocaleString('pt-BR')}</p>
        ${el.innerHTML}
        </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
}

async function compartilharProcesso(id, numero) {
    const texto = `Processo: ${numero}\nConsultado via Processo Bot CNJ`;
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Processo ' + numero, text: texto });
        } catch (e) { /* usuário cancelou */ }
    } else {
        try {
            await navigator.clipboard.writeText(texto);
            alert('📋 Informações copiadas para a área de transferência!');
        } catch (e) {
            prompt('Copie as informações:', texto);
        }
    }
}

// ── Usuários (admin) ──
async function carregarUsuarios() {
    if (user.tipo !== 'admin') return;

    try {
        const res = await fetch('/usuarios', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const dados = await res.json();

        const tbody = document.getElementById("tbody-usuarios");
        tbody.innerHTML = "";

        dados.forEach(u => {
            const criado = u.criado_em ? new Date(u.criado_em).toLocaleString() : '-';
            const ultimoLogin = u.ultimo_login ? new Date(u.ultimo_login).toLocaleString() : 'Nunca';
            const ativo = u.ativo !== false;
            const statusCor = ativo ? '#39FF14' : '#ff4444';
            const statusTexto = ativo ? '🟢 Ativo' : '🔴 Bloqueado';

            const pgStatus = u.status_pagamento || 'pendente';
            const pgCor = pgStatus === 'aprovado' ? '#39FF14' : pgStatus === 'rejeitado' ? '#ff4444' : '#FFD700';
            const pgTexto = pgStatus === 'aprovado' ? '✅ Pago' : pgStatus === 'rejeitado' ? '❌ Negado' : '⏳ Pendente';
            const comprovante = u.comprovante ? `<br><small style="color:#888;">📎 ${u.comprovante.substring(0,50)}</small>` : '';

            tbody.innerHTML += `
            <tr>
                <td>${u.email}</td>
                <td><span class="badge ${u.tipo}">${u.tipo}</span></td>
                <td>${u.modo}</td>
                <td>${u.total_processos || 0}</td>
                <td><span style="color:${pgCor}; font-weight:bold;">${pgTexto}${comprovante}</span></td>
                <td><span style="color:${statusCor}; font-weight:bold;">${statusTexto}</span></td>
                <td style="font-size:12px; color:#aaa;">${ultimoLogin}</td>
                <td style="display:flex; gap:4px; flex-wrap:wrap;">
                    ${pgStatus === 'pendente' ? `
                    <button onclick="aprovarPagamento(${u.id})" 
                            style="padding:4px 8px; font-size:10px; border-radius:4px; cursor:pointer;
                                   background:#39FF14; color:#000; border:none;">
                        ✅ Aprovar
                    </button>
                    <button onclick="rejeitarPagamento(${u.id})" 
                            style="padding:4px 8px; font-size:10px; border-radius:4px; cursor:pointer;
                                   background:#ff4444; color:#fff; border:none;">
                        ❌ Rejeitar
                    </button>` : ''}
                    ${ativo ? 
                        `<button onclick="toggleUsuario(${u.id}, false)" 
                                style="padding:4px 8px; font-size:10px; border-radius:4px; cursor:pointer;
                                       background:#ff4444; color:#fff; border:none;">
                            🔒 Bloquear
                        </button>` :
                        `<button onclick="toggleUsuario(${u.id}, true)" 
                                style="padding:4px 8px; font-size:10px; border-radius:4px; cursor:pointer;
                                       background:#39FF14; color:#000; border:none;">
                            🔓 Liberar
                        </button>`
                    }
                </td>
            </tr>`;
        });
    } catch (err) {
        console.error("Erro ao carregar usuários:", err);
    }
}

async function carregarConfig() {
    try {
        const res = await fetch('/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const dados = await res.json();

        document.getElementById('config-dados').innerHTML = `
            <p><strong>Email:</strong> ${dados.email}</p>
            <p><strong>Tipo:</strong> ${dados.tipo}</p>
            <p><strong>Modo:</strong> ${dados.modo}</p>
            <p><strong>Telegram ID:</strong> <span style="color:${dados.telegram_id ? '#39FF14' : '#ff4444'}">${dados.telegram_id || 'Não configurado'}</span></p>
            <p><strong>Bot Token:</strong> <span style="color:${dados.bot_token ? '#39FF14' : '#ff4444'}">${dados.bot_token ? '✅ Configurado' : '❌ Não configurado'}</span></p>
            <p><strong>API Key:</strong> ${dados.api_key ? '✅ Configurada' : 'Não configurada'}</p>
            <p><strong>Cadastrado em:</strong> ${new Date(dados.criado_em).toLocaleString()}</p>
        `;

        if (dados.telegram_id) document.getElementById('cfg-telegram').value = dados.telegram_id;
        if (dados.bot_token) document.getElementById('cfg-bot').value = dados.bot_token;
        if (dados.api_key) document.getElementById('cfg-api').value = dados.api_key;
        if (dados.modo) document.getElementById('cfg-modo').value = dados.modo;
    } catch (err) {
        console.error("Erro ao carregar config:", err);
    }
}

// ── Cadastro usuário (admin) ──
document.getElementById('form-usuario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('cad-msg');

    try {
        const res = await fetch('/usuario', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token 
            },
            body: JSON.stringify({
                email: document.getElementById('cad-email').value,
                senha: document.getElementById('cad-senha').value,
                tipo: document.getElementById('cad-tipo').value,
                telegram_id: document.getElementById('cad-telegram').value,
                bot_token: document.getElementById('cad-bot').value,
                api_key: document.getElementById('cad-api').value,
                modo: document.getElementById('cad-modo').value
            })
        });

        const data = await res.json();

        if (data.success) {
            msgEl.textContent = 'Usuário criado com sucesso!';
            msgEl.className = 'sucesso';
            document.getElementById('form-usuario').reset();
        } else {
            msgEl.textContent = data.error || 'Erro ao criar usuário';
            msgEl.className = 'erro';
        }
    } catch (err) {
        msgEl.textContent = 'Erro de conexão';
        msgEl.className = 'erro';
    }
});

// ── Config do bot (cliente) ──
document.getElementById('form-config')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('cfg-msg');
    msgEl.textContent = 'Salvando...';
    msgEl.className = '';

    try {
        const res = await fetch('/auth/config', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token 
            },
            body: JSON.stringify({
                telegram_id: document.getElementById('cfg-telegram').value,
                bot_token: document.getElementById('cfg-bot').value,
                api_key: document.getElementById('cfg-api').value,
                modo: document.getElementById('cfg-modo').value
            })
        });

        const data = await res.json();

        if (data.success) {
            msgEl.textContent = '✅ ' + data.message;
            msgEl.className = 'sucesso';
            carregarConfig();
        } else {
            msgEl.textContent = data.error || 'Erro ao salvar';
            msgEl.className = 'erro';
        }
    } catch (err) {
        msgEl.textContent = 'Erro de conexão';
        msgEl.className = 'erro';
    }
});

// ── Admin actions ──
function logout() {
    if (intervaloProcessos) clearInterval(intervaloProcessos);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

async function toggleUsuario(userId, novoAtivo) {
    if (!confirm('Tem certeza que deseja ' + (novoAtivo ? 'desbloquear' : 'bloquear') + ' este usuário?')) return;
    try {
        const res = await fetch('/usuario/' + userId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        const data = await res.json();
        if (data.success) carregarUsuarios();
        else alert('Erro: ' + (data.error || 'Falha ao atualizar'));
    } catch (err) { alert('Erro de conexão'); }
}

async function aprovarPagamento(userId) {
    if (!confirm('Confirmar pagamento e liberar acesso deste usuário?')) return;
    try {
        const res = await fetch('/usuario/' + userId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ ativo: true, status_pagamento: 'aprovado' })
        });
        const data = await res.json();
        if (data.success) carregarUsuarios();
        else alert('Erro: ' + (data.error || 'Falha ao aprovar'));
    } catch (err) { alert('Erro de conexão'); }
}

async function rejeitarPagamento(userId) {
    if (!confirm('Rejeitar pagamento e manter usuário bloqueado?')) return;
    try {
        const res = await fetch('/usuario/' + userId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ status_pagamento: 'rejeitado' })
        });
        const data = await res.json();
        if (data.success) carregarUsuarios();
        else alert('Erro: ' + (data.error || 'Falha ao rejeitar'));
    } catch (err) { alert('Erro de conexão'); }
}

// ── Inicializar ──
let intervaloProcessos;
configurarUI();
carregarProcessos();
intervaloProcessos = setInterval(carregarProcessos, 30000);
