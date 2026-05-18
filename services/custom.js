const axios = require('axios');

// API Key via variável de ambiente: TJ_API_KEY
const API_KEY = process.env.TJ_API_KEY || '';

// query = string (número) ou objeto { tipo, numero, uf, texto, original }
async function consultar(query) {
    if (!API_KEY) return null; // não configurada, pula silenciosamente

    const numero = typeof query === 'string' ? query : (query.numero || query.original);
    if (!numero) return null;

    try {
        // TODO: integrar endpoint de qualquer outro tribunal ou API
        return null;
    } catch {
        return null;
    }
}

module.exports = {
    nome: 'API Customizada',
    gratuito: false,
    consultar
};
