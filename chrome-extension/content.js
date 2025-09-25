// OnlineOffice IPTV Automator - Content Script
// Versão corrigida com múltiplos seletores e debug avançado

console.log('👋 OnlineOffice Automator carregado! - VERSÃO DEBUG AVANÇADO');
console.log('📍 URL Atual:', window.location.href);
console.log('📄 Título da página:', document.title);

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
// FUNÇÕES DE DEBUG AVANÇADO
// ===========================================================================
function debugPageElements() {
  console.log('🔍 === INICIANDO DEBUG DETALHADO DA PÁGINA ===');
  
  // 1. URL e título
  console.log(`📍 URL: ${window.location.href}`);
  console.log(`📄 Título: ${document.title}`);
  
  // 2. Todos os botões
  const buttons = document.querySelectorAll('button, [type="button"], .btn, [role="button"], a.button, .v-btn');
  console.log(`🔘 Total de botões encontrados: ${buttons.length}`);
  buttons.forEach((btn, index) => {
    const text = (btn.innerText || btn.textContent || btn.value || '').trim();
    const classes = btn.className;
    const id = btn.id;
    const onclick = btn.onclick ? 'sim' : 'não';
    const href = btn.href || '';
    if (text) {
      console.log(`  Botão ${index}: "${text}" | Classes: ${classes} | ID: ${id} | OnClick: ${onclick} | Href: ${href}`);
    }
  });
  
  // 3. Links importantes
  const links = document.querySelectorAll('a');
  const actionLinks = [];
  links.forEach(link => {
    const text = (link.innerText || link.textContent || '').toLowerCase();
    if (text.includes('criar') || text.includes('adicionar') || text.includes('novo') || 
        text.includes('gerar') || text.includes('user') || text.includes('usuário') ||
        text.includes('iptv') || text.includes('teste') || text.includes('add')) {
      actionLinks.push({
        text: link.innerText || link.textContent,
        href: link.href,
        classes: link.className
      });
    }
  });
  if (actionLinks.length > 0) {
    console.log(`🔗 Links de ação encontrados:`);
    actionLinks.forEach(link => {
      console.log(`  - "${link.text}" -> ${link.href}`);
    });
  }
  
  // 4. Ícones clicáveis
  const icons = document.querySelectorAll('i[class*="fa-plus"], i[class*="fa-add"], svg, .material-icons, .mdi');
  console.log(`🎨 Ícones encontrados: ${icons.length}`);
  icons.forEach((icon, index) => {
    const parent = icon.parentElement;
    if (parent && (parent.tagName === 'BUTTON' || parent.tagName === 'A')) {
      console.log(`  Ícone ${index}: ${icon.className} em ${parent.tagName}`);
    }
  });
  
  // 5. Inputs visíveis
  const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
  console.log(`📝 Inputs encontrados: ${inputs.length}`);
  inputs.forEach(input => {
    const name = input.name || input.id || '';
    const placeholder = input.placeholder || '';
    const value = input.value || '';
    if (name || placeholder) {
      console.log(`  - ${input.type}: "${name}" placeholder="${placeholder}" value="${value}"`);
    }
  });
  
  // 6. Modais e dialogs
  const modals = document.querySelectorAll('.modal, .swal2-container, [role="dialog"], .v-dialog, .dialog');
  console.log(`💬 Modais/Dialogs encontrados: ${modals.length}`);
  modals.forEach((modal, index) => {
    const isVisible = modal.style.display !== 'none' && !modal.classList.contains('hidden');
    if (isVisible) {
      console.log(`  Modal ${index} está VISÍVEL`);
      const modalText = (modal.innerText || modal.textContent || '').substring(0, 200);
      console.log(`  Texto: ${modalText}...`);
    }
  });
  
  console.log('🔍 === FIM DO DEBUG ===');
}

