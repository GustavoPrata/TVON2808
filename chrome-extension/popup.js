// Popup script - Interface simplificada para mostrar status do backend

document.addEventListener('DOMContentLoaded', async () => {
  const contentDiv = document.getElementById('content');
  
  // Função para renderizar o conteúdo
  async function render() {
    try {
      // Busca status do background script
      const response = await chrome.runtime.sendMessage({type: 'getStatus'});
      
      const isRunning = response?.isRunning || false;
      
      contentDiv.innerHTML = `
        <div class="status-card">
          <div class="status-row">
            <span class="status-label">Status da Automação</span>
            <span class="status-badge ${isRunning ? 'badge-active' : 'badge-inactive'}">
              ${isRunning ? 'ATIVO' : 'INATIVO'}
            </span>
          </div>
          <div class="status-row">
            <span class="status-label">Controle</span>
            <span class="status-value">Via Backend</span>
          </div>
        </div>
        
        <div class="info-box">
          <span class="info-icon">ℹ️</span>
          A automação agora é totalmente controlada pelo painel web.
          Todas as configurações e controles estão disponíveis no site.
        </div>
        
        <button class="action-button" id="openDashboard">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Abrir Painel de Controle
        </button>
        
        <div id="recentCredentials" style="display: none;">
          <div class="recent-credentials">
            <div style="text-align: center; font-size: 11px; opacity: 0.7;">
              Credenciais recentes aparecerão aqui
            </div>
          </div>
        </div>
      `;
      
      // Adiciona listener para o botão
      document.getElementById('openDashboard').addEventListener('click', () => {
        chrome.runtime.sendMessage({type: 'openDashboard'});
        window.close();
      });
      
    } catch (error) {
      contentDiv.innerHTML = `
        <div class="error">
          ⚠️ Erro ao conectar com o backend.
          <br>
          Por favor, verifique se o site está acessível.
        </div>
        
        <button class="action-button" id="retry">
          🔄 Tentar Novamente
        </button>
      `;
      
      document.getElementById('retry').addEventListener('click', render);
    }
  }
  
  // Renderiza inicialmente
  render();
  
  // Atualiza a cada 5 segundos
  setInterval(render, 5000);
  
  // Listener para receber atualizações do background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'credentialGenerated' && request.credentials) {
      // Mostra as credenciais recentes
      const recentDiv = document.getElementById('recentCredentials');
      if (recentDiv) {
        recentDiv.style.display = 'block';
        const credentialsContainer = recentDiv.querySelector('.recent-credentials');
        
        // Adiciona nova credencial no topo
        const newItem = document.createElement('div');
        newItem.className = 'credential-item';
        newItem.innerHTML = `
          <strong>Nova:</strong> ${request.credentials.username} | ${request.credentials.password}
        `;
        
        // Insere no início
        if (credentialsContainer.firstChild) {
          credentialsContainer.insertBefore(newItem, credentialsContainer.firstChild);
        } else {
          credentialsContainer.innerHTML = '';
          credentialsContainer.appendChild(newItem);
        }
        
        // Mantém apenas as últimas 3
        while (credentialsContainer.children.length > 3) {
          credentialsContainer.removeChild(credentialsContainer.lastChild);
        }
        
        // Destaca com animação
        newItem.style.background = 'rgba(40, 167, 69, 0.2)';
        setTimeout(() => {
          newItem.style.background = '';
        }, 2000);
      }
    }
  });
});