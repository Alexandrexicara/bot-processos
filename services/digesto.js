// API Key via variável de ambiente: DIGESTO_API_KEY
const API_KEY = process.env.DIGESTO_API_KEY || '';

async function consultar(numero) {
    if (!API_KEY) return null; // não configurada, pula silenciosamente

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
