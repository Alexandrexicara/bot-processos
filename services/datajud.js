const axios = require('axios');

// Chave da API DataJud — nível servidor (.env), NÃO por utilizador
const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY || '';
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

// Mapeamento UF → tribunal estadual DataJud
const UF_PARA_TRIBUNAL = {
    'SP': 'tjsp', 'RJ': 'tjrj', 'MG': 'tjmg', 'RS': 'tjrs',
    'PR': 'tjpr', 'BA': 'tjba', 'SC': 'tjsc', 'DF': 'tjdft',
    'ES': 'tjes', 'GO': 'tjgo', 'PE': 'tjpe', 'CE': 'tjce',
    'MS': 'tjms', 'MT': 'tjmt', 'PA': 'tjpa', 'AM': 'tjam',
    'MA': 'tjma', 'PI': 'tjpi', 'RN': 'tjrn', 'PB': 'tjpb',
    'AL': 'tjal', 'SE': 'tjse', 'TO': 'tjto', 'RO': 'tjro',
    'AC': 'tjac', 'AP': 'tjap', 'RR': 'tjrr'
};

// Para OAB, prioriza tribunal do estado + principais tribunais
const TRIBUNAIS_OAB = ['tjsp', 'tjrj', 'tjmg', 'tjrs', 'tjpr', 'tjba', 'tjsc',
    'tjdft', 'tjgo', 'tjpe', 'tjce', 'tjms', 'tjmt', 'tjpa'];

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
    // Remove máscara: DataJud armazena como 20 dígitos sem formatação
    const limpo = numero.replace(/\D/g, '');
    console.log(`[DataJud] 🔍 Buscando processo: ${numero} → ${limpo}`);

    const params = {
        query: { match: { numeroProcesso: limpo } },
        size: 10,
        sort: [{ "@timestamp": "desc" }]
    };

    // Detecta o tribunal pelo número CNJ para busca direta (1 chamada!)
    const tribunalCNJ = extrairTribunalCNJ(limpo);
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

    // Prioriza tribunal do estado da OAB primeiro
    const tribunalPrioritario = UF_PARA_TRIBUNAL[uf.toUpperCase()];

    // Estratégia 1: buscar OAB como texto estruturado
    const estrategias = [
        {
            nome: 'simple_query_string',
            query: {
                simple_query_string: {
                    query: `"${numeroOAB}"`,
                    fields: ["*"],
                    default_operator: "or"
                }
            }
        }
    ];

    for (const est of estrategias) {
        console.log(`[DataJud] ⚡ Tentando estratégia: ${est.nome}`);

        const params = {
            query: est.query,
            size: 15,
            sort: [{ "@timestamp": "desc" }]
        };

        // Primeiro: tribunal do estado da OAB (busca direta!)
        if (tribunalPrioritario) {
            console.log(`[DataJud] 🎯 Tribunal prioritário (UF=${uf}): ${tribunalPrioritario}`);
            const url = buildUrl(tribunalPrioritario);
            const data = await chamarAPI(url, params);
            if (data) {
                const hits = data.hits?.hits;
                if (hits && hits.length > 0) {
                    console.log(`[DataJud] ✅ OAB encontrada em ${tribunalPrioritario}: ${hits.length} hits`);
                    return extrairDados(hits);
                }
            }
        }

        // Depois: outros tribunais estaduais
        const multi = await chamarMultiTribunalOAB(params);

        if (multi) {
            const data = multi.data;
            const hits = data.hits?.hits;
            if (hits && hits.length > 0) {
                const total = data.hits?.total?.value || hits.length;
                console.log(`[DataJud] ✅ Estratégia ${est.nome}: ${total} resultados em ${multi.tribunal}`);
                return extrairDados(hits);
            }
        }

        console.log(`[DataJud] ⚠️ Estratégia ${est.nome}: 0 resultados`);
    }

    console.log(`[DataJud] ❌ Nenhuma estratégia funcionou para OAB ${uf}${numeroOAB}`);
    return null;
}

// Busca por CPF ou CNPJ — pesquisa nos campos de envolvidos/advogados
async function consultarCPFCNPJ(documento) {
    const limpo = documento.replace(/\D/g, '');
    console.log(`[DataJud] 🔍 Buscando CPF/CNPJ: ${limpo}`);

    // DataJud indexa CPF/CNPJ de advogados e envolvidos como texto
    const estrategias = [
        {
            nome: 'simple_query_string',
            query: {
                simple_query_string: {
                    query: `"${limpo}"`,
                    fields: ["*"],
                    default_operator: "or"
                }
            }
        },
        {
            nome: 'wildcard_cpf',
            query: {
                query_string: {
                    query: `*${limpo}*`,
                    default_field: "*"
                }
            }
        }
    ];

    for (const est of estrategias) {
        console.log(`[DataJud] ⚡ CPF/CNPJ estratégia: ${est.nome}`);

        const params = {
            query: est.query,
            size: 15,
            sort: [{ "@timestamp": "desc" }]
        };

        const multi = await chamarMultiTribunal(params);

        if (!multi) continue;
        const data = multi.data;
        const hits = data.hits?.hits;
        if (hits && hits.length > 0) {
            const total = data.hits?.total?.value || hits.length;
            console.log(`[DataJud] ✅ CPF/CNPJ ${est.nome}: ${total} resultados em ${multi.tribunal}`);
            return extrairDados(hits);
        }
    }

    console.log(`[DataJud] ❌ CPF/CNPJ ${limpo} não encontrado`);
    return null;
}

// Consulta unificada — decide o tipo de busca com base no parser
async function consultarDataJud(query) {
    if (query.tipo === 'oab') {
        return consultarOAB(query.uf, query.numero);
    }

    if (query.tipo === 'cpf' || query.tipo === 'cnpj') {
        return consultarCPFCNPJ(query.numero);
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
        
        // Extrai partes do processo
        const partes = [];
        if (p.partes) {
            for (const parte of p.partes) {
                partes.push({
                    nome: parte.nome || parte.polo || '',
                    tipo: parte.tipo || '',
                    polo: parte.polo || '',
                    advogados: (parte.advogados || []).map(a => a.nome || a)
                });
            }
        }
        
        // Extrai movimentacoes
        const movimentacoes = [];
        if (p.movimentacoes) {
            for (const mov of p.movimentacoes.slice(0, 20)) {
                movimentacoes.push({
                    data: mov.dataMovimentacao || mov.data || '',
                    descricao: mov.descricao || mov.texto || mov.tipo || ''
                });
            }
        }
        
        resultados.push({
            numero: p.numeroProcesso,
            tribunal: p.tribunal || p.nomeOrgao,
            classe: p.classe?.nome || p.classeProcessual,
            assunto: p.assunto?.nome || p.assuntoProcessual,
            data: p.dataHoraUltimaAtualizacao || p["@timestamp"],
            data_distribuicao: p.dataHoraDistribuicao || p.dataDistribuicao,
            grau: p.grau,
            orgaoJulgador: p.orgaoJulgador?.nome,
            situacao: p.situacao || p.nivelSigilo,
            valor_causa: p.valorCausa,
            polo_ativo: p.partes?.filter(p => p.polo === 'ATIVO').map(p => p.nome).join(', ') || '',
            polo_passivo: p.partes?.filter(p => p.polo === 'PASSIVO').map(p => p.nome).join(', ') || '',
            partes: partes,
            movimentacoes: movimentacoes,
            sistema: p.sistema,
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
