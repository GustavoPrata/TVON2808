// OnlineOffice IPTV Automator - Content Script
// Versão com sistema de logging completo

console.log('👋 OnlineOffice Automator carregado!');

// ===========================================================================
// SISTEMA DE LOGGING
// ===========================================================================
// Gera um ID único para rastrear operações
function generateTraceId() {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Função para enviar logs para o background script
function log(level, message, context = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: {
      ...context,
      url: window.location.href,
      traceId: context.traceId || generateTraceId()
    }
  };
  
  // Log local para debug
  const colors = {
    DEBUG: '#6c757d',
    INFO: '#0d6efd', 
    WARN: '#ffc107',
    ERROR: '#dc3545'
  };
  console.log(
    `%c[${level}] ${message}`,
    `color: ${colors[level] || '#000'}; font-weight: ${level === 'ERROR' ? 'bold' : 'normal'}`,
    context
  );
  
  // Envia para background script
  if (chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      type: 'LOG',
      logEntry
    }).catch(err => {
      console.warn('Falha ao enviar log para background:', err);
    });
  }
}

// Inicialização do script
log('INFO', 'Content script iniciado com sucesso', {
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent
});

// ===========================================================================
// CONFIGURAÇÃO
// ===========================================================================
// URL do servidor onde o sistema TV ON está rodando
// IMPORTANTE: A extensão roda no OnlineOffice, mas envia dados para nosso servidor
// Função para determinar a URL do servidor dinamicamente
async function getApiBase() {
  const traceId = generateTraceId();
  log('DEBUG', 'Iniciando detecção de API base', { traceId });
  
  // Primeiro, verifica se há uma configuração salva no storage
  const stored = await chrome.storage.local.get('apiBase');
  if (stored.apiBase) {
    log('INFO', `API configurada encontrada: ${stored.apiBase}`, { traceId, apiBase: stored.apiBase });
    return stored.apiBase;
  }
  
  // Lista de servidores possíveis em ordem de prioridade
  const servers = [
    'http://localhost:5000',           // Desenvolvimento local
    'http://127.0.0.1:5000',          // Desenvolvimento local alternativo
    'https://tv-on.site'               // Produção
  ];
  
  log('DEBUG', 'Testando servidores disponíveis', { traceId, servers });
  
  // Tenta cada servidor para ver qual está disponível
  for (const server of servers) {
    try {
      log('DEBUG', `Testando servidor: ${server}`, { traceId, server });
      const response = await fetch(`${server}/api`, {
        method: 'HEAD',
        mode: 'cors'
      }).catch(() => null);
      
      if (response && response.ok) {
        log('INFO', `Servidor disponível encontrado: ${server}`, { traceId, server, status: response.status });
        // Salva o servidor funcional no storage
        await chrome.storage.local.set({ apiBase: server });
        return server;
      } else {
        log('WARN', `Servidor não respondeu: ${server}`, { traceId, server, status: response?.status });
      }
    } catch (e) {
      log('ERROR', `Erro ao testar servidor: ${server}`, { traceId, server, error: e.message, stack: e.stack });
    }
  }
  
  // Se nenhum servidor responder, usa o padrão de produção
  log('WARN', 'Nenhum servidor respondeu, usando produção como fallback', { traceId });
  return 'https://tv-on.site';
}

// Variável global para armazenar a URL do API
let API_BASE = null;

// Inicializa API_BASE assim que o script carregar
(async () => {
  const traceId = generateTraceId();
  log('INFO', 'Inicializando configuração da API', { traceId });
  API_BASE = await getApiBase();
  log('INFO', `Servidor API configurado: ${API_BASE}`, { traceId, apiBase: API_BASE });
})();

// Flag para evitar duplicação de credenciais
let isGeneratingViaCommand = false;

