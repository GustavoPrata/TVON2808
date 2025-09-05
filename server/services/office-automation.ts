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
          // Alternativa: usar XPath para encontrar a opção
          const [option] = await page.$x('//option[contains(text(), "6 Horas")]');
          if (option) {
            await option.click();
          } else {
            // Ou usar evaluate para clicar na opção
            await page.evaluate(() => {
              const options = Array.from(document.querySelectorAll('option'));
              const sixHours = options.find(opt => opt.textContent?.includes('6 Horas'));
              if (sixHours) sixHours.click();
            });
          }
        } catch (e2) {
          console.log('⚠️ Não foi possível selecionar 6 horas');
        }
      }
      
      await this.delay(1000);

      // Clicar em "Confirmar" usando XPath ou evaluate
      console.log('✅ Confirmando geração...');
      try {
        // Método 1: Usar XPath para encontrar botão por texto
        const [confirmButton] = await page.$x('//button[contains(text(), "Confirmar")]');
        if (confirmButton) {
          await confirmButton.click();
        } else {
          throw new Error('Botão não encontrado com XPath');
        }
      } catch (e) {
        // Método 2: Usar evaluate para encontrar e clicar no botão
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const confirmBtn = buttons.find(btn => btn.textContent?.includes('Confirmar'));
          if (confirmBtn) {
            confirmBtn.click();
          } else {
            throw new Error('Botão Confirmar não encontrado');
          }
        });
      }
      
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