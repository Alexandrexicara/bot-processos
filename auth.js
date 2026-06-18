const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';

// Gerar token JWT
function gerarToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, tipo: user.tipo },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

// Middleware de autenticação — valida token E verifica se usuário está ativo
async function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verificar se o usuário ainda existe e está ativo no banco
        const result = await pool.query(
            'SELECT ativo FROM usuarios WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        if (result.rows[0].ativo === false) {
            return res.status(403).json({ error: 'Conta bloqueada. Contacte o administrador.' });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

// Middleware para verificar se é admin
function adminMiddleware(req, res, next) {
    if (req.user.tipo !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }
    next();
}

// Hash de senha
async function hashSenha(senha) {
    return await bcrypt.hash(senha, 10);
}

// Verificar senha
async function verificarSenha(senha, hash) {
    return await bcrypt.compare(senha, hash);
}

module.exports = {
    gerarToken,
    authMiddleware,
    adminMiddleware,
    hashSenha,
    verificarSenha,
    JWT_SECRET
};
