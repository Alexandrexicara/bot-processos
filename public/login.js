// Verifica se já está logado
const token = localStorage.getItem('token');
if (token) {
    window.location.href = '/painel.html';
}

// Alternar tabs
function mostrarTab(tab, event) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    document.getElementById(tab + '-form').classList.add('active');
}

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroEl = document.getElementById('login-erro');
    erroEl.textContent = '';

    try {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('login-email').value,
                senha: document.getElementById('login-senha').value
            })
        });

        const data = await res.json();

        if (data.success) {
            if (data.user && data.user.ativo === false) {
                erroEl.innerHTML = '⏳ Sua conta ainda <b>não foi aprovada</b>.<br>O administrador está verificando seu pagamento.<br><br>💳 Chave Pix: <b>santossilvac990@gmail.com</b><br>Titular: Celio Santos Silva';
                return;
            }
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '/painel.html';
        } else {
            erroEl.textContent = data.error || 'Erro ao fazer login';
        }
    } catch (err) {
        erroEl.textContent = 'Erro de conexão';
    }
});

// Registro
document.getElementById('registro-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroEl = document.getElementById('reg-erro');
    const sucessoEl = document.getElementById('reg-sucesso');
    erroEl.textContent = '';
    sucessoEl.textContent = '';

    const senha = document.getElementById('reg-senha').value;
    const senha2 = document.getElementById('reg-senha2').value;

    if (senha !== senha2) {
        erroEl.textContent = 'As senhas não conferem';
        return;
    }

    try {
        const res = await fetch('/auth/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('reg-email').value,
                senha: senha,
                telegram_id: document.getElementById('reg-telegram').value,
                bot_token: document.getElementById('reg-bot').value,
                api_key: document.getElementById('reg-api').value,
                modo: document.getElementById('reg-modo').value,
                comprovante: document.getElementById('reg-comprovante').value
            })
        });

        const data = await res.json();

        if (data.success) {
            let msg = '✅ Cadastro recebido!\n\n';
            msg += 'Seu acesso será liberado APÓS confirmação do pagamento.\n\n';
            if (data.pagamento) {
                msg += '💳 Pague via Pix:\n';
                msg += 'Chave: ' + data.pagamento.chave + '\n';
                msg += 'Banco: ' + data.pagamento.banco + '\n';
                msg += 'Titular: ' + data.pagamento.titular;
            }
            sucessoEl.innerHTML = msg.replace(/\n/g, '<br>');
            document.getElementById('registro-form').reset();
        } else {
            erroEl.textContent = data.error || 'Erro no cadastro';
        }
    } catch (err) {
        erroEl.textContent = 'Erro de conexão';
    }
});
