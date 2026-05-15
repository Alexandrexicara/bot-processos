CREATE DATABASE processos;

\c processos;

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo VARCHAR(20) DEFAULT 'cliente',
    telegram_id BIGINT,
    bot_token TEXT,
    api_key TEXT,
    modo VARCHAR(20) DEFAULT 'gratis',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE processos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50),
    usuario_id INTEGER REFERENCES usuarios(id),
    ultimo_status TEXT,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
