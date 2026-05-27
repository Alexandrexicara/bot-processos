const axios = require('axios');

// API Key via variável de ambiente: ESCAVADOR_API_KEY
const API_KEY = process.env.ESCAVADOR_API_KEY || '';
const BASE = 'https://api.escavador.com/api/v1';
const BASE_V2 = 'https://api.escavador.com/api/v2';

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
};

console.log(`[Escavador] 🔑 API Key: ${API_KEY ? 'SIM ✅' : 'NÃO ❌'}`);

// Extrai array de processos da resposta (vários formatos possíveis)
function extrairProcessos(data) {
    if (!data) return [];
    console.log(`[Escavador] 📦 RESPOSTA:`, JSON.stringify(data).substring(0, 500));
    const arr = data?.items || data?.data || data?.resultados || (Array.isArray(data) ? data : []);
    return arr.slice(0, 15);
}

// Converte processo para formato padronizado
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

// query = objeto { tipo, uf, numero, texto, original }
async function consultar(query) {
    if (!API_KEY) {
        console.log('[Escavador] ⏭️ Pulando — API Key não configurada');
        return null;
    }

    // OAB
    if (query.tipo === 'oab' && query.uf && query.numero) {
        return consultarPorOAB(query.uf, query.numero);
    }

    // CPF / CNPJ / Nome
    if ((query.tipo === 'cpf' || query.tipo === 'cnpj' || query.tipo === 'nome') && (query.numero || query.texto)) {
        return consultarPorDocumento(query.tipo, query.numero || query.texto);
    }

    // Processo
    const numero = typeof query === 'string' ? query : (query.numero || query.original);
    if (!numero) return null;
    return consultarPorProcesso(numero);
}

// ─── OAB ───────────────────────────────────────────
async function consultarPorOAB(uf, numeroOAB) {
    console.log(`[Escavador] 🔍 Buscando OAB ${uf}/${numeroOAB}`);

    try {
        const res = await axios.get(`${BASE}/envolvido/processos`, {
            params: { oab_estado: uf.toUpperCase(), oab_numero: numeroOAB },
            headers,
            timeout: 30000
        });

        console.log(`[Escavador] STATUS: ${res.status}`);
        const processos = extrairProcessos(res.data);
        console.log(`[Escavador] ✅ ${processos.length} processos (max 15)`);
        return processos.map(formatar);

    } catch (err) {
        console.error(`[Escavador] ❌ OAB: ${err.response?.status} ${err.message}`);
        return null;
    }
}

// ─── Processo (CNJ) ────────────────────────────────
async function consultarPorProcesso(numero) {
    // Remove máscara: só dígitos
    const limpo = numero.replace(/\D/g, '');
    console.log(`[Escavador] 🔍 Buscando processo: ${numero} → ${limpo}`);

    // Tenta V1
    try {
        const res = await axios.get(`${BASE}/processos/${limpo}`, { headers, timeout: 15000 });
        console.log(`[Escavador] V1 STATUS: ${res.status}`);

        const p = res.data;
        if (p && (p.numero_cnj || p.numeroProcesso || p.numero)) {
            console.log('[Escavador] ✅ Encontrado via V1');
            return [formatar(p)];
        }
        console.log('[Escavador] V1 retornou sem dados válidos');
    } catch (err) {
        console.log(`[Escavador] V1: ${err.response?.status}`);
    }

    // Tenta V2
    try {
        const res = await axios.get(`${BASE_V2}/processos/${limpo}`, { headers, timeout: 15000 });
        console.log(`[Escavador] V2 STATUS: ${res.status}`);

        const p = res.data;
        if (p && (p.numero_cnj || p.numeroProcesso || p.numero)) {
            console.log('[Escavador] ✅ Encontrado via V2');
            return [formatar(p)];
        }
        console.log('[Escavador] V2 retornou sem dados válidos');
    } catch (err) {
        if (err.response?.status === 404) {
            console.log('[Escavador] ⚠️ Processo não encontrado');
            return [];
        }
        console.error(`[Escavador] ❌ Processo: ${err.response?.status} ${err.message}`);
        return null;
    }

    return [];
}

// ─── CPF / CNPJ / Nome ─────────────────────────────
async function consultarPorDocumento(tipo, valor) {
    console.log(`[Escavador] 🔍 Buscando ${tipo}: ${valor}`);

    const params = {};
    if (tipo === 'cpf') params.cpf = valor;
    else if (tipo === 'cnpj') params.cnpj = valor;
    else params.nome = valor;

    try {
        const res = await axios.get(`${BASE}/envolvido/processos`, {
            params,
            headers,
            timeout: 30000
        });

        console.log(`[Escavador] STATUS: ${res.status}`);
        const processos = extrairProcessos(res.data);
        console.log(`[Escavador] ✅ ${processos.length} processos (max 15)`);
        return processos.map(formatar);

    } catch (err) {
        console.error(`[Escavador] ❌ ${tipo}: ${err.response?.status} ${err.message}`);
        return null;
    }
}

module.exports = {
    nome: 'Escavador',
    gratuito: false,
    consultar
};
