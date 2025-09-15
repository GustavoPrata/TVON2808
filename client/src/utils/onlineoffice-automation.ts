/**
 * OnlineOffice Automation Client-Side
 * Script para automatizar a captura de credenciais IPTV no navegador do cliente
 */

class OnlineOfficeAutomation {
  private static readonly ONLINEOFFICE_URL = 'https://onlineoffice.zip/';
  private static messageListener: ((event: MessageEvent) => void) | null = null;

  /**
   * Script minificado para injeção no console do navegador
   * Este script será executado diretamente no site OnlineOffice
   */
  static getInjectionScript(): string {
    return `(function(){
      console.log('🚀 OnlineOffice Automation iniciado...');
      
      // Função para aguardar elemento aparecer
      function waitForElement(selector, callback, timeout = 10000) {
        const startTime = Date.now();
        const interval = setInterval(() => {
          const element = document.querySelector(selector);
          if (element) {
            clearInterval(interval);
            callback(element);
          } else if (Date.now() - startTime > timeout) {
            clearInterval(interval);
            console.error('⏱️ Timeout aguardando elemento: ' + selector);
          }
        }, 500);
      }
      
      // Função para extrair credenciais do texto
      function extractCredentials(text) {
        const patterns = {
          usuario: [
            /usuario[:\\s]+([0-9a-zA-Z]+)/i,
            /user[:\\s]+([0-9a-zA-Z]+)/i,
            /login[:\\s]+([0-9a-zA-Z]+)/i,
            /Usuário[:\\s]+([0-9a-zA-Z]+)/i
          ],
          senha: [
            /senha[:\\s]+([0-9a-zA-Z]+)/i,
            /password[:\\s]+([0-9a-zA-Z]+)/i,
            /pass[:\\s]+([0-9a-zA-Z]+)/i,
            /Senha[:\\s]+([0-9a-zA-Z]+)/i
          ],
          vencimento: [
            /vencimento[:\\s]+([0-9]{1,2}\\/[0-9]{1,2}\\/[0-9]{4})/i,
            /validade[:\\s]+([0-9]{1,2}\\/[0-9]{1,2}\\/[0-9]{4})/i,
            /expira[:\\s]+([0-9]{1,2}\\/[0-9]{1,2}\\/[0-9]{4})/i
          ]
        };
        
        const result = { usuario: null, senha: null, vencimento: null };
        
        // Tentar cada padrão para extrair as informações
        for (const pattern of patterns.usuario) {
          const match = text.match(pattern);
          if (match && match[1]) {
            result.usuario = match[1].trim();
            break;
          }
        }
        
        for (const pattern of patterns.senha) {
          const match = text.match(pattern);
          if (match && match[1]) {
            result.senha = match[1].trim();
            break;
          }
        }
        
        for (const pattern of patterns.vencimento) {
          const match = text.match(pattern);
          if (match && match[1]) {
            result.vencimento = match[1].trim();
            break;
          }
        }
        
        return result;
      }
      
      // Função para enviar credenciais de volta
      function sendCredentials(credentials) {
        console.log('✅ Credenciais capturadas:', credentials);
        
        // Tentar enviar via postMessage se foi aberto por nossa aplicação
        if (window.opener) {
          window.opener.postMessage({
            type: 'ONLINEOFFICE_CREDENTIALS',
            source: 'onlineoffice-automation',
            ...credentials,
            timestamp: new Date().toISOString()
          }, '*');
        }
        
        // REMOVIDO: fetch direto para evitar problemas de CORS
        // As credenciais serão enviadas via postMessage e processadas no frontend
        
        // Mostrar as credenciais para o usuário copiar manualmente se necessário
        const message = \`
          ✅ CREDENCIAIS CAPTURADAS COM SUCESSO!
          
          Usuário: \${credentials.usuario || 'Não encontrado'}
          Senha: \${credentials.senha || 'Não encontrada'}
          Vencimento: \${credentials.vencimento || 'Não encontrado'}
          
          As credenciais foram enviadas automaticamente para o sistema.
          Caso necessário, copie manualmente as informações acima.
        \`;
        alert(message);
      }
      
      // Função para clicar no botão Gerar IPTV
      function clickGenerateButton() {
        console.log('🔍 Procurando botão Gerar IPTV...');
        
        // Diferentes seletores possíveis para o botão
        const selectors = [
          'button:contains("Gerar IPTV")',
          'button:contains("Gerar")',
          'button:contains("IPTV")',
          '.btn-outline-success',
          '.btn-success',
          'button.btn[onclick*="gerar"]',
          'button[onclick*="iptv"]',
          'a[href*="gerar"]',
          'a[href*="iptv"]'
        ];
        
        let button = null;
        
        // Tentar encontrar usando jQuery se disponível
        if (typeof $ !== 'undefined') {
          for (const selector of selectors) {
            button = $(selector).filter(':visible').first()[0];
            if (button) break;
          }
        }
        
        // Fallback para vanilla JS
        if (!button) {
          const buttons = document.querySelectorAll('button, a.btn');
          for (const btn of buttons) {
            const text = btn.textContent || btn.innerText || '';
            if (text.toLowerCase().includes('gerar') || text.toLowerCase().includes('iptv')) {
              button = btn;
              break;
            }
          }
        }
        
        if (button) {
          console.log('✅ Botão encontrado, clicando...');
          button.click();
          
          // Aguardar possíveis modais de confirmação
          setTimeout(() => {
            const confirmButtons = document.querySelectorAll('.swal2-confirm, button.confirm, button:contains("Sim"), button:contains("OK")');
            confirmButtons.forEach(btn => {
              console.log('🔄 Confirmando modal...');
              btn.click();
            });
          }, 1000);
          
          return true;
        } else {
          console.error('❌ Botão Gerar IPTV não encontrado');
          return false;
        }
      }
      
      // Configurar MutationObserver para detectar quando as credenciais aparecem
      let credentialsCaptured = false;
      const observer = new MutationObserver((mutations) => {
        if (credentialsCaptured) return;
        
        // Verificar todo o conteúdo da página
        const bodyText = document.body.innerText || document.body.textContent || '';
        
        // Também verificar modais e popups
        const modals = document.querySelectorAll('.modal, .swal2-container, .popup, [role="dialog"]');
        let modalText = '';
        modals.forEach(modal => {
          modalText += ' ' + (modal.innerText || modal.textContent || '');
        });
        
        const fullText = bodyText + ' ' + modalText;
        const credentials = extractCredentials(fullText);
        
        // Se encontrou ambos usuário e senha, capturar
        if (credentials.usuario && credentials.senha) {
          credentialsCaptured = true;
          observer.disconnect();
          sendCredentials(credentials);
        }
      });
      
      // Iniciar observação de mudanças no DOM
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      // Tentar clicar no botão automaticamente
      if (clickGenerateButton()) {
        console.log('⏳ Aguardando credenciais aparecerem...');
        
        // Timeout de segurança (30 segundos)
        setTimeout(() => {
          if (!credentialsCaptured) {
            observer.disconnect();
            console.error('⏱️ Timeout: Credenciais não foram detectadas em 30 segundos');
            alert('⚠️ Timeout: As credenciais não foram detectadas automaticamente. Por favor, copie manualmente.');
          }
        }, 30000);
      } else {
        // Se não encontrou o botão, dar instruções ao usuário
        alert('⚠️ Botão "Gerar IPTV" não encontrado automaticamente.\\n\\nPor favor:\\n1. Clique manualmente no botão "Gerar IPTV"\\n2. O script continuará monitorando e capturará as credenciais quando aparecerem.');
      }
    })();`;
  }

