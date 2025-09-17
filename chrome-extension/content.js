// OnlineOffice IPTV Automator - Content Script
// Versão simplificada - foco em funcionalidade

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
                
                // Procura inputs readonly com as credenciais
                const inputs = document.querySelectorAll('input[readonly]');
                let username = null;
                let password = null;
                
                if (inputs.length >= 2) {
                  username = inputs[0].value;
                  password = inputs[1].value;
                  console.log('📋 Credenciais encontradas:', {username, password});
                }
                
                // Se não achou nos inputs, tenta no texto
                if (!username || !password) {
                  const modalContent = document.querySelector('.swal2-content, .modal-body, [role="dialog"]');
                  if (modalContent) {
                    const text = modalContent.innerText;
                    const userMatch = text.match(/usu[áa]rio:?\s*([^\s\n]+)/i);
                    const passMatch = text.match(/senha:?\s*([^\s\n]+)/i);
                    
                    if (userMatch) username = userMatch[1];
                    if (passMatch) password = passMatch[1];
                  }
                }
                
                if (username && password) {
                  console.log('✅ Credenciais extraídas com sucesso!');
                  
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