const axios = require('axios');

// API Key via variável de ambiente: ESCAVADOR_API_KEY
const API_KEY = process.env.ESCAVADOR_API_KEY || '';

async function consultar(numero) {
    if (!API_KEY) return null; // não configurada, pula silenciosamente

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
