const axios = require('axios');

const API_KEY = process.env.ESCAVADOR_API_KEY || '';
const BASE = 'https://api.escavador.com/api/v2';

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
};

console.log(`[Escavador] 🔑 API Key: ${API_KEY ? 'SIM ✅' : 'NÃO ❌'}`);

function extrairProcessos(data) {
    if (!data) return [];
    console.log(`[Escavador] 📦 RESPOSTA:`, JSON.stringify(data).substring(0, 600));
    const arr = data?.items || data?.data || data?.resultados || (Array.isArray(data) ? data : []);
    return arr.slice(0, 15);
}

function formatar(p) {
    return {
        numero: p.numero_cnj || p.numeroProcesso || p.numero || '',
        tribunal: p.tribunal || p.fonte || p.fontes?.[0]?.nome || '',
        classe: p.classe || p.assunto || '',
        data: p.data_inicio || p.data || '',
        grau: p.grau || '',
        orgaoJulgador: p.orgao || '',
        polo_ativo: p.titulo_polo_ativo || '',
        polo_passivo: p.titulo_polo_passivo || '',
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

// ─── Advogado (OAB) → /advogado/processos ───────────
async function consultarAdvogado(uf, numero) {
    console.log(`[Escavador] 🔍 Advogado OAB: ${uf}/${numero}`);
    try {
        const res = await axios.get(`${BASE}/advogado/processos`, {
            params: { oab_estado: uf, oab_numero: numero, limit: 50 },
            headers,
            timeout: 30000
        });
        console.log(`[Escavador] STATUS: ${res.status}`);
        const p = extrairProcessos(res.data);
        console.log(`[Escavador] ✅ ${p.length} resultados`);
        return p.map(formatar);
    } catch (err) {
        console.error('[Escavador] ❌❌❌ ERRO ADVOGADO/OAB:');
        console.error('   STATUS:', err.response?.status);
        console.error('   DATA:', JSON.stringify(err.response?.data).substring(0, 1000));
        console.error('   MESSAGE:', err.message);
        return [];
    }
}

// ─── Envolvido (CPF/CNPJ/Nome) → /envolvido/processos ───
async function consultarEnvolvido(params) {
    console.log(`[Escavador] 🔍 Envolvido:`, params);
    try {
        const res = await axios.get(`${BASE}/envolvido/processos`, {
            params: { ...params, limit: 50 },
            headers,
            timeout: 30000
        });
        console.log(`[Escavador] STATUS: ${res.status}`);
        const p = extrairProcessos(res.data);
        console.log(`[Escavador] ✅ ${p.length} resultados`);
        return p.map(formatar);
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
