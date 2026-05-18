const axios = require('axios');

// API Key via variável de ambiente: ESCAVADOR_API_KEY
const API_KEY = process.env.ESCAVADOR_API_KEY || '';
const BASE = 'https://api.escavador.com/api/v2';

console.log(`[Escavador] 🔑 API Key: ${API_KEY ? 'SIM ✅' : 'NÃO ❌ (OAB não funcionará)'}`);

// query = objeto { tipo, uf, numero, texto, original }
async function consultar(query) {
    if (!API_KEY) {
        console.log('[Escavador] ⏭️ Pulando — API Key não configurada');
        return null;
    }

    // Se for busca por OAB, usa endpoint específico
    if (query.tipo === 'oab' && query.uf && query.numero) {
        return consultarPorOAB(query.uf, query.numero);
    }

    // Busca por número de processo
    const numero = typeof query === 'string' ? query : (query.numero || query.original);
    if (!numero) return null;
    return consultarPorProcesso(numero);
}

// Busca processos vinculados a uma OAB
// Endpoint: GET /api/v2/envolvido/processos?oab_estado=MS&oab_numero=3616
async function consultarPorOAB(uf, numeroOAB) {
    console.log(`[Escavador] 🔍 Buscando processos da OAB ${uf}/${numeroOAB}`);

    try {
        const res = await axios.get(`${BASE}/envolvido/processos`, {
            params: {
                oab_estado: uf.toUpperCase(),
                oab_numero: numeroOAB
            },
            headers: { 'Authorization': `Bearer ${API_KEY}` },
            timeout: 30000
        });

        const processos = res.data?.items || res.data?.data || [];
        console.log(`[Escavador] ✅ ${processos.length} processos encontrados`);

        if (processos.length === 0) return [];

        // Converte para o formato padronizado do sistema
        return processos.map(p => ({
            numero: p.numero_cnj || p.numeroProcesso || p.numero,
            tribunal: p.tribunal || p.fonte || '',
            classe: p.classe || p.assunto || '',
            data: p.data_inicio || p.data || '',
            grau: p.grau || '',
            orgaoJulgador: p.orgao || '',
            polo_ativo: p.titulo_polo_ativo || '',
            polo_passivo: p.titulo_polo_passivo || '',
            _score: null
        }));

    } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data ? JSON.stringify(err.response.data).substring(0, 300) : err.message;
        console.error(`[Escavador] ❌ Erro ${status}: ${msg}`);
        return null;
    }
}

// Busca processo por número CNJ
async function consultarPorProcesso(numero) {
    console.log(`[Escavador] 🔍 Buscando processo: ${numero}`);

    try {
        const res = await axios.get(`${BASE}/processos/${numero}`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` },
            timeout: 15000
        });

        const p = res.data;
        if (!p || !p.numero_cnj) return [];

        return [{
            numero: p.numero_cnj,
            tribunal: p.tribunal || p.fontes?.[0]?.nome || '',
            classe: p.classe || '',
            data: p.data_inicio || '',
            grau: p.grau || '',
            orgaoJulgador: p.orgao || '',
            _score: null
        }];

    } catch (err) {
        if (err.response?.status === 404) {
            console.log('[Escavador] ⚠️ Processo não encontrado');
            return [];
        }
        const status = err.response?.status;
        const msg = err.response?.data ? JSON.stringify(err.response.data).substring(0, 200) : err.message;
        console.error(`[Escavador] ❌ Erro ${status}: ${msg}`);
        return null;
    }
}

module.exports = {
    nome: 'Escavador',
    gratuito: false,
    consultar
};
