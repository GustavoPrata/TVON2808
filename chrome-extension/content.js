// OnlineOffice IPTV Automator - Content Script
// Versão corrigida - extração funcionando

console.log('👋 OnlineOffice Automator carregado!');

// Listener para comandos do background
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
                  
                  // Salva as credenciais
                  chrome.runtime.sendMessage({
                    type: 'credentialsSaved',
                    credentials: {
                      username: username,
                      password: password,
                      timestamp: new Date().toISOString()
                    }
                  });
                  
                  // 5. FECHAR MODAL - clicar fora ou no backdrop
                  setTimeout(() => {
                    console.log('Fechando modal...');
                    
                    // Tenta clicar no backdrop/overlay
                    const backdrop = document.querySelector('.swal2-container, .modal-backdrop, .overlay');
                    if (backdrop) {
                      backdrop.click();
                      console.log('✅ Modal fechado via backdrop');
                    } else {
                      // Tenta pressionar ESC
                      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
                      console.log('✅ Modal fechado via ESC');
                    }
                  }, 1000);
                  
                } else {
                  console.error('❌ Não conseguiu extrair credenciais');
                  console.log('Username:', username, 'Password:', password);
                }
                
              }, 3000);
              
            }, 1500);
            
          } else {
            console.error('❌ Botão Confirmar não encontrado!');
          }
        }, 2000);
        
      } else {
        console.error('❌ Botão Gerar IPTV não encontrado!');
      }
      
    }, 500);
    
    sendResponse({success: true});
    return true;
  }
});

// Notifica que o script está pronto
console.log('✅ Content script pronto e aguardando comandos!');