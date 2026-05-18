const TelegramBot = require('node-telegram-bot-api');
const pool = require('./db');
const { consultarProcesso } = require('./apiRouter');
const { parseMensagem } = require('./parser');

const bots = {};

async function iniciarBot(token, userId) {

    if (bots[token]) return;

    const bot = new TelegramBot(token, { polling: true });

    // Comando /start
    bot.onText(/^\/start$/, (msg) => {
        bot.sendMessage(msg.chat.id,
            `🤖 *Bot de Processos ativo!*\n\n` +
            `Envie:\n` +
            `📄 *Número do processo* — ex: \`0000000-00.0000.0.00.0000\`\n` +
            `👤 *OAB* — ex: \`/oab MS 3616\` ou \`MS3616\`\n` +
            `📝 *Nome da parte* — ex: \`José da Silva\`\n\n` +
            `Comandos:\n` +
            `/oab UF NUMERO — buscar por OAB\n` +
            `/p NUMERO — buscar por processo\n` +
            `/help — esta mensagem`,
            { parse_mode: 'Markdown' }
        );
    });

    // Comando /help e /ajuda
    bot.onText(/^\/(help|ajuda)$/, (msg) => {
        bot.sendMessage(msg.chat.id,
            `🤖 *Bot de Processos*\n\n` +
            `🔍 *Buscar processos:*\n` +
            `Envie o número do processo no formato CNJ\n` +
            `Ex: \`0000000-00.0000.0.00.0000\`\n\n` +
            `👤 *Buscar por OAB:*\n` +
            `Envie \`/oab UF NUMERO\`\n` +
            `Ex: \`/oab MS 3616\`\n` +
            `Ou simplesmente: \`MS 3616\` / \`MS3616\`\n\n` +
            `📝 *Buscar por nome:*\n` +
            `Envie o nome da parte ou advogado\n\n` +
            `⚠️ *Importante:*\n` +
            `- OAB: sempre UF + número (ex: MS 3616)\n` +
            `- Processo: formato CNJ com 20 dígitos`,
            { parse_mode: 'Markdown' }
        );
    });

    // Comando /oab
    bot.onText(/^\/oab\s+(.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const parsed = parseMensagem(msg.text);

        if (parsed.tipo !== 'oab' || !parsed.uf || !parsed.numero) {
            bot.sendMessage(chatId, '❌ Formato inválido. Use: `/oab UF NUMERO`\nEx: `/oab MS 3616`', { parse_mode: 'Markdown' });
            return;
        }

        bot.sendMessage(chatId, `🔍 Buscando processos para OAB ${parsed.uf} ${parsed.numero}...`);
        await processarConsulta(bot, chatId, parsed, userId);
    });

    // Mensagens normais (processos, OAB sem comando, nomes)
    bot.on('message', async (msg) => {
        // Ignora comandos já tratados
        if (msg.text?.startsWith('/')) return;

        const parsed = parseMensagem(msg.text);

        if (parsed.tipo === 'desconhecido') {
            bot.sendMessage(msg.chat.id,
                '🤔 Não entendi. Envie um número de processo, OAB ou nome.\n' +
                'Digite /help para ver como usar.'
            );
            return;
        }

        let label = '';
        if (parsed.tipo === 'oab') label = `OAB ${parsed.uf} ${parsed.numero}`;
        else if (parsed.tipo === 'processo') label = `processo ${parsed.numero}`;
        else label = `"${parsed.texto}"`;

        bot.sendMessage(msg.chat.id, `🔍 Buscando ${label}...`);
        await processarConsulta(bot, msg.chat.id, parsed, userId);
    });

    bots[token] = bot;
}

async function processarConsulta(bot, chatId, query, userId) {
    try {
        const userRes = await pool.query(
            "SELECT * FROM usuarios WHERE id=$1",
            [userId]
        );
        const user = userRes.rows[0];

        const resultados = await consultarProcesso(query, user);

        if (!resultados || resultados.length === 0) {
            bot.sendMessage(chatId,
                '❌ *Nenhum resultado encontrado.*\n\n' +
                'Verifique se os dados estão corretos.\n' +
                'Para OAB, use: `/oab UF NUMERO` (ex: `/oab MS 3616`)',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Se for um único resultado (formato antigo, compatível)
        const lista = Array.isArray(resultados) ? resultados : [resultados];

        // Limita a 15 resultados para não sobrecarregar o Telegram
        const exibir = lista.slice(0, 15);

        for (const dados of exibir) {
            await pool.query(
                `INSERT INTO processos (numero, usuario_id, ultimo_status) 
                 VALUES ($1,$2,$3) 
                 ON CONFLICT (numero, usuario_id) DO UPDATE SET ultimo_status=$3`,
                [dados.numero, userId, dados.data]
            );

            const mensagem = formatarResultado(dados);
            bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });

            // Pequena pausa para não floodar
            if (exibir.length > 3) {
                await new Promise(r => setTimeout(r, 300));
            }
        }

        if (lista.length > 15) {
            bot.sendMessage(chatId,
                `📊 *Mostrando 15 de ${lista.length} resultados.*\n` +
                `Para ver todos, refine a busca com /oab UF NUMERO`,
                { parse_mode: 'Markdown' }
            );
        }

    } catch (err) {
        console.error('[BotManager] Erro na consulta:', err);
        bot.sendMessage(chatId, '⚠️ Erro ao consultar. Tente novamente mais tarde.');
    }
}

function formatarResultado(dados) {
    let msg = '';
    msg += `📄 *${dados.numero || 'N/A'}*\n`;
    msg += `🏛️ Tribunal: ${dados.tribunal || 'N/A'}\n`;
    msg += `📚 Classe: ${dados.classe || 'N/A'}\n`;
    if (dados.grau) msg += `📊 Grau: ${dados.grau}\n`;
    if (dados.orgaoJulgador) msg += `⚖️ Órgão: ${dados.orgaoJulgador}\n`;
    if (dados.fonte) msg += `🔍 Fonte: ${dados.fonte}\n`;
    msg += `🕒 Atualizado: ${dados.data || 'N/A'}`;
    return msg;
}

async function carregarBots() {
    const res = await pool.query("SELECT * FROM usuarios WHERE bot_token IS NOT NULL");

    for (let user of res.rows) {
        iniciarBot(user.bot_token, user.id);
    }
}

module.exports = { carregarBots, iniciarBot };
