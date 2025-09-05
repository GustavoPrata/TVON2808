import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Usar o plugin stealth para evitar detecção de bot
puppeteerExtra.use(StealthPlugin());

interface IPTVCredentials {
  usuario: string;
  senha: string;
  vencimento?: string;
  error?: string;
}

export class OfficeAutomation {
  private username = 'gustavoprata17';
  private password = 'iptv102030';
  private baseUrl = 'https://onlineoffice.zip';

  async generateIPTVTest(): Promise<IPTVCredentials> {
    let browser;
    let page;
    
    try {
      console.log('🚀 Iniciando automação do OnlineOffice...');
      
      // Diretório para salvar dados do usuário (cookies, sessão, etc)
      const userDataDir = '/tmp/puppeteer-user-data';
      
      // Configurar o navegador com perfil persistente
      browser = await puppeteerExtra.launch({
        headless: false, // Mostrar navegador para permitir login manual
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        userDataDir: userDataDir, // Salvar dados do usuário
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-web-security',
          '--disable-site-isolation-trials',
          '--disable-gpu',
          '--no-first-run',
          '--disable-default-apps',
          '--window-size=1280,720'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      });

      page = await browser.newPage();
      
      // Configurar viewport e user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Adicionar headers extras para parecer mais humano
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      });

      // Primeiro, verificar se já está logado (verificar URL)
      console.log('📍 Navegando para o sistema...');
      await page.goto(`${this.baseUrl}/#/users-iptv`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.delay(3000);
      
      // Verificar se foi redirecionado para login
      const currentUrl = page.url();
      console.log('🔗 URL atual:', currentUrl);
      
      if (currentUrl.includes('/login')) {
        console.log('⚠️ Não está logado. Por favor, faça login manualmente no navegador que abriu.');
        console.log('📝 Instruções:');
        console.log('   1. Preencha o usuário e senha');
        console.log('   2. Resolva o captcha "Não sou um robô"');
        console.log('   3. Clique em Logar');
        console.log('   4. Aguarde ser redirecionado');
        console.log('⏳ Aguardando 30 segundos para login manual...');
        
        // Aguardar 30 segundos para o usuário fazer login manual
        await this.delay(30000);
        
        // Verificar se o login foi feito
        const urlAfterWait = page.url();
        if (urlAfterWait.includes('/login')) {
          throw new Error('Login não foi realizado. Por favor, tente novamente e faça o login manualmente.');
        }
      }
      
      console.log('✅ Logado com sucesso!');
      
      // Verificar URL atual e navegar para página de usuários IPTV se necessário
      const loggedUrl = page.url();
      console.log('📍 URL atual:', loggedUrl);

      if (!loggedUrl.includes('users-iptv')) {
        console.log('📍 Navegando para página de usuários IPTV...');
        await page.goto(`${this.baseUrl}/#/users-iptv`, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        await this.delay(3000);
      }

      // Clicar no botão "Gerar IPTV"
      console.log('🎬 Clicando em "Gerar IPTV"...');
      try {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const button = buttons.find(b => b.textContent?.includes('Gerar'));
          if (button) {
            button.click();
            console.log('Botão Gerar clicado');
          }
        });
      } catch (e) {
        console.log('⚠️ Erro ao clicar no botão Gerar:', e instanceof Error ? e.message : String(e));
      }
      
      await this.delay(2000);

