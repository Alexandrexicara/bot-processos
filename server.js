require('dotenv').config();
const express = require('express');
const pool = require('./db');
const { carregarBots, iniciarBot } = require('./botManager');
const { gerarToken, authMiddleware, adminMiddleware, hashSenha, verificarSenha } = require('./auth');

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

// Registro de novo usuário
app.post('/auth/registro', async (req, res) => {
    const { email, senha, bot_token, api_key, modo } = req.body;
    const telegram_id = limparTelegramId(req.body.telegram_id);

    try {
        const senhaHash = await hashSenha(senha);

        const result = await pool.query(
            "INSERT INTO usuarios (email, senha, telegram_id, bot_token, api_key, modo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
            [email, senhaHash, telegram_id, bot_token, api_key, modo || 'gratis']
        );

        const userId = result.rows[0].id;

        if (bot_token) {
            await iniciarBot(bot_token, userId);
        }

        res.json({ success: true, id: userId, message: "Usuário criado com sucesso" });
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

        const token = gerarToken(user);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                tipo: user.tipo
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cadastrar usuário (protegido - apenas admin)
app.post('/usuario', authMiddleware, adminMiddleware, async (req, res) => {
    const { bot_token, api_key, modo, email, senha } = req.body;
    const telegram_id = limparTelegramId(req.body.telegram_id);

    try {
        const senhaHash = senha ? await hashSenha(senha) : null;

        const result = await pool.query(
            "INSERT INTO usuarios (email, senha, telegram_id, bot_token, api_key, modo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
            [email, senhaHash, telegram_id, bot_token, api_key, modo || 'gratis']
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

// Listar todos os usuários (apenas admin)
app.get('/usuarios', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const data = await pool.query(
            "SELECT id, email, tipo, telegram_id, modo, criado_em FROM usuarios ORDER BY criado_em DESC"
        );
        res.json(data.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verificar token (perfil do usuário)
app.get('/auth/me', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, email, tipo, telegram_id, modo, criado_em FROM usuarios WHERE id = $1",
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
