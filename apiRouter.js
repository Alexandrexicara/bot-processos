const datajud = require('./services/datajud');

// 🧩 APIs pagas — adicione novas aqui. Cada ficheiro em /services exporta { nome, gratuito, consultar(numero) }
// A chave de cada API vem de uma variável de ambiente (ex: JUSBRASIL_API_KEY)
// Se a variável não estiver configurada, o serviço é pulado automaticamente
const servicosPagos = [
    require('./services/jusbrasil'),
    require('./services/escavador'),
    require('./services/digesto'),
    require('./services/custom'),
];

async function consultarProcesso(numero, user) {

    // 1. 🔍 DataJud (grátis — sempre tenta primeiro, com ou sem API key do utilizador)
    const gratis = await datajud.consultar(numero, user.api_key);
    if (gratis) {
        gratis.fonte = datajud.nome;
        return gratis;
    }

    // 2. 🔐 APIs pagas em sequência (cada uma verifica sua própria chave via process.env)
    for (const servico of servicosPagos) {
        const resultado = await servico.consultar(numero);
        if (resultado) {
            resultado.fonte = servico.nome;
            return resultado;
        }
    }

    return null;
}

module.exports = { consultarProcesso };
