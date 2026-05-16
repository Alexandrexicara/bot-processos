-- ============================================
-- Script para configurar o banco na Render
-- Copia e cola isto no Shell do PostgreSQL
-- ============================================

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
);

CREATE TABLE IF NOT EXISTS processos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50),
    usuario_id INTEGER REFERENCES usuarios(id),
    ultimo_status TEXT,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin padrão (senha: admin123)
-- Só roda quando as tabelas já existem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@sistema.com') THEN
        -- Senha: admin123 (bcrypt hash)
        INSERT INTO usuarios (email, senha, tipo)
        VALUES ('admin@sistema.com', '$2a$10$WmG3L1OcWTGyDjNt.VTEUOiF7v6oOr9c4eBT6pkfiCYbuqW8h.mVa', 'admin');
    END IF;
END $$;