function findButtonByMultipleSelectors() {
  console.log('🔎 Procurando botão para gerar credenciais...');
  
  // Lista expandida de possíveis textos
  const possibleTexts = [
    'Gerar IPTV', 'Gerar', 'Criar', 'Adicionar', 'Novo', 'New', 'Add',
    'Criar Usuário', 'Novo Usuário', 'Add User', 'Create User',
    'Gerar Credencial', 'Gerar Usuario', 'Generate', 'Create',
    'Adicionar IPTV', 'Nova Conta', 'Criar Conta', 'Teste Grátis',
    'Criar Teste', 'Gerar Teste', 'Test', 'Trial', '+'
  ];
  
  // Procura por texto
  for (const text of possibleTexts) {
    const elements = document.querySelectorAll('button, a, [role="button"], .btn, .v-btn');
    const button = Array.from(elements).find(el => {
      const elText = (el.innerText || el.textContent || '').trim();
      return elText.toLowerCase().includes(text.toLowerCase());
    });
    
    if (button) {
      console.log(`✅ Botão encontrado por texto: "${text}"`);
      return button;
    }
  }
  
  // Procura por ícones
  const iconButtons = document.querySelectorAll('[class*="add"], [class*="plus"], [class*="create"], .fa-plus, .mdi-plus');
  if (iconButtons.length > 0) {
    console.log(`🎨 Encontrados ${iconButtons.length} botões com ícones`);
    for (const btn of iconButtons) {
      if (btn.tagName === 'BUTTON' || btn.parentElement?.tagName === 'BUTTON') {
        return btn.tagName === 'BUTTON' ? btn : btn.parentElement;
      }
    }
  }
  
  // Procura por atributos
  const attrButtons = document.querySelectorAll('[data-action*="create"], [data-action*="add"], [ng-click*="create"], [ng-click*="add"], [onclick*="criar"], [onclick*="gerar"]');
  if (attrButtons.length > 0) {
    console.log(`🔍 Encontrados ${attrButtons.length} botões por atributos`);
    return attrButtons[0];
  }
  
  console.log('❌ Nenhum botão de gerar encontrado');
  return null;
}

function findCredentialsInPage() {
  console.log('🔍 Procurando credenciais na página...');
  
  let username = null;
  let password = null;
  
  // Método 1: Inputs com valores
  const inputs = document.querySelectorAll('input[type="text"], input[readonly], input[type="password"], input:not([type="hidden"])');
  console.log(`📝 ${inputs.length} inputs encontrados`);
  
  const credentialInputs = [];
  inputs.forEach((input, index) => {
    const value = input.value?.trim();
    if (value && value.length > 3) {
      const name = input.name || input.id || '';
      const placeholder = input.placeholder || '';
      const isReadonly = input.readOnly;
      
      console.log(`  Input ${index}: valor="${value}" name="${name}" readonly=${isReadonly}`);
      credentialInputs.push({ value, name, placeholder, isReadonly });
      
      // Heurística para identificar
      if (!username && (name.includes('user') || name.includes('login') || 
          placeholder.includes('usuário') || isReadonly)) {
        username = value;
        console.log(`    ✓ Identificado como USUÁRIO`);
      } else if (!password && (name.includes('pass') || name.includes('senha') || 
                placeholder.includes('senha'))) {
        password = value;
        console.log(`    ✓ Identificado como SENHA`);
      }
    }
  });
  
  // Se não identificou, usa os primeiros dois com valor
  if (!username && credentialInputs.length > 0) {
    username = credentialInputs[0].value;
    console.log(`  ✓ Assumindo primeiro input como USUÁRIO: ${username}`);
  }
  if (!password && credentialInputs.length > 1) {
    password = credentialInputs[1].value;
    console.log(`  ✓ Assumindo segundo input como SENHA: ${password}`);
  }
  
  // Método 2: Texto em modais
  if (!username || !password) {
    console.log('📄 Procurando em modais...');
    
    const modalSelectors = [
      '.swal2-container', '.modal-body', '.modal-content',
      '[role="dialog"]', '.v-dialog', '.alert'
    ];
    
    for (const selector of modalSelectors) {
      const modals = document.querySelectorAll(selector);
      for (const modal of modals) {
        const text = modal.innerText || modal.textContent || '';
        if (text.length > 10) {
          console.log(`  Modal (${selector}): ${text.substring(0, 100)}...`);
          
          const extracted = extractCredentialsFromText(text);
          if (extracted.username) {
            username = extracted.username;
            console.log(`    ✓ Usuário extraído: ${username}`);
          }
          if (extracted.password) {
            password = extracted.password;
            console.log(`    ✓ Senha extraída: ${password}`);
          }
          
          if (username && password) break;
        }
      }
      if (username && password) break;
    }
  }
  
  // Método 3: Tabelas
  if (!username || !password) {
    console.log('📊 Procurando em tabelas...');
    
    const cells = document.querySelectorAll('td, th');
    for (let i = 0; i < cells.length - 1; i++) {
      const cellText = (cells[i].innerText || '').toLowerCase();
      const nextCell = cells[i + 1];
      const nextText = nextCell?.innerText || '';
      
      if ((cellText.includes('usuário') || cellText.includes('user') || cellText.includes('login')) && nextText) {
        username = nextText.trim();
        console.log(`  ✓ Usuário em tabela: ${username}`);
      }
      if ((cellText.includes('senha') || cellText.includes('pass')) && nextText) {
        password = nextText.trim();
        console.log(`  ✓ Senha em tabela: ${password}`);
      }
    }
  }
  
  return { username, password };
}

