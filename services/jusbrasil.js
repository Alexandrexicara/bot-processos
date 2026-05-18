const axios = require('axios');

// API Key via variável de ambiente: JUSBRASIL_API_KEY
const API_KEY = process.env.JUSBRASIL_API_KEY || '';

// query = string (número) ou objeto { tipo, numero, uf, texto, original }
async function consultar(query) {
    if (!API_KEY) return null; // não configurada, pula silenciosamente

    const numero = typeof query === 'string' ? query : (query.numero || query.original);
    if (!numero) return null;

    try {
        // TODO: integrar endpoint real da Jusbrasil
        // Exemplo de chamada:
        // const res = await axios.get(
        //     `https://api.jusbrasil.com/v1/processos/${numero}`,
        //     { headers: { 'Authorization': `Bearer ${API_KEY}` } }
        // );
        // return {
        //     numero: res.data.numero,
        //     tribunal: res.data.tribunal,
        //     classe: res.data.classe,
        //     data: res.data.ultima_atualizacao
        // };

        // Placeholder — remove quando integrar a API real
        return null;
    } catch {
        return null;
    }
}

module.exports = {
    nome: 'Jusbrasil',
    gratuito: false,
    consultar
};
