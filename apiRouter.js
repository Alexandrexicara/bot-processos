const datajud = require('./services/datajud');

// 🧩 APIs pagas — adicione novas aqui. Cada ficheiro em /services exporta { nome, gratuito, consultar(query) }
// A chave de cada API vem de uma variável de ambiente (ex: JUSBRASIL_API_KEY)
// Se a variável não estiver configurada, o serviço é pulado automaticamente
const servicosPagos = [
    require('./services/jusbrasil'),
    require('./services/escavador'),
    require('./services/digesto'),
    require('./services/custom'),
];

// query = { tipo, uf, numero, texto, original } ou string (compatível com versão antiga)
async function consultarProcesso(query, user) {

    // Compatibilidade: se receber string, converte para objeto
    const q = typeof query === 'string' ? { tipo: 'processo', numero: query, original: query } : query;

    const modo = user?.modo || 'gratis';

    console.log(`[apiRouter] Modo: ${modo}, Tipo: ${q.tipo}, Query:`, q.original || q.numero || q.texto);

    // Estratégia por modo:
    if (modo === 'pago') {
        // Pago: tenta APIs pagas primeiro
        const pago = await buscarPagas(q);
        if (pago && pago.length > 0) return pago;

        // Fallback para DataJud grátis
        const gratis = await datajud.consultar(q, user?.api_key);
        if (gratis && gratis.length > 0) {
            gratis.forEach(r => r.fonte = datajud.nome);
            return gratis;
        }
    } else if (modo === 'hibrido') {
        // Híbrido: tenta DataJud grátis primeiro, depois pagas
        const gratis = await datajud.consultar(q, user?.api_key);
        if (gratis && gratis.length > 0) {
            gratis.forEach(r => r.fonte = datajud.nome);
            return gratis;
        }

        const pago = await buscarPagas(q);
        if (pago && pago.length > 0) return pago;
    } else {
        // Grátis (padrão): só DataJud
        const gratis = await datajud.consultar(q, user?.api_key);
        if (gratis && gratis.length > 0) {
            gratis.forEach(r => r.fonte = datajud.nome);
            return gratis;
        }
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
