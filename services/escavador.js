const axios = require('axios');

// API Key via variável de ambiente: ESCAVADOR_API_KEY
const API_KEY = process.env.ESCAVADOR_API_KEY || '';

// query = string (número) ou objeto { tipo, numero, uf, texto, original }
async function consultar(query) {
    if (!API_KEY) return null; // não configurada, pula silenciosamente

    const numero = typeof query === 'string' ? query : (query.numero || query.original);
    if (!numero) return null;

    try {
        // TODO: integrar endpoint real do Escavador
        // Exemplo: https://api.escavador.com/v2/processos/numero/{numero}
        // Headers: { 'Authorization': `Bearer ${API_KEY}` }
        return null;
    } catch {
        return null;
    }
}

module.exports = {
    nome: 'Escavador',
    gratuito: false,
    consultar
};
