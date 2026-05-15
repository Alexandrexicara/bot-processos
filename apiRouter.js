const { consultarDataJud } = require('./services/datajud');
const { consultarPremium } = require('./services/premium');

async function consultarProcesso(numero, user) {

    // 1. tenta grátis
    const gratis = await consultarDataJud(numero);
    if (gratis) return gratis;

    // 2. fallback pago
    if (user.api_key && user.modo !== 'gratis') {
        return await consultarPremium(numero, user.api_key);
    }

    return null;
}

module.exports = { consultarProcesso };