  /**
   * Script alternativo mais simples para usuários copiarem
   */
  static getSimpleScript(): string {
    return `javascript:(function(){var t=document.body.innerText,u=t.match(/usuario[:\\s]+([0-9a-zA-Z]+)/i),s=t.match(/senha[:\\s]+([0-9a-zA-Z]+)/i);if(u&&s){var d={usuario:u[1],senha:s[1]};console.log('Credenciais:',d);window.opener&&window.opener.postMessage({type:'ONLINEOFFICE_CREDENTIALS',...d},'*');alert('✅ Capturado! Usuario: '+d.usuario+' | Senha: '+d.senha);}else{alert('❌ Credenciais não encontradas. Tente novamente após gerar.');}})();`;
  }

  /**
   * Abre o OnlineOffice em nova aba e configura listeners
   */
  static openAndAutomate(onCredentialsReceived: (credentials: any) => void): Window | null {
    // Remover listener anterior se existir
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
    }

    // Configurar novo listener para receber credenciais
    this.messageListener = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ONLINEOFFICE_CREDENTIALS') {
        console.log('Credenciais recebidas via postMessage:', event.data);
        onCredentialsReceived({
          usuario: event.data.usuario,
          senha: event.data.senha,
          vencimento: event.data.vencimento || null,
          timestamp: event.data.timestamp || new Date().toISOString()
        });
      }
    };

    window.addEventListener('message', this.messageListener);

    // Abrir OnlineOffice em nova aba
    const newWindow = window.open(this.ONLINEOFFICE_URL, '_blank');
    
    if (!newWindow) {
      alert('⚠️ Por favor, permita pop-ups para este site para continuar.');
      return null;
    }

    return newWindow;
  }

  /**
   * Remove listeners quando não for mais necessário
   */
  static cleanup(): void {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
  }

  /**
   * Gera um bookmarklet que o usuário pode salvar
   */
  static generateBookmarklet(): string {
    const script = this.getSimpleScript();
    return script;
  }

  /**
   * Instruções formatadas para o usuário
   */
  static getInstructions(): string {
    return `
      <div class="space-y-4">
        <h3 class="font-bold text-lg">📋 Instruções de Uso</h3>
        
        <div class="space-y-2">
          <h4 class="font-semibold">Método 1: Automático (Recomendado)</h4>
          <ol class="list-decimal list-inside space-y-1 text-sm">
            <li>Clique no botão "Abrir OnlineOffice e Automatizar"</li>
            <li>Uma nova aba será aberta com o site OnlineOffice</li>
            <li>Faça login no site se necessário</li>
            <li>Abra o Console do navegador (F12 → Console)</li>
            <li>Cole o script fornecido e pressione Enter</li>
            <li>O script clicará automaticamente no botão e capturará as credenciais</li>
          </ol>
        </div>
        
        <div class="space-y-2">
          <h4 class="font-semibold">Método 2: Bookmarklet</h4>
          <ol class="list-decimal list-inside space-y-1 text-sm">
            <li>Arraste o botão "🔧 IPTV Capture" para sua barra de favoritos</li>
            <li>Acesse o OnlineOffice e faça login</li>
            <li>Clique em "Gerar IPTV" manualmente</li>
            <li>Quando as credenciais aparecerem, clique no bookmarklet salvo</li>
          </ol>
        </div>
        
        <div class="space-y-2">
          <h4 class="font-semibold">Método 3: Manual</h4>
          <ol class="list-decimal list-inside space-y-1 text-sm">
            <li>Acesse o OnlineOffice normalmente</li>
            <li>Gere as credenciais manualmente</li>
            <li>Copie e cole aqui no sistema</li>
          </ol>
        </div>
        
        <div class="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-xs">
          <p class="font-semibold">⚠️ Importante:</p>
          <ul class="list-disc list-inside mt-1 space-y-1">
            <li>Você precisa estar logado no OnlineOffice</li>
            <li>Permita pop-ups se solicitado</li>
            <li>O script é seguro e apenas captura as credenciais geradas</li>
          </ul>
        </div>
      </div>
    `;
  }
}

export default OnlineOfficeAutomation;