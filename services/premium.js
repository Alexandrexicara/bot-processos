async function consultarPremium(numero, apiKey) {
    // Aqui você integra Jusbrasil ou outra API real
    return {
        numero,
        tribunal: "Premium API",
        classe: "Completo",
        data: new Date().toISOString()
    };
}

module.exports = { consultarPremium };