// ===========================================================================
// LISTENER GLOBAL PARA FECHAR MODAIS COM ESC
// ===========================================================================
document.addEventListener('keydown', function(event) {
  // Se pressionou ESC (keyCode 27 ou key 'Escape')
  if (event.key === 'Escape' || event.keyCode === 27) {
    console.log('🔑 ESC pressionado, tentando fechar modais...');
    
    // Fecha modais do SweetAlert2
    const sweetAlertContainers = document.querySelectorAll('.swal2-container');
    sweetAlertContainers.forEach(container => {
      if (container && container.style.display !== 'none') {
        container.click(); // Simula clique no backdrop
        console.log('✅ Modal SweetAlert2 fechado via ESC');
      }
    });
    
    // Fecha modais do Bootstrap
    const bootstrapBackdrops = document.querySelectorAll('.modal-backdrop');
    bootstrapBackdrops.forEach(backdrop => {
      if (backdrop) {
        backdrop.click();
        console.log('✅ Modal Bootstrap fechado via ESC');
      }
    });
    
    // Tenta fechar qualquer modal visível
    const modals = document.querySelectorAll('.modal, [role="dialog"]');
    modals.forEach(modal => {
      if (modal && (modal.style.display === 'block' || modal.classList.contains('show'))) {
        // Tenta clicar no botão de fechar (X)
        const closeBtn = modal.querySelector('.close, .btn-close, [data-dismiss="modal"]');
        if (closeBtn) {
          closeBtn.click();
          console.log('✅ Modal fechado via botão X');
        }
      }
    });
    
    // Fecha overlays genéricos
    const overlays = document.querySelectorAll('.overlay, .modal-overlay');
    overlays.forEach(overlay => {
      if (overlay && overlay.style.display !== 'none') {
        overlay.click();
        console.log('✅ Overlay fechado via ESC');
      }
    });
  }
});