      // Primeiro clique no botão Confirmar
      console.log('✅ Primeiro clique no botão Confirmar...');
      try {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const confirmBtn = buttons.find(btn => 
            btn.textContent?.trim().toLowerCase().includes('confirmar')
          );
          if (confirmBtn) {
            confirmBtn.click();
            console.log('Primeiro Confirmar clicado');
            return true;
          }
          return false;
        });
      } catch (e) {
        console.log('⚠️ Erro no primeiro clique:', e instanceof Error ? e.message : String(e));
      }

      await this.delay(2000);

      // Segundo clique no botão Confirmar
      console.log('✅ Segundo clique no botão Confirmar...');
      try {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const confirmBtn = buttons.find(btn => 
            btn.textContent?.trim().toLowerCase().includes('confirmar')
          );
          if (confirmBtn) {
            confirmBtn.click();
            console.log('Segundo Confirmar clicado');
            return true;
          }
          return false;
        });
      } catch (e) {
        console.log('⚠️ Erro no segundo clique:', e instanceof Error ? e.message : String(e));
      }
      
      // Aguardar o modal aparecer (com timeout de 10 segundos)
      console.log('⏳ Aguardando modal aparecer...');
      try {
        await page.waitForSelector('span.alert-inner--text, .modal-content, [role="dialog"], .alert', {
          timeout: 10000
        });
        console.log('✅ Modal detectado!');
      } catch (e) {
        console.log('⚠️ Modal não detectado após 10 segundos, continuando mesmo assim...');
      }
      
      // Aguardar mais 2 segundos para garantir que o conteúdo carregou
      await this.delay(2000);

      // Tirar screenshot para debug
      try {
        const screenshotDebug = await page.screenshot({ encoding: 'base64', type: 'png' });
        console.log('📸 Screenshot após aguardar modal (primeiros 100 chars):', screenshotDebug.substring(0, 100));
      } catch (e) {
        console.log('⚠️ Não foi possível tirar screenshot de debug');
      }

      // Verificar se o modal está presente
      const modalPresent = await page.evaluate(() => {
        const modal = document.querySelector('.modal, [role="dialog"], .alert, .popup, .modal-content');
        const alertSpan = document.querySelector('span.alert-inner--text');
        return {
          hasModal: !!modal,
          hasAlertSpan: !!alertSpan,
          bodyText: document.body.innerText?.substring(0, 500) || 'sem texto'
        };
      });
      
      console.log('🔍 Estado da página:', modalPresent);

      // Extrair credenciais do modal
      console.log('📋 Extraindo credenciais...');
      
      // Tentar várias formas de pegar o usuário e senha
      let usuario = '';
      let senha = '';
      let vencimento = '';

      try {
        // Método 1: Buscar dentro do span.alert-inner--text (estrutura específica do modal)
        const modalContent = await page.evaluate(() => {
          // Primeiro tentar o span específico
          const alertSpan = document.querySelector('span.alert-inner--text') as HTMLElement;
          if (alertSpan) {
            return alertSpan.innerText || alertSpan.textContent;
          }
          
          // Se não encontrar, tentar outras estruturas de modal
          const modal = document.querySelector('.modal-content, .modal-body, [role="dialog"], .alert') as HTMLElement;
          if (modal) {
            return modal.innerText || modal.textContent;
          }
          
          // Por último, tentar qualquer elemento que contenha as credenciais
          const allText = document.body.innerText || document.body.textContent;
          if (allText && allText.includes('USUÁRIO:')) {
            return allText;
          }
          
          return null;
        });

        if (modalContent) {
          console.log('📄 Conteúdo do modal encontrado');
          
          // Regex mais flexível para capturar valores entre aspas ou não
          // USUÁRIO: "5259609334 " ou USUÁRIO: 5259609334
          const userMatch = modalContent.match(/USUÁRIO:\s*["\s]*(\d+)["\s]*/i);
          if (userMatch) {
            usuario = userMatch[1].trim();
            console.log('✅ Usuário extraído:', usuario);
          }

          // SENHA: "8867A44633 " ou SENHA: 8867A44633
          const passMatch = modalContent.match(/SENHA:\s*["\s]*([A-Z0-9]+)["\s]*/i);
          if (passMatch) {
            senha = passMatch[1].trim();
            console.log('✅ Senha extraída:', senha);
          }

          // VENCIMENTO: " 05/09/2025 12:22:34 "
          const vencMatch = modalContent.match(/VENCIMENTO:\s*["\s]*([^"\n]+?)["|\n]/i);
          if (vencMatch) {
            vencimento = vencMatch[1].trim();
            console.log('✅ Vencimento extraído:', vencimento);
          }
        }
      } catch (e) {
        console.log('⚠️ Método 1 falhou:', e instanceof Error ? e.message : String(e));
      }

      // Método 2: Buscar por estrutura HTML com textContent dos nós
      if (!usuario || !senha) {
        try {
          const credentials = await page.evaluate(() => {
            const result: { [key: string]: string } = { usuario: '', senha: '', vencimento: '' };
            
            // Procurar o span.alert-inner--text
            const alertSpan = document.querySelector('span.alert-inner--text');
            if (!alertSpan) return result;
            
            // Pegar os nós filhos
            const childNodes = alertSpan.childNodes;
            let currentField = '';
            
            childNodes.forEach(node => {
              const text = node.textContent || '';
              
              // Se for um strong com o nome do campo
              if (node.nodeName === 'STRONG') {
                if (text.includes('USUÁRIO')) currentField = 'usuario';
                else if (text.includes('SENHA')) currentField = 'senha';
                else if (text.includes('VENCIMENTO')) currentField = 'vencimento';
                else currentField = '';
              } 
              // Se for um texto após o strong
              else if (node.nodeType === Node.TEXT_NODE && currentField) {
                const value = text.replace(/["\s]+/g, ' ').trim();
                if (value) {
                  result[currentField] = value;
                }
              }
            });
            
            return result;
          });

          if (credentials.usuario) {
            usuario = credentials.usuario;
            console.log('✅ Usuário extraído (método 2):', usuario);
          }
          if (credentials.senha) {
            senha = credentials.senha;
            console.log('✅ Senha extraída (método 2):', senha);
          }
          if (credentials.vencimento) {
            vencimento = credentials.vencimento;
            console.log('✅ Vencimento extraído (método 2):', vencimento);
          }
        } catch (e) {
          console.log('⚠️ Método 2 falhou:', e instanceof Error ? e.message : String(e));
        }
      }

      // Método 3: Busca mais agressiva - pegar qualquer texto que pareça credenciais
      if (!usuario || !senha) {
        try {
          const pageText = await page.evaluate(() => document.body.innerText || '');
          console.log('📄 Texto completo da página (primeiros 300 chars):', pageText.substring(0, 300));
          
          // Procurar por padrões de números que possam ser usuário (geralmente 10 dígitos)
          const possibleUsers = pageText.match(/\b\d{9,11}\b/g);
          if (possibleUsers && possibleUsers.length > 0) {
            usuario = possibleUsers[0];
            console.log('🔍 Possível usuário encontrado (método 3):', usuario);
          }
          
          // Procurar por padrões que possam ser senha (mix de letras e números)
          const possiblePasswords = pageText.match(/\b[A-Z0-9]{8,12}\b/g);
          if (possiblePasswords && possiblePasswords.length > 0) {
            // Filtrar apenas os que têm letras E números
            const validPasswords = possiblePasswords.filter(p => 
              /[A-Z]/.test(p) && /[0-9]/.test(p)
            );
            if (validPasswords.length > 0) {
              senha = validPasswords[0];
              console.log('🔍 Possível senha encontrada (método 3):', senha);
            }
          }
          
          // Procurar por data/hora de vencimento
          const possibleDates = pageText.match(/\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}/g);
          if (possibleDates && possibleDates.length > 0) {
            vencimento = possibleDates[0];
            console.log('🔍 Possível vencimento encontrado (método 3):', vencimento);
          }
        } catch (e) {
          console.log('⚠️ Método 3 falhou:', e instanceof Error ? e.message : String(e));
        }
      }

      if (usuario && senha) {
        console.log('✅ Credenciais extraídas com sucesso!');
        return {
          usuario,
          senha,
          vencimento
        };
      } else {
        throw new Error('Não foi possível extrair as credenciais');
      }

    } catch (error) {
      console.error('❌ Erro na automação:', error);
      
      // Tentar tirar screenshot para debug se a página existir
      if (page) {
        try {
          const screenshot = await page.screenshot({ encoding: 'base64', type: 'png' });
          console.log('📸 Screenshot capturado para debug (base64):', screenshot.substring(0, 50) + '...');
        } catch (e) {
          console.log('❌ Não foi possível tirar screenshot');
        }
      }
      
      return {
        usuario: '',
        senha: '',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const officeAutomation = new OfficeAutomation();