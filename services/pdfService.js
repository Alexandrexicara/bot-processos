const PDFDocument = require('pdfkit');

/**
 * Gera um PDF com os dados de um ou mais processos
 * @param {Array|Object} processos - Dados do(s) processo(s)
 * @returns {Buffer} Buffer do PDF
 */
async function gerarPDFProcesso(processos) {
    const lista = Array.isArray(processos) ? processos : [processos];
    
    const doc = new PDFDocument({ 
        margin: 50, 
        size: 'A4',
        info: {
            Title: 'Relatório de Processos',
            Author: 'Processo Bot CNJ',
            CreationDate: new Date()
        }
    });

    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));

    // Cabeçalho
    doc.fontSize(20).font('Helvetica-Bold')
       .text('Relatório de Processos', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica')
       .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ccc');
    doc.moveDown(1);

    for (let i = 0; i < lista.length; i++) {
        const p = lista[i];
        
        // Verifica se precisa de nova página
        if (doc.y > 700 && i > 0) {
            doc.addPage();
        }

        // Número do processo
        doc.fontSize(14).font('Helvetica-Bold')
           .fillColor('#1a1a2e')
           .text(`Processo ${i + 1}: ${p.numero || 'N/A'}`);
        doc.moveDown(0.3);

        // Linha divisória
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#333');
        doc.moveDown(0.5);

        // Dados do processo
        doc.fontSize(11).font('Helvetica').fillColor('#333');
        
        const campos = [
            ['Tribunal', p.tribunal],
            ['Classe', p.classe],
            ['Grau', p.grau],
            ['Órgão Julgador', p.orgaoJulgador],
            ['Área', p.area],
            ['Valor da Causa', p.valor_causa],
            ['Polo Ativo', p.polo_ativo],
            ['Polo Passivo', p.polo_passivo],
            ['Sistema', p.sistema],
            ['Data', p.data],
            ['Última Atualização', p.ultimo_status || p.data],
            ['Fonte', p.fonte]
        ];

        for (const [label, valor] of campos) {
            if (valor && valor !== '' && valor !== 'N/A') {
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#555')
                   .text(`${label}: `, { continued: true });
                doc.font('Helvetica').fillColor('#333')
                   .text(String(valor));
                doc.moveDown(0.2);
            }
        }

        // Movimentações (se houver)
        if (p.movimentacoes && p.movimentacoes.length > 0) {
            doc.moveDown(0.5);
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a2e')
               .text('Últimas Movimentações:');
            doc.moveDown(0.3);
            
            const movs = p.movimentacoes.slice(0, 10);
            for (const mov of movs) {
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#666')
                   .text(`${mov.data || ''}`, { continued: true });
                doc.font('Helvetica').fillColor('#333')
                   .text(` - ${mov.descricao || mov.texto || ''}`);
                doc.moveDown(0.2);
            }
        }

        doc.moveDown(1);
        if (i < lista.length - 1) {
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ccc');
            doc.moveDown(1);
        }
    }

    // Rodapé
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).font('Helvetica').fillColor('#999')
           .text(`Processo Bot CNJ - Página ${i + 1} de ${pageCount}`, 50, 780, { align: 'center', width: 495 });
    }

    doc.end();

    return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
    });
}

module.exports = { gerarPDFProcesso };
