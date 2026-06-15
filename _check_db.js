require('dotenv').config();
const pool = require('./db');

async function main() {
    // Listar tabelas
    const t = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Tabelas:', t.rows.map(r => r.table_name).join(', '));

    // Listar usuarios
    try {
        const u = await pool.query("SELECT id, email, tipo, ativo FROM usuarios");
        console.log('Usuarios:', JSON.stringify(u.rows, null, 2));
    } catch (e) {
        console.log('Sem tabela usuarios ainda');
    }

    process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
