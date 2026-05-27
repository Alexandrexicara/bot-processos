const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) {
    window.location.href = '/login.html';
}

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

        // Token expirado ou inválido — redireciona para login
        if (res.status === 401 || res.status === 403) {
            logout();
            return;
        }

        const dados = await res.json();

        // Verifica se é um array antes de iterar
        if (!Array.isArray(dados)) {
            console.warn('Resposta inesperada de /processos:', dados);
            return;
        }

        const tbody = document.querySelector("#sec-processos tbody");
        tbody.innerHTML = "";

        dados.forEach(p => {
            const atualizado = p.atualizado_em ? new Date(p.atualizado_em).toLocaleString() : '-';
            const usuarioCol = user.tipo === 'admin' ? `<td>${p.usuario_email || '-'}</td>` : '';
            
            tbody.innerHTML += `
            <tr>
                <td>${p.numero}</td>
                <td>${p.ultimo_status || '-'}</td>
                <td>${atualizado}</td>
                ${usuarioCol}
            </tr>`;
        });
    } catch (err) {
        console.error("Erro ao carregar processos:", err);
    }
}

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

            // Status do pagamento
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

        // Preencher formulário com dados atuais
        if (dados.telegram_id) document.getElementById('cfg-telegram').value = dados.telegram_id;
        if (dados.bot_token) document.getElementById('cfg-bot').value = dados.bot_token;
        if (dados.api_key) document.getElementById('cfg-api').value = dados.api_key;
        if (dados.modo) document.getElementById('cfg-modo').value = dados.modo;
    } catch (err) {
        console.error("Erro ao carregar config:", err);
    }
}

// Cadastrar usuário (admin)
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

// Atualizar configuração do bot (cliente)
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
            carregarConfig(); // recarrega os dados
        } else {
            msgEl.textContent = data.error || 'Erro ao salvar';
            msgEl.className = 'erro';
        }
    } catch (err) {
        msgEl.textContent = 'Erro de conexão';
        msgEl.className = 'erro';
    }
});

function logout() {
    // Para o intervalo de recarga
    if (intervaloProcessos) clearInterval(intervaloProcessos);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// Bloquear/desbloquear usuário (admin)
async function toggleUsuario(userId, novoAtivo) {
    if (!confirm('Tem certeza que deseja ' + (novoAtivo ? 'desbloquear' : 'bloquear') + ' este usuário?')) return;

    try {
        const res = await fetch('/usuario/' + userId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ ativo: novoAtivo })
        });

        const data = await res.json();

        if (data.success) {
            carregarUsuarios();
        } else {
            alert('Erro: ' + (data.error || 'Falha ao atualizar'));
        }
    } catch (err) {
        alert('Erro de conexão');
    }
}

// Aprovar pagamento (admin)
async function aprovarPagamento(userId) {
    if (!confirm('Confirmar pagamento e liberar acesso deste usuário?')) return;

    try {
        const res = await fetch('/usuario/' + userId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ ativo: true, status_pagamento: 'aprovado' })
        });

        const data = await res.json();

        if (data.success) {
            carregarUsuarios();
        } else {
            alert('Erro: ' + (data.error || 'Falha ao aprovar'));
        }
    } catch (err) {
        alert('Erro de conexão');
    }
}

// Rejeitar pagamento (admin)
async function rejeitarPagamento(userId) {
    if (!confirm('Rejeitar pagamento e manter usuário bloqueado?')) return;

    try {
        const res = await fetch('/usuario/' + userId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ status_pagamento: 'rejeitado' })
        });

        const data = await res.json();

        if (data.success) {
            carregarUsuarios();
        } else {
            alert('Erro: ' + (data.error || 'Falha ao rejeitar'));
        }
    } catch (err) {
        alert('Erro de conexão');
    }
}

// Inicializar
let intervaloProcessos;
configurarUI();
carregarProcessos();
intervaloProcessos = setInterval(carregarProcessos, 30000); // 30 seg em vez de 5
