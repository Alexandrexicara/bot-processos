const TelegramBot = require('node-telegram-bot-api');
const pool = require('./db');
const { consultarProcesso } = require('./apiRouter');

const bots = {};

async function iniciarBot(token, userId) {

    if (bots[token]) return;

    const bot = new TelegramBot(token, { polling: true });

    bot.on('message', async (msg) => {

        const numero = msg.text;

        const userRes = await pool.query(
            "SELECT * FROM usuarios WHERE id=$1",
            [userId]
        );

        const user = userRes.rows[0];

        const dados = await consultarProcesso(numero, user);

        if (!dados) {
            bot.sendMessage(msg.chat.id, "Não encontrado");
            return;
        }

        await pool.query(
            "INSERT INTO processos (numero, usuario_id, ultimo_status) VALUES ($1,$2,$3)",
            [dados.numero, userId, dados.data]
        );

        bot.sendMessage(msg.chat.id,
            `📄 ${dados.numero}\n🏛️ ${dados.tribunal}\n📚 ${dados.classe}\n🕒 ${dados.data}`
        );
    });

    bots[token] = bot;
}

async function carregarBots() {
    const res = await pool.query("SELECT * FROM usuarios WHERE bot_token IS NOT NULL");

    for (let user of res.rows) {
        iniciarBot(user.bot_token, user.id);
    }
}

module.exports = { carregarBots, iniciarBot };
