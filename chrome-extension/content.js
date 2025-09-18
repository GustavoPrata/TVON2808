// OnlineOffice IPTV Automator - Content Script
// Versão corrigida - extração funcionando com salvamento no banco e ESC

console.log('👋 OnlineOffice Automator carregado!');

// ===========================================================================
// CONFIGURAÇÃO
// ===========================================================================
const API_BASE = 'https://tv-on.site';

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
// FUNÇÃO PARA MOSTRAR MODAL DE SUCESSO CUSTOMIZADO
// ===========================================================================
function showSuccessModal(username, password) {
  console.log('🎉 Mostrando modal de sucesso com credenciais');
  
  // Remove modal anterior se existir
  const existingModal = document.getElementById('iptv-success-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Cria o modal customizado
  const modalHTML = `
    <div id="iptv-success-modal" class="modal" style="display: block; position: fixed; z-index: 99999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5);">
      <div class="modal-content" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; width: 90%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0; color: #333;">✅ Credencial Gerada com Sucesso!</h3>
          <button id="close-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>Usuário:</strong> <span style="font-family: monospace; background: white; padding: 5px; border-radius: 3px;">${username}</span></p>
          <p style="margin: 5px 0;"><strong>Senha:</strong> <span style="font-family: monospace; background: white; padding: 5px; border-radius: 3px;">${password}</span></p>
        </div>
        
        <div id="save-status" style="padding: 10px; border-radius: 5px; margin-bottom: 15px; background: #d4edda; color: #155724; display: none;">
          <strong>💾 Credenciais salvas no banco de dados!</strong>
        </div>
        
        <div style="display: flex; justify-content: space-between; gap: 10px;">
          <button id="copy-credentials-btn" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">📋 Copiar</button>
          <button id="close-modal-btn2" style="flex: 1; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">Fechar</button>
        </div>
        
        <div style="margin-top: 15px; font-size: 12px; color: #666; text-align: center;">
          Pressione <strong>ESC</strong> para fechar este modal
        </div>
      </div>
    </div>
  `;
  
  // Adiciona o modal ao DOM
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Adiciona listeners aos botões
  const modal = document.getElementById('iptv-success-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const closeBtn2 = document.getElementById('close-modal-btn2');
  const copyBtn = document.getElementById('copy-credentials-btn');
  const saveStatus = document.getElementById('save-status');
  
  // Função para fechar o modal
  const closeModal = () => {
    modal.remove();
    console.log('✅ Modal de sucesso fechado');
  };
  
  // Fechar ao clicar no X
  closeBtn.addEventListener('click', closeModal);
  closeBtn2.addEventListener('click', closeModal);
  
  // Fechar ao clicar fora do modal
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Copiar credenciais
  copyBtn.addEventListener('click', () => {
    const text = `Usuário: ${username}\nSenha: ${password}`;
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✅ Copiado!';
      copyBtn.style.background = '#17a2b8';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copiar';
        copyBtn.style.background = '#28a745';
      }, 2000);
    });
  });
  
  // Salvar no banco de dados
  saveCredentialsToDatabase(username, password).then(success => {
    if (success) {
      saveStatus.style.display = 'block';
    } else {
      saveStatus.style.display = 'block';
      saveStatus.style.background = '#f8d7da';
      saveStatus.style.color = '#721c24';
      saveStatus.innerHTML = '<strong>⚠️ Erro ao salvar no banco de dados</strong>';
    }
  });
  
  return modal;
}

// ===========================================================================
// LISTENER PARA COMANDOS DO BACKGROUND
// ===========================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Comando recebido:', request);
  
  if (request.action === 'generateOne') {
    console.log('🎯 Gerando uma credencial...');
    
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
                        
                        if (line.includes('USUÁRIO') || line.includes('Usuário') || line.includes('usuário')) {
                          // Verifica se tem : na mesma linha
                          if (line.includes(':')) {
                            const parts = line.split(':');
                            if (parts[1]) {
                              username = parts[1].trim();
                            }
                          } else if (i + 1 < lines.length) {
                            // Pega próxima linha
                            username = lines[i + 1].trim();
                          }
                        }
                        
                        if (line.includes('SENHA') || line.includes('Senha') || line.includes('senha')) {
                          if (line.includes(':')) {
                            const parts = line.split(':');
                            if (parts[1]) {
                              password = parts[1].trim();
                            }
                          } else if (i + 1 < lines.length) {
                            password = lines[i + 1].trim();
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
                  
                  // 6. MOSTRAR MODAL DE SUCESSO CUSTOMIZADO E SALVAR NO BANCO
                  setTimeout(() => {
                    showSuccessModal(username, password);
                  }, 1000);
                  
                  // 7. ENVIAR RESPOSTA PARA O BACKGROUND
                  sendResponse({
                    success: true,
                    credentials: {
                      username: username,
                      password: password,
                      timestamp: new Date().toISOString()
                    }
                  });
                  
                } else {
                  console.error('❌ Não conseguiu extrair credenciais');
                  console.log('Username:', username, 'Password:', password);
                  sendResponse({
                    success: false,
                    error: 'Não conseguiu extrair credenciais'
                  });
                }
                
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
            console.log(`📋 Credenciais detectadas: ${username} / ${password}`);
            
            // Salva no banco de dados
            saveCredentialsToDatabase(username, password);
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