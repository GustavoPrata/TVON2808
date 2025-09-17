// OnlineOffice IPTV Automator - Content Script
// Versão simplificada - foco em funcionalidade

console.log('👋 OnlineOffice Automator carregado!');

// Listener para comandos do background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Comando recebido:', request.action);
  
  if (request.action === 'generateOne') {
    console.log('🎯 Iniciando geração de credencial...');
    performGeneration()
      .then(result => {
        console.log('✅ Geração concluída:', result);
        sendResponse({success: true, credentials: result});
      })
      .catch(error => {
        console.error('❌ Erro na geração:', error);
        sendResponse({success: false, error: error.message});
      });
    return true; // resposta assíncrona
  }
});

// Função principal de geração
async function performGeneration() {
  try {
    // Passo 1: Clicar em "Gerar IPTV"
    console.log('Passo 1: Procurando botão Gerar IPTV...');
    const btnGerar = await findButtonByText('Gerar IPTV');
    if (!btnGerar) throw new Error('Botão Gerar IPTV não encontrado');
    
    btnGerar.click();
    console.log('✅ Clicou em Gerar IPTV');
    
    // Passo 2: Aguardar e clicar no primeiro Confirmar
    await sleep(1500);
    console.log('Passo 2: Procurando primeiro Confirmar...');
    const btnConfirmar1 = await findButtonByText('Confirmar');
    if (!btnConfirmar1) throw new Error('Primeiro Confirmar não encontrado');
    
    btnConfirmar1.click();
    console.log('✅ Clicou no primeiro Confirmar');
    
    // Passo 3: Aguardar e clicar no segundo Confirmar
    await sleep(1500);
    console.log('Passo 3: Procurando segundo Confirmar...');
    const btnConfirmar2 = await findButtonByText('Confirmar');
    if (!btnConfirmar2) throw new Error('Segundo Confirmar não encontrado');
    
    btnConfirmar2.click();
    console.log('✅ Clicou no segundo Confirmar');
    
    // Passo 4: Aguardar modal com credenciais
    await sleep(3000);
    console.log('Passo 4: Extraindo credenciais...');
    
    // Procurar por texto de usuário e senha
    const modalText = document.body.innerText;
    const credentials = extractCredentials(modalText);
    
    if (!credentials) throw new Error('Não conseguiu extrair credenciais');
    
    console.log('✅ Credenciais extraídas:', credentials);
    
    // Passo 5: Fechar modal
    await closeModal();
    console.log('✅ Modal fechado');
    
    return credentials;
    
  } catch (error) {
    console.error('Erro durante geração:', error);
    // Tentar fechar modal em caso de erro
    await closeModal().catch(() => {});
    throw error;
  }
}

// Função para encontrar botão por texto
function findButtonByText(text) {
  return new Promise((resolve) => {
    // Tenta várias formas de encontrar o botão
    let button = null;
    
    // Método 1: querySelector direto
    button = document.querySelector(`button:contains("${text}")`);
    
    // Método 2: Buscar em todos os botões
    if (!button) {
      const buttons = Array.from(document.querySelectorAll('button'));
      button = buttons.find(btn => 
        btn.textContent.includes(text) || 
        btn.innerText?.includes(text)
      );
    }
    
    // Método 3: Buscar em elementos com role="button"
    if (!button) {
      const roleButtons = Array.from(document.querySelectorAll('[role="button"]'));
      button = roleButtons.find(btn => 
        btn.textContent.includes(text) || 
        btn.innerText?.includes(text)
      );
    }
    
    resolve(button);
  });
}

// Função para extrair credenciais do texto
function extractCredentials(text) {
  try {
    let username = null;
    let password = null;
    
    // Divide o texto em linhas
    const lines = text.split(/\n|\r/);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Procura por USUÁRIO
      if (line.includes('USUÁRIO') || line.includes('Usuario') || line.includes('usuário')) {
        // Verifica se tem : na mesma linha
        if (line.includes(':')) {
          const parts = line.split(':');
          if (parts[1]) {
            username = parts[1].trim();
          }
        } else if (i + 1 < lines.length) {
          // Pega próxima linha
          const nextLine = lines[i + 1].trim();
          if (nextLine && !nextLine.includes(':')) {
            username = nextLine;
          }
        }
      }
      
      // Procura por SENHA
      if (line.includes('SENHA') || line.includes('Senha') || line.includes('senha')) {
        // Verifica se tem : na mesma linha
        if (line.includes(':')) {
          const parts = line.split(':');
          if (parts[1]) {
            password = parts[1].trim();
          }
        } else if (i + 1 < lines.length) {
          // Pega próxima linha
          const nextLine = lines[i + 1].trim();
          if (nextLine && !nextLine.includes(':')) {
            password = nextLine;
          }
        }
      }
    }
    
    // Tenta método alternativo com regex
    if (!username || !password) {
      const userMatch = text.match(/USU[AÁ]RIO:?\s*([^\s\n]+)/i);
      const passMatch = text.match(/SENHA:?\s*([^\s\n]+)/i);
      
      if (userMatch) username = userMatch[1];
      if (passMatch) password = passMatch[1];
    }
    
    if (username && password) {
      return {
        username: username,
        password: password,
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao extrair credenciais:', error);
    return null;
  }
}

// Função para fechar modal
async function closeModal() {
  try {
    // Tenta várias formas de fechar o modal
    
    // Método 1: Clicar no backdrop
    const backdrop = document.querySelector('.modal-backdrop, .swal2-container, [role="dialog"]');
    if (backdrop) {
      backdrop.click();
      return;
    }
    
    // Método 2: Clicar no botão de fechar
    const closeBtn = document.querySelector('[aria-label="Close"], .close, .modal-close');
    if (closeBtn) {
      closeBtn.click();
      return;
    }
    
    // Método 3: Pressionar ESC
    const escEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      bubbles: true
    });
    document.dispatchEvent(escEvent);
    
    // Método 4: Clicar fora
    document.body.click();
    
  } catch (error) {
    console.log('Não conseguiu fechar modal:', error);
  }
}

// Função auxiliar para aguardar
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Notifica que o script está pronto
chrome.runtime.sendMessage({
  type: 'contentScriptReady',
  url: window.location.href
}).catch(() => {});