// ===========================================================================
// FUNÇÃO PARA SALVAR CREDENCIAIS NO BANCO
// ===========================================================================
async function saveCredentialsToDatabase(username, password) {
  const traceId = generateTraceId();
  log('INFO', 'Iniciando salvamento de credenciais', { 
    traceId, 
    username,
    password: '***' // Mascara a senha nos logs
  });
  
  // Garante que API_BASE está definido
  if (!API_BASE) {
    log('DEBUG', 'API_BASE não definido, reconfigurando...', { traceId });
    API_BASE = await getApiBase();
    log('INFO', `API reconfigurada: ${API_BASE}`, { traceId, apiBase: API_BASE });
  }
  
  // Usar o endpoint correto que existe no backend
  const endpoint = `${API_BASE}/api/office/automation/credentials`;
  log('INFO', `Enviando credenciais para: ${endpoint}`, { traceId, endpoint });
  
  try {
    const payload = {
      type: 'manual_generation',
      credentials: {
        username: username,
        password: password
      },
      timestamp: new Date().toISOString(),
      traceId: traceId
    };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': 'chrome-extension-secret-2024',
        'X-Trace-Id': traceId
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { rawResponse: responseText };
    }
    
    if (response.ok) {
      log('INFO', 'Credenciais salvas com sucesso', { 
        traceId, 
        response: data,
        status: response.status 
      });
      return true;
    } else {
      log('ERROR', 'Erro ao salvar credenciais', { 
        traceId, 
        status: response.status,
        response: data,
        statusText: response.statusText
      });
      return false;
    }
  } catch (error) {
    log('ERROR', 'Exceção ao salvar credenciais', { 
      traceId, 
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}


// ===========================================================================
// LISTENER PARA COMANDOS DO BACKGROUND
// ===========================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const traceId = request.traceId || generateTraceId();
  log('INFO', 'Comando recebido do background', { traceId, action: request.action, request });
  
  // Responde ao ping para manter conexão viva
  if (request.action === 'ping') {
    log('DEBUG', 'Ping recebido, respondendo pong', { traceId });
    sendResponse({ pong: true });
    return true;
  }
  
  if (request.action === 'generateOne') {
    log('INFO', 'Iniciando geração de credencial', { traceId });
    
    // Define flag para evitar duplicação
    isGeneratingViaCommand = true;
    
    // SEQUÊNCIA CORRETA DE CLIQUES
    setTimeout(() => {
      // 1. CLICAR NO BOTÃO "GERAR IPTV"
      log('DEBUG', 'Procurando botão Gerar IPTV...', { traceId });
      let btnGerar = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent.includes('Gerar IPTV')
      );
      
      if (btnGerar) {
        log('INFO', 'Botão Gerar IPTV encontrado e clicado', { traceId });
        btnGerar.click();
        
        // 2. AGUARDAR E CLICAR EM "CONFIRMAR" NO MODAL
        setTimeout(() => {
          log('DEBUG', 'Procurando botão Confirmar...', { traceId });
          let btnConfirmar = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent === 'Confirmar' || btn.textContent.includes('Confirmar')
          );
          
          if (btnConfirmar) {
            log('INFO', 'Botão Confirmar encontrado e clicado', { traceId });
            btnConfirmar.click();
            
            // 3. AGUARDAR SEGUNDO "CONFIRMAR" (SE HOUVER)
            setTimeout(() => {
              let btnConfirmar2 = Array.from(document.querySelectorAll('button')).find(btn => 
                btn.textContent === 'Confirmar'
              );
              
              if (btnConfirmar2) {
                log('INFO', 'Segundo botão Confirmar encontrado e clicado', { traceId });
                btnConfirmar2.click();
              }
              
              // 4. AGUARDAR E EXTRAIR CREDENCIAIS
              setTimeout(() => {
                log('DEBUG', 'Aguardando modal de credenciais aparecer...', { traceId });
                
                // Aguarda mais tempo para o modal de credenciais aparecer
                setTimeout(() => {
                  log('INFO', 'Iniciando extração de credenciais', { traceId });
                  
                  let username = null;
                  let password = null;
                
                // Método 1: Procura inputs readonly com as credenciais
                const inputs = document.querySelectorAll('input[readonly], input[type="text"]');
                log('DEBUG', `Encontrados ${inputs.length} inputs na página`, { traceId });
                
                // Tenta extrair dos inputs
                inputs.forEach((input, index) => {
                  const value = input.value;
                  log('DEBUG', `Input ${index}: ${value ? '***' : 'vazio'}`, { traceId });
                  
                  // Se tem valor e parece ser uma credencial
                  if (value && value.trim()) {
                    // O primeiro input com valor geralmente é o usuário
                    if (!username) {
                      username = value;
                    } else if (!password) {
                      // O segundo é a senha
                      password = value;
                    }
                  }
                });
                
                // Método 2: Se não achou nos inputs, tenta no texto do modal
                if (!username || !password) {
                  log('DEBUG', 'Tentando extrair do texto do modal...', { traceId });
                  
                  // Procura por diferentes tipos de modal
                  const modalSelectors = [
                    '.swal2-content',
                    '.modal-body',
                    '[role="dialog"]',
                    '.modal-content',
                    '.swal2-html-container'
                  ];
                  
                  let modalContent = null;
                  for (const selector of modalSelectors) {
                    modalContent = document.querySelector(selector);
                    if (modalContent) {
                      log('DEBUG', `Modal encontrado com selector: ${selector}`, { traceId });
                      break;
                    }
                  }
                  
                  if (modalContent) {
                    const text = modalContent.innerText || modalContent.textContent;
                    log('DEBUG', 'Texto do modal encontrado', { traceId, textLength: text?.length });
                    
                    // Método especial para OnlineOffice - detecta formato específico do modal
                    // O modal tem formato:
                    // USUÁRIO:
                    // 12345usuario
                    // SENHA:
                    // senha123
                    // VENCIMENTO:
                    // data
                    
                    if (text.includes('USUÁRIO') && text.includes('SENHA')) {
                      // Divide por linhas e remove espaços
                      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
                      
                      // Procura índice de USUÁRIO e SENHA
                      let userIndex = -1;
                      let passIndex = -1;
                      let expiryIndex = -1;
                      
                      for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('USUÁRIO')) userIndex = i;
                        if (lines[i].includes('SENHA')) passIndex = i;
                        if (lines[i].includes('VENCIMENTO')) expiryIndex = i;
                      }
                      
                      // Extrai valores que estão depois dos labels
                      if (userIndex >= 0 && userIndex + 1 < lines.length) {
                        // Pega a linha após USUÁRIO que não seja SENHA ou VENCIMENTO
                        for (let i = userIndex + 1; i < lines.length && i < passIndex; i++) {
                          const line = lines[i];
                          if (line && !line.includes('SENHA') && !line.includes('VENCIMENTO') && !line.includes(':')) {
                            username = line;
                            log('INFO', 'Usuário detectado do modal', { traceId, username });
                            break;
                          }
                        }
                      }
                      
                      if (passIndex >= 0 && passIndex + 1 < lines.length) {
                        // Pega a linha após SENHA que não seja VENCIMENTO
                        for (let i = passIndex + 1; i < lines.length && (expiryIndex < 0 || i < expiryIndex); i++) {
                          const line = lines[i];
                          if (line && !line.includes('VENCIMENTO') && !line.includes(':')) {
                            password = line;
                            log('INFO', 'Senha detectada do modal', { traceId, password: '***' });
                            break;
                          }
                        }
                      }
                    }
                    
                    // Tenta extrair com diferentes padrões
                    const patterns = [
                      /usu[áa]rio:?\s*([^\s\n]+)/i,
                      /user:?\s*([^\s\n]+)/i,
                      /login:?\s*([^\s\n]+)/i,
                      /USUÁRIO:?\s*([^\s\n]+)/i
                    ];
                    
                    for (const pattern of patterns) {
                      const match = text.match(pattern);
                      if (match && match[1]) {
                        username = match[1];
                        console.log(`Usuário encontrado: ${username}`);
                        break;
                      }
                    }
                    
                    const passwordPatterns = [
                      /senha:?\s*([^\s\n]+)/i,
                      /password:?\s*([^\s\n]+)/i,
                      /pass:?\s*([^\s\n]+)/i,
                      /SENHA:?\s*([^\s\n]+)/i
                    ];
                    
                    for (const pattern of passwordPatterns) {
                      const match = text.match(pattern);
                      if (match && match[1]) {
                        password = match[1];
                        console.log(`Senha encontrada: ${password}`);
                        break;
                      }
                    }
                    
                    // Método 3: Procura por linhas com USUÁRIO e SENHA
                    if (!username || !password) {
                      const lines = text.split('\n');
                      for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        
                        // Procura por USUÁRIO em várias formas
                        if (line.match(/USU[ÁA]RIO/i)) {
                          // Se a próxima linha existe e não contém outros labels
                          if (i + 1 < lines.length && !lines[i + 1].includes('SENHA') && !lines[i + 1].includes('VENCIMENTO')) {
                            const nextLine = lines[i + 1].trim();
                            // Verifica se não é um label e tem conteúdo
                            if (nextLine && !nextLine.includes(':') && !nextLine.match(/USU[ÁA]RIO|SENHA|VENCIMENTO/i)) {
                              username = nextLine;
                            }
                          }
                        }
                        
                        // Procura por SENHA
                        if (line.match(/SENHA/i)) {
                          // Se a próxima linha existe e não contém outros labels
                          if (i + 1 < lines.length && !lines[i + 1].includes('VENCIMENTO') && !lines[i + 1].includes('USUÁRIO')) {
                            const nextLine = lines[i + 1].trim();
                            // Verifica se não é um label e tem conteúdo
                            if (nextLine && !nextLine.includes(':') && !nextLine.match(/USU[ÁA]RIO|SENHA|VENCIMENTO/i)) {
                              password = nextLine;
                            }
                          }
                        }
                      }
                    }
                  }
                }
                
                // Método 4: Tenta pegar de elementos específicos
                if (!username || !password) {
                  console.log('Tentando método específico de elementos...');
                  
                  // Procura por elementos que podem conter as credenciais
                  const allElements = document.querySelectorAll('p, div, span, td');
                  allElements.forEach(el => {
                    const text = el.innerText || el.textContent;
                    if (text && text.includes('USUÁRIO')) {
                      const match = text.match(/USUÁRIO:?\s*([^\s\n]+)/i);
                      if (match) username = match[1];
                    }
                    if (text && text.includes('SENHA')) {
                      const match = text.match(/SENHA:?\s*([^\s\n]+)/i);
                      if (match) password = match[1];
                    }
                  });
                }
                
                if (username && password) {
                  log('INFO', 'Credenciais extraídas com sucesso', { 
                    traceId, 
                    username, 
                    password: '***'
                  });
                  
                  // 5. FECHAR MODAL ORIGINAL DO SITE
                  setTimeout(() => {
                    log('DEBUG', 'Fechando modal original do site...', { traceId });
                    
                    // Tenta clicar no backdrop/overlay
                    const backdrop = document.querySelector('.swal2-container, .modal-backdrop, .overlay');
                    if (backdrop) {
                      backdrop.click();
                      log('INFO', 'Modal original fechado via backdrop', { traceId });
                    }
                    
                    // Tenta clicar no botão OK ou Fechar
                    const okButton = Array.from(document.querySelectorAll('button')).find(btn => 
                      btn.textContent === 'OK' || btn.textContent === 'Ok' || btn.textContent === 'Fechar'
                    );
                    if (okButton) {
                      okButton.click();
                      log('INFO', 'Modal original fechado via botão OK', { traceId });
                    }
                  }, 500);
                  
                  // 6. NÃO SALVAR AQUI - será salvo pelo background via task-complete
                  log('INFO', 'Credenciais extraídas, enviando para o background processar', { traceId });
                  
                  // 7. ENVIAR RESPOSTA PARA O BACKGROUND (que salvará via task-complete)
                  sendResponse({
                    success: true,
                    credentials: {
                      username: username,
                      password: password,
                      timestamp: new Date().toISOString()
                    },
                    traceId: traceId
                  });
                  
                  // Reset flag após processar
                  setTimeout(() => {
                    isGeneratingViaCommand = false;
                    log('DEBUG', 'Flag resetada', { traceId });
                  }, 2000);
                  
                } else {
                  log('ERROR', 'Não conseguiu extrair credenciais', { 
                    traceId,
                    usernameFound: !!username,
                    passwordFound: !!password
                  });
                  sendResponse({
                    success: false,
                    error: 'Não conseguiu extrair credenciais',
                    traceId: traceId
                  });
                }
                
                }, 2000); // Fecha o setTimeout adicional para aguardar modal
                
              }, 3000);
              
            }, 1500);
            
          } else {
            log('ERROR', 'Botão Confirmar não encontrado', { traceId });
            sendResponse({
              success: false,
              error: 'Botão Confirmar não encontrado',
              traceId: traceId
            });
          }
        }, 2000);
        
      } else {
        log('ERROR', 'Botão Gerar IPTV não encontrado', { traceId });
        sendResponse({
          success: false,
          error: 'Botão Gerar IPTV não encontrado',
          traceId: traceId
        });
      }
      
    }, 500);
    
    // Retorna true para indicar que a resposta será enviada assincronamente
    return true;
  }
  
  // ===========================================================================
  // EDITANDO SISTEMA NO ONLINEOFFICE (RESTAURADO)
  // ===========================================================================
  if (request.action === 'editSystem') {
    const { systemId, username, password } = request;
    const traceId = request.traceId || generateTraceId();
    log('INFO', 'Iniciando edição de sistema', { traceId, systemId, username, password: '***' });
    
    // Função assíncrona para editar o sistema
    (async () => {
      try {
        // 1. NAVEGAR PARA A PÁGINA DE EDIÇÃO DO SISTEMA
        const editUrl = `https://onlineoffice.zip/iptv/editar.php?id=${systemId}`;
        log('INFO', `Navegando para: ${editUrl}`, { traceId, systemId });
        
        // Se não estamos na página de edição, navegar para ela
        if (window.location.href !== editUrl) {
          window.location.href = editUrl;
          // Após navegação, o script será recarregado, então precisamos salvar estado
          await chrome.storage.local.set({
            pendingEdit: {
              systemId,
              username,
              password,
              traceId,
              timestamp: Date.now()
            }
          });
          log('INFO', 'Estado de edição pendente salvo, aguardando navegação', { traceId });
          sendResponse({ 
            success: true, 
            message: 'Navegando para página de edição',
            traceId: traceId 
          });
          return;
        }
        
        // 2. SE ESTAMOS NA PÁGINA DE EDIÇÃO, PREENCHER E ENVIAR
        log('INFO', 'Já estamos na página de edição, preenchendo formulário', { traceId });
        
        // Aguardar página carregar completamente
        await waitForPageLoad();
        await sleep(1000);
        
        // 3. PROCURAR E PREENCHER CAMPO DE USUÁRIO
        log('DEBUG', 'Procurando campo de usuário...', { traceId });
        let usernameField = null;
        
        // Tenta diferentes seletores para o campo de usuário
        const userFieldSelectors = [
          'input[name="usuario"]',
          'input[name="user"]',
          'input[name="username"]',
          'input[placeholder*="usuário" i]',
          'input[placeholder*="user" i]',
          '#usuario',
          '#user'
        ];
        
        for (const selector of userFieldSelectors) {
          usernameField = document.querySelector(selector);
          if (usernameField) {
            log('INFO', `Campo de usuário encontrado com selector: ${selector}`, { traceId });
            break;
          }
        }
        
        // Se não encontrou por seletores específicos, procura por tipo text
        if (!usernameField) {
          const textInputs = document.querySelectorAll('input[type="text"]');
          if (textInputs.length > 0) {
            // Geralmente o primeiro campo text é o usuário
            usernameField = textInputs[0];
            log('INFO', 'Campo de usuário encontrado por input[type="text"]', { traceId });
          }
        }
        
        if (usernameField) {
          usernameField.value = username;
          usernameField.dispatchEvent(new Event('input', { bubbles: true }));
          usernameField.dispatchEvent(new Event('change', { bubbles: true }));
          log('INFO', 'Campo de usuário preenchido', { traceId, username });
        } else {
          log('ERROR', 'Campo de usuário não encontrado', { traceId });
          sendResponse({ 
            success: false, 
            error: 'Campo de usuário não encontrado',
            traceId: traceId 
          });
          return;
        }
        
        // 4. PROCURAR E PREENCHER CAMPO DE SENHA
        log('DEBUG', 'Procurando campo de senha...', { traceId });
        let passwordField = null;
        
        // Tenta diferentes seletores para o campo de senha
        const passFieldSelectors = [
          'input[name="senha"]',
          'input[name="password"]',
          'input[name="pass"]',
          'input[type="password"]',
          'input[placeholder*="senha" i]',
          'input[placeholder*="password" i]',
          '#senha',
          '#password'
        ];
        
        for (const selector of passFieldSelectors) {
          passwordField = document.querySelector(selector);
          if (passwordField) {
            log('INFO', `Campo de senha encontrado com selector: ${selector}`, { traceId });
            break;
          }
        }
        
        // Se não encontrou senha mas tem dois inputs de texto, o segundo pode ser senha
        if (!passwordField) {
          const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
          if (inputs.length >= 2) {
            passwordField = inputs[1];
            log('INFO', 'Campo de senha encontrado como segundo input', { traceId });
          }
        }
        
        if (passwordField) {
          passwordField.value = password;
          passwordField.dispatchEvent(new Event('input', { bubbles: true }));
          passwordField.dispatchEvent(new Event('change', { bubbles: true }));
          log('INFO', 'Campo de senha preenchido', { traceId, password: '***' });
        } else {
          log('ERROR', 'Campo de senha não encontrado', { traceId });
          sendResponse({ 
            success: false, 
            error: 'Campo de senha não encontrado',
            traceId: traceId 
          });
          return;
        }
        
        // 5. SUBMETER O FORMULÁRIO
        await sleep(500); // Pequena espera para garantir que os valores foram definidos
        
        log('DEBUG', 'Procurando botão de submit...', { traceId });
        let submitButton = null;
        
        // Tenta diferentes seletores para o botão de submit
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:contains("Salvar")',
          'button:contains("Atualizar")',
          'button:contains("Confirmar")',
          'button:contains("Editar")',
          '.btn-primary',
          '.btn-success'
        ];
        
        for (const selector of submitSelectors) {
          try {
            // Para seletores com :contains, usar jQuery se disponível
            if (selector.includes(':contains')) {
              if (typeof $ !== 'undefined') {
                submitButton = $(selector)[0];
              } else {
                // Fallback sem jQuery
                submitButton = Array.from(document.querySelectorAll('button')).find(btn => 
                  btn.textContent.includes(selector.match(/:contains\("(.+)"\)/)[1])
                );
              }
            } else {
              submitButton = document.querySelector(selector);
            }
            
            if (submitButton) {
              log('INFO', `Botão de submit encontrado com selector: ${selector}`, { traceId });
              break;
            }
          } catch (e) {
            log('DEBUG', `Erro ao tentar selector ${selector}: ${e.message}`, { traceId });
          }
        }
        
        // Se não encontrou botão, procura qualquer botão com texto relacionado
        if (!submitButton) {
          submitButton = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(btn => {
            const text = btn.textContent || btn.value || '';
            return /salvar|atualizar|confirmar|editar|enviar|submit/i.test(text);
          });
          
          if (submitButton) {
            log('INFO', 'Botão de submit encontrado por texto', { traceId });
          }
        }
        
        // Se ainda não encontrou, tenta submeter o formulário diretamente
        if (!submitButton) {
          const form = usernameField?.closest('form') || passwordField?.closest('form');
          if (form) {
            log('INFO', 'Submetendo formulário diretamente', { traceId });
            form.submit();
            
            // Limpa estado pendente
            await chrome.storage.local.remove('pendingEdit');
            
            sendResponse({ 
              success: true, 
              message: 'Sistema editado com sucesso (via form.submit)',
              traceId: traceId 
            });
            return;
          }
        }
        
        if (submitButton) {
          log('INFO', 'Clicando no botão de submit', { traceId });
          submitButton.click();
          
          // Limpa estado pendente
          await chrome.storage.local.remove('pendingEdit');
          
          sendResponse({ 
            success: true, 
            message: 'Sistema editado com sucesso',
            traceId: traceId 
          });
        } else {
          log('ERROR', 'Botão de submit não encontrado', { traceId });
          sendResponse({ 
            success: false, 
            error: 'Botão de submit não encontrado',
            traceId: traceId 
          });
        }
        
      } catch (error) {
        log('ERROR', 'Erro ao editar sistema', { 
          traceId, 
          error: error.message,
          stack: error.stack 
        });
        sendResponse({ 
          success: false, 
          error: error.message,
          traceId: traceId 
        });
      }
    })();
    
    return true; // Indica resposta assíncrona
  }
});

