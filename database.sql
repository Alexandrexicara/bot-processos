CREATE DATABASE processos;

\c processos;

CREATE TABLE usuarios (
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

CREATE TABLE processos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50),
    usuario_id INTEGER REFERENCES usuarios(id),
    ultimo_status TEXT,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE consultas_publicas (
    id VARCHAR(64) PRIMARY KEY,
    tipo VARCHAR(20),
    query_texto VARCHAR(255),
    label VARCHAR(255),
    resultados JSONB,
    telefones JSONB,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
