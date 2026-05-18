// API Key via variável de ambiente: DIGESTO_API_KEY
const API_KEY = process.env.DIGESTO_API_KEY || '';

// query = string (número) ou objeto { tipo, numero, uf, texto, original }
async function consultar(query) {
    if (!API_KEY) return null; // não configurada, pula silenciosamente

    const numero = typeof query === 'string' ? query : (query.numero || query.original);
    if (!numero) return null;

    try {
        // TODO: integrar endpoint real do Digesto
        // https://www.digesto.com.br/api
        return null;
    } catch {
        return null;
    }
}

module.exports = {
    nome: 'Digesto',
    gratuito: false,
    consultar
};
