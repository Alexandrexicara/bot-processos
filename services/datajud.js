const axios = require('axios');

const BASE_URL = "https://api-publica.datajud.cnj.jus.br/api_publica";

// Rate limiting: delay mínimo entre requisições (em ms)
let ultimaReq = 0;
const RATE_DELAY = 500; // 0.5s entre chamadas

async function aguardarRateLimit() {
    const agora = Date.now();
    const esperar = RATE_DELAY - (agora - ultimaReq);
    if (esperar > 0) {
        await new Promise(r => setTimeout(r, esperar));
    }
    ultimaReq = Date.now();
}

// Faz a chamada à API com retry automático
async function chamarAPI(params, apiKey = null, tentativa = 1) {
    await aguardarRateLimit();

    const headers = {};
    if (apiKey) {
        headers['Authorization'] = `APIKey ${apiKey}`;
    }

    try {
        const url = `${BASE_URL}/tjba/_search`;
        const res = await axios.post(url, params, { headers, timeout: 15000 });

        console.log('[DataJud] Resposta recebida, total hits:', res.data.hits?.total?.value || 0);

        if (process.env.DEBUG_API === 'true') {
            console.log('[DataJud DEBUG] Response:', JSON.stringify(res.data).substring(0, 500));
        }

        return res.data;

    } catch (err) {
        const status = err.response?.status;
        console.error(`[DataJud] Erro na chamada (tentativa ${tentativa}):`, status, err.message);

        // Rate limit (429) ou erro de servidor (5xx) — retry
        if ((status === 429 || status >= 500) && tentativa < 3) {
            const backoff = Math.pow(2, tentativa) * 1000;
            console.log(`[DataJud] Retry em ${backoff}ms...`);
            await new Promise(r => setTimeout(r, backoff));
            return chamarAPI(params, apiKey, tentativa + 1);
        }

        return null;
    }
}

// Busca por número de processo
async function consultarProcesso(numero, apiKey) {
    console.log('[DataJud] Buscando processo:', numero);

    const data = await chamarAPI(
        {
            query: { match: { numeroProcesso: numero } },
            size: 10,
            sort: [{ "@timestamp": "desc" }]
        },
        apiKey
    );

    if (!data) return null;

    const hits = data.hits?.hits;
    if (!hits || hits.length === 0) {
        console.log('[DataJud] Nenhum processo encontrado para:', numero);
        return null;
    }

    return extrairDados(hits);
}

// Busca por OAB (UF + número)
async function consultarOAB(uf, numeroOAB, apiKey) {
    console.log(`[DataJud] Buscando OAB: ${uf} ${numeroOAB}`);

    // A OAB aparece em diversos campos no CNJ:
    // - advogados.oab
    // - poloAtivo.advogados.oab
    // - poloPassivo.advogados.oab
    // Usamos query_string para buscar em todos os campos de texto
    const query = {
        query_string: {
            query: `*${uf}${numeroOAB}*`,
            fields: [
                "*advogado*",
                "*oab*",
                "*adv*",
                "*partes*"
            ],
            default_operator: "AND"
        }
    };

    const data = await chamarAPI(
        {
            query,
            size: 50,
            sort: [{ "@timestamp": "desc" }],
            track_total_hits: true
        },
        apiKey
    );

    if (!data) return null;

    const hits = data.hits?.hits;
    if (!hits || hits.length === 0) {
        console.log(`[DataJud] Nenhum resultado para OAB ${uf}${numeroOAB}`);
        return null;
    }

    const total = data.hits.total?.value || hits.length;
    console.log(`[DataJud] Encontrados ${total} resultados para OAB ${uf}${numeroOAB}`);

    // Paginação: se houver mais resultados, buscar próximas páginas
    if (total > 50) {
        const paginas = Math.min(Math.ceil(total / 50), 5); // máximo 5 páginas
        for (let page = 2; page <= paginas; page++) {
            const mais = await chamarAPI(
                {
                    query,
                    size: 50,
                    from: (page - 1) * 50,
                    sort: [{ "@timestamp": "desc" }]
                },
                apiKey
            );
            if (mais?.hits?.hits) {
                hits.push(...mais.hits.hits);
            }
        }
        console.log(`[DataJud] Total com paginação: ${hits.length} resultados`);
    }

    return extrairDados(hits);
}

// Consulta unificada — decide o tipo de busca com base no parser
async function consultarDataJud(query, apiKey) {
    if (query.tipo === 'oab') {
        return consultarOAB(query.uf, query.numero, apiKey);
    }

    if (query.tipo === 'processo' || query.tipo === 'nome') {
        const numero = query.numero || query.texto;
        return consultarProcesso(numero, apiKey);
    }

    // Fallback: trata como processo
    return consultarProcesso(query.original || query, apiKey);
}

// Extrai dados padronizados dos hits
function extrairDados(hits) {
    const resultados = [];

    for (const hit of hits) {
        const p = hit._source;
        resultados.push({
            numero: p.numeroProcesso,
            tribunal: p.tribunal || p.nomeOrgao,
            classe: p.classe?.nome || p.classeProcessual,
            data: p.dataHoraUltimaAtualizacao || p["@timestamp"],
            grau: p.grau,
            orgaoJulgador: p.orgaoJulgador?.nome,
            _score: hit._score
        });
    }

    return resultados;
}

module.exports = {
    nome: 'DataJud (CNJ)',
    gratuito: true,
    consultar: consultarDataJud
};
