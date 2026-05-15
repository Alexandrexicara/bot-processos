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
                modo: document.getElementById('reg-modo').value
            })
        });

        const data = await res.json();

        if (data.success) {
            sucessoEl.textContent = 'Cadastro realizado! Faça login.';
            document.getElementById('registro-form').reset();
            setTimeout(() => mostrarTab('login'), 1500);
        } else {
            erroEl.textContent = data.error || 'Erro no cadastro';
        }
    } catch (err) {
        erroEl.textContent = 'Erro de conexão';
    }
});
