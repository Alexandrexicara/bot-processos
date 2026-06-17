const PDFDocument = require('pdfkit');

/**
 * Gera um PDF completo com todos os dados de um ou mais processos
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
       .fillColor('#1a1a2e')
       .text('Relatório de Processos', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#666')
       .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    if (lista.length > 1) {
        doc.text(`Total: ${lista.length} processos`, { align: 'center' });
    }
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ccc');
    doc.moveDown(1);

    for (let i = 0; i < lista.length; i++) {
        const p = lista[i];
        
        // Verifica se precisa de nova página
        if (doc.y > 680 && i > 0) {
            doc.addPage();
        }

        // Número do processo (título)
        doc.fontSize(13).font('Helvetica-Bold')
           .fillColor('#1a1a2e')
           .text(`${i + 1}. ${p.numero || 'N/A'}`);
        doc.moveDown(0.2);

        // Linha divisória
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#444');
        doc.moveDown(0.4);

        // ── DADOS BÁSICOS ──
        escreverSecao(doc, 'Dados do Processo');
        escreverCampo(doc, 'Tribunal', p.tribunal || p.tribunal_descricao);
        escreverCampo(doc, 'Classe', p.classe);
        escreverCampo(doc, 'Assunto', p.assunto);
        escreverCampo(doc, 'Área', p.area);
        escreverCampo(doc, 'Grau', p.grau);
        escreverCampo(doc, 'Situação', p.situacao);
        escreverCampo(doc, 'Órgão Julgador', p.orgaoJulgador);
        escreverCampo(doc, 'Relator', p.relator);
        escreverCampo(doc, 'Valor da Causa', p.valor_causa);
        escreverCampo(doc, 'Sistema', p.sistema);
        escreverCampo(doc, 'Segredo de Justiça', p.segredo_justica ? 'Sim' : '');
        escreverCampo(doc, 'Estado', p.estado);
        escreverCampo(doc, 'Unidade', p.unidade);
        escreverCampo(doc, 'Data de Início', p.data);
        escreverCampo(doc, 'Última Movimentação', p.data_ultima_movimentacao || p.ultimo_status);
        escreverCampo(doc, 'Total Movimentações', p.quantidade_movimentacoes);
        escreverCampo(doc, 'Fase', p.fase);
        escreverCampo(doc, 'Origem', p.origem);
        escreverCampo(doc, 'Fonte', p.fonte);

        // ── POLOS ──
        if (p.polo_ativo || p.polo_passivo) {
            escreverSecao(doc, 'Polos');
            escreverCampo(doc, 'Polo Ativo (Autor)', p.polo_ativo);
            escreverCampo(doc, 'Polo Passivo (Réu)', p.polo_passivo);
        }

        // ── PARTES DETALHADAS ──
        if (p.partes && p.partes.length > 0) {
            doc.moveDown(0.3);
            escreverSecao(doc, 'Partes e Advogados');
            for (const parte of p.partes) {
                const tipoLabel = parte.tipo || parte.polo || 'Parte';
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#444')
                   .text(`  ${tipoLabel}: `, { continued: true });
                doc.font('Helvetica').fillColor('#222')
                   .text(parte.nome || 'N/A');
                
                if (parte.cpf) {
                    doc.fontSize(9).font('Helvetica').fillColor('#666')
                       .text(`    CPF: ${parte.cpf}`);
                }
                if (parte.cnpj) {
                    doc.fontSize(9).font('Helvetica').fillColor('#666')
                       .text(`    CNPJ: ${parte.cnpj}`);
                }
                
                if (parte.advogados && parte.advogados.length > 0) {
                    doc.fontSize(9).font('Helvetica').fillColor('#0066cc')
                       .text(`    Advogado(s): ${parte.advogados.join(', ')}`);
                }
                doc.moveDown(0.15);
            }
        }

        // ── INFORMAÇÕES COMPLEMENTARES ──
        if (p.info_complementares && Object.keys(p.info_complementares).length > 0) {
            doc.moveDown(0.3);
            escreverSecao(doc, 'Informações Complementares');
            for (const [chave, valor] of Object.entries(p.info_complementares)) {
                const label = chave.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                escreverCampo(doc, label, valor);
            }
        }

        // ── MOVIMENTAÇÕES ──
        if (p.movimentacoes && p.movimentacoes.length > 0) {
            doc.moveDown(0.3);
            escreverSecao(doc, 'Últimas Movimentações');
            
            const movs = p.movimentacoes.slice(0, 15);
            for (const mov of movs) {
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#666')
                   .text(`  ${mov.data || ''}`, { continued: true });
                doc.font('Helvetica').fillColor('#333')
                   .text(` — ${mov.descricao || mov.texto || ''}`);
                doc.moveDown(0.15);
            }
        }

        doc.moveDown(1);
        if (i < lista.length - 1) {
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ddd');
            doc.moveDown(1);
        }
    }

    // Rodapé em todas as páginas
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).font('Helvetica').fillColor('#aaa')
           .text(`Processo Bot CNJ — ${new Date().toLocaleDateString('pt-BR')} — Página ${i + 1} de ${pageCount}`, 
                 50, 790, { align: 'center', width: 495 });
    }

    doc.end();

    return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
    });
}

function escreverSecao(doc, titulo) {
    if (doc.y > 750) doc.addPage();
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#FF5E00')
       .text(titulo);
    doc.moveDown(0.2);
}

function escreverCampo(doc, label, valor) {
    if (!valor || valor === '' || valor === 'N/A' || valor === undefined || valor === null) return;
    if (doc.y > 770) doc.addPage();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#555')
       .text(`  ${label}: `, { continued: true });
    doc.font('Helvetica').fillColor('#222')
       .text(String(valor));
    doc.moveDown(0.15);
}

module.exports = { gerarPDFProcesso };
