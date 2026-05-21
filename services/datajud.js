const axios = require('axios');

// Chave da API DataJud — nível servidor (.env), NÃO por utilizador
const DATAJUD_API_KEY = process.env.DATAAJUD_API_KEY || '';
console.log(`[DataJud] 🔑 API Key do servidor: ${DATAJUD_API_KEY ? 'SIM ✅' : 'NÃO ❌ — vai falhar 401!'}`);

// Endpoints por tribunal conforme documentação oficial do CNJ
// Formato: api_publica_{tribunal}/_search (underscore, NÃO barra!)
// Fonte: https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
const TRIBUNAIS = [
    'tjsp',   // São Paulo
    'tjrj',   // Rio de Janeiro
    'tjmg',   // Minas Gerais
    'tjrs',   // Rio Grande do Sul
    'tjpr',   // Paraná
    'tjba',   // Bahia
    'tjsc',   // Santa Catarina
    'tjdft',  // Distrito Federal
    'tjes',   // Espírito Santo
    'tjgo',   // Goiás
    'tjpe',   // Pernambuco
    'tjce',   // Ceará
    'trf1',   // TRF 1ª Região
    'trf2',   // TRF 2ª Região
    'trf3',   // TRF 3ª Região
    'trf4',   // TRF 4ª Região
    'trf5',   // TRF 5ª Região
    'stj',    // Superior Tribunal de Justiça
    'tst',    // Tribunal Superior do Trabalho
];

// Mapeamento CNJ → código DataJud para busca direta
// Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO → J.TR identifica o tribunal
const CNJ_PARA_TRIBUNAL = {
    '8.26': 'tjsp', '8.19': 'tjrj', '8.13': 'tjmg', '8.21': 'tjrs',
    '8.16': 'tjpr', '8.05': 'tjba', '8.24': 'tjsc', '8.07': 'tjdft',
    '8.08': 'tjes', '8.09': 'tjgo', '8.17': 'tjpe', '8.06': 'tjce',
    '5.01': 'trf1', '5.02': 'trf2', '5.03': 'trf3', '5.04': 'trf4', '5.05': 'trf5',
    '5.06': 'trf1', // trf6 usa mesmo índice do trf1
    '1.02': 'stj',  '1.03': 'tst',
};

// Extrai o código do tribunal de um número CNJ para busca direta
function extrairTribunalCNJ(numeroProcesso) {
    const limpo = numeroProcesso.replace(/\D/g, '');
    if (limpo.length < 16) return null;
    // Posições: 0-6=sequencial, 7-8=dígitos, 9-12=ano, 13=segmento, 14-15=tribunal
    const segmento = limpo[13];
    const tribunal = limpo.substring(14, 16);
    const chave = `${segmento}.${tribunal}`;
    return CNJ_PARA_TRIBUNAL[chave] || null;
}

// Para OAB, só tentamos tribunais estaduais (mais provável e mais rápido)
const TRIBUNAIS_OAB = ['tjsp', 'tjrj', 'tjmg', 'tjrs', 'tjpr', 'tjba', 'tjsc'];

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
    // Formato oficial: api_publica_tjsp/_search (underscore, não barra!)
    return `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal}/_search`;
}

// Chamada à API com autenticação e debug
async function chamarAPI(url, params, apiKeyParam = null, tentativa = 1) {
    await aguardarRateLimit();

    const headers = { 'Content-Type': 'application/json' };
    // Usa a chave do servidor (.env) como padrão; pode ser sobrescrita por apiKeyParam
    const chave = apiKeyParam || DATAJUD_API_KEY;
    const temChave = !!(chave && chave.trim());
    if (temChave) {
        headers['Authorization'] = `APIKey ${chave}`;
    }

    try {
        console.log(`[DataJud] POST ${url} | auth=${temChave ? 'SIM' : 'NÃO'}`);
        console.log(`[DataJud] Query:`, JSON.stringify(params.query).substring(0, 180));

        const res = await axios.post(url, params, { headers, timeout: 30000 });

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
            return chamarAPI(url, params, apiKeyParam, tentativa + 1);
        }

        return null;
    }
}

// Tenta consultar em múltiplos tribunais até encontrar resultado
async function chamarMultiTribunal(params) {
    return _chamarMultiTribunal(params, TRIBUNAIS);
}

// Versão para OAB — só tribunais estaduais
async function chamarMultiTribunalOAB(params) {
    return _chamarMultiTribunal(params, TRIBUNAIS_OAB);
}

async function _chamarMultiTribunal(params, tribunais) {
    for (const tribunal of tribunais) {
        const url = buildUrl(tribunal);
        const data = await chamarAPI(url, params);
        if (data) {
            const hits = data.hits?.hits;
            if (hits && hits.length > 0) {
                return { data, tribunal };
            }
        }
    }
    return null;
}

// Busca por número de processo — vai DIRETO ao tribunal pelo CNJ
async function consultarProcesso(numero) {
    console.log(`[DataJud] 🔍 Buscando processo: ${numero}`);

    const params = {
        query: { match: { numeroProcesso: numero } },
        size: 10,
        sort: [{ "@timestamp": "desc" }]
    };

    // Detecta o tribunal pelo número CNJ para busca direta (1 chamada!)
    const tribunalCNJ = extrairTribunalCNJ(numero);
    if (tribunalCNJ) {
        console.log(`[DataJud] 🎯 Tribunal detectado pelo CNJ: ${tribunalCNJ}`);
        const url = buildUrl(tribunalCNJ);
        const data = await chamarAPI(url, params);
        if (data) {
            const hits = data.hits?.hits;
            if (hits && hits.length > 0) {
                console.log(`[DataJud] ✅ Encontrado em ${tribunalCNJ}: ${hits.length} hits`);
                return extrairDados(hits);
            }
        }
        console.log(`[DataJud] ⚠️ Não encontrado no tribunal ${tribunalCNJ}`);
        return null;
    }

    // Sem CNJ reconhecido → tenta múltiplos tribunais
    const multi = await chamarMultiTribunal(params);
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
async function consultarOAB(uf, numeroOAB) {
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
        }
    ];

    for (const est of estrategias) {
        console.log(`[DataJud] ⚡ Tentando estratégia: ${est.nome}`);

        const params = {
            query: est.query,
            size: 50,
            sort: [{ "@timestamp": "desc" }]
        };

        // Vai direto para tribunais estaduais (só 7, mais rápido)
        const multi = await chamarMultiTribunalOAB(params);

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
                    const mais = await chamarAPI(buildUrl(tribunalEncontrado), params);
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
async function consultarDataJud(query) {
    if (query.tipo === 'oab') {
        return consultarOAB(query.uf, query.numero);
    }

    if (query.tipo === 'processo' || query.tipo === 'nome') {
        const numero = query.numero || query.texto;
        return consultarProcesso(numero);
    }

    // Fallback: trata como processo
    return consultarProcesso(query.original || query);
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
