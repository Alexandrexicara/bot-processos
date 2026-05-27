// Parser de mensagens do Telegram — detecta tipo de consulta e extrai parâmetros

/**
 * Tipos de consulta suportados:
 * - processo: número CNJ (ex: 0000000-00.0000.0.00.0000)
 * - oab:      OAB formatada (ex: MS 3616, /oab MS 3616, MS3616)
 * - nome:     texto livre (ex: nome de parte ou advogado)
 */

function parseMensagem(texto) {
    if (!texto) return { tipo: 'desconhecido', original: texto };

    const raw = texto.trim();

    // 1. Comando /oab
    const oabCmd = raw.match(/^\/oab\s+(.+)/i);
    if (oabCmd) {
        const parsed = parseOAB(oabCmd[1]);
        if (parsed) return { tipo: 'oab', uf: parsed.uf, numero: parsed.numero, original: raw };
    }

    // 2. Comando /processo ou /p
    const procCmd = raw.match(/^\/p(?:rocesso)?\s+(.+)/i);
    if (procCmd) {
        const limpo = limparNumeroProcesso(procCmd[1]);
        if (limpo) return { tipo: 'processo', numero: limpo, original: raw };
    }

    // 3. Detecta OAB no formato "UF NUMERO" (ex: MS 3616, SP 123456)
    const oabPadrao = raw.match(/^([A-Za-z]{2})\s*(\d{1,10})$/);
    if (oabPadrao) {
        return { tipo: 'oab', uf: oabPadrao[1].toUpperCase(), numero: oabPadrao[2], original: raw };
    }

    // 4. Detecta OAB no formato "UFNUMERO" (ex: MS3616, sp123456)
    const oabJunto = raw.match(/^([A-Za-z]{2})(\d{1,10})$/);
    if (oabJunto) {
        return { tipo: 'oab', uf: oabJunto[1].toUpperCase(), numero: oabJunto[2], original: raw };
    }

    // 5. Detecta número de processo CNJ (formato: NNNNNNN-DD.AAAA.J.TR.OOOO)
    const procNum = raw.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    if (procNum) {
        return { tipo: 'processo', numero: procNum[1], original: raw };
    }

    // 6. Número só com dígitos
    const soDigitos = raw.replace(/\D/g, '');
    if (soDigitos.length === 20) {
        // Processo CNJ sem máscara
        const mascarado = soDigitos.replace(
            /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/,
            '$1-$2.$3.$4.$5.$6'
        );
        return { tipo: 'processo', numero: mascarado, original: raw };
    }
    if (soDigitos.length === 11) {
        return { tipo: 'cpf', numero: soDigitos, original: raw };
    }
    if (soDigitos.length === 14) {
        return { tipo: 'cnpj', numero: soDigitos, original: raw };
    }

    // 7. Fallback: texto livre (busca por nome)
    if (raw.length >= 3) {
        return { tipo: 'nome', texto: raw, original: raw };
    }

    return { tipo: 'desconhecido', original: raw };
}

// Extrai UF e número de uma string OAB
function parseOAB(texto) {
    const t = texto.trim();
    // UF seguido de número com ou sem espaço
    const m1 = t.match(/^([A-Za-z]{2})\s*(\d{1,10})$/);
    if (m1) return { uf: m1[1].toUpperCase(), numero: m1[2] };

    // Número seguido de UF
    const m2 = t.match(/^(\d{1,10})\s*([A-Za-z]{2})$/);
    if (m2) return { uf: m2[2].toUpperCase(), numero: m2[1] };

    return null;
}

// Limpa e formata número de processo
function limparNumeroProcesso(texto) {
    const digitos = texto.replace(/\D/g, '');
    if (digitos.length === 20) {
        return digitos.replace(
            /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/,
            '$1-$2.$3.$4.$5.$6'
        );
    }
    // Tenta extrair formato com máscara
    const match = texto.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    if (match) return match[1];
    return null;
}

module.exports = { parseMensagem };
