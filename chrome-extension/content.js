// OnlineOffice IPTV Automator - Content Script
// Versão corrigida - extração funcionando com salvamento no banco e ESC

console.log('👋 OnlineOffice Automator carregado!');

// ===========================================================================
// CONFIGURAÇÃO
// ===========================================================================
// URL do servidor onde o sistema TV ON está rodando
// IMPORTANTE: A extensão roda no OnlineOffice, mas envia dados para nosso servidor
// Função para determinar a URL do servidor dinamicamente
async function getApiBase() {
  // Primeiro, verifica se há uma configuração salva no storage
  const stored = await chrome.storage.local.get('apiBase');
  if (stored.apiBase) {
    console.log(`📍 Usando API configurada: ${stored.apiBase}`);
    return stored.apiBase;
  }
  
  // Lista de servidores possíveis em ordem de prioridade
  const servers = [
    'http://localhost:5000',           // Desenvolvimento local
    'http://127.0.0.1:5000',          // Desenvolvimento local alternativo
    'https://tv-on.site'               // Produção
  ];
  
  // Tenta cada servidor para ver qual está disponível
  for (const server of servers) {
    try {
      console.log(`🔍 Testando servidor: ${server}`);
      const response = await fetch(`${server}/api`, {
        method: 'HEAD',
        mode: 'cors'
      }).catch(() => null);
      
      if (response && response.ok) {
        console.log(`✅ Servidor disponível: ${server}`);
        // Salva o servidor funcional no storage
        await chrome.storage.local.set({ apiBase: server });
        return server;
      }
    } catch (e) {
      console.log(`❌ Servidor não disponível: ${server}`);
    }
  }
  
  // Se nenhum servidor responder, usa o padrão de produção
  console.warn('⚠️ Nenhum servidor respondeu, usando produção como fallback');
  return 'https://tv-on.site';
}

// Variável global para armazenar a URL do API
let API_BASE = null;

