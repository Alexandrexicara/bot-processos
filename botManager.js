const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const pool = require('./db');
const { consultarProcesso } = require('./apiRouter');
const { parseMensagem } = require('./parser');
const { gerarPDFProcesso } = require('./services/pdfService');

const bots = {};
const BASE_URL = process.env.BASE_URL || '';

async function iniciarBot(token, userId) {

    if (!token || !token.trim()) {
        console.log(`[BotManager] ⚠️ Token vazio para userId=${userId}, ignorando`);
        return;
    }
    if (bots[token]) {
        console.log(`[BotManager] ⚠️ Bot já ativo para token ...${token.slice(-8)}`);
        return;
    }

    // Valida o token antes de iniciar
    try {
        const testBot = new TelegramBot(token);
        const me = await testBot.getMe();
        console.log(`[BotManager] ✅ Token válido: @${me.username} (userId=${userId})`);
    } catch (err) {
        console.error(`[BotManager] ❌ Token inválido para userId=${userId}: ${err.message}`);
        try {
            await pool.query("UPDATE usuarios SET bot_token = NULL WHERE id = $1", [userId]);
        } catch (e) {}
        return;
    }

    const options = {};
    if (!BASE_URL) {
        options.polling = true;
    }

    const bot = new TelegramBot(token, options);

    bot.on('polling_error', (err) => {
        if (err.code === 'ETELEGRAM' && err.message?.includes('404')) {
            console.error(`[BotManager] ❌ Token inválido (404). Parando bot userId=${userId}`);
            bot.stopPolling();
            delete bots[token];
        } else {
            console.error(`[BotManager] ⚠️ Polling error userId=${userId}:`, err.message);
        }
    });

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

        await processarConsultaArquivo(bot, chatId, parsed, userId, `OAB ${parsed.uf}${parsed.numero}`);
    });

    // Comando /detalhes - busca detalhes de um processo por número
    bot.onText(/^\/detalhes\s+(.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const numero = match[1].trim();
        
        bot.sendMessage(chatId, `🔍 Buscando detalhes de ${numero}...`);
        const query = { tipo: 'processo', numero: numero, original: numero };
        await processarConsultaIndividual(bot, chatId, query, userId);
    });

    // Mensagens normais (processos, OAB sem comando, nomes)
    bot.on('message', async (msg) => {
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
        if (parsed.tipo === 'oab') label = `OAB ${parsed.uf}${parsed.numero}`;
        else if (parsed.tipo === 'processo') label = `processo ${parsed.numero}`;
        else if (parsed.tipo === 'cpf') label = `CPF ${parsed.numero}`;
        else if (parsed.tipo === 'cnpj') label = `CNPJ ${parsed.numero}`;
        else label = `"${parsed.texto}"`;

        // Para OAB, CPF, CNPJ e nome → gera arquivo .txt com todos os resultados
        // Para processo individual → mostra detalhes na mensagem
        if (parsed.tipo === 'processo') {
            await processarConsultaIndividual(bot, msg.chat.id, parsed, userId);
        } else {
            await processarConsultaArquivo(bot, msg.chat.id, parsed, userId, label);
        }
    });

    // ── Callback queries dos botões inline ──────────────
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        
        try {
            if (data.startsWith('pdf:')) {
                const numero = data.substring(4);
                bot.answerCallbackQuery(query.id, { text: '⚡ Gerando PDF...' });
                
                const proc = await pool.query(
                    'SELECT * FROM processos WHERE numero=$1 AND usuario_id=$2 LIMIT 1',
                    [numero, userId]
                );
                
                let dadosPDF;
                if (proc.rows.length > 0) {
                    const userRes = await pool.query('SELECT * FROM usuarios WHERE id=$1', [userId]);
                    const resultados = await consultarProcesso(numero, userRes.rows[0]);
                    const lista = Array.isArray(resultados) ? resultados : [resultados];
                    dadosPDF = lista.find(r => r.numero === numero) || lista[0] || { numero, ultimo_status: proc.rows[0].ultimo_status };
                } else {
                    dadosPDF = { numero };
                }

                const pdfBuffer = await gerarPDFProcesso(dadosPDF);
                const fileName = `processo_${numero.replace(/[^0-9]/g, '')}.pdf`;
                
                await bot.sendDocument(chatId, pdfBuffer, {}, {
                    filename: fileName,
                    contentType: 'application/pdf'
                });
                
            } else if (data.startsWith('share:')) {
                const numero = data.substring(6);
                bot.answerCallbackQuery(query.id, { text: '📋 Mensagem pronta!' });
                
                const userRes = await pool.query('SELECT * FROM usuarios WHERE id=$1', [userId]);
                const resultados = await consultarProcesso(numero, userRes.rows[0]);
                const lista = Array.isArray(resultados) ? resultados : [resultados];
                const detalhe = lista.find(r => r.numero === numero) || lista[0] || {};
                
                const msg = formatarResultado({ ...detalhe, numero });
                bot.sendMessage(chatId, '📤 *Compartilhe esta mensagem:*\n\n' + msg, { parse_mode: 'Markdown' });
            }
        } catch (err) {
            console.error('[BotManager] Erro callback:', err.message);
            bot.answerCallbackQuery(query.id, { text: '❌ Erro ao processar' });
        }
    });

    bots[token] = bot;
    bot.userId = userId;
    console.log(`[BotManager] 🤖 Bot iniciado para userId=${userId}`);
}

