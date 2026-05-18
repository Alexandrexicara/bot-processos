const axios = require('axios');

// A API DataJud pública exige o código do tribunal no path.
// Mas alguns tribunais aceitam _search sem prefixo.
// Se falhar, tentamos os tribunais mais comuns.
const TRIBUNAIS = [
    '',       // sem tribunal (todos)
    'tjsp',   // São Paulo
    'tjba',   // Bahia
    'tjrj',   // Rio de Janeiro
    'tjmg',   // Minas Gerais
    'tjpr',   // Paraná
    'tjrs',   // Rio Grande do Sul
    'trf1',   // TRF 1ª Região
    'trf3',   // TRF 3ª Região
    'trf4',   // TRF 4ª Região
    'trf5',   // TRF 5ª Região
];

// Rate limiting: delay mínimo entre requisições
let ultimaReq = 0;
const RATE_DELAY = 600;

async function aguardarRateLimit() {
    const agora = Date.now();
    const esperar = RATE_DELAY - (agora - ultimaReq);
    if (esperar > 0) {
        await new Promise(r => setTimeout(r, esperar));
    }
    ultimaReq = Date.now();
}

function buildUrl(tribunal) {
    const base = "https://api-publica.datajud.cnj.jus.br/api_publica";
    return tribunal ? `${base}/${tribunal}/_search` : `${base}/_search`;
}

// Chamada à API com retry e debug completo
async function chamarAPI(url, params, apiKey = null, tentativa = 1) {
    await aguardarRateLimit();

    const headers = {};
    if (apiKey) {
        headers['Authorization'] = `APIKey ${apiKey}`;
    }

    try {
        console.log(`[DataJud] POST ${url}`);
        console.log(`[DataJud] Query:`, JSON.stringify(params.query).substring(0, 200));

        const res = await axios.post(url, params, { headers, timeout: 20000 });

        // DEBUG COMPLETO — sempre loga o retorno bruto resumido
        const total = res.data?.hits?.total?.value ?? res.data?.hits?.total ?? '?';
        const count = res.data?.hits?.hits?.length ?? 0;
        console.log(`[DataJud] ✅ Resposta: total=${total}, recebidos=${count}`);

        // Log do primeiro hit para diagnosticar estrutura
        if (count > 0 && res.data.hits.hits[0]) {
            const primeiro = res.data.hits.hits[0]._source;
            console.log(`[DataJud] 📄 Primeiro hit:`, JSON.stringify({
                numero: primeiro.numeroProcesso,
                tribunal: primeiro.tribunal,
                classe: primeiro.classe?.nome
            }));
        } else {
            console.log(`[DataJud] ⚠️ Resposta vazia. Resumo:`, JSON.stringify(res.data).substring(0, 400));
        }

        return res.data;

    } catch (err) {
        const status = err.response?.status;
        const body = err.response?.data ? JSON.stringify(err.response.data).substring(0, 300) : '';
        console.error(`[DataJud] ❌ Erro (tentativa ${tentativa}): status=${status}, ${err.message} ${body}`);

        // Rate limit (429) ou erro de servidor (5xx) — retry
        if ((status === 429 || status >= 500) && tentativa < 3) {
            const backoff = Math.pow(2, tentativa) * 1200;
            console.log(`[DataJud] 🔄 Retry em ${backoff}ms...`);
            await new Promise(r => setTimeout(r, backoff));
            return chamarAPI(url, params, apiKey, tentativa + 1);
        }

        return null;
    }
}

// Tenta consultar em múltiplos tribunais até encontrar resultado
async function chamarMultiTribunal(params, apiKey) {
    for (const tribunal of TRIBUNAIS) {
        const url = buildUrl(tribunal);
        const data = await chamarAPI(url, params, apiKey);
        if (data) {
            const hits = data.hits?.hits;
            if (hits && hits.length > 0) {
                return { data, tribunal };
            }
        }
    }
    return null;
}

// Busca por número de processo
async function consultarProcesso(numero, apiKey) {
    console.log('[DataJud] 🔍 Buscando processo:', numero);

    const params = {
        query: { match: { numeroProcesso: numero } },
        size: 10,
        sort: [{ "@timestamp": "desc" }]
    };

    // Processo: tenta sem tribunal primeiro
    const data = await chamarAPI(buildUrl(''), params, apiKey);

    if (!data) return null;

    const hits = data.hits?.hits;
    if (!hits || hits.length === 0) {
        console.log('[DataJud] ❌ Nenhum processo encontrado para:', numero);
        return null;
    }

    return extrairDados(hits);
}

// Busca por OAB (UF + número) — tenta múltiplos formatos de query
async function consultarOAB(uf, numeroOAB, apiKey) {
    console.log(`[DataJud] 🔍 Buscando OAB: ${uf} ${numeroOAB}`);

    // Estratégia 1: match nos campos de advogado
    // O CNJ indexa advogados como texto dentro dos documentos
    const estrategias = [
        // Estratégia A: simple_query_string — mais flexível
        {
            nome: 'simple_query_string',
            query: {
                simple_query_string: {
                    query: `"${uf}${numeroOAB}"`,
                    fields: ["*"],
                    default_operator: "or"
                }
            }
        },
        // Estratégia B: match_phrase no campo _all
        {
            nome: 'match_phrase',
            query: {
                match_phrase: {
                    _all: `${uf}${numeroOAB}`
                }
            }
        },
        // Estratégia C: query_string com wildcard
        {
            nome: 'query_string_wildcard',
            query: {
                query_string: {
                    query: `*${uf}*${numeroOAB}*`,
                    default_operator: "AND",
                    analyze_wildcard: true
                }
            }
        }
    ];

    for (const est of estrategias) {
        console.log(`[DataJud] ⚡ Tentando estratégia: ${est.nome}`);

        const params = {
            query: est.query,
            size: 50,
            sort: [{ "@timestamp": "desc" }]
        };

        // Tenta no endpoint sem tribunal primeiro
        let data = await chamarAPI(buildUrl(''), params, apiKey);

        // Se falhar, tenta tribunais específicos
        if (!data) {
            const multi = await chamarMultiTribunal(params, apiKey);
            if (multi) data = multi.data;
        }

        if (!data) continue;

        const hits = data.hits?.hits;
        if (hits && hits.length > 0) {
            const total = data.hits?.total?.value || hits.length;
            console.log(`[DataJud] ✅ Estratégia ${est.nome}: ${total} resultados`);

            // Paginação se necessário
            if (total > 50) {
                const paginas = Math.min(Math.ceil(total / 50), 5);
                for (let page = 2; page <= paginas; page++) {
                    params.from = (page - 1) * 50;
                    const mais = await chamarAPI(buildUrl(''), params, apiKey);
                    if (mais?.hits?.hits) {
                        hits.push(...mais.hits.hits);
                    }
                }
                console.log(`[DataJud] Total c/ paginação: ${hits.length}`);
            }

            return extrairDados(hits);
        }

        console.log(`[DataJud] ⚠️ Estratégia ${est.nome}: 0 resultados`);
    }

    console.log(`[DataJud] ❌ Nenhuma estratégia funcionou para OAB ${uf}${numeroOAB}`);
    return null;
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
