// Sistema de Autenticação IFSP
class AuthSystem {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = this.loadCurrentUser();
        this.initDemoUsers();
    }

    initDemoUsers() {
        // Usuários demo para teste
        const demoUsers = [
            {
                prontuario: 'SP1234567',
                senha: 'ifsp2024',
                nome: 'João Silva',
                email: 'joao.silva@aluno.ifsp.edu.br',
                tipo: 'aluno',
                curso: 'Bacharelado em Ciência da Computação'
            },
            {
                prontuario: 'SP7654321',
                senha: 'ifsp2024',
                nome: 'Maria Santos',
                email: 'maria.santos@aluno.ifsp.edu.br',
                tipo: 'aluno',
                curso: 'ADS'
            },
            {
                prontuario: 'PR123456',
                senha: 'prof2024',
                nome: 'Dr. Carlos Oliveira',
                email: 'carlos.oliveira@ifsp.edu.br',
                tipo: 'professor',
                curso: 'ADS'
            }
        ];

        // Adicionar usuários demo se não existirem
        demoUsers.forEach(user => {
            if (!this.users.find(u => u.prontuario === user.prontuario)) {
                this.users.push(user);
            }
        });
        this.saveUsers();
    }

    loadUsers() {
        const users = localStorage.getItem('ifsp_users');
        return users ? JSON.parse(users) : [];
    }

    saveUsers() {
        localStorage.setItem('ifsp_users', JSON.stringify(this.users));
    }

    loadCurrentUser() {
        const user = sessionStorage.getItem('ifsp_current_user');
        return user ? JSON.parse(user) : null;
    }

    saveCurrentUser(user) {
        sessionStorage.setItem('ifsp_current_user', JSON.stringify(user));
    }

    login(prontuario, senha, lembrar = false) {
        const user = this.users.find(u => 
            u.prontuario === prontuario && u.senha === senha
        );

        if (user) {
            this.currentUser = user;
            this.saveCurrentUser(user);
            
            if (lembrar) {
                localStorage.setItem('ifsp_remembered_user', prontuario);
            }
            
            return { success: true, user };
        }
        
        return { success: false, message: 'Prontuário ou senha inválidos' };
    }

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem('ifsp_current_user');
        localStorage.removeItem('ifsp_remembered_user');
        window.location.href = 'login.html';
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getUserFullName() {
        return this.currentUser ? this.currentUser.nome : '';
    }

    getUserProntuario() {
        return this.currentUser ? this.currentUser.prontuario : '';
    }

    getUserType() {
        return this.currentUser ? this.currentUser.tipo : '';
    }

    canDelete(user) {
        return this.currentUser && (
            this.currentUser.tipo === 'professor' || 
            this.currentUser.prontuario === user.prontuario
        );
    }
}

// Instância global
const auth = new AuthSystem();

// Verificar autenticação
function checkAuth() {
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Login handler
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const prontuario = document.getElementById('prontuario').value;
        const senha = document.getElementById('senha').value;
        const lembrar = document.getElementById('lembrar').checked;
        
        const result = auth.login(prontuario, senha, lembrar);
        const statusElement = document.getElementById('loginStatus');
        
        if (result.success) {
            statusElement.className = 'status-message success';
            statusElement.textContent = 'Login realizado com sucesso! Redirecionando...';
            statusElement.style.display = 'block';
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            statusElement.className = 'status-message error';
            statusElement.textContent = result.message;
            statusElement.style.display = 'block';
            
            // Animar erro
            document.querySelector('.login-card').style.animation = 'shake 0.5s';
            setTimeout(() => {
                document.querySelector('.login-card').style.animation = '';
            }, 500);
        }
    });
}

// Preencher prontuário lembrado
if (document.getElementById('prontuario')) {
    const rememberedUser = localStorage.getItem('ifsp_remembered_user');
    if (rememberedUser) {
        document.getElementById('prontuario').value = rememberedUser;
        document.getElementById('lembrar').checked = true;
    }
}

// Logout
function logout() {
    auth.logout();
}