// ===========================================================================
// VERIFICAR SE HÁ EDIÇÃO PENDENTE (após navegação)
// ===========================================================================
(async () => {
  // Verifica se há uma edição pendente após navegação
  const stored = await chrome.storage.local.get('pendingEdit');
  if (stored.pendingEdit) {
    const { systemId, username, password, traceId, timestamp } = stored.pendingEdit;
    
    // Verifica se a edição não é muito antiga (máximo 30 segundos)
    if (Date.now() - timestamp < 30000) {
      // Verifica se estamos na página de edição correta
      if (window.location.href.includes(`editar.php?id=${systemId}`)) {
        log('INFO', 'Edição pendente detectada, continuando processo', { traceId, systemId });
        
        // Aguarda um pouco para a página carregar
        await sleep(2000);
        
        // Simula o comando de edição
        chrome.runtime.sendMessage({
          action: 'editSystem',
          systemId,
          username,
          password,
          traceId
        });
      } else {
        log('WARN', 'Edição pendente mas não estamos na página correta', { 
          traceId, 
          expectedId: systemId,
          currentUrl: window.location.href 
        });
        // Limpa edição pendente antiga
        await chrome.storage.local.remove('pendingEdit');
      }
    } else {
      log('WARN', 'Edição pendente expirada, removendo', { traceId, systemId });
      await chrome.storage.local.remove('pendingEdit');
    }
  }
})();

