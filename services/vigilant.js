const axios = require('axios');

const API_KEY = process.env.VIGILANT_API_KEY || '';
const BASE = 'https://vigilant.trackjud.com.br';

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
};

console.log(`[Vigilant] 🔑 API Key: ${API_KEY ? 'SIM ✅' : 'NÃO ❌'}`);

// Cache de tribunais disponíveis
let _tribunaisCache = null;
let _tribunaisExpira = 0;

// ─── Lista tribunais disponíveis ────────────────────
async function getTribunaisAtivos() {
    if (_tribunaisCache && Date.now() < _tribunaisExpira) return _tribunaisCache;

    try {
        const res = await axios.get(`${BASE}/api/v1/courts`, { headers, timeout: 15000 });
        const lista = res.data?.data || [];
        _tribunaisCache = lista
            .filter(t => t.status === 'active' || t.status === 'unavailable')
            .map(t => t.court_code);
        _tribunaisExpira = Date.now() + 60 * 60 * 1000; // 1 hora
        console.log(`[Vigilant] 📋 ${_tribunaisCache.length} tribunais ativos`);
        return _tribunaisCache;
    } catch (err) {
        console.error('[Vigilant] ❌ Erro ao listar tribunais:', err.message);
        // Fallback: tribunais mais comuns
        return ['TJSP', 'TJRJ', 'TJMG', 'TJRS', 'TJBA', 'TJPR', 'TJSC', 'TJPE', 'TJCE', 'TJGO',
                'TJDF', 'TJES', 'TJPA', 'TJAM', 'TJMT', 'TJMS', 'TJMA', 'TJPB', 'TJRN', 'TJAL',
                'TJSE', 'TJPI', 'TJTO', 'TJAC', 'TJAP', 'TJRR', 'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5'];
    }
}

// ─── Formata ProcessRecord para o padrão do sistema ──────
function formatar(p) {
    const partesNomes = (p.partes || []).map(pt => `${pt.tipo}: ${pt.nome}`).join(' | ');
    return {
        numero: p.numero_processo_unico || p.numero_processo || '',
        tribunal: p.court || '',
        classe: p.classe || '',
        data: p.distribuido_em || '',
        grau: p.instance === '2' ? '2ª Instância' : '1ª Instância',
        orgaoJulgador: p.competencia || '',
        polo_ativo: (p.partes || []).filter(pt => pt.tipo === 'Autor' || pt.tipo === 'Requerente').map(pt => pt.nome).join(', '),
        polo_passivo: (p.partes || []).filter(pt => pt.tipo === 'Réu' || pt.tipo === 'Requerido').map(pt => pt.nome).join(', '),
        situacao: p.situacao || '',
        valor_causa: p.valor_causa || '',
        url: p.url_processo || '',
        _score: null,
        _raw: partesNomes
    };
}

// ─── Extrai processos da resposta (cache hit ou consult detail) ─
function extrairProcessos(data) {
    if (!data) return [];
    const courts = data?.courts || [];
    const processos = [];
    for (const court of courts) {
        const procs = court.processes || [];
        for (const p of procs) {
            processos.push(formatar(p));
        }
    }
    return processos.slice(0, 15);
}

// ─── Polling: aguarda consulta ficar "done" ────────────
async function aguardarResultado(consultId, maxTentativas = 12, intervaloMs = 5000) {
    console.log(`[Vigilant] ⏳ Aguardando resultado ${consultId}...`);
    for (let i = 0; i < maxTentativas; i++) {
        await new Promise(r => setTimeout(r, intervaloMs));
        try {
            const res = await axios.get(`${BASE}/api/v1/consults/${consultId}`, { headers, timeout: 15000 });
            const status = res.data?.data?.status;
            console.log(`[Vigilant] 🔄 Polling ${i + 1}/${maxTentativas}: status=${status}`);
            if (status === 'done') {
                return res.data.data;
            }
            if (status === 'canceled') {
                console.log('[Vigilant] ⚠️ Consulta cancelada');
                return null;
            }
        } catch (err) {
            console.error(`[Vigilant] ❌ Erro polling:`, err.message);
        }
    }
    console.log('[Vigilant] ⚠️ Timeout — consulta não finalizou em tempo');
    return null;
}

// ─── Consulta principal ─────────────────────────────
async function consultar(query) {
    if (!API_KEY) { console.log('[Vigilant] ⏭️ Sem API Key'); return []; }

    // Vigilant só aceita CPF
    if (query.tipo !== 'cpf') return [];

    const cpf = (query.numero || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
        console.log('[Vigilant] ⚠️ CPF inválido:', cpf);
        return [];
    }

    // Formata CPF com máscara (aceito pela API)
    const cpfMask = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

    console.log(`[Vigilant] 🔍 CPF: ${cpfMask}`);

    // Busca tribunais ativos
    const tribunais = await getTribunaisAtivos();

    try {
        const res = await axios.post(`${BASE}/api/v1/consults`, {
            document: cpfMask,
            courts: tribunais,
            force_refresh: false
        }, { headers, timeout: 30000 });

        console.log(`[Vigilant] STATUS: ${res.status}`);

        // 200 = cache hit, dados prontos
        if (res.status === 200) {
            const procs = extrairProcessos(res.data?.data);
            console.log(`[Vigilant] ✅ Cache hit: ${procs.length} resultados`);
            return procs;
        }

        // 202 = consulta criada, precisa polling
        if (res.status === 202) {
            const consultId = res.data?.data?.consult_id;
            if (!consultId) {
                console.log('[Vigilant] ⚠️ Sem consult_id na resposta 202');
                return [];
            }
            console.log(`[Vigilant] 📋 Consult criada: ${consultId}`);
            const resultado = await aguardarResultado(consultId);
            if (resultado) {
                const procs = extrairProcessos(resultado);
                console.log(`[Vigilant] ✅ ${procs.length} resultados`);
                return procs;
            }
        }

        console.log('[Vigilant] ⚠️ Resposta inesperada:', res.status);
        return [];
    } catch (err) {
        console.error('[Vigilant] ❌ ERRO:');
        console.error('   STATUS:', err.response?.status);
        console.error('   DATA:', JSON.stringify(err.response?.data).substring(0, 500));
        console.error('   MESSAGE:', err.message);
        return [];
    }
}

module.exports = { nome: 'Vigilant', gratuito: false, consultar };
