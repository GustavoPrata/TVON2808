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
      
      // Configurar o navegador
      browser = await puppeteerExtra.launch({
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
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
          '--disable-default-apps'
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

      console.log('📍 Navegando para a página de login...');
      await page.goto(`${this.baseUrl}/#/login`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Aguardar um pouco para a página carregar completamente
      console.log('⏳ Aguardando página carregar...');
      await this.delay(5000);
      
      // Aguardar que o Angular carregue completamente
      try {
        await page.waitForFunction(
          () => {
            // Verificar se o Angular está presente e carregado
            return (window as any).getAllAngularRootElements !== undefined ||
                   document.querySelector('input[placeholder]') !== null ||
                   document.querySelector('form') !== null;
          },
          { timeout: 15000 }
        );
        console.log('✅ Angular ou formulário detectado');
      } catch (e) {
        console.log('⚠️ Timeout ao aguardar Angular/formulário');
      }
      
      await this.delay(3000);

      // Debug: verificar se a página carregou
      const pageTitle = await page.title();
      const pageUrl = page.url();
      console.log('📄 Título da página:', pageTitle);
      console.log('🔗 URL atual:', pageUrl);
      
      // Debug: verificar o conteúdo HTML da página
      const pageContent = await page.content();
      console.log('📋 Tamanho do HTML:', pageContent.length, 'caracteres');
      
      // Debug: verificar se há algum formulário na página
      const forms = await page.$$('form');
      console.log('📝 Formulários encontrados:', forms.length);
      
      // Debug: listar todos os inputs encontrados
      const inputs = await page.$$('input');
      console.log('🔍 Inputs encontrados:', inputs.length);
      
      // Listar os placeholders dos inputs
      for (let i = 0; i < inputs.length; i++) {
        const placeholder = await inputs[i].evaluate(el => el.getAttribute('placeholder'));
        const type = await inputs[i].evaluate(el => el.type);
        console.log(`  Input ${i + 1}: type="${type}", placeholder="${placeholder}"`);
      }
      
      // Preencher username - usando seletor específico do site
      console.log('📝 Tentando preencher credenciais...');
      try {
        // Tentar múltiplos seletores
        const usernameSelectors = [
          'input[placeholder="Usuário"]',
          'input[placeholder*="usuário" i]',
          'input[placeholder*="user" i]',
          'input[type="text"]:not([placeholder*="senha" i])',
          'input:not([type="password"])',
        ];
        
        let usernameField = null;
        for (const selector of usernameSelectors) {
          try {
            const element = await page.$(selector);
            if (element) {
              usernameField = selector;
              console.log(`✅ Campo username encontrado com seletor: ${selector}`);
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!usernameField) {
          throw new Error('Nenhum seletor funcionou para o campo de username');
        }
        
        await page.click(usernameField);
        await page.type(usernameField, this.username, { delay: 100 });
        console.log('✅ Campo username preenchido');
        await this.delay(1000);
      } catch (e) {
        console.error('❌ Erro ao preencher username:', e);
        throw new Error('Campo de username não encontrado - verifique se a página carregou corretamente');
      }

      // Preencher password - usando seletor específico do site
      try {
        const passwordSelector = 'input[placeholder="Senha"][type="password"]';
        await page.waitForSelector(passwordSelector, { timeout: 10000 });
        await page.click(passwordSelector);
        await page.type(passwordSelector, this.password, { delay: 100 });
        console.log('✅ Campo password preenchido');
        await this.delay(1000);
      } catch (e) {
        console.error('❌ Erro ao preencher password:', e);
        throw new Error('Campo de password não encontrado - verifique se a página carregou corretamente');
      }

      // Tentar marcar o checkbox do reCAPTCHA
      console.log('🤖 Tentando marcar checkbox "Não sou um robô"...');
      
      // Primeiro, procurar por frames do reCAPTCHA
      const frames = page.frames();
      let recaptchaFrame = frames.find(frame => frame.url().includes('recaptcha'));
      
      if (recaptchaFrame) {
        try {
          // Tentar clicar no checkbox dentro do frame
          await recaptchaFrame.click('.recaptcha-checkbox-border');
          console.log('✅ Checkbox marcado!');
          await this.delay(2000);
        } catch (e) {
          console.log('⚠️ Não foi possível clicar no checkbox do reCAPTCHA automaticamente');
        }
      } else {
        // Tentar clicar em qualquer checkbox visível
        try {
          await page.click('input[type="checkbox"]');
          console.log('✅ Checkbox marcado!');
          await this.delay(2000);
        } catch (e) {
          console.log('⚠️ Checkbox não encontrado ou já marcado');
        }
      }

      // Clicar no botão de login
      console.log('🔐 Fazendo login...');
      try {
        // Tentar clicar no botão usando múltiplas estratégias
        const loginButtonSelectors = [
          'button.btn.btn-primary',
          'button:has-text("Logar")',
          'button[type="button"]'
        ];
        
        let clicked = false;
        for (const selector of loginButtonSelectors) {
          try {
            await page.click(selector, { delay: 100 });
            clicked = true;
            console.log(`✅ Botão de login clicado com seletor: ${selector}`);
            break;
          } catch (e) {
            continue;
          }
        }
        
        if (!clicked) {
          throw new Error('Botão de login não encontrado');
        }
      } catch (e) {
        console.error('❌ Erro ao clicar no botão de login:', e);
        throw e;
      }
      
      // Aguardar o redirecionamento
      await this.delay(5000);

      // Verificar se estamos na página correta após o login
      const currentUrl = page.url();
      console.log('📍 URL atual:', currentUrl);

      // Navegar para a página de usuários IPTV se necessário
      if (!currentUrl.includes('users-iptv')) {
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
        // Tentar várias seletores possíveis
        const gerarButton = await page.waitForSelector('button:has-text("Gerar IPTV"), button:has-text("Gerar P2P")', { 
          timeout: 10000 
        });
        await gerarButton?.click();
      } catch (e) {
        console.log('⚠️ Botão "Gerar IPTV" não encontrado, tentando alternativa...');
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const button = buttons.find(b => b.textContent?.includes('Gerar'));
          if (button) button.click();
        });
      }
      
      await this.delay(3000);

      // Preencher a nota
      console.log('📝 Preenchendo nota...');
      try {
        await page.waitForSelector('input[placeholder*="nota"]', { timeout: 5000 });
        await page.type('input[placeholder*="nota"]', 'teste', { delay: 100 });
      } catch (e) {
        console.log('⚠️ Campo de nota não encontrado');
      }
      
      await this.delay(1000);

      // Selecionar 6 horas no dropdown
      console.log('⏰ Selecionando tempo de teste (6 horas)...');
      try {
        // Clicar no select
        await page.click('select, [role="combobox"]');
        await this.delay(500);
        
        // Selecionar a opção "6 Horas"
        await page.select('select', '6');
      } catch (e) {
        try {
          // Alternativa: clicar diretamente na opção
          await page.click('option:has-text("6 Horas")');
        } catch (e2) {
          console.log('⚠️ Não foi possível selecionar 6 horas');
        }
      }
      
      await this.delay(1000);

      // Clicar em "Confirmar"
      console.log('✅ Confirmando geração...');
      await page.click('button:has-text("Confirmar")', { delay: 100 });
      
      // Aguardar 7 segundos para o modal aparecer
      console.log('⏳ Aguardando geração do teste (7 segundos)...');
      await this.delay(7000);

      // Extrair credenciais do modal
      console.log('📋 Extraindo credenciais...');
      
      // Tentar várias formas de pegar o usuário e senha
      let usuario = '';
      let senha = '';
      let vencimento = '';

      try {
        // Método 1: Buscar por texto específico
        const usuarioElement = await page.$x('//p[contains(text(), "USUÁRIO:")]/following-sibling::p[1]');
        if (usuarioElement.length > 0) {
          usuario = await page.evaluate(el => el.textContent, usuarioElement[0]);
        }
        
        const senhaElement = await page.$x('//p[contains(text(), "SENHA:")]/following-sibling::p[1]');
        if (senhaElement.length > 0) {
          senha = await page.evaluate(el => el.textContent, senhaElement[0]);
        }
      } catch (e) {
        console.log('⚠️ Método 1 falhou, tentando método 2...');
      }

      // Método 2: Buscar por padrão no texto
      if (!usuario || !senha) {
        try {
          const modalText = await page.evaluate(() => {
            const modal = document.querySelector('[role="dialog"], .modal, .popup');
            return modal ? modal.textContent : document.body.textContent;
          });

          // Extrair usuário (formato esperado: USUÁRIO: 974286091)
          const userMatch = modalText?.match(/USUÁRIO:\s*(\d+)/i);
          if (userMatch) usuario = userMatch[1];

          // Extrair senha (formato esperado: SENHA: x569n9833G)
          const passMatch = modalText?.match(/SENHA:\s*([a-zA-Z0-9]+)/i);
          if (passMatch) senha = passMatch[1];

          // Extrair vencimento (formato esperado: VENCIMENTO: 05/09/2025 10:10:51)
          const vencMatch = modalText?.match(/VENCIMENTO:\s*([\d\/\s:]+)/i);
          if (vencMatch) vencimento = vencMatch[1].trim();
        } catch (e) {
          console.log('⚠️ Método 2 falhou, tentando método 3...');
        }
      }

      // Método 3: Buscar diretamente nos elementos
      if (!usuario || !senha) {
        try {
          const allText = await page.evaluate(() => {
            const elements = document.querySelectorAll('p, div, span');
            return Array.from(elements).map(el => el.textContent).join('\n');
          });

          const lines = allText.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('USUÁRIO:')) {
              usuario = lines[i].split(':')[1]?.trim() || lines[i + 1]?.trim() || '';
            }
            if (lines[i].includes('SENHA:')) {
              senha = lines[i].split(':')[1]?.trim() || lines[i + 1]?.trim() || '';
            }
            if (lines[i].includes('VENCIMENTO:')) {
              vencimento = lines[i].split(':', 2)[1]?.trim() || lines[i + 1]?.trim() || '';
            }
          }
        } catch (e) {
          console.log('⚠️ Método 3 falhou');
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