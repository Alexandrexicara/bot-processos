async function cadastrar() {
    try {
        const res = await fetch('/usuario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: document.getElementById('telegram').value,
                bot_token: document.getElementById('bot').value,
                api_key: document.getElementById('api').value,
                modo: document.getElementById('modo').value
            })
        });

        const data = await res.json();
        
        if (data.success) {
            alert("Usuário cadastrado e bot iniciado com sucesso!");
            document.getElementById('telegram').value = '';
            document.getElementById('bot').value = '';
            document.getElementById('api').value = '';
        } else {
            alert("Erro: " + data.error);
        }
    } catch (err) {
        alert("Erro ao cadastrar: " + err.message);
    }
}

async function carregar() {
    try {
        const res = await fetch('/processos');
        const dados = await res.json();

        const tbody = document.querySelector("tbody");
        tbody.innerHTML = "";

        dados.forEach(p => {
            const atualizado = p.atualizado_em ? new Date(p.atualizado_em).toLocaleString() : '-';
            tbody.innerHTML += `
            <tr>
                <td>${p.numero}</td>
                <td>${p.ultimo_status || '-'}</td>
                <td>${atualizado}</td>
            </tr>`;
        });
    } catch (err) {
        console.error("Erro ao carregar processos:", err);
    }
}

carregar();
setInterval(carregar, 5000);
