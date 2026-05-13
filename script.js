// Sistema de Gerenciamento de PDFs
class PDFManager {
    constructor() {
        this.pdfs = this.loadPDFs();
        this.currentFilter = {
            search: '',
            type: '',
            year: '',
            course: ''
        };
    }

    loadPDFs() {
        const pdfs = localStorage.getItem('ifsp_pdfs');
        return pdfs ? JSON.parse(pdfs) : [];
    }

    savePDFs() {
        localStorage.setItem('ifsp_pdfs', JSON.stringify(this.pdfs));
    }

    addPDF(pdfData) {
        const pdf = {
            id: Date.now(),
            ...pdfData,
            uploadedBy: auth.getCurrentUser().prontuario,
            uploaderName: auth.getCurrentUser().nome,
            uploadedAt: new Date().toISOString(),
            downloads: 0
        };
        
        this.pdfs.unshift(pdf);
        this.savePDFs();
        return pdf;
    }

    deletePDF(id) {
        const index = this.pdfs.findIndex(p => p.id === id);
        if (index !== -1) {
            const pdf = this.pdfs[index];
            
            // Verificar permissão
            if (!auth.canDelete(pdf.uploadedBy)) {
                return { success: false, message: 'Sem permissão para excluir este documento' };
            }
            
            this.pdfs.splice(index, 1);
            this.savePDFs();
            return { success: true };
        }
        return { success: false, message: 'Documento não encontrado' };
    }

    searchPDFs(filters) {
        return this.pdfs.filter(pdf => {
            const searchLower = filters.search.toLowerCase();
            const matchSearch = !filters.search || 
                pdf.titulo.toLowerCase().includes(searchLower) ||
                pdf.autores.toLowerCase().includes(searchLower) ||
                pdf.palavrasChave.toLowerCase().includes(searchLower) ||
                pdf.orientador.toLowerCase().includes(searchLower);
            
            const matchType = !filters.type || pdf.tipoDocumento === filters.type;
            const matchYear = !filters.year || pdf.ano === filters.year;
            const matchCourse = !filters.course || pdf.curso === filters.course;
            
            return matchSearch && matchType && matchYear && matchCourse;
        });
    }

    getDocumentById(id) {
        return this.pdfs.find(p => p.id === id);
    }

    incrementDownloads(id) {
        const pdf = this.pdfs.find(p => p.id === id);
        if (pdf) {
            pdf.downloads = (pdf.downloads || 0) + 1;
            this.savePDFs();
        }
    }

    getYears() {
        const years = [...new Set(this.pdfs.map(p => p.ano))];
        return years.sort((a, b) => b - a);
    }

    getStatistics() {
        return {
            total: this.pdfs.length,
            byType: this.groupByType(),
            byYear: this.groupByYear(),
            byCourse: this.groupByCourse()
        };
    }

    groupByType() {
        return this.pdfs.reduce((acc, pdf) => {
            acc[pdf.tipoDocumento] = (acc[pdf.tipoDocumento] || 0) + 1;
            return acc;
        }, {});
    }

    groupByYear() {
        return this.pdfs.reduce((acc, pdf) => {
            acc[pdf.ano] = (acc[pdf.ano] || 0) + 1;
            return acc;
        }, {});
    }

    groupByCourse() {
        return this.pdfs.reduce((acc, pdf) => {
            acc[pdf.curso] = (acc[pdf.curso] || 0) + 1;
            return acc;
        }, {});
    }
}

// Instância global
const pdfManager = new PDFManager();

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação
    if (!checkAuth()) return;
    
    // Atualizar informações do usuário
    updateUserInfo();
    
    // Inicializar componentes
    initializeUpload();
    initializeSearch();
    updateYearFilter();
    renderPDFs();
    updateStatistics();
    
    // Verificar parâmetros de URL (para abertura direta de documento)
    checkURLParams();
});

// Atualizar informações do usuário
function updateUserInfo() {
    document.getElementById('userName').textContent = auth.getUserFullName();
    document.getElementById('userProntuario').textContent = auth.getUserProntuario();
}

// Inicializar upload
function initializeUpload() {
    const uploadForm = document.getElementById('uploadForm');
    const pdfFileInput = document.getElementById('pdfFile');
    const fileNameDisplay = document.getElementById('fileName');
    
    pdfFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            fileNameDisplay.style.color = '#006437';
        }
    });
    
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleUpload();
    });
}

