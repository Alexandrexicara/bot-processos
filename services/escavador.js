const axios = require('axios');

const API_KEY = process.env.ESCAVADOR_API_KEY || '';
const BASE = 'https://api.escavador.com/api/v2';

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
};

console.log(`[Escavador] 🔑 API Key: ${API_KEY ? 'SIM ✅' : 'NÃO ❌'}`);

function extrairProcessos(data) {
    if (!data) return [];
    const arr = data?.items || data?.data || data?.resultados || (Array.isArray(data) ? data : []);
    return arr; // retorna todos sem limite
}

function formatar(p) {
    // Extrai dados da fonte principal (primeira fonte do processo)
    const fonte = p.fontes?.[0] || {};
    const capa = fonte.capa || {};
    
    // Extrai envolvidos (partes, advogados)
    const envolvidos = fonte.envolvidos || [];
    const partes = envolvidos.map(e => ({
        nome: e.nome || '',
        tipo: e.tipo_normalizado || e.tipo || '',
        polo: e.polo || '',
        tipo_pessoa: e.tipo_pessoa || '',
        cpf: e.cpf || '',
        cnpj: e.cnpj || '',
        telefone: e.telefone || e.telefones?.[0] || '',
        email: e.email || e.emails?.[0] || '',
        endereco: e.endereco || '',
        advogados: (e.advogados || []).map(a => ({
            nome: a.nome || (typeof a === 'string' ? a : ''),
            oab: a.oab || a.oab_numero || '',
            telefone: a.telefone || a.telefones?.[0] || ''
        }))
    }));
    
    // Extrai informacoes complementares (relator, fase, origem, etc)
    const infoComp = {};
    if (capa.informacoes_complementares) {
        for (const info of capa.informacoes_complementares) {
            const chave = (info.tipo || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
            infoComp[chave] = info.valor;
        }
    }

    return {
        numero: p.numero_cnj || p.numeroProcesso || p.numero || '',
        tribunal: fonte.sigla || fonte.nome || p.tribunal || '',
        tribunal_descricao: fonte.descricao || '',
        classe: capa.classe || p.classe || p.assunto || '',
        assunto: capa.assunto || capa.assunto_principal_normalizado?.path_completo || '',
        area: capa.area || '',
        data: p.data_inicio || capa.data_distribuicao || p.data || '',
        data_ultima_movimentacao: p.data_ultima_movimentacao || fonte.data_ultima_movimentacao || '',
        grau: fonte.grau_formatado || p.grau || '',
        orgaoJulgador: capa.orgao_julgador || p.orgao || '',
        situacao: capa.situacao || fonte.status_predito || '',
        polo_ativo: p.titulo_polo_ativo || '',
        polo_passivo: p.titulo_polo_passivo || '',
        sistema: fonte.sistema || '',
        valor_causa: capa.valor_causa?.valor_formatado || '',
        segredo_justica: fonte.segredo_justica || false,
        url: fonte.url || '',
        quantidade_movimentacoes: p.quantidade_movimentacoes || fonte.quantidade_movimentacoes || 0,
        estado: p.estado_origem?.nome || p.estado_origem?.sigla || '',
        unidade: p.unidade_origem?.nome || '',
        partes: partes,
        info_complementares: infoComp,
        relator: infoComp.relator || '',
        fase: infoComp.fase || '',
        origem: infoComp.origem || '',
        _score: null
    };
}

async function consultar(query) {
    if (!API_KEY) { console.log('[Escavador] ⏭️ Sem API Key'); return []; }

    // OAB → endpoint separado: /advogado/processos
    if (query.tipo === 'oab' && query.uf && query.numero) {
        return consultarAdvogado(query.uf.toUpperCase(), query.numero);
    }
    // CPF ou CNPJ → /envolvido/processos?cpf_cnpj=...
    if (query.tipo === 'cpf' && query.numero) {
        return consultarEnvolvido({ cpf_cnpj: query.numero });
    }
    if (query.tipo === 'cnpj' && query.numero) {
        return consultarEnvolvido({ cpf_cnpj: query.numero });
    }
    // Nome → /envolvido/processos?nome=...
    if (query.tipo === 'nome' && query.texto) {
        return consultarEnvolvido({ nome: query.texto });
    }
    // Número de processo CNJ → /processos/{numero}
    const numero = typeof query === 'string' ? query : (query.numero || query.original);
    if (!numero) return [];
    return consultarPorProcesso(numero);
}

// ─── Advogado (OAB) → /advogado/processos (com paginação) ───────────
async function consultarAdvogado(uf, numero) {
    console.log(`[Escavador] 🔍 Advogado OAB: ${uf}/${numero}`);
    try {
        const todosResultados = [];
        let offset = 0;
        const limit = 100;
        let totalDisponivel = 0;
        
        do {
            const res = await axios.get(`${BASE}/advogado/processos`, {
                params: { oab_estado: uf, oab_numero: numero, limit, offset },
                headers,
                timeout: 30000
            });
            console.log(`[Escavador] STATUS: ${res.status} (offset=${offset})`);
            const info = res.data?.advogado_encontrado;
            if (info && offset === 0) {
                console.log(`[Escavador] 👤 ${info.nome} | ${info.quantidade_processos} processos`);
                totalDisponivel = info.quantidade_processos || 0;
            }
            const p = extrairProcessos(res.data);
            todosResultados.push(...p);
            
            console.log(`[Escavador] 📦 Página: ${p.length} processos (total coletado: ${todosResultados.length})`);
            
            if (p.length < limit) break; // Última página
            offset += limit;
            
            // Segurança: máximo 500 processos
            if (todosResultados.length >= 500) break;
        } while (true);
        
        console.log(`[Escavador] ✅ ${todosResultados.length} resultados (de ${totalDisponivel} disponíveis)`);
        return todosResultados.map(formatar);
    } catch (err) {
        console.error('[Escavador] ❌❌❌ ERRO ADVOGADO/OAB:');
        console.error('   STATUS:', err.response?.status);
        console.error('   DATA:', JSON.stringify(err.response?.data).substring(0, 1000));
        console.error('   MESSAGE:', err.message);
        return [];
    }
}

// ─── Envolvido (CPF/CNPJ/Nome) → /envolvido/processos (com paginação) ───
async function consultarEnvolvido(params) {
    console.log(`[Escavador] 🔍 Envolvido:`, params);
    try {
        const todosResultados = [];
        let offset = 0;
        const limit = 100;
        
        do {
            const res = await axios.get(`${BASE}/envolvido/processos`, {
                params: { ...params, limit, offset },
                headers,
                timeout: 30000
            });
            console.log(`[Escavador] STATUS: ${res.status} (offset=${offset})`);
            const info = res.data?.envolvido_encontrado;
            if (info && offset === 0) {
                console.log(`[Escavador] 👤 ${info.nome} | ${info.quantidade_processos} processos`);
            }
            const p = extrairProcessos(res.data);
            todosResultados.push(...p);
            
            console.log(`[Escavador] 📦 Página: ${p.length} processos (total coletado: ${todosResultados.length})`);
            
            if (p.length < limit) break;
            offset += limit;
            if (todosResultados.length >= 500) break;
        } while (true);
        
        console.log(`[Escavador] ✅ ${todosResultados.length} resultados`);
        return todosResultados.map(formatar);
    } catch (err) {
        console.error('[Escavador] ❌❌❌ ERRO ENVOLVIDO:');
        console.error('   STATUS:', err.response?.status);
        console.error('   DATA:', JSON.stringify(err.response?.data).substring(0, 1000));
        console.error('   MESSAGE:', err.message);
        return [];
    }
}

// ─── Processo (CNJ) ────────────────────────────────
async function consultarPorProcesso(numero) {
    const limpo = numero.replace(/\D/g, '');
    console.log(`[Escavador] 🔍 Processo: ${numero} → ${limpo}`);

    try {
        const res = await axios.get(`${BASE}/processos/${limpo}`, { headers, timeout: 15000 });
        console.log(`[Escavador] STATUS: ${res.status}`);
        const p = res.data;
        if (p && (p.numero_cnj || p.numeroProcesso || p.numero)) {
            console.log('[Escavador] ✅ Encontrado');
            return [formatar(p)];
        }
        console.log('[Escavador] Sem dados válidos na resposta');
    } catch (err) {
        console.error('[Escavador] ❌ PROCESSO:');
        console.error('   STATUS:', err.response?.status);
        console.error('   DATA:', JSON.stringify(err.response?.data).substring(0, 500));
        if (err.response?.status === 404) return [];
    }

    return [];
}

module.exports = { nome: 'Escavador', gratuito: false, consultar };
