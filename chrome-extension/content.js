// OnlineOffice IPTV Automator - Content Script
// Versão corrigida - extração funcionando + login automático

console.log('👋 OnlineOffice Automator carregado!');

// ===========================================================================
// FUNÇÃO DE LOGIN AUTOMÁTICO
// ===========================================================================
function checkAndAutoLogin() {
  // Verifica se está na página de login
  const userInput = document.querySelector('input[placeholder="Usuário"]');
  const passInput = document.querySelector('input[placeholder="Senha"][type="password"]');
  const loginButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent === 'Logar' || btn.textContent.includes('Logar')
  );
  
  if (userInput && passInput && loginButton) {
    console.log('🔐 Página de login detectada! Iniciando login automático...');
    
    // Preenche usuário e senha
    userInput.value = 'gustavoprata17';
    userInput.dispatchEvent(new Event('input', { bubbles: true }));
    userInput.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('✅ Usuário preenchido');
    
    passInput.value = 'iptv102030';
    passInput.dispatchEvent(new Event('input', { bubbles: true }));
    passInput.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('✅ Senha preenchida');
    
    // Aguarda um pouco e clica no recaptcha
    setTimeout(() => {
      console.log('🔍 Procurando recaptcha...');
      
      // Função para mostrar onde vamos clicar
      function showClickIndicator(x, y) {
        const indicator = document.createElement('div');
        indicator.style.position = 'fixed';
        indicator.style.left = (x - 15) + 'px';
        indicator.style.top = (y - 15) + 'px';
        indicator.style.width = '30px';
        indicator.style.height = '30px';
        indicator.style.background = 'rgba(255, 0, 0, 0.5)';
        indicator.style.border = '3px solid red';
        indicator.style.borderRadius = '50%';
        indicator.style.zIndex = '999999';
        indicator.style.pointerEvents = 'none';
        document.body.appendChild(indicator);
        console.log(`🎯 Indicador vermelho criado na posição: ${x}, ${y}`);
        
        setTimeout(() => {
          indicator.remove();
        }, 2000);
      }
      
      // Método 1: Usar Tab + Space (simula navegação por teclado)
      function clickRecaptchaWithKeyboard() {
        console.log('⌨️ Tentando método do teclado...');
        
        // Foca no campo de senha
        passInput.focus();
        
        // Simula TAB para ir ao recaptcha
        setTimeout(() => {
          const tabEvent = new KeyboardEvent('keydown', {
            key: 'Tab',
            code: 'Tab',
            keyCode: 9,
            which: 9,
            bubbles: true
          });
          document.activeElement.dispatchEvent(tabEvent);
          
          // Espera e simula SPACE para marcar o checkbox
          setTimeout(() => {
            const spaceEvent = new KeyboardEvent('keydown', {
              key: ' ',
              code: 'Space',
              keyCode: 32,
              which: 32,
              bubbles: true
            });
            document.activeElement.dispatchEvent(spaceEvent);
            
            const spaceUpEvent = new KeyboardEvent('keyup', {
              key: ' ',
              code: 'Space',
              keyCode: 32,
              which: 32,
              bubbles: true
            });
            document.activeElement.dispatchEvent(spaceUpEvent);
            
            console.log('✅ Tab + Space executados!');
          }, 500);
        }, 300);
      }
      
      // Método 2: Clique simulado com coordenadas
      function clickRecaptchaWithCoords() {
        const recaptchaFrame = document.querySelector('iframe[src*="recaptcha"][src*="anchor"]') || 
                              document.querySelector('iframe[src*="recaptcha"]');
        
        if (recaptchaFrame) {
          console.log('🤖 Iframe encontrado, tentando clique...');
          
          const rect = recaptchaFrame.getBoundingClientRect();
          // Clica no canto esquerdo onde está o checkbox
          const x = rect.left + 25;
          const y = rect.top + rect.height / 2;
          
          showClickIndicator(x, y);
          
          // Simula um clique humano com pequeno delay
          setTimeout(() => {
            // Cria evento de clique completo
            const clickEvent = document.createEvent('MouseEvents');
            clickEvent.initMouseEvent(
              'click', 
              true, // bubbles
              true, // cancelable
              window,
              0,
              x, // screenX
              y, // screenY
              x, // clientX
              y, // clientY
              false, // ctrlKey
              false, // altKey
              false, // shiftKey
              false, // metaKey
              0, // button
              null // relatedTarget
            );
            
            // Tenta clicar no elemento na posição
            const element = document.elementFromPoint(x, y);
            if (element) {
              element.dispatchEvent(clickEvent);
              element.click();
              console.log('🎯 Clique enviado para:', element.tagName);
            }
            
            // Também clica diretamente no iframe
            recaptchaFrame.click();
            recaptchaFrame.focus();
            
            console.log('✅ Cliques executados!');
          }, 300);
        }
      }
      
      // Método 3: Procurar div do recaptcha fora do iframe
      function clickRecaptchaDiv() {
        const recaptchaDiv = document.querySelector('.g-recaptcha') || 
                            document.querySelector('[data-sitekey]');
        
        if (recaptchaDiv) {
          console.log('📍 Div do recaptcha encontrada!');
          recaptchaDiv.click();
          
          // Procura qualquer elemento clicável dentro
          const clickableElements = recaptchaDiv.querySelectorAll('*');
          clickableElements.forEach(el => el.click());
        }
      }
      
      // Executa todos os métodos em sequência
      console.log('🚀 Iniciando tentativas de clique no recaptcha...');
      
      // Tenta método de coordenadas primeiro
      clickRecaptchaWithCoords();
      
      // Depois tenta navegação por teclado
      setTimeout(() => {
        clickRecaptchaWithKeyboard();
      }, 1000);
      
      // Por fim, tenta clicar na div
      setTimeout(() => {
        clickRecaptchaDiv();
      }, 2000);
        
      } else {
        // Método 2: Procura o container do recaptcha
        const recaptchaContainer = document.querySelector('.g-recaptcha, [data-sitekey], #g-recaptcha, div[style*="width: 304px"]');
        
        if (recaptchaContainer) {
          console.log('🤖 Container do recaptcha encontrado!');
          const rect = recaptchaContainer.getBoundingClientRect();
          
          // O checkbox geralmente está no início esquerdo do container
          const x = rect.left + 15; // 15px da borda esquerda (centro do checkbox)
          const y = rect.top + rect.height / 2; // Centro vertical
          
          console.log(`📍 Container: left=${rect.left}, top=${rect.top}`);
          console.log(`🎯 Clicando em: ${x}, ${y}`);
          
          showClickIndicator(x, y);
          
          setTimeout(() => {
            const element = document.elementFromPoint(x, y);
            if (element) {
              element.click();
              console.log('✅ Clique no container enviado!');
            }
          }, 500);
          
        } else {
          // Método 3: Procura qualquer elemento com texto "Não sou um robô"
          const allElements = document.querySelectorAll('*');
          let recaptchaElement = null;
          
          for (const el of allElements) {
            if (el.textContent && el.textContent.includes('Não sou um robô')) {
              recaptchaElement = el;
              break;
            }
          }
          
          if (recaptchaElement) {
            console.log('🤖 Elemento com texto do recaptcha encontrado!');
            const rect = recaptchaElement.getBoundingClientRect();
            
            // Clica no início do elemento (onde deve estar o checkbox)
            const x = rect.left - 20; // 20px antes do texto (posição do checkbox)
            const y = rect.top + rect.height / 2;
            
            console.log(`🎯 Clicando próximo ao texto em: ${x}, ${y}`);
            showClickIndicator(x, y);
            
            setTimeout(() => {
              const element = document.elementFromPoint(x, y);
              if (element) {
                element.click();
                console.log('✅ Clique enviado!');
              }
            }, 500);
            
          } else {
            console.log('⚠️ Recaptcha não encontrado!');
            
            // Método 4: Posição fixa baseada no campo de senha
            const senhaRect = passInput.getBoundingClientRect();
            const x = senhaRect.left; // Alinhado com o campo de senha
            const y = senhaRect.bottom + 50; // 50px abaixo do campo de senha
            
            console.log('📏 Usando posição relativa ao campo de senha');
            showClickIndicator(x, y);
            
            setTimeout(() => {
              const element = document.elementFromPoint(x, y);
              if (element) {
                element.click();
                console.log('✅ Clique enviado na posição estimada!');
              }
            }, 500);
          }
        }
      }
      
      // Aguarda verificação do recaptcha e faz login
      setTimeout(() => {
        console.log('🚀 Clicando no botão de login...');
        loginButton.click();
        console.log('✅ Login automático executado!');
      }, 4000); // Aguarda 4 segundos para o recaptcha processar
      
    }, 1500); // Aguarda 1.5 segundos após preencher os campos
  }
}

// Verifica ao carregar a página
setTimeout(checkAndAutoLogin, 1000);

// Verifica periodicamente se voltou para a página de login
setInterval(checkAndAutoLogin, 5000);

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
                    
                    // Envia resposta com as credenciais
                    sendResponse({
                      success: true,
                      credentials: {
                        username: username,
                        password: password,
                        timestamp: new Date().toISOString()
                      }
                    });
                  }, 1000);
                  
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
          }
        }, 2000);
        
      } else {
        console.error('❌ Botão Gerar IPTV não encontrado!');
      }
      
    }, 500);
    
    // Retorna true para indicar que a resposta será enviada assincronamente
    return true;
  }
});

// Notifica que o script está pronto
console.log('✅ Content script pronto e aguardando comandos!');
console.log('🔐 Login automático ativado para gustavoprata17');