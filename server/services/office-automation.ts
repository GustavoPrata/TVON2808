import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { promises as fs } from 'fs';

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

      // Navegar para página de login primeiro
      console.log('📍 Navegando para o sistema...');
      
      let pageLoaded = false;
      let attempts = 0;
      
      while (!pageLoaded && attempts < 3) {
        attempts++;
        try {
          console.log(`🔄 Tentativa ${attempts} de carregar a página...`);
          
          // Na primeira tentativa, tentar a URL base diretamente
          const targetUrl = attempts === 1 ? this.baseUrl : `${this.baseUrl}/#/login`;
          console.log(`📍 Acessando: ${targetUrl}`);
          
          await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          
          // Aguardar um pouco para a página processar
          await this.delay(3000);
          
          // Verificar se a página carregou corretamente
          const currentUrl = page.url();
          if (!currentUrl.includes('chrome-error://') && !currentUrl.includes('about:blank')) {
            pageLoaded = true;
            console.log('✅ Página carregada com sucesso');
          } else {
            console.log('⚠️ Erro de carregamento detectado, tentando novamente...');
            await this.delay(2000);
          }
        } catch (error) {
          console.error(`❌ Erro na tentativa ${attempts}:`, error);
          if (attempts >= 3) {
            throw new Error(`Não foi possível acessar o site ${this.baseUrl} após 3 tentativas. Verifique se o site está disponível.`);
          }
          await this.delay(2000);
        }
      }
      
      await this.delay(2000);
      
      const currentUrl = page.url();
      console.log('🔗 URL atual:', currentUrl);
      
      // Fazer login automaticamente
      if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
        console.log('🔐 Fazendo login automaticamente...');
        
        try {
          // Preencher usuário
          await page.waitForSelector('input[type="text"], input[name="username"], input[placeholder*="usuário" i], #username', { timeout: 5000 });
          await page.type('input[type="text"], input[name="username"], input[placeholder*="usuário" i], #username', 'gustavoprata17', { delay: 100 });
          
          // Preencher senha
          await page.waitForSelector('input[type="password"], input[name="password"], input[placeholder*="senha" i], #password', { timeout: 5000 });
          await page.type('input[type="password"], input[name="password"], input[placeholder*="senha" i], #password', 'iptv102030', { delay: 100 });
          
          console.log('📝 Credenciais preenchidas');
          
          // Clicar no botão de login
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            const loginBtn = buttons.find(btn => {
              const text = btn.textContent?.toLowerCase() || '';
              const value = (btn as HTMLInputElement).value?.toLowerCase() || '';
              return text.includes('logar') || text.includes('login') || text.includes('entrar') || 
                     value.includes('logar') || value.includes('login') || value.includes('entrar');
            });
            if (loginBtn) {
              (loginBtn as HTMLElement).click();
              return true;
            }
            return false;
          });
          
          console.log('🖱️ Botão de login clicado');
          
          // Aguardar redirecionamento após login
          await this.delay(5000);
          
          const urlAfterLogin = page.url();
          if (urlAfterLogin.includes('/login')) {
            console.log('⚠️ Login automático pode ter falhado. Tentando resolver captcha manualmente...');
            console.log('📝 Se houver captcha, resolva-o manualmente no navegador');
            console.log('⏳ Aguardando 20 segundos para resolução manual do captcha...');
            await this.delay(20000);
          }
          
        } catch (e) {
          console.log('⚠️ Erro no login automático:', e instanceof Error ? e.message : String(e));
          console.log('📝 Por favor, faça login manualmente no navegador');
          console.log('⏳ Aguardando 30 segundos para login manual...');
          await this.delay(30000);
        }
      }
      
      console.log('✅ Login processado!');
      
      // Aguardar um pouco mais para garantir que o login foi processado
      await this.delay(3000);
      
      // Primeiro tentar no dashboard
      console.log('📍 Navegando para o dashboard...');
      await page.goto(`${this.baseUrl}/#/dashboard`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Aguardar a página carregar
      await this.delay(5000);
      
      // Verificar se o botão "Gerar IPTV" está no dashboard
      let hasGerarButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        return buttons.some(btn => {
          const text = (btn as HTMLElement).innerText || btn.textContent || '';
          return text.includes('Gerar IPTV') || text.includes('Gerar iptv');
        });
      });
      
      console.log(`🔍 Botão "Gerar IPTV" no dashboard: ${hasGerarButton ? 'Encontrado ✅' : 'Não encontrado ❌'}`);
      
      // Se não encontrar no dashboard, tentar na página users-iptv
      if (!hasGerarButton) {
        console.log('📍 Navegando para página users-iptv...');
        await page.goto(`${this.baseUrl}/#/users-iptv`, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        
        await this.delay(5000);
        
        // Verificar novamente
        hasGerarButton = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          return buttons.some(btn => {
            const text = (btn as HTMLElement).innerText || btn.textContent || '';
            return text.includes('Gerar IPTV') || text.includes('Gerar iptv');
          });
        });
        
        console.log(`🔍 Botão "Gerar IPTV" em users-iptv: ${hasGerarButton ? 'Encontrado ✅' : 'Não encontrado ❌'}`);
      }
      
      // Verificar URL atual
      const currentPageUrl = page.url();
      console.log('🔗 URL da página atual:', currentPageUrl);
      
      // Verificar o título da página
      const pageTitle = await page.title();
      console.log('📄 Título da página:', pageTitle);
      
      // Verificar se há algum erro na página
      const hasError = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        return bodyText.includes('error') || bodyText.includes('erro') || 
               bodyText.includes('404') || bodyText.includes('not found');
      });
      
      if (hasError) {
        console.log('⚠️ Possível erro na página detectado');
        
        // Tentar navegar de forma diferente
        console.log('🔄 Tentando navegação alternativa...');
        await page.goto(this.baseUrl, { waitUntil: 'networkidle2' });
        await this.delay(2000);
        
        // Clicar em link de usuários IPTV se existir
        const linkClicked = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const iptvLink = links.find(a => {
            const text = a.textContent?.toLowerCase() || '';
            const href = a.href?.toLowerCase() || '';
            return text.includes('iptv') || text.includes('usuários') || 
                   href.includes('users-iptv') || href.includes('iptv');
          });
          if (iptvLink) {
            (iptvLink as HTMLAnchorElement).click();
            return true;
          }
          return false;
        });
        
        if (linkClicked) {
          console.log('✅ Link para usuários IPTV clicado');
          await this.delay(3000);
        } else {
          console.log('⚠️ Link para usuários IPTV não encontrado');
        }
      }

      // Aguardar carregamento completo da página
      console.log('⏳ Aguardando carregamento completo da página...');
      
      try {
        await page.waitForSelector('button', { timeout: 10000 });
      } catch (e) {
        console.log('⚠️ Timeout aguardando botões. Continuando...');
      }
      
      await this.delay(3000);
      
      // Procurar e clicar no botão "Gerar IPTV"
      console.log('🎬 Procurando botão "Gerar IPTV"...');
      
      // Listar todos os botões da página para debug
      const buttonsInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a[role="button"], div[role="button"], .btn'));
        return buttons.map((btn, index) => {
          const text = btn.textContent?.trim() || '';
          const classes = btn.className || '';
          const tagName = btn.tagName;
          return { index, text, classes, tagName };
        });
      });
      
      console.log('📋 Botões encontrados na página:');
      buttonsInfo.forEach(btn => {
        if (btn.text) {
          console.log(`  - ${btn.tagName} ${btn.index}: "${btn.text}" (classes: ${btn.classes})`);
        }
      });
      
      // Tentar clicar no botão de gerar
      const gerarClicked = await page.evaluate(() => {
        // Procurar todos os botões na página
        const buttons = Array.from(document.querySelectorAll('button'));
        console.log(`Total de botões encontrados: ${buttons.length}`);
        
        // Procurar botão que contenha "Gerar IPTV" no texto (pode estar em span interno)
        const button = buttons.find(b => {
          // Verificar texto do botão e de elementos internos (como span)
          const buttonText = b.innerText || b.textContent || '';
          const hasGerarIPTV = buttonText.includes('Gerar IPTV');
          
          if (hasGerarIPTV) {
            console.log(`✅ Botão "Gerar IPTV" encontrado! Classes: ${b.className}`);
            console.log(`   HTML interno: ${b.innerHTML}`);
          }
          
          return hasGerarIPTV;
        });
        
        if (button) {
          // Forçar o clique mesmo se houver elementos internos
          button.click();
          console.log('🖱️ Botão "Gerar IPTV" clicado com sucesso!');
          return true;
        }
        
        // Se não encontrar, procurar por botão com span contendo o texto
        const spanWithText = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('Gerar IPTV'));
        
        if (spanWithText && spanWithText.parentElement?.tagName === 'BUTTON') {
          (spanWithText.parentElement as HTMLButtonElement).click();
          console.log('🖱️ Clicado no botão pai do span "Gerar IPTV"');
          return true;
        }
        
        // Última tentativa: botão com classe btn-outline-success que contém "Gerar IPTV"
        const successButton = document.querySelector('button.btn-outline-success');
        if (successButton) {
          const buttonText = successButton.textContent || '';
          if (buttonText.includes('Gerar IPTV')) {
            (successButton as HTMLButtonElement).click();
            console.log('🖱️ Clicado no botão "Gerar IPTV" com classe btn-outline-success');
            return true;
          }
        }
        
        console.log('❌ Botão "Gerar IPTV" não encontrado em nenhuma das tentativas');
        return false;
      });
      
      if (!gerarClicked) {
        console.log('⚠️ Botão de gerar não encontrado automaticamente');
        throw new Error('Não foi possível encontrar o botão para gerar IPTV. Verifique se você está na página correta.');
      }
      
      await this.delay(3000);

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
      
      // Aguardar o modal aparecer (com timeout de 15 segundos)
      console.log('⏳ Aguardando modal aparecer (15 segundos)...');
      
      // Tentar detectar mudanças na página por 15 segundos
      let modalFound = false;
      for (let i = 0; i < 15; i++) {
        await this.delay(1000);
        
        // Verificar se algum modal ou alerta apareceu
        const hasModal = await page.evaluate(() => {
          const selectors = [
            'span.alert-inner--text',
            '.modal-content', 
            '[role="dialog"]',
            '.alert',
            '.swal2-container',
            '.sweet-alert',
            'div[class*="modal"]',
            'div[class*="popup"]',
            'div[class*="dialog"]'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
              console.log(`Modal encontrado com seletor: ${selector}`);
              return true;
            }
          }
          
          // Verificar também se apareceu algum texto com padrão de credencial
          const pageText = document.body.innerText;
          if (pageText.includes('usuário') || pageText.includes('senha') || 
              /\b\d{10}\b/.test(pageText)) {
            console.log('Possível texto de credencial detectado');
            return true;
          }
          
          return false;
        });
        
        if (hasModal) {
          modalFound = true;
          console.log(`✅ Modal detectado após ${i+1} segundos!`);
          break;
        }
        
        console.log(`⏱️ Aguardando... (${i+1}/15)`);
      }
      
      if (!modalFound) {
        console.log('⚠️ Modal não detectado após 15 segundos, continuando mesmo assim...');
      }
      
      // Aguardar mais 2 segundos para garantir que o conteúdo carregou completamente
      await this.delay(2000);

      // Capturar HTML completo da página
      const pageHTML = await page.evaluate(() => document.documentElement.outerHTML);
      console.log('📄 HTML da página capturado, tamanho:', pageHTML.length);
      
      // Salvar HTML em arquivo para debug
      const debugFilePath = '/tmp/office-page-debug.html';
      try {
        await fs.writeFile(debugFilePath, pageHTML);
        console.log('📝 HTML salvo em:', debugFilePath);
      } catch (e) {
        console.log('⚠️ Erro ao salvar HTML:', e);
      }

      // Tirar screenshot para debug
      try {
        const screenshotDebug = await page.screenshot({ encoding: 'base64', type: 'png' });
        console.log('📸 Screenshot após aguardar modal (primeiros 100 chars):', screenshotDebug.substring(0, 100));
      } catch (e) {
        console.log('⚠️ Não foi possível tirar screenshot de debug');
      }

      // Verificar se o modal está presente e capturar estrutura detalhada
      const modalPresent = await page.evaluate(() => {
        const modal = document.querySelector('.modal, [role="dialog"], .alert, .popup, .modal-content');
        const alertSpan = document.querySelector('span.alert-inner--text');
        
        // Buscar todos os elementos que contenham números
        const allElements = document.querySelectorAll('*');
        const numbersFound: string[] = [];
        
        allElements.forEach(el => {
          const text = el.textContent || '';
          const numbers = text.match(/\b\d{9,11}\b/g);
          if (numbers) {
            numbersFound.push(...numbers);
          }
        });
        
        return {
          hasModal: !!modal,
          hasAlertSpan: !!alertSpan,
          bodyText: document.body.innerText?.substring(0, 500) || 'sem texto',
          numbersInPage: Array.from(new Set(numbersFound)).slice(0, 5), // Primeiros 5 números únicos
          modalHTML: modal ? modal.innerHTML.substring(0, 500) : null,
          alertSpanHTML: alertSpan ? alertSpan.innerHTML : null
        };
      });
      
      console.log('🔍 Estado da página:', JSON.stringify(modalPresent, null, 2));

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