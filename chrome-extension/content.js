// OnlineOffice IPTV Automator - Content Script
// Versão corrigida - extração funcionando com salvamento no banco e ESC

console.log('👋 OnlineOffice Automator carregado!');

// ===========================================================================
// CONFIGURAÇÃO
// ===========================================================================
// URL do servidor onde o sistema TV ON está rodando
// IMPORTANTE: A extensão roda no OnlineOffice, mas envia dados para nosso servidor
const API_BASE = 'https://tv-on.site';

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

// Notifica que o script está pronto
console.log('✅ Content script pronto e aguardando comandos!');
console.log('🔑 Listener para ESC ativo');
console.log('👁️ Observer para detecção de credenciais ativo');