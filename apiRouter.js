const datajud = require('./services/datajud');

// Serviço Escavador — nível servidor, usado para OAB em todos os modos
const escavador = require('./services/escavador');

// 🧩 APIs pagas — adicione novas aqui. Cada ficheiro em /services exporta { nome, gratuito, consultar(query) }
// A chave de cada API vem de uma variável de ambiente (ex: JUSBRASIL_API_KEY)
// Se a variável não estiver configurada, o serviço é pulado automaticamente
const servicosPagos = [
    require('./services/jusbrasil'),
    require('./services/digesto'),
    require('./services/custom'),
];

// query = { tipo, uf, numero, texto, original } ou string (compatível com versão antiga)
async function consultarProcesso(query, user) {

    // Compatibilidade: se receber string, converte para objeto
    const q = typeof query === 'string' ? { tipo: 'processo', numero: query, original: query } : query;

    const modo = user?.modo || 'gratis';

    console.log(`[apiRouter] Modo: ${modo}, Tipo: ${q.tipo}, Query:`, q.original || q.numero || q.texto);

    // 🔑 Para OAB: sempre tenta Escavador (nível servidor) como fallback da DataJud
    if (q.tipo === 'oab') {
        // 1. Tenta DataJud (grátis, raramente funciona para OAB)
        const gratis = await datajud.consultar(q);
        if (gratis && gratis.length > 0) {
            gratis.forEach(r => r.fonte = datajud.nome);
            return gratis;
        }

        // 2. Tenta Escavador (nível servidor) — É AQUI QUE OAB FUNCIONA!
        console.log('[apiRouter] ⚡ DataJud sem resultado para OAB, tentando Escavador...');
        const esc = await escavador.consultar(q);
        if (esc && esc.length > 0) {
            esc.forEach(r => r.fonte = escavador.nome);
            return esc;
        }

        // 3. Se modo pago/híbrido, tenta outras APIs pagas do utilizador
        if (modo === 'pago' || modo === 'hibrido') {
            const pago = await buscarPagas(q);
            if (pago && pago.length > 0) return pago;
        }

        return null;
    }

    // Para processo/nome: estratégia normal por modo
    // Estratégia por modo:
    if (modo === 'pago') {
        // Pago: tenta APIs pagas primeiro
        const pago = await buscarPagas(q);
        if (pago && pago.length > 0) return pago;

        // Fallback para DataJud
        const gratis = await datajud.consultar(q);
        if (gratis && gratis.length > 0) {
            gratis.forEach(r => r.fonte = datajud.nome);
            return gratis;
        }
    } else if (modo === 'hibrido') {
        // Híbrido: tenta DataJud primeiro, depois pagas
        const gratis = await datajud.consultar(q);
        if (gratis && gratis.length > 0) {
            gratis.forEach(r => r.fonte = datajud.nome);
            return gratis;
        }

        const pago = await buscarPagas(q);
        if (pago && pago.length > 0) return pago;
    } else {
        // Grátis (padrão): só DataJud
        const gratis = await datajud.consultar(q);
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
