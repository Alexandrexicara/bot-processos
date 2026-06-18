require('dotenv').config();
const pool = require('./db');
const { consultarProcesso } = require('./apiRouter');
const TelegramBot = require('node-telegram-bot-api');

// Cache de bots por token para evitar recriar instâncias
const botsCache = {};

function getBot(token) {
    if (!token) return null;
    if (!botsCache[token]) {
        botsCache[token] = new TelegramBot(token);
    }
    return botsCache[token];
}

async function loop() {
    console.log('[' + new Date().toLocaleString() + '] Verificando atualizações...');

    const processos = await pool.query("SELECT * FROM processos");

    // Agrupa processos por usuario_id para evitar queries duplicadas
    const usuariosCache = {};

    for (let p of processos.rows) {

        // Cache de usuário para evitar queries repetidas
        if (!usuariosCache[p.usuario_id]) {
            const userRes = await pool.query(
                "SELECT * FROM usuarios WHERE id=$1",
                [p.usuario_id]
            );
            usuariosCache[p.usuario_id] = userRes.rows[0];
        }

        const user = usuariosCache[p.usuario_id];
        if (!user) continue;

        // Pular usuários bloqueados (ativo = false)
        if (user.ativo === false) continue;

        // Verifica se o usuário tem os dados necessários para notificação
        if (!user.bot_token || !user.telegram_id) continue;

        const bot = getBot(user.bot_token);
        if (!bot) continue;

        const resultados = await consultarProcesso(p.numero, user);

        if (!resultados || resultados.length === 0) continue;

        // Pega o primeiro resultado (mais recente)
        const lista = Array.isArray(resultados) ? resultados : [resultados];
        const novo = lista[0];

        if (!novo.data || novo.data === p.ultimo_status) continue;

        await pool.query(
            "UPDATE processos SET ultimo_status=$1, atualizado_em=CURRENT_TIMESTAMP WHERE id=$2",
            [novo.data, p.id]
        );

        bot.sendMessage(user.telegram_id,
            `🚨 *Atualização*\n📄 ${novo.numero}\n🕒 ${novo.data}`,
            { parse_mode: 'Markdown' }
        );
    }
}

// Roda a cada 5 minutos
setInterval(loop, 300000);

// Roda imediatamente na inicialização
loop();

console.log('Worker iniciado - verificando a cada 5 minutos');
