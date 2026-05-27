const escavador = require('./services/escavador');

// Nenhum serviço extra do servidor — só Escavador como base principal
// Cada utilizador pode adicionar as suas próprias APIs no painel
const servicosPagos = [];

// query = { tipo, uf, numero, texto, original } ou string
async function consultarProcesso(query, user) {

    const q = typeof query === 'string' ? { tipo: 'processo', numero: query, original: query } : query;
    const modo = user?.modo || 'gratis';

    console.log(`[apiRouter] Modo: ${modo}, Tipo: ${q.tipo}, Query:`, q.original || q.numero || q.texto);

    // 1. ESCAVADOR — base PRINCIPAL da plataforma
    console.log('[apiRouter] ⚡ Escavador (base principal)...');
    const esc = await escavador.consultar(q);
    if (esc && esc.length > 0) {
        esc.forEach(r => r.fonte = escavador.nome);
        return esc;
    }

    // 2. APIs extra do utilizador (se modo pago/híbrido e tiver chave própria)
    if (modo === 'pago' || modo === 'hibrido') {
        console.log('[apiRouter] ⚡ Tentando APIs extra do utilizador...');
        const extra = await buscarPagas(q);
        if (extra && extra.length > 0) return extra;
    }

    return null;
}

async function buscarPagas(query) {
    for (const servico of servicosPagos) {
        try {
            const resultado = await servico.consultar(query);
            if (resultado && resultado.length > 0) {
                resultado.forEach(r => r.fonte = servico.nome);
                return resultado;
            }
        } catch (err) {
            console.error(`[apiRouter] Erro no serviço ${servico.nome}:`, err.message);
        }
    }
    return null;
}

module.exports = { consultarProcesso };