// Manipular upload
async function handleUpload() {
    const file = document.getElementById('pdfFile').files[0];
    if (!file) {
        showNotification('Selecione um arquivo PDF', 'error');
        return;
    }
    
    if (file.type !== 'application/pdf') {
        showNotification('Apenas arquivos PDF são permitidos', 'error');
        return;
    }
    
    const submitBtn = document.querySelector('.upload-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const pdfData = {
            tipoDocumento: document.getElementById('tipoDocumento').value,
            curso: document.getElementById('curso').value,
            titulo: document.getElementById('titulo').value,
            autores: document.getElementById('autores').value,
            orientador: document.getElementById('orientador').value,
            ano: document.getElementById('ano').value,
            palavrasChave: document.getElementById('palavrasChave').value,
            fileName: file.name,
            fileSize: file.size,
            fileData: e.target.result
        };
        
        pdfManager.addPDF(pdfData);
        
        // Limpar formulário
        uploadForm.reset();
        document.getElementById('fileName').textContent = 'Nenhum arquivo selecionado';
        
        // Atualizar interface
        updateYearFilter();
        renderPDFs();
        updateStatistics();
        
        showNotification('Documento submetido com sucesso!', 'success');
    };
    
    reader.readAsDataURL(file);
    
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-upload"></i> Submeter Documento';
}

// Inicializar busca
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    const filterType = document.getElementById('filterType');
    const filterYear = document.getElementById('filterYear');
    const filterCourse = document.getElementById('filterCourse');
    
    const applyFilters = () => {
        pdfManager.currentFilter = {
            search: searchInput.value,
            type: filterType.value,
            year: filterYear.value,
            course: filterCourse.value
        };
        renderPDFs();
    };
    
    searchInput.addEventListener('input', debounce(applyFilters, 300));
    filterType.addEventListener('change', applyFilters);
    filterYear.addEventListener('change', applyFilters);
    filterCourse.addEventListener('change', applyFilters);
}

// Debounce para busca
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Atualizar filtro de anos
function updateYearFilter() {
    const filterYear = document.getElementById('filterYear');
    const years = pdfManager.getYears();
    
    filterYear.innerHTML = '<option value="">Todos os anos</option>' +
        years.map(year => `<option value="${year}">${year}</option>`).join('');
}

// Atualizar estatísticas
function updateStatistics() {
    const stats = pdfManager.getStatistics();
    document.getElementById('totalDocs').textContent = stats.total;
}

