const axios = require('axios');

async function consultarDataJud(numero) {
    try {
        const res = await axios.post(
            "https://api-publica.datajud.cnj.jus.br/api_publica_tj/_search",
            {
                query: {
                    match: { numeroProcesso: numero }
                }
            }
        );

        const hit = res.data.hits.hits[0];
        if (!hit) return null;

        const p = hit._source;

        return {
            numero: p.numeroProcesso,
            tribunal: p.tribunal,
            classe: p.classe?.nome,
            data: p.dataHoraUltimaAtualizacao
        };

    } catch {
        return null;
    }
}

module.exports = { consultarDataJud };
