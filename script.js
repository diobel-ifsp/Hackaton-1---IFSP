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
        this.currentSort = 'date';
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
                (pdf.palavrasChave && pdf.palavrasChave.toLowerCase().includes(searchLower)) ||
                (pdf.orientador && pdf.orientador.toLowerCase().includes(searchLower));
            
            const matchType = !filters.type || pdf.tipoDocumento === filters.type;
            const matchYear = !filters.year || pdf.ano == filters.year;
            const matchCourse = !filters.course || pdf.curso === filters.course;
            
            return matchSearch && matchType && matchYear && matchCourse;
        });
    }

    sortDocuments(docs) {
        const sorted = [...docs];
        switch(this.currentSort) {
            case 'title':
                sorted.sort((a, b) => a.titulo.localeCompare(b.titulo));
                break;
            case 'downloads':
                sorted.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
                break;
            case 'year':
                sorted.sort((a, b) => b.ano - a.ano);
                break;
            case 'date':
            default:
                sorted.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
                break;
        }
        return sorted;
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
let currentDocumentId = null;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    
    updateUserInfo();
    initializeUpload();
    initializeSearch();
    initializeSorting();
    initializeDragAndDrop();
    updateYearFilter();
    renderPDFs();
    updateStatistics();
    checkURLParams();
    
    // Botão de limpar filtros
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('searchInput');
            const filterType = document.getElementById('filterType');
            const filterYear = document.getElementById('filterYear');
            const filterCourse = document.getElementById('filterCourse');
            
            if (searchInput) searchInput.value = '';
            if (filterType) filterType.value = '';
            if (filterYear) filterYear.value = '';
            if (filterCourse) filterCourse.value = '';
            
            pdfManager.currentFilter = {
                search: '',
                type: '',
                year: '',
                course: ''
            };
            renderPDFs();
            showNotification('Filtros limpos!', 'success');
        });
    }
    
    // Botão de exportar CSV
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
});

// Atualizar informações do usuário
function updateUserInfo() {
    const userName = document.getElementById('userName');
    const userProntuario = document.getElementById('userProntuario');
    if (userName) userName.textContent = auth.getUserFullName();
    if (userProntuario) userProntuario.textContent = auth.getUserProntuario();
}

// Inicializar upload
function initializeUpload() {
    const uploadForm = document.getElementById('uploadForm');
    const pdfFileInput = document.getElementById('pdfFile');
    const fileNameDisplay = document.getElementById('fileName');
    
    if (pdfFileInput) {
        pdfFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileNameDisplay.textContent = file.name;
                fileNameDisplay.style.color = '#006437';
            }
        });
    }
    
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleUpload();
        });
    }
}

// Manipular upload
async function handleUpload() {
    const fileInput = document.getElementById('pdfFile');
    const file = fileInput ? fileInput.files[0] : null;
    
    if (!file) {
        showNotification('Selecione um arquivo PDF', 'error');
        return;
    }
    
    if (file.type !== 'application/pdf') {
        showNotification('Apenas arquivos PDF são permitidos', 'error');
        return;
    }
    
    const submitBtn = document.querySelector('.upload-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        const btnText = submitBtn.querySelector('.btn-text');
        const loader = submitBtn.querySelector('.loader');
        if (btnText) btnText.style.display = 'none';
        if (loader) loader.style.display = 'inline-block';
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const pdfData = {
            tipoDocumento: document.getElementById('tipoDocumento').value,
            curso: document.getElementById('curso').value,
            titulo: document.getElementById('titulo').value,
            autores: document.getElementById('autores').value,
            orientador: document.getElementById('orientador').value,
            ano: parseInt(document.getElementById('ano').value),
            palavrasChave: document.getElementById('palavrasChave').value,
            fileName: file.name,
            fileSize: file.size,
            fileData: e.target.result
        };
        
        pdfManager.addPDF(pdfData);
        
        const uploadForm = document.getElementById('uploadForm');
        if (uploadForm) uploadForm.reset();
        const fileNameDisplay = document.getElementById('fileName');
        if (fileNameDisplay) fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
        
        updateYearFilter();
        renderPDFs();
        updateStatistics();
        
        showNotification('Documento submetido com sucesso!', 'success');
    };
    
    reader.readAsDataURL(file);
    
    if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector('.btn-text');
        const loader = submitBtn.querySelector('.loader');
        if (btnText) btnText.style.display = 'inline-block';
        if (loader) loader.style.display = 'none';
    }
}

