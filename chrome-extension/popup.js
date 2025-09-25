// Popup script - Interface simplificada para mostrar status do backend

document.addEventListener('DOMContentLoaded', async () => {
  const contentDiv = document.getElementById('content');
  const serverConfigDiv = document.getElementById('serverConfig');
  const configToggle = document.getElementById('configToggle');
  
  // Estado da configuração
  let showingConfig = false;
  
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
            <span class="status-label">Modo</span>
            <span class="status-value">Automático 24/7</span>
          </div>
          <div class="status-row">
            <span class="status-label">Funcionamento</span>
            <span class="status-value" style="color: #28a745;">Em Background</span>
          </div>
        </div>
        
        <div class="info-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
          <span class="info-icon">✨</span>
          <strong>Extensão Funcionando Automaticamente!</strong><br>
          <span style="font-size: 11px;">
            A extensão está rodando em background e funcionará mesmo com esta janela fechada.
            Ela verifica tarefas a cada 30 segundos e abre a aba do OnlineOffice automaticamente quando necessário.
          </span>
        </div>
        
        <button class="action-button" id="openDashboard">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Abrir Painel de Controle
        </button>
        
        <button class="action-button" id="debugPage" style="margin-top: 10px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Debug Página OnlineOffice
        </button>
        
        <div id="debugOutput" style="display: none; margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 11px; font-family: monospace; max-height: 200px; overflow-y: auto; white-space: pre-wrap;"></div>
        
        <div id="recentCredentials" style="display: none;">
          <div class="recent-credentials">
            <div style="text-align: center; font-size: 11px; opacity: 0.7;">
              Credenciais recentes aparecerão aqui
            </div>
          </div>
        </div>
      `;
      
      // Adiciona listener para o botão dashboard
      document.getElementById('openDashboard').addEventListener('click', () => {
        chrome.runtime.sendMessage({type: 'openDashboard'});
        window.close();
      });
      
      // Adiciona listener para o botão de debug
      document.getElementById('debugPage').addEventListener('click', async () => {
        const btn = document.getElementById('debugPage');
        const output = document.getElementById('debugOutput');
        
        btn.innerHTML = '🔍 Executando debug...';
        btn.disabled = true;
        
        try {
          // Envia comando de debug para o content script
          const [tab] = await chrome.tabs.query({ url: 'https://onlineoffice.zip/*' });
          
          if (!tab) {
            output.style.display = 'block';
            output.textContent = '❌ Não foi possível encontrar a aba do OnlineOffice.\n\nAbra o site https://onlineoffice.zip primeiro!';
            btn.innerHTML = '🔄 Tentar Novamente';
            btn.disabled = false;
            return;
          }
          
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'debug' });
          
          if (response && response.success) {
            output.style.display = 'block';
            output.textContent = `✅ Debug executado com sucesso!\n\nURL: ${response.url}\n\nVerifique o console do navegador (F12) na aba do OnlineOffice para ver os detalhes completos.\n\nO debug mostra:\n- Botões encontrados na página\n- Links de ação\n- Inputs visíveis\n- Modais/Dialogs\n- Ícones clicáveis`;
          } else {
            output.style.display = 'block';
            output.textContent = '❌ Erro ao executar debug: ' + (response?.error || 'Desconhecido');
          }
        } catch (error) {
          output.style.display = 'block';
          output.textContent = `❌ Erro: ${error.message}\n\nCertifique-se de que:\n1. O site OnlineOffice está aberto\n2. Você está logado no site\n3. A extensão tem permissão para acessar o site`;
        } finally {
          btn.innerHTML = '🔄 Debug Página OnlineOffice';
          btn.disabled = false;
        }
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
  
  // Toggle de configuração
  configToggle.addEventListener('click', () => {
    showingConfig = !showingConfig;
    if (showingConfig) {
      contentDiv.style.display = 'none';
      serverConfigDiv.style.display = 'block';
      loadServerConfig();
    } else {
      contentDiv.style.display = 'block';
      serverConfigDiv.style.display = 'none';
    }
  });
  
  // Carrega configuração do servidor
  async function loadServerConfig() {
    const stored = await chrome.storage.local.get('apiBase');
    const serverUrl = document.getElementById('serverUrl');
    if (stored.apiBase) {
      serverUrl.value = stored.apiBase;
    } else {
      // Tenta detectar o servidor atual
      const response = await chrome.runtime.sendMessage({type: 'getCurrentServer'});
      if (response?.server) {
        serverUrl.value = response.server;
      } else {
        serverUrl.value = 'http://localhost:5000';
      }
    }
  }
  
  // Salva configuração do servidor
  document.getElementById('saveServer')?.addEventListener('click', async () => {
    const serverUrl = document.getElementById('serverUrl').value.trim();
    if (serverUrl) {
      // Remove barra final se houver
      const cleanUrl = serverUrl.replace(/\/$/, '');
      await chrome.storage.local.set({ apiBase: cleanUrl });
      
      // Notifica background script
      chrome.runtime.sendMessage({type: 'serverUpdated', server: cleanUrl});
      
      // Feedback visual
      const btn = document.getElementById('saveServer');
      btn.textContent = '✅ Salvo!';
      setTimeout(() => {
        btn.textContent = 'Salvar';
        // Volta para tela principal
        showingConfig = false;
        contentDiv.style.display = 'block';
        serverConfigDiv.style.display = 'none';
        render();
      }, 1500);
    }
  });
  
  // Auto-detecta servidor
  document.getElementById('autoDetect')?.addEventListener('click', async () => {
    const btn = document.getElementById('autoDetect');
    btn.textContent = '🔍 Detectando...';
    
    // Remove configuração salva para forçar auto-detecção
    await chrome.storage.local.remove('apiBase');
    
    // Pede ao background para re-detectar
    const response = await chrome.runtime.sendMessage({type: 'autoDetectServer'});
    
    if (response?.server) {
      document.getElementById('serverUrl').value = response.server;
      btn.textContent = '✅ Detectado!';
      setTimeout(() => {
        btn.textContent = 'Auto-detectar';
      }, 2000);
    } else {
      btn.textContent = '❌ Falhou';
      setTimeout(() => {
        btn.textContent = 'Auto-detectar';
      }, 2000);
    }
  });
  
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