function extractCredentialsFromText(text) {
  let username = null;
  let password = null;
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';
    
    // Padrões de labels
    if (line.match(/USU[ÁA]RIO|USER|LOGIN/i) && nextLine && !nextLine.match(/SENHA|PASS|VENCIMENTO/i)) {
      username = nextLine;
    }
    if (line.match(/SENHA|PASS|PASSWORD/i) && nextLine && !nextLine.match(/USU[ÁA]RIO|USER|VENCIMENTO/i)) {
      password = nextLine;
    }
    
    // Padrão chave:valor
    const colonMatch = line.match(/^(USU[ÁA]RIO|USER|LOGIN|SENHA|PASS|PASSWORD):?\s*(.+)$/i);
    if (colonMatch) {
      const key = colonMatch[1].toLowerCase();
      const value = colonMatch[2].trim();
      
      if (key.includes('usu') || key.includes('user') || key.includes('login')) {
        username = value;
      } else if (key.includes('senha') || key.includes('pass')) {
        password = value;
      }
    }
  }
  
  return { username, password };
}

// ===========================================================================
// LISTENER PARA COMANDOS DO BACKGROUND
// ===========================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Comando recebido:', request);
  
  if (request.action === 'generateOne') {
    console.log('🎯 === INICIANDO GERAÇÃO DE CREDENCIAIS ===');
    
    // Define flag para evitar duplicação
    isGeneratingViaCommand = true;
    
    // Debug inicial da página
    debugPageElements();
    
    // Estratégia adaptativa de geração
    setTimeout(async () => {
      try {
        // 1. Tenta encontrar botão de gerar
        console.log('🔍 Etapa 1: Procurando botão de gerar...');
        let btnGerar = findButtonByMultipleSelectors();
        
        if (btnGerar) {
          console.log(`✅ Botão encontrado! Clicando...`);
          btnGerar.click();
        
          // 2. Aguarda e procura confirmação
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          console.log('🔍 Etapa 2: Procurando botão de confirmação...');
          const confirmTexts = ['Confirmar', 'OK', 'Sim', 'Yes', 'Continuar', 'Prosseguir'];
          let btnConfirmar = null;
          
          for (const text of confirmTexts) {
            btnConfirmar = Array.from(document.querySelectorAll('button, a')).find(btn => {
              const btnText = (btn.innerText || btn.textContent || '').toLowerCase();
              return btnText === text.toLowerCase() || btnText.includes(text.toLowerCase());
            });
            if (btnConfirmar) break;
          }
          
          if (btnConfirmar) {
            console.log(`✅ Botão de confirmação encontrado! Clicando...`);
            btnConfirmar.click();
            
            // 3. Aguarda possível segunda confirmação
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const btnConfirmar2 = Array.from(document.querySelectorAll('button')).find(btn => {
              const text = (btn.innerText || btn.textContent || '').toLowerCase();
              return confirmTexts.some(t => text.includes(t.toLowerCase()));
            });
            
            if (btnConfirmar2) {
              console.log('✅ Segunda confirmação encontrada, clicando...');
              btnConfirmar2.click();
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          // 4. Aguardar e tentar extrair credenciais
          console.log('🔍 Etapa 3: Aguardando credenciais...');
          
          let attempts = 0;
          let credentials = null;
          
          while (attempts < 5 && (!credentials || !credentials.username || !credentials.password)) {
            attempts++;
            console.log(`  Tentativa ${attempts}/5...`);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Debug a cada tentativa
            if (attempts === 2 || attempts === 4) {
              debugPageElements();
            }
            
            credentials = findCredentialsInPage();
            
            if (credentials && credentials.username && credentials.password) {
              console.log('✅ Credenciais capturadas com sucesso!');
              break;
            }
          }
          
          // 5. Processar resultado
          if (credentials && credentials.username && credentials.password) {
            console.log(`📋 Credenciais extraídas: ${credentials.username} / ${credentials.password}`);
            
            // Fechar modal se houver
            await new Promise(resolve => setTimeout(resolve, 500));
            const closeSelectors = ['.swal2-container', '.modal-backdrop', '.overlay', 'button.close'];
            closeSelectors.forEach(selector => {
              const element = document.querySelector(selector);
              if (element) {
                element.click();
                console.log(`✅ Modal fechado: ${selector}`);
              }
            });
            
            // Enviar resposta de sucesso
            sendResponse({
              success: true,
              credentials: {
                username: credentials.username,
                password: credentials.password,
                timestamp: new Date().toISOString()
              }
            });
            
            isGeneratingViaCommand = false;
            console.log('✅ === GERAÇÃO CONCLUÍDA COM SUCESSO ===');
          } else {
            // Se não encontrou credenciais
            console.error('❌ Não foi possível capturar credenciais');
            
            const pageDebug = {
              url: window.location.href,
              title: document.title,
              buttonsFound: document.querySelectorAll('button').length,
              inputsFound: document.querySelectorAll('input').length,
              modalsFound: document.querySelectorAll('.modal, [role="dialog"], .swal2-container').length,
              visibleText: document.body.innerText.substring(0, 500)
            };
            
            sendResponse({
              success: false,
              error: 'Não foi possível capturar credenciais válidas do OnlineOffice',
              debug: pageDebug
            });
            
            isGeneratingViaCommand = false;
            console.log('❌ === GERAÇÃO FALHOU ===');
          }
        } else {
          // Se não encontrou botão de gerar
          console.log('⚠️ Botão de gerar não encontrado, tentando capturar credenciais existentes...');
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          const credentials = findCredentialsInPage();
          
          if (credentials && credentials.username && credentials.password) {
            console.log('✅ Credenciais existentes capturadas!');
            
            sendResponse({
              success: true,
              credentials: {
                username: credentials.username,
                password: credentials.password,
                timestamp: new Date().toISOString(),
                note: 'Credenciais capturadas da página atual'
              }
            });
          } else {
            // Última tentativa: varredura completa
            console.log('🔍 Última tentativa: varredura completa da página...');
            
            const pageText = document.body.innerText || document.body.textContent || '';
            const extracted = extractCredentialsFromText(pageText);
            
            if (extracted.username && extracted.password) {
              console.log('✅ Credenciais encontradas na varredura!');
              
              sendResponse({
                success: true,
                credentials: {
                  username: extracted.username,
                  password: extracted.password,
                  timestamp: new Date().toISOString(),
                  note: 'Credenciais extraídas do texto da página'
                }
              });
            } else {
              // Debug completo
              const debug = {
                url: window.location.href,
                title: document.title,
                buttonsText: Array.from(document.querySelectorAll('button')).map(b => b.innerText).filter(t => t).slice(0, 10),
                linksText: Array.from(document.querySelectorAll('a')).map(a => a.innerText).filter(t => t && t.length < 50).slice(0, 10),
                inputsInfo: Array.from(document.querySelectorAll('input:not([type="hidden"])')).map(i => ({
                  type: i.type,
                  name: i.name,
                  value: i.value ? '(tem valor)' : '(vazio)'
                })).slice(0, 10)
              };
              
              console.error('❌ Debug completo:', debug);
              
              sendResponse({
                success: false,
                error: 'Não foi possível encontrar botão de gerar nem credenciais na página',
                debug: debug
              });
            }
          }
          
          isGeneratingViaCommand = false;
        }
                    
      } catch (error) {
        console.error('❌ Erro durante geração:', error);
        sendResponse({
          success: false,
          error: error.message,
          stack: error.stack
        });
        isGeneratingViaCommand = false;
      }
    }, 500);
    
    // Retorna true para resposta assíncrona
    return true;
  }
  
  // Comando de debug
  if (request.action === 'debug') {
    debugPageElements();
    sendResponse({ 
      success: true, 
      message: 'Debug executado, verifique o console',
      url: window.location.href
    });
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
// MONITORAMENTO AUTOMÁTICO DE URL
// ===========================================================================
let lastUrl = window.location.href;

// Monitora mudanças de URL
const urlObserver = setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('📍 URL mudou para:', lastUrl);
    
    // Se estiver em uma página relevante, faz debug automático
    if (lastUrl.includes('user') || lastUrl.includes('iptv') || 
        lastUrl.includes('conta') || lastUrl.includes('test') ||
        lastUrl.includes('criar') || lastUrl.includes('gerar')) {
      setTimeout(() => {
        console.log('🔍 Debug automático da nova página:');
        debugPageElements();
      }, 1000);
    }
  }
}, 1000);

// ===========================================================================
// INICIALIZAÇÃO
// ===========================================================================
console.log('✅ Content script pronto e aguardando comandos!');
console.log('🔑 Listener para ESC ativo');
console.log('👁️ Observer para detecção de credenciais ativo');
console.log('🔍 Sistema de debug avançado ativo');
console.log('📁 Monitoramento de URL ativo');