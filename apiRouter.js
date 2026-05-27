const escavador = require('./services/escavador');

// Nenhum serviço extra do servidor — só Escavador como base principal
// Cada utilizador pode adicionar as suas próprias APIs no painel
const servicosPagos = [];

// query = { tipo, uf, numero, texto, original } ou string
async function consultarProcesso(query, user) {

    const q = typeof query === 'string' ? { tipo: 'processo', numero: query, original: query } : query;
    const modo = user?.modo || 'gratis';

    console.log(`[apiRouter] Modo: ${modo}, Tipo: ${q.tipo}, Query:`, q.original || q.numero || q.texto);

    try {
        console.log('[apiRouter] ⚡ Consultando Escavador...');
        const esc = await escavador.consultar(q);

        console.log('[apiRouter] 📦 RESPOSTA:', JSON.stringify(esc).substring(0, 1000));

        // Array com resultados
        if (Array.isArray(esc) && esc.length > 0) {
            esc.forEach(r => r.fonte = escavador.nome);
            return esc;
        }

        // Objeto único
        if (esc && typeof esc === 'object' && !Array.isArray(esc) && esc.numero) {
            esc.fonte = escavador.nome;
            return [esc];
        }

        console.log('[apiRouter] ⚠️ Nenhum resultado do Escavador');
    } catch (err) {
        console.error('[apiRouter] ❌ Erro:', err.response?.data || err.message);
    }

    // APIs extra do utilizador (modo pago/híbrido)
    if (modo === 'pago' || modo === 'hibrido') {
        console.log('[apiRouter] ⚡ Tentando APIs extra...');
        const extra = await buscarPagas(q);
        if (extra && extra.length > 0) return extra;
    }

    return [];
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