// Inicializar busca
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    const filterType = document.getElementById('filterType');
    const filterYear = document.getElementById('filterYear');
    const filterCourse = document.getElementById('filterCourse');
    
    const applyFilters = () => {
        pdfManager.currentFilter = {
            search: searchInput ? searchInput.value : '',
            type: filterType ? filterType.value : '',
            year: filterYear ? filterYear.value : '',
            course: filterCourse ? filterCourse.value : ''
        };
        renderPDFs();
    };
    
    if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 300));
    if (filterType) filterType.addEventListener('change', applyFilters);
    if (filterYear) filterYear.addEventListener('change', applyFilters);
    if (filterCourse) filterCourse.addEventListener('change', applyFilters);
}

// Inicializar ordenação
function initializeSorting() {
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            pdfManager.currentSort = e.target.value;
            renderPDFs();
        });
    }
}

// Inicializar Drag & Drop
function initializeDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('pdfFile');
    const fileNameDisplay = document.getElementById('fileName');
    
    if (!dropZone) return;
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            if (fileInput) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                fileNameDisplay.textContent = file.name;
                fileNameDisplay.style.color = '#006437';
                showNotification('PDF adicionado!', 'success');
            }
        } else {
            showNotification('Arraste apenas arquivos PDF!', 'error');
        }
    });
}

// Debounce
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
    if (!filterYear) return;
    
    const years = pdfManager.getYears();
    const currentValue = filterYear.value;
    
    filterYear.innerHTML = '<option value="">Todos os anos</option>' +
        years.map(year => `<option value="${year}">${year}</option>`).join('');
    
    if (currentValue && years.includes(parseInt(currentValue))) {
        filterYear.value = currentValue;
    }
}

// Atualizar estatísticas
function updateStatistics() {
    const totalDocs = document.getElementById('totalDocs');
    if (totalDocs) {
        const stats = pdfManager.getStatistics();
        totalDocs.textContent = stats.total;
    }
}

// Exportar para CSV
function exportToCSV() {
    const filtered = pdfManager.searchPDFs(pdfManager.currentFilter);
    const sorted = pdfManager.sortDocuments(filtered);
    
    let csv = "ID,Título,Autores,Orientador,Ano,Curso,Tipo,Palavras-chave,Downloads,Data Envio\n";
    
    sorted.forEach(pdf => {
        const row = [
            pdf.id,
            `"${pdf.titulo.replace(/"/g, '""')}"`,
            `"${pdf.autores.replace(/"/g, '""')}"`,
            `"${(pdf.orientador || '').replace(/"/g, '""')}"`,
            pdf.ano,
            `"${pdf.curso || ''}"`,
            `"${pdf.tipoDocumento || ''}"`,
            `"${(pdf.palavrasChave || '').replace(/"/g, '""')}"`,
            pdf.downloads || 0,
            new Date(pdf.uploadedAt).toLocaleDateString('pt-BR')
        ];
        csv += row.join(',') + "\n";
    });
    
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `ifsp_pdfs_${new Date().toISOString().slice(0,19)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification(`Exportados ${sorted.length} documentos!`, 'success');
}

// Renderizar PDFs
function renderPDFs(pdfsToRender = null) {
    let pdfs = pdfsToRender || pdfManager.searchPDFs(pdfManager.currentFilter);
    pdfs = pdfManager.sortDocuments(pdfs);
    
    const pdfsList = document.getElementById('pdfsList');
    if (!pdfsList) return;
    
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) resultsCount.textContent = pdfs.length;
    
    if (pdfs.length === 0) {
        pdfsList.innerHTML = `
            <div class="loading">
                <i class="fas fa-inbox"></i>
                <p>Nenhum documento encontrado</p>
            </div>`;
        return;
    }
    
    pdfsList.innerHTML = pdfs.map(pdf => `
        <div class="pdf-card" onclick="showDocumentDetails(${pdf.id})">
            <div class="document-type-badge type-${pdf.tipoDocumento}">
                <i class="fas ${getTypeIcon(pdf.tipoDocumento)}"></i>
                ${getTypeName(pdf.tipoDocumento)}
            </div>
            <div class="pdf-icon">
                <i class="fas fa-file-pdf"></i>
            </div>
            <div class="pdf-info">
                <h3 title="${pdf.titulo.replace(/"/g, '&quot;')}">${pdf.titulo}</h3>
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

