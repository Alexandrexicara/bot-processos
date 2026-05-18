const axios = require('axios');

// Endpoints por tribunal — NUNCA usar _search sem prefixo (requer auth e dá 401)
// Cada tribunal tem seu próprio índice no Elasticsearch do CNJ
const TRIBUNAIS = [
    'tjsp',   // São Paulo
    'tjrj',   // Rio de Janeiro
    'tjmg',   // Minas Gerais
    'tjba',   // Bahia
    'tjpr',   // Paraná
    'tjrs',   // Rio Grande do Sul
    'tjsc',   // Santa Catarina
    'tjdf',   // Distrito Federal
    'tjes',   // Espírito Santo
    'tjgo',   // Goiás
    'tjpe',   // Pernambuco
    'tjce',   // Ceará
    'trf1',   // TRF 1ª Região
    'trf3',   // TRF 3ª Região
    'trf4',   // TRF 4ª Região
    'trf5',   // TRF 5ª Região
];

// Rate limiting
let ultimaReq = 0;
const RATE_DELAY = 400;

async function aguardarRateLimit() {
    const agora = Date.now();
    const esperar = RATE_DELAY - (agora - ultimaReq);
    if (esperar > 0) {
        await new Promise(r => setTimeout(r, esperar));
    }
    ultimaReq = Date.now();
}

function buildUrl(tribunal) {
    return `https://api-publica.datajud.cnj.jus.br/api_publica/${tribunal}/_search`;
}

// Chamada à API com autenticação e debug
async function chamarAPI(url, params, apiKey = null, tentativa = 1) {
    await aguardarRateLimit();

    const headers = { 'Content-Type': 'application/json' };
    const temChave = !!(apiKey && apiKey.trim());
    if (temChave) {
        headers['Authorization'] = `APIKey ${apiKey}`;
    }

    try {
        console.log(`[DataJud] POST ${url} | auth=${temChave ? 'SIM' : 'NÃO'}`);
        console.log(`[DataJud] Query:`, JSON.stringify(params.query).substring(0, 180));

        const res = await axios.post(url, params, { headers, timeout: 20000 });

        const total = res.data?.hits?.total?.value ?? res.data?.hits?.total ?? '?';
        const count = res.data?.hits?.hits?.length ?? 0;
        console.log(`[DataJud] ✅ Resposta: total=${total}, hits=${count}`);

        if (count > 0 && res.data.hits.hits[0]) {
            const p = res.data.hits.hits[0]._source;
            console.log(`[DataJud] 📄 Exemplo: ${p.numeroProcesso} | ${p.tribunal}`);
        } else if (total == 0) {
            console.log(`[DataJud] ⚠️ Zero resultados neste tribunal`);
        }

        return res.data;

    } catch (err) {
        const status = err.response?.status;
        const body = err.response?.data ? JSON.stringify(err.response.data).substring(0, 300) : '';
        console.error(`[DataJud] ❌ Erro ${status} (tentativa ${tentativa}): ${body || err.message}`);

        // 401 = sem autenticação neste endpoint. Pula silenciosamente.
        if (status === 401) return null;

        // Rate limit (429) ou erro de servidor (5xx) — retry
        if ((status === 429 || status >= 500) && tentativa < 3) {
            const backoff = Math.pow(2, tentativa) * 1000;
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
    console.log(`[DataJud] 🔍 Buscando processo: ${numero} | apiKey=${apiKey ? 'SIM' : 'NÃO'}`);

    const params = {
        query: { match: { numeroProcesso: numero } },
        size: 10,
        sort: [{ "@timestamp": "desc" }]
    };

    // Tenta múltiplos tribunais
    const multi = await chamarMultiTribunal(params, apiKey);
    if (!multi) return null;

    const hits = multi.data.hits?.hits;
    if (!hits || hits.length === 0) {
        console.log('[DataJud] ❌ Processo não encontrado em nenhum tribunal');
        return null;
    }

    console.log(`[DataJud] ✅ Encontrado no tribunal: ${multi.tribunal}`);
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

        // Vai direto para múltiplos tribunais (nunca usa _search sem tribunal)
        const multi = await chamarMultiTribunal(params, apiKey);

        if (!multi) continue;
        const data = multi.data;

        const hits = data.hits?.hits;
        if (hits && hits.length > 0) {
            const total = data.hits?.total?.value || hits.length;
            console.log(`[DataJud] ✅ Estratégia ${est.nome}: ${total} resultados`);

            // Paginação se necessário
            if (total > 50) {
                const paginas = Math.min(Math.ceil(total / 50), 5);
                for (let page = 2; page <= paginas; page++) {
                    params.from = (page - 1) * 50;
                    // Usa o mesmo tribunal que retornou resultados
                    const tribunalEncontrado = multi.tribunal || TRIBUNAIS[0];
                    const mais = await chamarAPI(buildUrl(tribunalEncontrado), params, apiKey);
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
