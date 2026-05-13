// API base URL - ajuste conforme necessário
const API_URL = 'http://localhost:3000/api';

// Elementos DOM
const uploadForm = document.getElementById('uploadForm');
const pdfFileInput = document.getElementById('pdfFile');
const fileNameDisplay = document.getElementById('fileName');
const uploadStatus = document.getElementById('uploadStatus');
const pdfsList = document.getElementById('pdfsList');
const searchInput = document.getElementById('searchInput');
const notification = document.getElementById('notification');

// Array para armazenar os PDFs
let pdfs = [];

// Mostrar notificação
function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        notification.className = 'notification';
    }, 3000);
}

// Mostrar nome do arquivo selecionado
pdfFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileNameDisplay.textContent = file.name;
        fileNameDisplay.style.color = '#006437';
        fileNameDisplay.style.fontWeight = '500';
    } else {
        fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
        fileNameDisplay.style.color = '#666';
        fileNameDisplay.style.fontWeight = 'normal';
    }
});

// Upload de PDF
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const file = pdfFileInput.files[0];
    if (!file) {
        showNotification('Por favor, selecione um arquivo PDF', 'error');
        return;
    }
    
    if (file.type !== 'application/pdf') {
        showNotification('Apenas arquivos PDF são permitidos', 'error');
        return;
    }
    
    // Desabilitar botão durante upload
    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    const formData = new FormData();
    formData.append('pdf', file);
    
    try {
        // Simular upload com armazenamento local
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const pdfData = {
                id: Date.now(),
                name: file.name,
                size: file.size,
                uploadedAt: new Date().toISOString(),
                data: e.target.result
            };
            
            // Salvar no localStorage
            const savedPdfs = JSON.parse(localStorage.getItem('ifsp_pdfs') || '[]');
            savedPdfs.push(pdfData);
            localStorage.setItem('ifsp_pdfs', JSON.stringify(savedPdfs));
            
            // Atualizar lista
            pdfs = savedPdfs;
            renderPdfs(pdfs);
            
            // Resetar formulário
            uploadForm.reset();
            fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
            fileNameDisplay.style.color = '#666';
            fileNameDisplay.style.fontWeight = 'normal';
            
            showNotification('PDF enviado com sucesso!', 'success');
        };
        
        reader.readAsDataURL(file);
        
    } catch (error) {
        showNotification('Erro ao enviar o arquivo', 'error');
        console.error('Erro:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Enviar PDF';
    }
});

// Formatar tamanho do arquivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Formatar data
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Renderizar lista de PDFs
function renderPdfs(pdfsToRender) {
    if (pdfsToRender.length === 0) {
        pdfsList.innerHTML = `
            <div class="loading">
                <i class="fas fa-inbox"></i>
                <p>Nenhum PDF encontrado</p>
            </div>
        `;
        return;
    }
    
    pdfsList.innerHTML = pdfsToRender.map(pdf => `
        <div class="pdf-card" data-id="${pdf.id}">
            <div class="pdf-icon">
                <i class="fas fa-file-pdf"></i>
            </div>
            <div class="pdf-info">
                <h3 title="${pdf.name}">${pdf.name}</h3>
                <p>
                    <i class="fas fa-hdd"></i> ${formatFileSize(pdf.size)}
                    <br>
                    <i class="fas fa-calendar"></i> ${formatDate(pdf.uploadedAt)}
                </p>
            </div>
            <div class="pdf-actions">
                <button class="download-btn" onclick="downloadPdf(${pdf.id})">
                    <i class="fas fa-download"></i> Baixar
                </button>
                <button class="delete-btn" onclick="deletePdf(${pdf.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Download de PDF
function downloadPdf(id) {
    const pdf = pdfs.find(p => p.id === id);
    if (!pdf) return;
    
    // Criar link de download
    const link = document.createElement('a');
    link.href = pdf.data;
    link.download = pdf.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Baixando: ${pdf.name}`, 'success');
}

// Deletar PDF
function deletePdf(id) {
    const pdf = pdfs.find(p => p.id === id);
    if (!pdf) return;
    
    if (confirm(`Tem certeza que deseja excluir "${pdf.name}"?`)) {
        pdfs = pdfs.filter(p => p.id !== id);
        localStorage.setItem('ifsp_pdfs', JSON.stringify(pdfs));
        renderPdfs(pdfs);
        showNotification('PDF excluído com sucesso!', 'success');
    }
}

// Buscar PDFs
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredPdfs = pdfs.filter(pdf => 
        pdf.name.toLowerCase().includes(searchTerm)
    );
    renderPdfs(filteredPdfs);
});

// Carregar PDFs do localStorage ao iniciar
function loadPdfs() {
    const savedPdfs = JSON.parse(localStorage.getItem('ifsp_pdfs') || '[]');
    pdfs = savedPdfs;
    renderPdfs(pdfs);
}

// Inicializar
document.addEventListener('DOMContentLoaded', loadPdfs);