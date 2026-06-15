const escavador = require('./services/escavador');
const datajud = require('./services/datajud');
const jusbrasil = require('./services/jusbrasil');
const vigilant = require('./services/vigilant');

// Serviços extra pagos (vazios — usuário pode adicionar APIs próprias no painel)
const servicosPagos = [];

// query = { tipo, uf, numero, texto, original } ou string
async function consultarProcesso(query, user) {

    const q = typeof query === 'string' ? { tipo: 'processo', numero: query, original: query } : query;
    const modo = user?.modo || 'gratis';

    console.log(`[apiRouter] Modo: ${modo}, Tipo: ${q.tipo}, Query:`, q.original || q.numero || q.texto);

    // ── BUSCA POR NÚMERO DE PROCESSO ──────────────────────
    // DataJud (CNJ oficial) primeiro → cobre TODOS os tribunais
    if (q.tipo === 'processo' && (q.numero || q.original)) {
        try {
            console.log('[apiRouter] ⚡ Consultando DataJud (CNJ)...');
            const dj = await datajud.consultar(q);
            console.log('[apiRouter] 📦 DataJud:', JSON.stringify(dj).substring(0, 500));
            if (Array.isArray(dj) && dj.length > 0) {
                dj.forEach(r => r.fonte = datajud.nome);
                return dj;
            }
        } catch (err) {
            console.error('[apiRouter] ❌ Erro DataJud:', err.message);
        }
        // Fallback: Escavador para processo
        console.log('[apiRouter] ⚡ DataJud sem resultado, tentando Escavador...');
    }

    // ── BUSCA POR OAB ────────────────────────────────────
    // 1. Jusbrasil (busca dedicada por OAB)
    // 2. Escavador (endpoint /advogado/processos)
    // 3. DataJud (fallback — busca textual no tribunal do estado)
    if (q.tipo === 'oab') {
        // Jusbrasil primeiro
        try {
            console.log('[apiRouter] ⚡ Consultando Jusbrasil (OAB)...');
            const jb = await jusbrasil.consultar(q);
            if (Array.isArray(jb) && jb.length > 0) {
                jb.forEach(r => r.fonte = jusbrasil.nome);
                return jb;
            }
        } catch (err) {
            console.error('[apiRouter] ❌ Erro Jusbrasil:', err.message);
        }
        // Escavador como fallback
        try {
            console.log('[apiRouter] ⚡ Consultando Escavador (OAB)...');
            const esc = await escavador.consultar(q);
            if (Array.isArray(esc) && esc.length > 0) {
                esc.forEach(r => r.fonte = escavador.nome);
                return esc;
            }
        } catch (err) {
            console.error('[apiRouter] ❌ Erro Escavador OAB:', err.message);
        }
        // DataJud como último fallback
        try {
            console.log('[apiRouter] ⚡ Consultando DataJud (OAB fallback)...');
            const dj = await datajud.consultar(q);
            if (Array.isArray(dj) && dj.length > 0) {
                dj.forEach(r => r.fonte = datajud.nome);
                return dj;
            }
        } catch (err) {
            console.error('[apiRouter] ❌ Erro DataJud OAB:', err.message);
        }
        return [];
    }

    // ── BUSCA POR CPF / CNPJ / NOME ──────────────────────
    // Escavador primeiro → se falhar, DataJud como fallback
    try {
        console.log('[apiRouter] ⚡ Consultando Escavador...');
        const esc = await escavador.consultar(q);

        console.log('[apiRouter] 📦 Escavador:', JSON.stringify(esc).substring(0, 1000));

        // Array com resultados
        if (Array.isArray(esc) && esc.length > 0) {
            esc.forEach(r => r.fonte = escavador.nome);
            return esc;
        }

        // Objeto único
        if (esc && typeof esc === 'object' && !Array.isArray(esc) && esc.numero) {
            esc.fonte = escavador.nome;
            return [esc];
        }

        console.log('[apiRouter] ⚠️ Nenhum resultado do Escavador');
    } catch (err) {
        console.error('[apiRouter] ❌ Erro Escavador:', err.response?.data || err.message);
    }

    // ── FALLBACK: DataJud para CPF / CNPJ ──────────────
    if (q.tipo === 'cpf' || q.tipo === 'cnpj') {
        try {
            console.log(`[apiRouter] ⚡ Fallback DataJud para ${q.tipo}...`);
            const dj = await datajud.consultar(q);
            if (Array.isArray(dj) && dj.length > 0) {
                dj.forEach(r => r.fonte = datajud.nome);
                return dj;
            }
        } catch (err) {
            console.error('[apiRouter] ❌ Erro DataJud fallback:', err.message);
        }
    }

    // ── FALLBACK: Vigilant (TrackJud) para CPF ───────────
    // Busca em todos os tribunais brasileiros via scraping (custa créditos)
    if (q.tipo === 'cpf') {
        try {
            console.log('[apiRouter] ⚡ Fallback Vigilant (CPF)...');
            const vig = await vigilant.consultar(q);
            if (Array.isArray(vig) && vig.length > 0) {
                vig.forEach(r => r.fonte = vigilant.nome);
                return vig;
            }
        } catch (err) {
            console.error('[apiRouter] ❌ Erro Vigilant:', err.message);
        }
    }

    // APIs extra do utilizador (modo pago/híbrido)
    if (modo === 'pago' || modo === 'hibrido') {
        console.log('[apiRouter] ⚡ Tentando APIs extra...');
        const extra = await buscarPagas(q);
        if (extra && extra.length > 0) return extra;
    }

    return [];
}

async function buscarPagas(query) {
    for (const servico of servicosPagos) {
        try {
            const resultado = await servico.consultar(query);
            if (resultado && resultado.length > 0) {
                resultado.forEach(r => r.fonte = servico.nome);
                return resultado;
            }
        } catch (err) {
            console.error(`[apiRouter] Erro no serviço ${servico.nome}:`, err.message);
        }
    }
    return null;
}

module.exports = { consultarProcesso };
