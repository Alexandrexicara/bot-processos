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
        return [];
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
    if (!numero) return [];
    return consultarPorProcesso(numero);
}

// ─── OAB ───────────────────────────────────────────
async function consultarPorOAB(uf, numeroOAB) {
    console.log(`[Escavador] 🔍 Buscando OAB ${uf}/${numeroOAB}`);

    try {
        const res = await axios.get(`${BASE}/busca`, {
            params: { q: `${uf} ${numeroOAB}`, pagina: 1 },
            headers,
            timeout: 30000
        });

        console.log(`[Escavador] OAB STATUS: ${res.status}`);
        const processos = extrairProcessos(res.data);
        console.log(`[Escavador] ✅ ${processos.length} processos (max 15)`);
        return processos.map(formatar);

    } catch (err) {
        console.error('[Escavador] ❌❌❌ ERRO OAB COMPLETO:');
        console.error('   STATUS:', err.response?.status);
        console.error('   DATA:', JSON.stringify(err.response?.data).substring(0, 1000));
        console.error('   MESSAGE:', err.message);
        return [];
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
        console.error('[Escavador] ❌❌❌ ERRO PROCESSO COMPLETO:');
        console.error('   STATUS:', err.response?.status);
        console.error('   DATA:', JSON.stringify(err.response?.data).substring(0, 1000));
        console.error('   MESSAGE:', err.message);
        return [];
    }

    return [];
}

// ─── CPF / CNPJ / Nome ─────────────────────────────
async function consultarPorDocumento(tipo, valor) {
    console.log(`[Escavador] 🔍 Buscando ${tipo}: ${valor}`);

    try {
        const res = await axios.get(`${BASE}/busca`, {
            params: { q: valor, pagina: 1 },
            headers,
            timeout: 30000
        });

        console.log(`[Escavador] ${tipo} STATUS: ${res.status}`);
        const processos = extrairProcessos(res.data);
        console.log(`[Escavador] ✅ ${processos.length} processos (max 15)`);
        return processos.map(formatar);

    } catch (err) {
        console.error(`[Escavador] ❌❌❌ ERRO ${tipo.toUpperCase()} COMPLETO:`);
        console.error('   STATUS:', err.response?.status);
        console.error('   DATA:', JSON.stringify(err.response?.data).substring(0, 1000));
        console.error('   MESSAGE:', err.message);
        return [];
    }
}

module.exports = {
    nome: 'Escavador',
    gratuito: false,
    consultar
};