// Inicializa API_BASE assim que o script carregar
(async () => {
  API_BASE = await getApiBase();
  console.log(`🔗 Content Script - Servidor API configurado: ${API_BASE}`);
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
  console.log('💾 Salvando credenciais no banco de dados...');
  
  // Garante que API_BASE está definido
  if (!API_BASE) {
    API_BASE = await getApiBase();
    console.log(`🔗 API re-configurada: ${API_BASE}`);
  }
  
  console.log(`📤 Enviando para: ${API_BASE}/api/office/automation/task-complete`);
  
  try {
    const response = await fetch(`${API_BASE}/api/office/automation/task-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': 'chrome-extension-secret-2024'
      },
      body: JSON.stringify({
        type: 'manual_generation',
        credentials: {
          username: username,
          password: password
        },
        timestamp: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Credenciais salvas no banco com sucesso:', data);
      return true;
    } else {
      console.error('❌ Erro ao salvar credenciais. Status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao salvar credenciais no banco:', error);
    return false;
  }
}


// ===========================================================================
// LISTENER PARA COMANDOS DO BACKGROUND
// ===========================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Comando recebido:', request);
  
  if (request.action === 'generateOne') {
    console.log('🎯 Gerando uma credencial...');
    
    // Define flag para evitar duplicação
    isGeneratingViaCommand = true;
    
    // SEQUÊNCIA CORRETA DE CLIQUES
    setTimeout(() => {
      // 1. CLICAR NO BOTÃO "GERAR IPTV"
      console.log('Procurando botão Gerar IPTV...');
      let btnGerar = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent.includes('Gerar IPTV')
      );
      
      if (btnGerar) {
        console.log('✅ Botão Gerar IPTV encontrado!');
        btnGerar.click();
        
        // 2. AGUARDAR E CLICAR EM "CONFIRMAR" NO MODAL
        setTimeout(() => {
          console.log('Procurando botão Confirmar...');
          let btnConfirmar = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent === 'Confirmar' || btn.textContent.includes('Confirmar')
          );
          
          if (btnConfirmar) {
            console.log('✅ Botão Confirmar encontrado!');
            btnConfirmar.click();
            
            // 3. AGUARDAR SEGUNDO "CONFIRMAR" (SE HOUVER)
            setTimeout(() => {
              let btnConfirmar2 = Array.from(document.querySelectorAll('button')).find(btn => 
                btn.textContent === 'Confirmar'
              );
              
              if (btnConfirmar2) {
                console.log('✅ Segundo Confirmar encontrado, clicando...');
                btnConfirmar2.click();
              }
              
              // 4. AGUARDAR E EXTRAIR CREDENCIAIS
              setTimeout(() => {
                console.log('Aguardando modal de credenciais aparecer...');
                
                // Aguarda mais tempo para o modal de credenciais aparecer
                setTimeout(() => {
                  console.log('Extraindo credenciais...');
                  
                  let username = null;
                  let password = null;
                
                // Método 1: Procura inputs readonly com as credenciais
                const inputs = document.querySelectorAll('input[readonly], input[type="text"]');
                console.log(`Encontrou ${inputs.length} inputs na página`);
                
                // Tenta extrair dos inputs
                inputs.forEach((input, index) => {
                  const value = input.value;
                  console.log(`Input ${index}: ${value}`);
                  
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
                  console.log('Tentando extrair do texto do modal...');
                  
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
                      console.log(`Modal encontrado com selector: ${selector}`);
                      break;
                    }
                  }
                  
                  if (modalContent) {
                    const text = modalContent.innerText || modalContent.textContent;
                    console.log('Texto do modal:', text);
                    
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
                            console.log(`✓ Usuário detectado: ${username}`);
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
                            console.log(`✓ Senha detectada: ${password}`);
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
                  console.log('✅ Credenciais extraídas com sucesso!');
                  console.log(`📋 Usuário: ${username}, Senha: ${password}`);
                  
                  // 5. FECHAR MODAL ORIGINAL DO SITE
                  setTimeout(() => {
                    console.log('Fechando modal original do site...');
                    
                    // Tenta clicar no backdrop/overlay
                    const backdrop = document.querySelector('.swal2-container, .modal-backdrop, .overlay');
                    if (backdrop) {
                      backdrop.click();
                      console.log('✅ Modal original fechado via backdrop');
                    }
                    
                    // Tenta clicar no botão OK ou Fechar
                    const okButton = Array.from(document.querySelectorAll('button')).find(btn => 
                      btn.textContent === 'OK' || btn.textContent === 'Ok' || btn.textContent === 'Fechar'
                    );
                    if (okButton) {
                      okButton.click();
                      console.log('✅ Modal original fechado via botão OK');
                    }
                  }, 500);
                  
                  // 6. NÃO SALVAR AQUI - será salvo pelo background via task-complete
                  console.log('📦 Credenciais extraídas, enviando para o background processar...');
                  
                  // 7. ENVIAR RESPOSTA PARA O BACKGROUND (que salvará via task-complete)
                  sendResponse({
                    success: true,
                    credentials: {
                      username: username,
                      password: password,
                      timestamp: new Date().toISOString()
                    }
                  });
                  
                  // Reset flag após processar
                  setTimeout(() => {
                    isGeneratingViaCommand = false;
                    console.log('🔄 Flag resetada');
                  }, 2000);
                  
                } else {
                  console.error('❌ Não conseguiu extrair credenciais');
                  console.log('Username:', username, 'Password:', password);
                  sendResponse({
                    success: false,
                    error: 'Não conseguiu extrair credenciais'
                  });
                }
                
                }, 2000); // Fecha o setTimeout adicional para aguardar modal
                
              }, 3000);
              
            }, 1500);
            
          } else {
            console.error('❌ Botão Confirmar não encontrado!');
            sendResponse({
              success: false,
              error: 'Botão Confirmar não encontrado'
            });
          }
        }, 2000);
        
      } else {
        console.error('❌ Botão Gerar IPTV não encontrado!');
        sendResponse({
          success: false,
          error: 'Botão Gerar IPTV não encontrado'
        });
      }
      
    }, 500);
    
    // Retorna true para indicar que a resposta será enviada assincronamente
    return true;
  }
});

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
          
          console.log('🔍 Detectado modal com credenciais!');
          
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
              console.log(`📋 Credenciais detectadas manualmente: ${username} / ${password}`);
              // Salva no banco de dados
              saveCredentialsToDatabase(username, password);
            } else {
              console.log(`⚠️ Credenciais detectadas mas já salvas via comando: ${username}`);
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
// FUNÇÃO PARA EDITAR SISTEMA - REMOVIDA
// ===========================================================================
// A extensão não deve editar sistemas no OnlineOffice.
// Ela apenas gera credenciais. A edição é feita no aplicativo.
/*
async function editSystem(sistemaId, username, password) {
  console.log('📝 Função de edição desativada - não é função da extensão');
  return { success: false, error: 'Edição de sistemas não é suportada pela extensão' };
}
*/

// Função stub para compatibilidade
async function editSystem(sistemaId, username, password) {
  console.log('⚠️ Tentativa de editar sistema ignorada - função desativada');
  return { success: false, error: 'Função de edição desativada' };
    
    // Aguardar página carregar completamente
    await waitForPageLoad();
    console.log('✅ Página de edição carregada');
    await sleep(2000); // Aguarda elementos carregarem
    
    // Preencher campos de username e password
    console.log('🔍 Procurando campos de edição...');
    
    // Tenta diferentes seletores para o campo de username
    let usernameField = document.querySelector('input[name="username"]') ||
                        document.querySelector('input[name="user"]') ||
                        document.querySelector('input[name="usuario"]') ||
                        document.querySelector('#username') ||
                        document.querySelector('input[type="text"][placeholder*="usuário" i]');
    
    // Tenta diferentes seletores para o campo de password
    let passwordField = document.querySelector('input[name="password"]') ||
                        document.querySelector('input[name="senha"]') ||
                        document.querySelector('input[name="pass"]') ||
                        document.querySelector('#password') ||
                        document.querySelector('input[type="password"]') ||
                        document.querySelector('input[type="text"][placeholder*="senha" i]');
    
    if (!usernameField || !passwordField) {
      console.error('❌ Campos não encontrados. Username:', !!usernameField, 'Password:', !!passwordField);
      
      // Tenta buscar por labels para encontrar os campos
      const labels = document.querySelectorAll('label');
      labels.forEach(label => {
        const text = label.textContent.toLowerCase();
        if ((text.includes('usuário') || text.includes('username') || text.includes('user')) && !usernameField) {
          const input = label.parentElement.querySelector('input') || 
                       label.nextElementSibling || 
                       document.querySelector(`#${label.getAttribute('for')}`);
          if (input) usernameField = input;
        }
        if ((text.includes('senha') || text.includes('password') || text.includes('pass')) && !passwordField) {
          const input = label.parentElement.querySelector('input') || 
                       label.nextElementSibling || 
                       document.querySelector(`#${label.getAttribute('for')}`);
          if (input) passwordField = input;
        }
      });
      
      if (!usernameField || !passwordField) {
        throw new Error(`Campos de edição não encontrados. Username: ${!!usernameField}, Password: ${!!passwordField}`);
      }
    }
    
    console.log('✅ Campos encontrados, preenchendo valores...');
    
    // Limpar e preencher os campos
    usernameField.value = '';
    usernameField.value = username;
    usernameField.dispatchEvent(new Event('input', { bubbles: true }));
    usernameField.dispatchEvent(new Event('change', { bubbles: true }));
    console.log(`✓ Username preenchido: ${username}`);
    
    passwordField.value = '';
    passwordField.value = password;
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    console.log(`✓ Password preenchido: ${password}`);
    
    await sleep(500); // Aguarda campos serem processados
    
    // Procurar botão de salvar
    console.log('🔍 Procurando botão de salvar...');
    let saveButton = document.querySelector('button[type="submit"]') ||
                     document.querySelector('input[type="submit"]') ||
                     document.querySelector('button[name="save"]') ||
                     document.querySelector('button[name="salvar"]') ||
                     Array.from(document.querySelectorAll('button')).find(btn => 
                       btn.textContent.toLowerCase().includes('salvar') || 
                       btn.textContent.toLowerCase().includes('save') ||
                       btn.textContent.toLowerCase().includes('atualizar') ||
                       btn.textContent.toLowerCase().includes('update')
                     );
    
    if (!saveButton) {
      console.error('❌ Botão de salvar não encontrado');
      throw new Error('Botão de salvar não encontrado');
    }
    
    console.log('✅ Botão de salvar encontrado, clicando...');
    saveButton.click();
    
    // Aguardar resposta do servidor
    console.log('⏳ Aguardando confirmação...');
    await sleep(3000);
    
    // Verificar se houve sucesso
    const successIndicators = [
      '.alert-success',
      '.success',
      '.alert.alert-success',
      '.swal2-success',
      '[class*="success"]'
    ];
    
    let successFound = false;
    for (const selector of successIndicators) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) { // Verifica se está visível
        successFound = true;
        console.log(`✅ Indicador de sucesso encontrado: ${selector}`);
        break;
      }
    }
    
    // Se não encontrou indicador de sucesso, verifica se voltou para a página de listagem
    if (!successFound) {
      const currentUrl = window.location.href;
      if (currentUrl.includes('index.php') || currentUrl.includes('list') || currentUrl.includes('sistemas')) {
        console.log('✅ Redirecionado para listagem - edição provavelmente bem-sucedida');
        successFound = true;
      }
    }
    
    // Verifica se houve erro
    const errorIndicators = [
      '.alert-danger',
      '.error',
      '.alert.alert-danger',
      '.swal2-error',
      '[class*="error"]',
      '[class*="danger"]'
    ];
    
    for (const selector of errorIndicators) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        const errorText = element.textContent || '';
        console.error(`❌ Erro detectado: ${errorText}`);
        throw new Error(`Erro ao salvar: ${errorText}`);
      }
    }
    
    if (successFound) {
      console.log('✅ Sistema editado com sucesso', { sistemaId, username });
      return { success: true, sistemaId, username, password };
    } else {
      console.warn('⚠️ Não foi possível confirmar o sucesso da edição, mas não houve erro');
      return { success: true, sistemaId, username, password, warning: 'Confirmação não encontrada' };
    }
    
  } catch (error) {
    console.error('❌ Erro ao editar sistema', { 
      sistemaId, 
      username,
      error: error.message,
      stack: error.stack
    });
    return { 
      success: false, 
      sistemaId,
      error: error.message 
    };
  }
}

// Listener para comandos de edição do background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'editSystem') {
    console.log('📨 Comando de edição recebido:', request);
    
    editSystem(request.sistemaId, request.username, request.password)
      .then(result => {
        console.log('📤 Enviando resultado da edição:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('❌ Erro na edição:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    
    // Retorna true para indicar resposta assíncrona
    return true;
  }
});

// Notifica que o script está pronto
console.log('✅ Content script pronto e aguardando comandos!');
console.log('🔑 Listener para ESC ativo');
console.log('👁️ Observer para detecção de credenciais ativo');
console.log('📝 Função de edição de sistema disponível');