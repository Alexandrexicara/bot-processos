require('dotenv').config();
const express = require('express');
const pool = require('./db');
const { carregarBots, iniciarBot } = require('./botManager');
const { gerarToken, authMiddleware, adminMiddleware, hashSenha, verificarSenha } = require('./auth');
const { consultarProcesso } = require('./apiRouter');
const { gerarPDFProcesso } = require('./services/pdfService');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Limpa o telegram_id de links, @ e espaços
function limparTelegramId(raw) {
    if (!raw) return raw;
    let id = raw.trim();
    // Remove URLs: t.me/, https://t.me/, etc.
    id = id.replace(/https?:\/\/t\.me\//i, '');
    id = id.replace(/^t\.me\//i, '');
    // Remove @ do início
    id = id.replace(/^@/, '');
    // Remove barras extras
    id = id.replace(/\//g, '');
    return id;
}

// Registro de novo usuário — começa BLOQUEADO até admin aprovar pagamento
app.post('/auth/registro', async (req, res) => {
    const { email, senha, bot_token, api_key, modo, comprovante } = req.body;
    const telegram_id = limparTelegramId(req.body.telegram_id);

    try {
        const senhaHash = await hashSenha(senha);

        const result = await pool.query(
            "INSERT INTO usuarios (email, senha, telegram_id, bot_token, api_key, modo, ativo, comprovante) VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING id",
            [email, senhaHash, telegram_id, bot_token, api_key, modo || 'gratis', comprovante || null]
        );

        const userId = result.rows[0].id;

        // Log de novo cadastro pendente
        console.log(`[REGISTRO] Novo cadastro pendente: ${email} ${comprovante ? '| Comprovante: ' + comprovante : ''}`);

        res.json({
            success: true,
            id: userId,
            message: "Cadastro realizado com sucesso! Você já pode fazer login.",
            pagamento: {
                chave: 'santossilvac990@gmail.com',
                banco: 'PagBank',
                titular: 'Celio Santos Silva'
            }
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Email já cadastrado" });
        }
        res.status(500).json({ error: err.message });
    }
});

// Login
app.post('/auth/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const result = await pool.query(
            "SELECT * FROM usuarios WHERE email = $1",
            [email]
        );

        const user = result.rows[0];

        if (!user || !(await verificarSenha(senha, user.senha))) {
            return res.status(401).json({ error: "Email ou senha incorretos" });
        }

        // Bloquear login se usuário estiver inativo
        if (user.ativo === false) {
            return res.status(403).json({ error: "Conta bloqueada. Contacte o administrador." });
        }

        const token = gerarToken(user);

        // Atualizar último login
        await pool.query("UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                tipo: user.tipo,
                ativo: user.ativo,
                status_pagamento: user.status_pagamento
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cadastrar usuário (protegido - apenas admin)
app.post('/usuario', authMiddleware, adminMiddleware, async (req, res) => {
    const { bot_token, api_key, modo, email, senha, tipo: tipoBody } = req.body;
    const telegram_id = limparTelegramId(req.body.telegram_id);

    try {
        const senhaHash = senha ? await hashSenha(senha) : null;
        const tipo = tipoBody || 'cliente';

        const result = await pool.query(
            "INSERT INTO usuarios (email, senha, telegram_id, bot_token, api_key, modo, tipo, ativo, status_pagamento) VALUES ($1,$2,$3,$4,$5,$6,$7,true,'aprovado') RETURNING id",
            [email, senhaHash, telegram_id, bot_token, api_key, modo || 'gratis', tipo]
        );

        const userId = result.rows[0].id;

        if (bot_token) {
            await iniciarBot(bot_token, userId);
        }

        res.json({ success: true, id: userId, message: "Usuário criado e bot iniciado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar processos do usuário logado (cliente vê apenas os seus, admin vê todos)
app.get('/processos', authMiddleware, async (req, res) => {
    try {
        let query = "SELECT p.*, u.email as usuario_email FROM processos p JOIN usuarios u ON p.usuario_id = u.id";
        let params = [];

        if (req.user.tipo !== 'admin') {
            query += " WHERE p.usuario_id = $1";
            params = [req.user.id];
        }

        const data = await pool.query(query, params);
        res.json(data.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Buscar detalhes de um processo específico (reconsulta na API)
app.get('/processos/:id/detalhes', authMiddleware, async (req, res) => {
    try {
        const proc = await pool.query(
            "SELECT p.*, u.email as usuario_email FROM processos p JOIN usuarios u ON p.usuario_id = u.id WHERE p.id = $1",
            [req.params.id]
        );
        if (proc.rows.length === 0) {
            return res.status(404).json({ error: 'Processo não encontrado' });
        }

        // Verifica permissão
        const processo = proc.rows[0];
        if (req.user.tipo !== 'admin' && processo.usuario_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        // Reconsulta na API para dados atualizados
        const userRes = await pool.query("SELECT * FROM usuarios WHERE id=$1", [processo.usuario_id]);
        const user = userRes.rows[0];

        const resultados = await consultarProcesso(processo.numero, user);
        const lista = Array.isArray(resultados) ? resultados : [resultados];
        
        // Busca o processo específico ou retorna o primeiro
        const detalhe = lista.find(r => r.numero === processo.numero) || lista[0] || {};
        
        // Atualiza status se mudou
        if (detalhe.data && detalhe.data !== processo.ultimo_status) {
            await pool.query(
                "UPDATE processos SET ultimo_status=$1, atualizado_em=CURRENT_TIMESTAMP WHERE id=$2",
                [detalhe.data, processo.id]
            );
            processo.ultimo_status = detalhe.data;
        }

        res.json({
            ...processo,
            detalhes: detalhe,
            fonte: detalhe.fonte || 'N/A'
        });
    } catch (err) {
        console.error('[Detalhes] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Gerar PDF de um processo
app.get('/processos/:id/pdf', authMiddleware, async (req, res) => {
    try {
        const proc = await pool.query(
            "SELECT p.*, u.email as usuario_email FROM processos p JOIN usuarios u ON p.usuario_id = u.id WHERE p.id = $1",
            [req.params.id]
        );
        if (proc.rows.length === 0) {
            return res.status(404).json({ error: 'Processo não encontrado' });
        }

        const processo = proc.rows[0];
        if (req.user.tipo !== 'admin' && processo.usuario_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        // Busca dados atualizados
        const userRes = await pool.query("SELECT * FROM usuarios WHERE id=$1", [processo.usuario_id]);
        const user = userRes.rows[0];
        const resultados = await consultarProcesso(processo.numero, user);
        const lista = Array.isArray(resultados) ? resultados : [resultados];
        const detalhe = lista.find(r => r.numero === processo.numero) || lista[0] || {};

        // Mescla dados do banco com dados da API
        const dadosPDF = {
            ...detalhe,
            numero: processo.numero,
            ultimo_status: processo.ultimo_status
        };

        const pdfBuffer = await gerarPDFProcesso(dadosPDF);
        
        const fileName = `processo_${processo.numero.replace(/[^0-9]/g, '')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('[PDF] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao gerar PDF: ' + err.message });
    }
});

// Gerar PDF de todos os processos do usuário (com dados completos da API)
app.get('/processos/todos/pdf', authMiddleware, async (req, res) => {
    try {
        let query = "SELECT p.*, u.email as usuario_email FROM processos p JOIN usuarios u ON p.usuario_id = u.id";
        let params = [];
        if (req.user.tipo !== 'admin') {
            query += " WHERE p.usuario_id = $1";
            params = [req.user.id];
        }
        const data = await pool.query(query, params);
        
        // Consulta a API para cada processo para ter dados completos
        const dadosCompletos = [];
        for (const proc of data.rows) {
            try {
                const userRes = await pool.query('SELECT * FROM usuarios WHERE id=$1', [proc.usuario_id]);
                const user = userRes.rows[0];
                const resultados = await consultarProcesso(proc.numero, user);
                const lista = Array.isArray(resultados) ? resultados : [resultados];
                const detalhe = lista.find(r => r.numero === proc.numero) || lista[0] || {};
                dadosCompletos.push({ ...detalhe, numero: proc.numero, ultimo_status: proc.ultimo_status });
            } catch (e) {
                console.error(`[PDF Todos] Erro ao consultar ${proc.numero}:`, e.message);
                dadosCompletos.push({ numero: proc.numero, ultimo_status: proc.ultimo_status });
            }
        }
        
        const pdfBuffer = await gerarPDFProcesso(dadosCompletos);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="todos_processos.pdf"');
        res.send(pdfBuffer);
    } catch (err) {
        console.error('[PDF Todos] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao gerar PDF: ' + err.message });
    }
});

// Gerar PDF de processos selecionados (por IDs)
app.post('/processos/selecionados/pdf', authMiddleware, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Nenhum processo selecionado' });
        }

        let query = "SELECT p.*, u.email as usuario_email FROM processos p JOIN usuarios u ON p.usuario_id = u.id WHERE p.id = ANY($1)";
        let params = [ids];
        if (req.user.tipo !== 'admin') {
            query += " AND p.usuario_id = $2";
            params = [ids, req.user.id];
        }
        const data = await pool.query(query, params);
        
        // Consulta a API para cada processo selecionado
        const dadosCompletos = [];
        for (const proc of data.rows) {
            try {
                const userRes = await pool.query('SELECT * FROM usuarios WHERE id=$1', [proc.usuario_id]);
                const user = userRes.rows[0];
                const resultados = await consultarProcesso(proc.numero, user);
                const lista = Array.isArray(resultados) ? resultados : [resultados];
                const detalhe = lista.find(r => r.numero === proc.numero) || lista[0] || {};
                dadosCompletos.push({ ...detalhe, numero: proc.numero, ultimo_status: proc.ultimo_status });
            } catch (e) {
                console.error(`[PDF Selecionados] Erro ao consultar ${proc.numero}:`, e.message);
                dadosCompletos.push({ numero: proc.numero, ultimo_status: proc.ultimo_status });
            }
        }
        
        const pdfBuffer = await gerarPDFProcesso(dadosCompletos);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="processos_selecionados.pdf"');
        res.send(pdfBuffer);
    } catch (err) {
        console.error('[PDF Selecionados] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao gerar PDF: ' + err.message });
    }
});

// Listar todos os usuários (apenas admin)
app.get('/usuarios', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const data = await pool.query(
            `SELECT u.id, u.email, u.tipo, u.telegram_id, u.modo, u.ativo, u.criado_em, u.ultimo_login,
                    u.comprovante, u.status_pagamento,
                    COUNT(p.id) as total_processos
             FROM usuarios u
             LEFT JOIN processos p ON p.usuario_id = u.id
             GROUP BY u.id
             ORDER BY u.criado_em DESC`
        );
        res.json(data.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bloquear/desbloquear usuário (apenas admin)
app.put('/usuario/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { ativo, modo, tipo, status_pagamento } = req.body;
    const userId = req.params.id;

    try {
        const sets = [];
        const params = [];
        let idx = 1;

        if (ativo !== undefined) {
            sets.push(`ativo = $${idx++}`);
            params.push(ativo);
        }
        if (modo !== undefined) {
            sets.push(`modo = $${idx++}`);
            params.push(modo);
        }
        if (tipo !== undefined) {
            sets.push(`tipo = $${idx++}`);
            params.push(tipo);
        }
        if (status_pagamento !== undefined) {
            sets.push(`status_pagamento = $${idx++}`);
            params.push(status_pagamento);
        }

        if (sets.length === 0) {
            return res.status(400).json({ error: "Nenhum campo para atualizar" });
        }

        params.push(userId);
        await pool.query(
            `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${idx}`,
            params
        );

        res.json({ success: true, message: "Usuário atualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verificar token (perfil do usuário)
app.get('/auth/me', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, email, tipo, telegram_id, bot_token, api_key, modo, ativo, comprovante, status_pagamento, criado_em FROM usuarios WHERE id = $1",
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Atualizar configuração do bot (usuário logado)
app.put('/auth/config', authMiddleware, async (req, res) => {
    const telegram_id = limparTelegramId(req.body.telegram_id);
    const bot_token = req.body.bot_token || undefined;
    const api_key = req.body.api_key || undefined;
    const modo = req.body.modo || undefined;

    try {
        // Busca dados atuais para preservar o que não foi informado
        const current = await pool.query(
            "SELECT telegram_id, bot_token, api_key, modo FROM usuarios WHERE id=$1",
            [req.user.id]
        );
        const c = current.rows[0];

        await pool.query(
            "UPDATE usuarios SET telegram_id=$1, bot_token=$2, api_key=$3, modo=$4 WHERE id=$5",
            [
                telegram_id || c.telegram_id,
                bot_token || c.bot_token,
                api_key || c.api_key,
                modo || c.modo,
                req.user.id
            ]
        );

        // Se informou bot_token, inicia o bot
        const tokenFinal = bot_token || c.bot_token;
        if (tokenFinal) {
            await iniciarBot(tokenFinal, req.user.id);
        }

        res.json({ success: true, message: "Configuração atualizada e bot iniciado!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Enviar comprovante de pagamento (usuário logado)
app.put('/auth/comprovante', authMiddleware, async (req, res) => {
    const { comprovante } = req.body;

    try {
        await pool.query(
            "UPDATE usuarios SET comprovante=$1, status_pagamento='pendente' WHERE id=$2",
            [comprovante, req.user.id]
        );

        res.json({ success: true, message: "Comprovante enviado! Aguarde a aprovação do administrador." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── ENDPOINTS PÚBLICOS (sem autenticação) ──
// Página pública de resultados da consulta (lista de processos)
app.get('/resultados/:id', (req, res) => {
    res.sendFile(__dirname + '/public/resultados.html');
});

// API pública: retorna dados da consulta
app.get('/api/resultados/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM consultas_publicas WHERE id=$1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Consulta não encontrada' });
        }
        const c = result.rows[0];
        res.json({
            id: c.id,
            tipo: c.tipo,
            query_texto: c.query_texto,
            label: c.label,
            resultados: c.resultados || [],
            telefones: c.telefones || [],
            criado_em: c.criado_em
        });
    } catch (err) {
        console.error('[API Resultados] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Página pública do processo
app.get('/processo/:numero', (req, res) => {
    res.sendFile(__dirname + '/public/processo.html');
});

// API pública: retorna dados do processo
app.get('/api/processo/:numero', async (req, res) => {
    try {
        const numero = decodeURIComponent(req.params.numero);
        // Busca o processo no banco para achar o usuário dono
        const proc = await pool.query(
            'SELECT p.*, u.id as uid FROM processos p JOIN usuarios u ON p.usuario_id = u.id WHERE p.numero = $1 LIMIT 1',
            [numero]
        );
        
        let detalhe = {};
        if (proc.rows.length > 0) {
            const p = proc.rows[0];
            const userRes = await pool.query('SELECT * FROM usuarios WHERE id=$1', [p.uid]);
            const user = userRes.rows[0];
            const resultados = await consultarProcesso(numero, user);
            const lista = Array.isArray(resultados) ? resultados : [resultados];
            detalhe = lista.find(r => r.numero === numero) || lista[0] || {};
        } else {
            // Se não existe no banco, tenta consultar como admin padrão
            const adminRes = await pool.query("SELECT * FROM usuarios WHERE tipo='admin' LIMIT 1");
            if (adminRes.rows.length > 0) {
                const resultados = await consultarProcesso(numero, adminRes.rows[0]);
                const lista = Array.isArray(resultados) ? resultados : [resultados];
                detalhe = lista.find(r => r.numero === numero) || lista[0] || {};
            }
        }
        
        res.json({ numero, detalhes: detalhe });
    } catch (err) {
        console.error('[API Pública] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// API pública: PDF do processo
app.get('/api/processo/:numero/pdf', async (req, res) => {
    try {
        const numero = decodeURIComponent(req.params.numero);
        const proc = await pool.query(
            'SELECT p.*, u.id as uid FROM processos p JOIN usuarios u ON p.usuario_id = u.id WHERE p.numero = $1 LIMIT 1',
            [numero]
        );
        
        let dadosPDF = { numero };
        if (proc.rows.length > 0) {
            const p = proc.rows[0];
            const userRes = await pool.query('SELECT * FROM usuarios WHERE id=$1', [p.uid]);
            const user = userRes.rows[0];
            const resultados = await consultarProcesso(numero, user);
            const lista = Array.isArray(resultados) ? resultados : [resultados];
            dadosPDF = lista.find(r => r.numero === numero) || lista[0] || { numero };
        }
        
        const pdfBuffer = await gerarPDFProcesso(dadosPDF);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="processo_${numero.replace(/[^0-9]/g, '')}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('[API Pública PDF] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// API pública: Alvará do processo (PDF com dados completos)
app.get('/api/alvara/:numero', async (req, res) => {
    try {
        const numero = decodeURIComponent(req.params.numero);
        
        // Busca dados do processo
        let detalhe = { numero };
        const proc = await pool.query(
            'SELECT p.*, u.id as uid FROM processos p JOIN usuarios u ON p.usuario_id = u.id WHERE p.numero = $1 LIMIT 1',
            [numero]
        );
        if (proc.rows.length > 0) {
            const p = proc.rows[0];
            const userRes = await pool.query('SELECT * FROM usuarios WHERE id=$1', [p.uid]);
            const user = userRes.rows[0];
            const resultados = await consultarProcesso(numero, user);
            const lista = Array.isArray(resultados) ? resultados : [resultados];
            detalhe = lista.find(r => r.numero === numero) || lista[0] || { numero };
        }

        // Gerar PDF do Alvará
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        doc.on('data', b => buffers.push(b));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="alvara_${numero.replace(/[^0-9]/g, '')}.pdf"`);
            res.send(pdfBuffer);
        });

        const d = detalhe;
        const dataAtual = new Date().toLocaleDateString('pt-BR');

        // Cabeçalho
        doc.fontSize(10).text(`Processo Bot CNJ — Gerado em ${dataAtual}`, 50, 30);
        doc.fontSize(20).font('Helvetica-Bold').text('ALVARÁ / EXTRATO DE PROCESSO', 50, 50, { align: 'center' });
        doc.moveTo(50, 85).lineTo(545, 85).stroke('#FF5E00');

        // Dados do Processo
        let y = 100;
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF5E00').text('DADOS DO PROCESSO', 50, y);
        y += 25;
        doc.fontSize(11).font('Helvetica').fillColor('#333');
        
        const campos = [
            ['Processo', d.numero || numero],
            ['Tribunal', d.tribunal || d.tribunal_descricao || ''],
            ['Classe', d.classe || ''],
            ['Assunto', d.assunto || ''],
            ['Área', d.area || ''],
            ['Situação', d.situacao || ''],
            ['Órgão Julgador', d.orgaoJulgador || ''],
            ['Relator', d.relator || ''],
            ['Valor da Causa', d.valor_causa || ''],
            ['Data de Início', d.data || ''],
            ['Última Movimentação', d.data_ultima_movimentacao || d.ultimo_status || '']
        ];
        for (const [label, valor] of campos) {
            if (valor && valor.toString().trim()) {
                doc.font('Helvetica-Bold').text(`${label}: `, 50, y, { continued: true });
                doc.font('Helvetica').text(valor);
                y += 18;
            }
        }

        // Polos
        if (d.polo_ativo || d.polo_passivo) {
            y += 10;
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF5E00').text('POLOS', 50, y);
            y += 25;
            doc.fontSize(11).fillColor('#333');
            if (d.polo_ativo) {
                doc.font('Helvetica-Bold').text('Polo Ativo (Autor): ', 50, y, { continued: true });
                doc.font('Helvetica').text(d.polo_ativo);
                y += 20;
            }
            if (d.polo_passivo) {
                doc.font('Helvetica-Bold').text('Polo Passivo (Réu): ', 50, y, { continued: true });
                doc.font('Helvetica').text(d.polo_passivo);
                y += 20;
            }
        }

        // Partes
        if (d.partes && d.partes.length > 0) {
            y += 10;
            if (y > 650) { doc.addPage(); y = 50; }
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF5E00').text('PARTES E ADVOGADOS', 50, y);
            y += 25;
            doc.fontSize(11).fillColor('#333');
            for (const parte of d.partes) {
                if (y > 700) { doc.addPage(); y = 50; }
                const tipo = parte.tipo || parte.polo || 'Parte';
                doc.font('Helvetica-Bold').fillColor('#FF5E00').text(tipo.toUpperCase(), 50, y);
                y += 18;
                doc.fillColor('#333');
                doc.font('Helvetica-Bold').text('Nome: ', 60, y, { continued: true });
                doc.font('Helvetica').text(parte.nome || 'N/A');
                y += 18;
                if (parte.cpf) { doc.font('Helvetica-Bold').text('CPF: ', 60, y, { continued: true }); doc.font('Helvetica').text(parte.cpf); y += 18; }
                if (parte.cnpj) { doc.font('Helvetica-Bold').text('CNPJ: ', 60, y, { continued: true }); doc.font('Helvetica').text(parte.cnpj); y += 18; }
                if (parte.telefone) { doc.text(`Telefone: ${parte.telefone}`, 60, y); y += 18; }
                if (parte.email) { doc.text(`Email: ${parte.email}`, 60, y); y += 18; }
                if (parte.advogados) {
                    for (const adv of parte.advogados) {
                        const nm = typeof adv === 'string' ? adv : (adv.nome || '');
                        const oab = typeof adv === 'object' ? (adv.oab || '') : '';
                        doc.text(`Advogado: ${nm}${oab ? ' — OAB: ' + oab : ''}`, 60, y);
                        y += 18;
                    }
                }
                y += 5;
            }
        }

        // Movimentações
        if (d.movimentacoes && d.movimentacoes.length > 0) {
            y += 10;
            if (y > 650) { doc.addPage(); y = 50; }
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF5E00').text('MOVIMENTAÇÕES', 50, y);
            y += 25;
            doc.fontSize(10).fillColor('#333');
            for (const mov of d.movimentacoes.slice(0, 20)) {
                if (y > 720) { doc.addPage(); y = 50; }
                doc.font('Helvetica-Bold').text(`${mov.data || ''}`, 50, y, { continued: true });
                doc.font('Helvetica').text(` — ${mov.descricao || mov.texto || ''}`);
                y += 16;
            }
        }

        // Rodapé
        y += 30;
        if (y > 700) { doc.addPage(); y = 50; }
        doc.moveTo(50, y).lineTo(545, y).stroke('#ccc');
        y += 10;
        doc.fontSize(9).fillColor('#888').text('Documento gerado automaticamente pelo Processo Bot CNJ', 50, y, { align: 'center' });

        doc.end();
    } catch (err) {
        console.error('[API Alvará] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Webhook Telegram por usuário
const botsMap = require('./botManager').bots;
app.post('/webhook/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    try {
        // Verificar se o usuário está ativo antes de processar
        const userCheck = await pool.query('SELECT ativo FROM usuarios WHERE id=$1', [userId]);
        if (userCheck.rows.length === 0 || userCheck.rows[0].ativo === false) {
            return res.sendStatus(403); // Bloqueado
        }
        const bot = Object.values(botsMap).find(b => b.userId === userId);
        if (!bot) return res.sendStatus(404);
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error('[Webhook] Erro:', err.message);
        res.sendStatus(500);
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Keep-alive: ping no próprio servidor a cada 10 minutos para evitar que o Render durma
if (process.env.BASE_URL) {
    const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutos
    setInterval(async () => {
        try {
            const url = `${process.env.BASE_URL}/health`;
            const res = await fetch(url);
            console.log(`[KeepAlive] Ping ${url} → ${res.status}`);
        } catch (err) {
            console.log(`[KeepAlive] Ping falhou: ${err.message}`);
        }
    }, KEEP_ALIVE_INTERVAL);
    console.log('[KeepAlive] 🔄 Auto-ping ativo a cada 10min');
}

app.listen(process.env.PORT, async () => {
    console.log(`Servidor rodando na porta ${process.env.PORT}...`);
    await criarTabelas();
    await criarAdminPadrao();
    await carregarBots();
});

// Criar tabelas automaticamente se não existirem (migration automática)
async function criarTabelas() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(100),
                email VARCHAR(255) UNIQUE NOT NULL,
                senha TEXT NOT NULL,
                tipo VARCHAR(20) DEFAULT 'cliente',
                telegram_id TEXT,
                bot_token TEXT,
                api_key TEXT,
                modo VARCHAR(20) DEFAULT 'gratis',
                ativo BOOLEAN DEFAULT true,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ultimo_login TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS processos (
                id SERIAL PRIMARY KEY,
                numero VARCHAR(50),
                usuario_id INTEGER REFERENCES usuarios(id),
                ultimo_status TEXT,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Tabelas verificadas/criadas com sucesso');

        // Migração: altera telegram_id de BIGINT para TEXT se necessário
        try {
            await pool.query(`
                ALTER TABLE usuarios
                ALTER COLUMN telegram_id TYPE TEXT
            `);
        } catch (e) {
            // Já está como TEXT ou não precisa alterar
        }

        // Migração: adiciona colunas ativo e ultimo_login se não existirem
        try {
            await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true`);
        } catch (e) {
            // Coluna já existe
        }
        try {
            await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP`);
        } catch (e) {
            // Coluna já existe
        }

        // Migração: campos de pagamento
        try {
            await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS comprovante TEXT`);
        } catch (e) { /* Coluna já existe */ }
        try {
            await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status_pagamento VARCHAR(20) DEFAULT 'pendente'`);
        } catch (e) { /* Coluna já existe */ }

        // Tabela de consultas públicas (links compartilháveis do bot)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS consultas_publicas (
                id VARCHAR(64) PRIMARY KEY,
                tipo VARCHAR(20),
                query_texto VARCHAR(255),
                label VARCHAR(255),
                resultados JSONB,
                telefones JSONB,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (err) {
        console.error('Erro ao criar tabelas:', err.message);
    }
}

// Criar admin padrão se não existir
async function criarAdminPadrao() {
    try {
        const adminEmail = 'admin@sistema.com';
        const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [adminEmail]);

        if (result.rows.length === 0) {
            const senhaHash = await hashSenha('admin123');
            await pool.query(
                "INSERT INTO usuarios (email, senha, tipo) VALUES ($1, $2, 'admin')",
                [adminEmail, senhaHash]
            );
            console.log('Admin padrão criado: admin@sistema.com / admin123');
        }
    } catch (err) {
        console.error('Erro ao criar admin:', err);
    }
}