function showDocumentDetails(id) {
    const pdf = pdfManager.getDocumentById(id);
    if (!pdf) return;
    
    currentDocumentId = id;
    const modal = document.getElementById('documentModal');
    if (!modal) return;
    
    const modalType = document.getElementById('modalType');
    const modalTitle = document.getElementById('modalTitle');
    const modalAuthors = document.getElementById('modalAuthors');
    const modalAdvisor = document.getElementById('modalAdvisor');
    const modalYear = document.getElementById('modalYear');
    const modalCourse = document.getElementById('modalCourse');
    const modalKeywords = document.getElementById('modalKeywords');
    const modalUploader = document.getElementById('modalUploader');
    const modalDate = document.getElementById('modalDate');
    const modalDownload = document.getElementById('modalDownload');
    const modalDelete = document.getElementById('modalDelete');
    const modalShare = document.getElementById('modalShare');
    
    if (modalType) {
        modalType.textContent = getTypeName(pdf.tipoDocumento);
        modalType.className = `document-type-badge type-${pdf.tipoDocumento}`;
    }
    if (modalTitle) modalTitle.textContent = pdf.titulo;
    if (modalAuthors) modalAuthors.textContent = pdf.autores;
    if (modalAdvisor) modalAdvisor.textContent = pdf.orientador || 'Não informado';
    if (modalYear) modalYear.textContent = pdf.ano;
    if (modalCourse) modalCourse.textContent = pdf.curso || 'Não informado';
    if (modalKeywords) modalKeywords.textContent = pdf.palavrasChave || 'Não informadas';
    if (modalUploader) modalUploader.textContent = pdf.uploaderName || 'Desconhecido';
    if (modalDate) modalDate.textContent = new Date(pdf.uploadedAt).toLocaleDateString('pt-BR');
    
    if (modalDownload) modalDownload.onclick = () => downloadDocument(id);
    
    if (modalDelete) {
        if (auth.canDelete(pdf.uploadedBy)) {
            modalDelete.style.display = 'inline-flex';
            modalDelete.onclick = () => {
                closeModal();
                deleteDocument(id);
            };
        } else {
            modalDelete.style.display = 'none';
        }
    }
    
    if (modalShare) modalShare.style.display = 'inline-flex';
    
    modal.style.display = 'block';
}

function shareCurrentDocument() {
    if (!currentDocumentId) return;
    const url = `${window.location.origin}${window.location.pathname}?doc=${currentDocumentId}`;
    navigator.clipboard.writeText(url);
    showNotification('Link copiado! Compartilhe o documento.', 'success');
}

function closeModal() {
    const modal = document.getElementById('documentModal');
    if (modal) modal.style.display = 'none';
    currentDocumentId = null;
}

function changeView(mode) {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.dataset.view = '';
    });
    
    const activeBtn = document.querySelector(`.view-btn .fa-${mode === 'grid' ? 'th-large' : 'list'}`);
    if (activeBtn && activeBtn.parentElement) {
        activeBtn.parentElement.classList.add('active');
        activeBtn.parentElement.dataset.view = mode;
    }
    
    renderPDFs();
}

function checkURLParams() {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc');
    if (docId) {
        setTimeout(() => {
            showDocumentDetails(parseInt(docId));
        }, 500);
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        notification.className = 'notification';
    }, 3000);
}

window.onclick = (event) => {
    const modal = document.getElementById('documentModal');
    if (event.target === modal) {
        closeModal();
    }
};
