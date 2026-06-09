const TelegramBot = require('node-telegram-bot-api');
const pool = require('./db');
const { consultarProcesso } = require('./apiRouter');
const { parseMensagem } = require('./parser');

const bots = {};
const BASE_URL = process.env.BASE_URL || ''; // ex: https://meuapp.onrender.com

async function iniciarBot(token, userId) {

    if (!token || !token.trim()) {
        console.log(`[BotManager] ⚠️ Token vazio para userId=${userId}, ignorando`);
        return;
    }
    if (bots[token]) {
        console.log(`[BotManager] ⚠️ Bot já ativo para token ...${token.slice(-8)}`);
        return;
    }

    const options = {};
    if (!BASE_URL) {
        // Apenas local: polling
        options.polling = true;
    }

    const bot = new TelegramBot(token, options);

    // Registra webhook se em produção (rota /webhook/:userId no server.js)
    if (BASE_URL) {
        try {
            const webhookUrl = `${BASE_URL}/webhook/${userId}`;
            await bot.setWebHook(webhookUrl);
            console.log(`[BotManager] 🌐 Webhook registrado: ${webhookUrl}`);
        } catch (err) {
            console.error(`[BotManager] ❌ Falha ao registar webhook userId=${userId}:`, err.message);
        }
    } else {
        console.log(`[BotManager] 📡 Polling local ativo`);
    }

    // Comando /start
    bot.onText(/^\/start$/, (msg) => {
        bot.sendMessage(msg.chat.id,
            `🤖 *Bot de Processos ativo!*\n\n` +
            `Envie:\n` +
            `📄 *Número do processo* — ex: \`0000000-00.0000.0.00.0000\`\n` +
            `👤 *OAB* — ex: \`/oab MS 3616\` ou \`MS3616\`\n` +
            `🪪 *CPF/CNPJ* — envia o número direto (11 ou 14 dígitos)\n` +
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
            `🪪 *Buscar por CPF/CNPJ:*\n` +
            `Envie o número (11 dígitos CPF, 14 dígitos CNPJ)\n\n` +
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
        else if (parsed.tipo === 'cpf') label = `CPF ${parsed.numero}`;
        else if (parsed.tipo === 'cnpj') label = `CNPJ ${parsed.numero}`;
        else label = `"${parsed.texto}"`;

        bot.sendMessage(msg.chat.id, `🔍 Buscando ${label}...`);
        await processarConsulta(bot, msg.chat.id, parsed, userId);
    });

    bots[token] = bot;
    bot.userId = userId; // guarda userId no bot para webhook
    console.log(`[BotManager] 🤖 Bot iniciado para userId=${userId}`);
}

async function processarConsulta(bot, chatId, query, userId) {
    // ⏳ Indicador "a escrever..." no Telegram enquanto busca
    bot.sendChatAction(chatId, 'typing');
    const typingInterval = setInterval(() => {
        bot.sendChatAction(chatId, 'typing');
    }, 4000);

    try {
        const userRes = await pool.query(
            "SELECT * FROM usuarios WHERE id=$1",
            [userId]
        );
        const user = userRes.rows[0];

        const resultados = await consultarProcesso(query, user);

        // ⏳ Para o indicador de typing
        clearInterval(typingInterval);

        if (!resultados || resultados.length === 0) {
            if (query.tipo === 'oab') {
                bot.sendMessage(chatId,
                    '⚠️ *OAB não encontrada.*\n\n' +
                    'A busca por OAB funciona através da API Escavador.\n' +
                    'Se a chave ESCAVADOR_API_KEY não estiver configurada no servidor, a busca OAB fica limitada.\n\n' +
                    '🔹 *Alternativa gratuita:* pesquise pelo *número do processo*\n' +
                    '    Ex: `0001234-56.2025.8.19.0001`',
                    { parse_mode: 'Markdown' }
                );
            } else {
                bot.sendMessage(chatId,
                    '❌ *Nenhum resultado encontrado.*\n\n' +
                    'Verifique se o número do processo está correto.\n' +
                    'Formato: `NNNNNNN-DD.AAAA.J.TR.OOOO` (20 dígitos)',
                    { parse_mode: 'Markdown' }
                );
            }
            return;
        }

        // Se for um único resultado (formato antigo, compatível)
        const lista = Array.isArray(resultados) ? resultados : [resultados];

        // Limita a 15 resultados para não sobrecarregar o Telegram
        const exibir = lista.slice(0, 15);

        for (const dados of exibir) {
            try {
                await pool.query(
                    `INSERT INTO processos (numero, usuario_id, ultimo_status) 
                     VALUES ($1,$2,$3)`,
                    [dados.numero, userId, dados.data]
                );
            } catch (dbErr) {
                // Ignora erro de duplicata, apenas loga
                if (dbErr.code !== '23505') {
                    console.error('[BotManager] Erro ao salvar processo:', dbErr.message);
                }
            }

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
        clearInterval(typingInterval);
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
    const res = await pool.query("SELECT * FROM usuarios WHERE bot_token IS NOT NULL AND bot_token != ''");

    for (let user of res.rows) {
        try {
            await iniciarBot(user.bot_token, user.id);
        } catch (err) {
            console.error(`[BotManager] Erro ao iniciar bot userId=${user.id}:`, err.message);
        }
    }
}

module.exports = { carregarBots, iniciarBot, bots };