// ═══════════════════════════════════════════════════════════
// MODO LINK: Busca múltiplos resultados e envia LINK para página web
// O usuário clica no link e vê todos os processos com links para tribunais
// ═══════════════════════════════════════════════════════════
async function processarConsultaArquivo(bot, chatId, query, userId, label) {
    // 1. "Buscando processos..."
    const msgBuscando = await bot.sendMessage(chatId, `🔍 Buscando processos...`);

    // Keep-alive typing
    bot.sendChatAction(chatId, 'typing');
    const typingInterval = setInterval(() => {
        bot.sendChatAction(chatId, 'typing');
    }, 4000);

    try {
        const userRes = await pool.query("SELECT * FROM usuarios WHERE id=$1", [userId]);
        const user = userRes.rows[0];

        const resultados = await consultarProcesso(query, user);

        clearInterval(typingInterval);

        if (!resultados || resultados.length === 0) {
            await bot.editMessageText('❌ Nenhum processo encontrado.', {
                chat_id: chatId, message_id: msgBuscando.message_id
            });
            return;
        }

        const lista = Array.isArray(resultados) ? resultados : [resultados];

        // 2. "✅ Encontrados X processos"
        await bot.editMessageText(
            `✅ Encontrados ${lista.length} processos\n\n⏳ Gerando link com todos os detalhes...`,
            { chat_id: chatId, message_id: msgBuscando.message_id }
        );

        // Salvar processos no banco
        for (const dados of lista) {
            try {
                await pool.query(
                    `INSERT INTO processos (numero, usuario_id, ultimo_status) VALUES ($1,$2,$3)`,
                    [dados.numero, userId, dados.data]
                );
            } catch (dbErr) {
                if (dbErr.code !== '23505') {
                    console.error('[BotManager] Erro ao salvar processo:', dbErr.message);
                }
            }
        }

        // 3. Gerar ID único para a consulta pública
        const consultaId = crypto.randomBytes(16).toString('hex');
        const telefones = coletarTelefones(lista);

        // 4. Salvar consulta pública no banco
        const queryTexto = query.tipo === 'oab'
            ? `OAB ${query.uf} ${query.numero}`
            : `${query.tipo}: ${query.numero}`;

        await pool.query(
            `INSERT INTO consultas_publicas (id, tipo, query_texto, label, resultados, telefones)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [consultaId, query.tipo || 'outro', queryTexto, label, JSON.stringify(lista), JSON.stringify(telefones)]
        );

        // 5. Gerar o link público
        const linkPublico = BASE_URL ? `${BASE_URL}/resultados/${consultaId}` : `https://bot-processos.onrender.com/resultados/${consultaId}`;

        // 6. Enviar mensagem com "detalhes.txt" como LINK AZUL clicável
        const temTelefones = telefones.length > 0;
        const msgFinal =
            `✅ <b>${lista.length} processo(s) encontrado(s)</b>\n\n` +
            `📄 <a href="${linkPublico}">detalhes.txt</a>\n\n` +
            `${query.tipo === 'oab' ? `OAB: ${query.uf}${query.numero}` : `Busca: ${label}`}\n` +
            `${temTelefones ? '📞 Telefones encontrados — veja no arquivo' : ''}\n` +
            `\n💡 Clique em <b>detalhes.txt</b> para ver todos os processos`;

        await bot.editMessageText(msgFinal, {
            chat_id: chatId,
            message_id: msgBuscando.message_id,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        });

        // 7. Botões de ação: PDF completo
        const botoes = {
            inline_keyboard: [
                [
                    { text: '📥 PDF Completo', callback_data: 'pdf_todos:' + label }
                ]
            ]
        };
        bot.sendMessage(chatId, '📊 Deseja gerar o PDF completo com todos os processos?', { reply_markup: botoes });

    } catch (err) {
        clearInterval(typingInterval);
        console.error('[BotManager] Erro na consulta:', err);
        try {
            await bot.editMessageText('⚠️ Erro ao consultar. Tente novamente mais tarde.', {
                chat_id: chatId, message_id: msgBuscando.message_id
            });
        } catch (e) {
            bot.sendMessage(chatId, '⚠️ Erro ao consultar. Tente novamente mais tarde.');
        }
    }
}

// ═══════════════════════════════════════════════════════════
// MODO INDIVIDUAL: Busca um processo e mostra detalhes + botões
// ═══════════════════════════════════════════════════════════
async function processarConsultaIndividual(bot, chatId, query, userId) {
    bot.sendChatAction(chatId, 'typing');
    const typingInterval = setInterval(() => {
        bot.sendChatAction(chatId, 'typing');
    }, 4000);

    try {
        const userRes = await pool.query("SELECT * FROM usuarios WHERE id=$1", [userId]);
        const user = userRes.rows[0];

        const resultados = await consultarProcesso(query, user);

        clearInterval(typingInterval);

        if (!resultados || resultados.length === 0) {
            bot.sendMessage(chatId,
                '❌ *Nenhum resultado encontrado.*\n\n' +
                'Verifique se o número do processo está correto.\n' +
                'Formato: `NNNNNNN-DD.AAAA.J.TR.OOOO` (20 dígitos)',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const lista = Array.isArray(resultados) ? resultados : [resultados];

        for (const dados of lista.slice(0, 5)) {
            try {
                await pool.query(
                    `INSERT INTO processos (numero, usuario_id, ultimo_status) VALUES ($1,$2,$3)`,
                    [dados.numero, userId, dados.data]
                );
            } catch (dbErr) {
                if (dbErr.code !== '23505') {
                    console.error('[BotManager] Erro ao salvar processo:', dbErr.message);
                }
            }

            const mensagem = formatarResultado(dados);
            
            const botoes = {
                inline_keyboard: [
                    [
                        { text: '📥 PDF', callback_data: `pdf:${dados.numero}` },
                        { text: '📤 Compartilhar', callback_data: `share:${dados.numero}` }
                    ]
                ]
            };
            
            bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown', reply_markup: botoes });

            if (lista.length > 3) {
                await new Promise(r => setTimeout(r, 300));
            }
        }

    } catch (err) {
        clearInterval(typingInterval);
        console.error('[BotManager] Erro na consulta:', err);
        bot.sendMessage(chatId, '⚠️ Erro ao consultar. Tente novamente mais tarde.');
    }
}

// ═══════════════════════════════════════════════════════════
// Gerar conteúdo do arquivo .txt com todos os detalhes
// ═══════════════════════════════════════════════════════════
function gerarArquivoDetalhes(lista, query, label) {
    const linhas = [];
    const separador = '═'.repeat(60);
    const separadorFino = '─'.repeat(60);

    // Cabeçalho
    linhas.push(separador);
    linhas.push(`  RELATÓRIO DE PROCESSOS - ${label}`);
    linhas.push(`  Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    linhas.push(`  Total de processos: ${lista.length}`);
    linhas.push(separador);
    linhas.push('');

    // Resumo de telefones encontrados
    const todosTelefones = coletarTelefones(lista);
    if (todosTelefones.length > 0) {
        linhas.push('📞 TELEFONES ENCONTRADOS:');
        for (const tel of todosTelefones) {
            linhas.push(`  ${tel.nome}: ${tel.numero}`);
        }
        linhas.push('');
        linhas.push(separadorFino);
        linhas.push('');
    }

    // Detalhes de cada processo
    for (let i = 0; i < lista.length; i++) {
        const p = lista[i];
        
        linhas.push(`PROCESSO ${i + 1} de ${lista.length}`);
        linhas.push(separadorFino);
        linhas.push(`Número: ${p.numero || 'N/A'}`);
        // Link público para visualizar o processo completo
        if (p.numero && BASE_URL) {
            linhas.push(`LINK: ${BASE_URL}/processo/${encodeURIComponent(p.numero)}`);
        }
        linhas.push(`Tribunal: ${p.tribunal || p.tribunal_descricao || 'N/A'}`);
        if (p.classe) linhas.push(`Classe: ${p.classe}`);
        if (p.assunto) linhas.push(`Assunto: ${p.assunto}`);
        if (p.area) linhas.push(`Área: ${p.area}`);
        if (p.grau) linhas.push(`Grau: ${p.grau}`);
        if (p.situacao) linhas.push(`Situação: ${p.situacao}`);
        if (p.orgaoJulgador) linhas.push(`Órgão Julgador: ${p.orgaoJulgador}`);
        if (p.relator) linhas.push(`Relator: ${p.relator}`);
        if (p.valor_causa) linhas.push(`Valor da Causa: ${p.valor_causa}`);
        if (p.polo_ativo) linhas.push(`Polo Ativo (Autor): ${p.polo_ativo}`);
        if (p.polo_passivo) linhas.push(`Polo Passivo (Réu): ${p.polo_passivo}`);
        if (p.fase) linhas.push(`Fase: ${p.fase}`);
        if (p.origem) linhas.push(`Origem: ${p.origem}`);
        if (p.sistema) linhas.push(`Sistema: ${p.sistema}`);
        if (p.estado) linhas.push(`Estado: ${p.estado}`);
        if (p.unidade) linhas.push(`Unidade: ${p.unidade}`);
        if (p.segredo_justica) linhas.push(`Segredo de Justiça: Sim`);
        if (p.data) linhas.push(`Data de Início: ${p.data}`);
        if (p.data_ultima_movimentacao) linhas.push(`Última Movimentação: ${p.data_ultima_movimentacao}`);
        if (p.quantidade_movimentacoes) linhas.push(`Total de Movimentações: ${p.quantidade_movimentacoes}`);
        if (p.fonte) linhas.push(`Fonte: ${p.fonte}`);

        // Partes detalhadas com telefones
        if (p.partes && p.partes.length > 0) {
            linhas.push('');
            linhas.push('  PARTES E ADVOGADOS:');
            for (const parte of p.partes) {
                const tipo = parte.tipo || parte.polo || 'Parte';
                linhas.push(`  [${tipo}] ${parte.nome || 'N/A'}`);
                if (parte.cpf) linhas.push(`    CPF: ${parte.cpf}`);
                if (parte.cnpj) linhas.push(`    CNPJ: ${parte.cnpj}`);
                if (parte.telefone) linhas.push(`    📞 Tel: ${parte.telefone}`);
                if (parte.email) linhas.push(`    📧 Email: ${parte.email}`);
                if (parte.endereco) linhas.push(`    📍 Endereço: ${parte.endereco}`);
                if (parte.advogados && parte.advogados.length > 0) {
                    for (const adv of parte.advogados) {
                        linhas.push(`    👨‍⚖️ Advogado: ${typeof adv === 'string' ? adv : adv.nome || adv}`);
                        if (typeof adv === 'object' && adv.oab) linhas.push(`      OAB: ${adv.oab}`);
                        if (typeof adv === 'object' && adv.telefone) linhas.push(`      📞 Tel: ${adv.telefone}`);
                    }
                }
            }
        }

        // Informações complementares
        if (p.info_complementares && Object.keys(p.info_complementares).length > 0) {
            linhas.push('');
            linhas.push('  INFORMAÇÕES COMPLEMENTARES:');
            for (const [chave, valor] of Object.entries(p.info_complementares)) {
                const label2 = chave.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                linhas.push(`  ${label2}: ${valor}`);
            }
        }

        // Movimentações
        if (p.movimentacoes && p.movimentacoes.length > 0) {
            linhas.push('');
            linhas.push(`  MOVIMENTAÇÕES (${p.movimentacoes.length}):`);
            for (const mov of p.movimentacoes.slice(0, 30)) {
                linhas.push(`  ${mov.data || ''} — ${mov.descricao || mov.texto || ''}`);
            }
        }

        linhas.push('');
        linhas.push(separador);
        linhas.push('');
    }

    // Rodapé
    linhas.push('Relatório gerado pelo Processo Bot CNJ');
    linhas.push(`Data: ${new Date().toLocaleString('pt-BR')}`);

    return linhas.join('\n');
}

// ═══════════════════════════════════════════════════════════
// Coletar telefones de todos os processos
// ═══════════════════════════════════════════════════════════
function coletarTelefones(lista) {
    const telefones = [];
    for (const p of lista) {
        if (p.partes) {
            for (const parte of p.partes) {
                if (parte.telefone) {
                    telefones.push({ nome: parte.nome, numero: parte.telefone });
                }
                if (parte.advogados) {
                    for (const adv of parte.advogados) {
                        if (typeof adv === 'object' && adv.telefone) {
                            telefones.push({ nome: adv.nome || parte.nome, numero: adv.telefone });
                        }
                    }
                }
            }
        }
    }
    return telefones;
}

// ═══════════════════════════════════════════════════════════
// Formatar resultado individual para mensagem do Telegram
// ═══════════════════════════════════════════════════════════
function formatarResultado(dados) {
    let msg = '';
    msg += `📄 *${dados.numero || 'N/A'}*\n`;
    msg += `🏛️ Tribunal: ${dados.tribunal || 'N/A'}\n`;
    if (dados.grau) msg += `📊 Grau: ${dados.grau}\n`;
    msg += `📚 Classe: ${dados.classe || 'N/A'}\n`;
    if (dados.assunto) msg += `📝 Assunto: ${dados.assunto}\n`;
    if (dados.area) msg += `📂 Área: ${dados.area}\n`;
    if (dados.situacao) msg += `📌 Situação: ${dados.situacao}\n`;
    if (dados.orgaoJulgador) msg += `⚖️ Órgão: ${dados.orgaoJulgador}\n`;
    if (dados.relator) msg += `👨‍⚖️ Relator: ${dados.relator}\n`;
    if (dados.valor_causa) msg += `💰 Valor: R$ ${dados.valor_causa}\n`;
    if (dados.polo_ativo) msg += `➡️ Autor: ${dados.polo_ativo}\n`;
    if (dados.polo_passivo) msg += `⬅️ Réu: ${dados.polo_passivo}\n`;
    
    if (dados.partes && dados.partes.length > 0) {
        msg += `\n👥 *Partes:*\n`;
        for (const parte of dados.partes.slice(0, 6)) {
            const tipo = parte.tipo || parte.polo || '';
            msg += `  • _${tipo}_: ${parte.nome}`;
            if (parte.advogados && parte.advogados.length > 0) {
                msg += ` (Adv: ${parte.advogados.slice(0, 2).map(a => typeof a === 'string' ? a : a.nome || a).join(', ')})`;
            }
            msg += `\n`;
        }
    }
    
    if (dados.fase) msg += `\n📋 Fase: ${dados.fase}`;
    if (dados.origem) msg += `\n📍 Origem: ${dados.origem}`;
    if (dados.sistema) msg += `\n💻 Sistema: ${dados.sistema}`;
    if (dados.segredo_justica) msg += `\n🔒 Segredo de Justiça`;
    if (dados.quantidade_movimentacoes) msg += `\n📊 ${dados.quantidade_movimentacoes} movimentações`;
    if (dados.fonte) msg += `\n🔍 Fonte: ${dados.fonte}`;
    msg += `\n🕒 Atualizado: ${dados.data_ultima_movimentacao || dados.data || 'N/A'}`;
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
