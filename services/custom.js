const axios = require('axios');

// API Key via variável de ambiente: TJ_API_KEY
const API_KEY = process.env.TJ_API_KEY || '';

async function consultar(numero) {
    if (!API_KEY) return null; // não configurada, pula silenciosamente

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
