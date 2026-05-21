const axios = require('axios');

// API Key via variável de ambiente: JUSBRASIL_API_KEY
const API_KEY = process.env.JUSBRASIL_API_KEY || '';
const BASE = 'https://op.digesto.com.br';

console.log(`[Jusbrasil] 🔑 API Key: ${API_KEY ? 'SIM ✅' : 'NÃO ❌'}`);

// query = objeto { tipo, uf, numero, texto, original }
async function consultar(query) {
    if (!API_KEY) {
        console.log('[Jusbrasil] ⏭️ Pulando — API Key não configurada');
        return null;
    }

    // Se for busca por OAB, usa endpoint específico
    if (query.tipo === 'oab' && query.uf && query.numero) {
        return consultarPorOAB(query.uf, query.numero);
    }

    // Busca por número de processo via Jusbrasil
    const numero = typeof query === 'string' ? query : (query.numero || query.original);
    if (!numero) return null;
    return consultarPorProcesso(numero);
}

// 🔍 Busca OAB no Jusbrasil — fluxo completo:
// 1. Verifica se a OAB já está monitorada
// 2. Se sim → retorna os CNJs vinculados
// 3. Se não → cadastra e avisa que é assíncrono
async function consultarPorOAB(uf, numeroOAB) {
    const ufUpper = uf.toUpperCase();
    console.log(`[Jusbrasil] 🔍 Buscando OAB ${ufUpper}/${numeroOAB}`);

    try {
        // Passo 1: Buscar OAB já monitorada
        const oabExistente = await buscarOABMonitorada(ufUpper, numeroOAB);

        if (oabExistente) {
            console.log(`[Jusbrasil] ✅ OAB já monitorada (id=${oabExistente.id})`);
            // Passo 2: Buscar processos vinculados
            return await listarProcessosPorOAB(oabExistente.id);
        }

        // Passo 3: OAB não monitorada → cadastrar
        console.log('[Jusbrasil] 📝 OAB não monitorada, cadastrando...');
        const novaOab = await cadastrarOAB(ufUpper, numeroOAB);

        if (novaOab) {
            // Tenta buscar processos imediatamente (podem já existir na base)
            console.log(`[Jusbrasil] 📋 OAB cadastrada (id=${novaOab.id}), buscando processos...`);
            const processos = await listarProcessosPorOAB(novaOab.id);
            if (processos && processos.length > 0) {
                return processos;
            }
            // Se não encontrou ainda, a coleta é assíncrona
            console.log('[Jusbrasil] ⏳ Processos ainda em coleta assíncrona');
        }

        return [];

    } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data ? JSON.stringify(err.response.data).substring(0, 300) : err.message;
        console.error(`[Jusbrasil] ❌ Erro ${status}: ${msg}`);
        return null;
    }
}

// GET /api/monitoramento/oab/acompanhamento/{UF}/{NUMERO}
async function buscarOABMonitorada(uf, numero) {
    try {
        const res = await axios.get(
            `${BASE}/api/monitoramento/oab/acompanhamento/${uf}/${numero}`,
            {
                headers: { 'Authorization': `Bearer ${API_KEY}` },
                timeout: 15000
            }
        );
        if (res.data && res.data.id) {
            return res.data;
        }
        return null;
    } catch (err) {
        if (err.response?.status === 404) {
            return null; // Não monitorada ainda
        }
        throw err;
    }
}

// POST /api/monitoramento/oab/acompanhamento/
async function cadastrarOAB(uf, numero) {
    try {
        const res = await axios.post(
            `${BASE}/api/monitoramento/oab/acompanhamento/`,
            [{
                name: `Advogado(a) ${uf} ${numero}`,
                number: parseInt(numero),
                region: uf,
                is_active: true
            }],
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );
        if (res.data && Array.isArray(res.data) && res.data[0]) {
            return res.data[0];
        }
        return null;
    } catch (err) {
        const status = err.response?.status;
        // 409 = OAB já existe, tenta buscar de novo
        if (status === 409) {
            console.log('[Jusbrasil] ⚠️ OAB já existe (409), tentando buscar...');
            return await buscarOABMonitorada(uf, numero);
        }
        throw err;
    }
}

// GET /api/monitoramento/oab/vinculos/processos/oab?oab_id={id}
async function listarProcessosPorOAB(oabId) {
    try {
        const res = await axios.get(
            `${BASE}/api/monitoramento/oab/vinculos/processos/oab`,
            {
                params: { oab_id: oabId, per_page: 50, page: 1 },
                headers: { 'Authorization': `Bearer ${API_KEY}` },
                timeout: 30000
            }
        );

        const vinculos = res.data || [];
        console.log(`[Jusbrasil] ✅ ${vinculos.length} processos vinculados`);

        if (vinculos.length === 0) return [];

        // Converte para formato padronizado
        return vinculos.map(v => ({
            numero: v.cnj || '',
            tribunal: '',
            classe: '',
            data: v.created_at || '',
            grau: '',
            orgaoJulgador: '',
            _score: null
        }));

    } catch (err) {
        console.error('[Jusbrasil] ❌ Erro ao listar processos:', err.message);
        return [];
    }
}

// Busca processo por número CNJ (fallback)
async function consultarPorProcesso(numero) {
    try {
        const res = await axios.get(
            `${BASE}/api/monitoramento/oab/vinculos/processos/cnj`,
            {
                params: { numero_cnj: numero, per_page: 10 },
                headers: { 'Authorization': `Bearer ${API_KEY}` },
                timeout: 15000
            }
        );

        const vinculos = res.data || [];
        if (vinculos.length === 0) return [];

        return vinculos.map(v => ({
            numero: v.cnj || '',
            tribunal: '',
            classe: '',
            data: v.created_at || '',
            grau: '',
            orgaoJulgador: '',
            _score: null
        }));

    } catch (err) {
        if (err.response?.status === 404) return [];
        console.error('[Jusbrasil] ❌ Erro ao buscar processo:', err.message);
        return null;
    }
}

module.exports = {
    nome: 'Jusbrasil',
    gratuito: false,
    consultar
};