// ===========================================================================
// OBSERVER PARA DETECTAR CREDENCIAIS GERADAS MANUALMENTE
// ===========================================================================
// Observa mudanças no DOM para detectar quando credenciais são mostradas
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      // Procura por modais do SweetAlert2 com credenciais
      const swalContainers = document.querySelectorAll('.swal2-html-container');
      swalContainers.forEach(container => {
        const text = container.textContent || container.innerText;
        
        // Verifica se contém credenciais
        if (text && (text.includes('USUÁRIO') || text.includes('Usuário')) && 
            (text.includes('SENHA') || text.includes('Senha'))) {
          
          log('INFO', 'Detectado modal com credenciais', { hasUsername: text.includes('USUÁRIO'), hasPassword: text.includes('SENHA') });
          
          // Extrai credenciais
          let username = null;
          let password = null;
          
          // Tenta extrair username
          const userPatterns = [/USUÁRIO:?\s*([^\s\n]+)/i, /Usuário:?\s*([^\s\n]+)/i];
          for (const pattern of userPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              username = match[1];
              break;
            }
          }
          
          // Tenta extrair password
          const passPatterns = [/SENHA:?\s*([^\s\n]+)/i, /Senha:?\s*([^\s\n]+)/i];
          for (const pattern of passPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              password = match[1];
              break;
            }
          }
          
          // Se encontrou credenciais, salva no banco
          if (username && password && !container.hasAttribute('data-processed')) {
            container.setAttribute('data-processed', 'true'); // Evita processar múltiplas vezes
            
            // Verifica se NÃO está gerando via comando para evitar duplicação
            if (!isGeneratingViaCommand) {
              log('INFO', 'Credenciais detectadas manualmente', { username, password: '***' });
              // Salva no banco de dados
              saveCredentialsToDatabase(username, password);
            } else {
              log('DEBUG', 'Credenciais detectadas mas já salvas via comando', { username });
            }
          }
        }
      });
    }
  });
});

// Inicia o observer
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// ===========================================================================
// FUNÇÕES AUXILIARES
// ===========================================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPageLoad() {
  return new Promise(resolve => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', () => resolve(), { once: true });
    }
  });
}

// ===========================================================================
// FUNÇÃO PARA EDITAR SISTEMA REMOVIDA
// ===========================================================================
// IMPORTANTE: A edição do sistema agora é feita pela aplicação principal
// Esta extensão APENAS gera credenciais e envia para o servidor

// Listener para 'editSystem' removido - extensão não edita mais sistemas

// Notifica que o script está pronto
console.log('✅ Content script pronto e aguardando comandos!');
console.log('🔑 Listener para ESC ativo');
console.log('👁️ Observer para detecção de credenciais ativo');
console.log('🎯 Extensão focada APENAS em geração de credenciais (sem edição de sistema)');