// Renderizar PDFs
function renderPDFs(pdfsToRender = null) {
    const pdfs = pdfsToRender || pdfManager.searchPDFs(pdfManager.currentFilter);
    const pdfsList = document.getElementById('pdfsList');
    
    if (pdfs.length === 0) {
        pdfsList.innerHTML = `
            <div class="loading">
                <i class="fas fa-inbox"></i>
                <p>Nenhum documento encontrado</p>
            </div>`;
        return;
    }
    
    const viewMode = document.querySelector('.view-btn.active')?.dataset?.view || 'grid';
    
    pdfsList.innerHTML = pdfs.map(pdf => `
        <div class="pdf-card ${viewMode === 'list' ? 'list-view' : ''}" 
             onclick="showDocumentDetails(${pdf.id})">
            <div class="document-type-badge type-${pdf.tipoDocumento}">
                <i class="fas ${getTypeIcon(pdf.tipoDocumento)}"></i>
                ${getTypeName(pdf.tipoDocumento)}
            </div>
            <div class="pdf-icon">
                <i class="fas fa-file-pdf"></i>
            </div>
            <div class="pdf-info">
                <h3 title="${pdf.titulo}">${pdf.titulo}</h3>
                <p class="authors">
                    <i class="fas fa-users"></i> ${pdf.autores}
                </p>
                ${pdf.orientador ? `
                    <p class="advisor">
                        <i class="fas fa-chalkboard-teacher"></i> ${pdf.orientador}
                    </p>
                ` : ''}
                <div class="pdf-meta">
                    <span><i class="fas fa-calendar"></i> ${pdf.ano}</span>
                    <span><i class="fas fa-download"></i> ${pdf.downloads || 0}</span>
                </div>
            </div>
            <div class="pdf-actions" onclick="event.stopPropagation()">
                <button class="download-btn" onclick="downloadDocument(${pdf.id})">
                    <i class="fas fa-download"></i> Baixar
                </button>
                ${auth.canDelete(pdf.uploadedBy) ? `
                    <button class="delete-btn" onclick="deleteDocument(${pdf.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Funções auxiliares
function getTypeIcon(type) {
    const icons = {
        'tcc': 'fa-graduation-cap',
        'dissertacao': 'fa-book',
        'tese': 'fa-microscope',
        'artigo': 'fa-file-alt',
        'relatorio': 'fa-clipboard',
        'projeto': 'fa-project-diagram',
        'monografia': 'fa-scroll',
        'resumo': 'fa-file-contract'
    };
    return icons[type] || 'fa-file';
}

function getTypeName(type) {
    const names = {
        'tcc': 'TCC',
        'dissertacao': 'Dissertação',
        'tese': 'Tese',
        'artigo': 'Artigo',
        'relatorio': 'Relatório',
        'projeto': 'Projeto',
        'monografia': 'Monografia',
        'resumo': 'Resumo'
    };
    return names[type] || 'Documento';
}

// Download de documento
function downloadDocument(id) {
    const pdf = pdfManager.getDocumentById(id);
    if (!pdf) return;
    
    pdfManager.incrementDownloads(id);
    
    const link = document.createElement('a');
    link.href = pdf.fileData;
    link.download = pdf.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    renderPDFs();
    showNotification(`Baixando: ${pdf.titulo}`, 'success');
}

// Deletar documento
function deleteDocument(id) {
    const pdf = pdfManager.getDocumentById(id);
    if (!pdf) return;
    
    if (confirm(`Tem certeza que deseja excluir "${pdf.titulo}"?`)) {
        const result = pdfManager.deletePDF(id);
        
        if (result.success) {
            updateYearFilter();
            renderPDFs();
            updateStatistics();
            showNotification('Documento excluído com sucesso!', 'success');
        } else {
            showNotification(result.message, 'error');
        }
    }
}

// Mostrar detalhes do documento
function showDocumentDetails(id) {
    const pdf = pdfManager.getDocumentById(id);
    if (!pdf) return;
    
    const modal = document.getElementById('documentModal');
    
    document.getElementById('modalType').textContent = getTypeName(pdf.tipoDocumento);
    document.getElementById('modalType').className = `document-type-badge type-${pdf.tipoDocumento}`;
    document.getElementById('modalTitle').textContent = pdf.titulo;
    document.getElementById('modalAuthors').textContent = pdf.autores;
    document.getElementById('modalAdvisor').textContent = pdf.orientador || 'Não informado';
    document.getElementById('modalYear').textContent = pdf.ano;
    document.getElementById('modalCourse').textContent = pdf.curso || 'Não informado';
    document.getElementById('modalKeywords').textContent = pdf.palavrasChave || 'Não informadas';
    document.getElementById('modalUploader').textContent = pdf.uploaderName || 'Desconhecido';
    document.getElementById('modalDate').textContent = new Date(pdf.uploadedAt).toLocaleDateString('pt-BR');
    
    document.getElementById('modalDownload').onclick = () => downloadDocument(id);
    
    const deleteBtn = document.getElementById('modalDelete');
    if (auth.canDelete(pdf.uploadedBy)) {
        deleteBtn.style.display = 'inline-flex';
        deleteBtn.onclick = () => {
            closeModal();
            deleteDocument(id);
        };
    } else {
        deleteBtn.style.display = 'none';
    }
    
    modal.style.display = 'block';
}

// Fechar modal
function closeModal() {
    document.getElementById('documentModal').style.display = 'none';
}

// Mudar visualização
function changeView(mode) {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.dataset.view = '';
    });
    
    const activeBtn = document.querySelector(`.view-btn .fa-${mode === 'grid' ? 'th-large' : 'list'}`);
    if (activeBtn) {
        activeBtn.parentElement.classList.add('active');
        activeBtn.parentElement.dataset.view = mode;
    }
    
    renderPDFs();
}

// Verificar parâmetros de URL
function checkURLParams() {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc');
    if (docId) {
        showDocumentDetails(parseInt(docId));
    }
}

// Notificações
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        notification.className = 'notification';
    }, 3000);
}

// Fechar modal ao clicar fora
window.onclick = (event) => {
    const modal = document.getElementById('documentModal');
    if (event.target === modal) {
        closeModal();
    }
};