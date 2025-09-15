import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { execSync } from 'child_process';
import * as fs from 'fs';

// Adiciona o plugin stealth para evitar detecção de bots
puppeteer.use(StealthPlugin());

interface IPTVTestResult {
  usuario: string;
  senha: string;
  vencimento?: string;
}

export class OnlineOfficeService {
  private static instance: OnlineOfficeService;
  
  static getInstance(): OnlineOfficeService {
    if (!this.instance) {
      this.instance = new OnlineOfficeService();
    }
    return this.instance;
  }

  private getChromiumPath(): string | undefined {
    // Try to find chromium executable in Replit environment
    try {
      const path = execSync('which chromium', { encoding: 'utf8' }).trim();
      if (path) {
        console.log('📍 Using Chromium at:', path);
        return path;
      }
    } catch (error) {
      console.log('⚠️ Could not find chromium via which command');
    }
    
    // Return undefined to let Puppeteer handle it in non-Replit environments
    return undefined;
  }

  async generateIPTVTest(): Promise<IPTVTestResult> {
    let browser;
    
    try {
      console.log('🚀 Iniciando automação OnlineOffice com proteção anti-bot avançada...');
      
      const executablePath = this.getChromiumPath();
      
      // Adiciona randomização para parecer mais humano
      const viewportWidth = 1920 + Math.floor(Math.random() * 100);
      const viewportHeight = 1080 + Math.floor(Math.random() * 100);
      
      // Inicia o navegador com configurações anti-detecção ultra avançadas
      browser = await puppeteer.launch({
        headless: 'new', // Usa o novo headless que é menos detectável
        executablePath: executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          `--window-size=${viewportWidth},${viewportHeight}`,
          '--start-maximized',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--user-data-dir=/tmp/puppeteer_user_data_' + Date.now(),
          '--disable-web-security',
          '--disable-gpu',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        ],
        defaultViewport: null,
        ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled'],
        protocolTimeout: 60000 // Aumenta timeout para evitar erros
      });

      const page = await browser.newPage();
      
      // Remove sinais de que é um navegador automatizado
      await page.evaluateOnNewDocument(() => {
        // Remove webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
        
        // Sobrescreve plugins para parecer um navegador real
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        // Sobrescreve languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['pt-BR', 'pt', 'en']
        });
        
        // Adiciona chrome runtime
        window.chrome = {
          runtime: {}
        };
        
        // Sobrescreve permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });
      
      // Define headers HTTP completos
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });
      
      // Define user agent mais realista
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      // Define viewport para parecer um navegador desktop real
      await page.setViewport({ width: viewportWidth, height: viewportHeight });

      console.log('📍 Navegando para OnlineOffice...');
      
      // Tenta acessar o site
      let response;
      try {
        response = await page.goto('https://onlineoffice.zip/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } catch (error) {
        console.error('❌ Erro ao navegar:', error.message);
        
        // Verifica se é erro de rede/DNS
        if (error.message.includes('ERR_NAME_NOT_RESOLVED') || error.message.includes('net::')) {
          throw new Error(
            'SITE_BLOQUEADO: O site OnlineOffice está bloqueando acessos de servidores. ' +
            'Este site só funciona em navegadores de usuários finais e bloqueia IPs de datacenters/cloud. ' +
            'Por favor, acesse https://onlineoffice.zip diretamente no seu navegador, ' +
            'gere o teste IPTV e use a opção "Extrair Credenciais" para processar o resultado.'
          );
        }
        throw error;
      }
      
      // Verifica o status da resposta
      const status = response?.status();
      console.log(`📊 Status HTTP: ${status}`);
      
      if (status === 404 || status === 403) {
        throw new Error(
          'SITE_BLOQUEADO: O site OnlineOffice retornou erro ' + status + '. ' +
          'Este site detecta e bloqueia acessos automatizados de servidores. ' +
          'Por favor, acesse https://onlineoffice.zip diretamente no seu navegador, ' +
          'gere o teste IPTV manualmente e use a função "Extrair Credenciais" para processar o resultado copiado.'
        );
      }
      
      // Aguarda a página carregar
      console.log('⏳ Aguardando página carregar completamente...');
      await page.waitForTimeout(5000);
      
      // Verifica se a página carregou corretamente
      const pageTitle = await page.title();
      const pageUrl = page.url();
      console.log(`📄 Título da página: ${pageTitle}`);
      console.log(`🔗 URL atual: ${pageUrl}`);
      
      // Verifica se não é uma página de erro
      if (pageUrl.includes('chrome-error://') || pageUrl.includes('about:blank')) {
        throw new Error(
          'SITE_BLOQUEADO: Não foi possível acessar o site OnlineOffice. ' +
          'O site está bloqueando acessos de servidores/automação. ' +
          'Acesse https://onlineoffice.zip no seu navegador e use a opção manual.'
        );
      }
      
      // Tira screenshot para debug
      try {
        const screenshotPath = `/tmp/onlineoffice-loaded-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot da página: ${screenshotPath}`);
      } catch (e) {
        console.log('⚠️ Não foi possível tirar screenshot');
      }

      // Procura e clica no botão "Gerar IPTV"
      console.log('🔍 Procurando botão "Gerar IPTV"...');
      
      // Procura o botão com múltiplas estratégias
      const buttonClicked = await page.evaluate(() => {
        // Procura por texto
        const buttons = Array.from(document.querySelectorAll('button'));
        const button = buttons.find(btn => {
          const text = btn.textContent?.trim().toLowerCase() || '';
          return text.includes('gerar iptv');
        });
        
        if (button && button instanceof HTMLElement) {
          button.click();
          return true;
        }
        
        // Tenta por classe
        const btnByClass = document.querySelector('button.btn-outline-success');
        if (btnByClass && btnByClass instanceof HTMLElement) {
          btnByClass.click();
          return true;
        }
        
        return false;
      });
      
      if (!buttonClicked) {
        // Lista botões para debug
        const buttonsInfo = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.map(btn => ({
            text: btn.textContent?.trim(),
            classes: btn.className
          }));
        });
        console.log('📋 Botões encontrados:', JSON.stringify(buttonsInfo, null, 2));
        
        throw new Error('Não foi possível encontrar ou clicar no botão "Gerar IPTV"');
      }
      
      console.log('✅ Botão clicado!');

      // Aguarda e confirma modais
      console.log('📝 Aguardando modais...');
      
      // Aguarda um pouco para o modal aparecer
      await page.waitForTimeout(2000);
      
      // Tenta confirmar qualquer modal SweetAlert2
      for (let i = 0; i < 3; i++) {
        try {
          await page.evaluate(() => {
            const btn = document.querySelector('.swal2-confirm');
            if (btn && btn instanceof HTMLElement) {
              btn.click();
              return true;
            }
            return false;
          });
          console.log(`✅ Modal ${i + 1} confirmado`);
          await page.waitForTimeout(1500);
        } catch (e) {
          // Ignora se não houver modal
        }
      }

      // Aguarda as credenciais aparecerem
      console.log('⏳ Aguardando credenciais...');
      await page.waitForTimeout(3000);
      
      // Captura as credenciais
      const result = await page.evaluate(() => {
        const text = document.body.innerText || '';
        
        // Procura padrões de credenciais
        const usuarioMatch = text.match(/USU[AÁ]RIO[:\s]+(\d{6,12})/i) ||
                            text.match(/USER[:\s]+(\d{6,12})/i) ||
                            text.match(/LOGIN[:\s]+(\d{6,12})/i);
        
        const senhaMatch = text.match(/SENHA[:\s]+([A-Za-z0-9]{6,20})/i) ||
                          text.match(/PASSWORD[:\s]+([A-Za-z0-9]{6,20})/i);
        
        if (usuarioMatch && senhaMatch) {
          const vencimentoMatch = text.match(/VENCIMENTO[:\s]+([^\n]+)/i) ||
                                 text.match(/VALIDADE[:\s]+([^\n]+)/i);
          
          return {
            usuario: usuarioMatch[1],
            senha: senhaMatch[1],
            vencimento: vencimentoMatch ? vencimentoMatch[1].trim() : undefined
          };
        }
        
        return null;
      });
      
      if (!result) {
        // Tenta capturar o HTML para debug
        const pageContent = await page.content();
        const htmlPath = `/tmp/onlineoffice-no-credentials-${Date.now()}.html`;
        fs.writeFileSync(htmlPath, pageContent.substring(0, 10000)); // Salva apenas primeiros 10KB
        console.error(`📄 HTML parcial salvo em: ${htmlPath}`);
        
        throw new Error(
          'Não foi possível capturar as credenciais. ' +
          'O site pode estar com problemas ou as credenciais não foram geradas. ' +
          'Tente acessar manualmente em https://onlineoffice.zip'
        );
      }

      console.log('🎉 Teste IPTV gerado com sucesso!');
      console.log(`📋 Usuário: ${result.usuario}`);
      console.log(`🔑 Senha: ${result.senha}`);
      if (result.vencimento) {
        console.log(`📅 Vencimento: ${result.vencimento}`);
      }
      
      return result;

    } catch (error) {
      console.error('❌ Erro na automação OnlineOffice:', error);
      
      // Se for erro de bloqueio, relança com mensagem clara
      if (error.message?.includes('SITE_BLOQUEADO')) {
        throw error;
      }
      
      // Para outros erros, tenta capturar screenshot
      if (browser) {
        try {
          const pages = await browser.pages();
          if (pages.length > 0) {
            const finalScreenshot = `/tmp/onlineoffice-error-${Date.now()}.png`;
            await pages[0].screenshot({ path: finalScreenshot, fullPage: true });
            console.error(`📸 Screenshot de erro: ${finalScreenshot}`);
          }
        } catch (e) {
          console.error('Não foi possível tirar screenshot:', e.message);
        }
      }
      
      throw error;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error('Erro ao fechar browser:', e.message);
        }
      }
    }
  }

  async generateIPTVTestManual(credentialsText: string): Promise<IPTVTestResult> {
    console.log('📋 Processando credenciais copiadas manualmente...');
    
    // Extrai credenciais de texto copiado manualmente
    const usuarioMatch = credentialsText.match(/USU[AÁ]RIO[:\s]+(\d{6,12})/i) ||
                         credentialsText.match(/USER[:\s]+(\d{6,12})/i) ||
                         credentialsText.match(/LOGIN[:\s]+(\d{6,12})/i);
    
    const senhaMatch = credentialsText.match(/SENHA[:\s]+([A-Za-z0-9]{6,20})/i) ||
                      credentialsText.match(/PASSWORD[:\s]+([A-Za-z0-9]{6,20})/i) ||
                      credentialsText.match(/PASS[:\s]+([A-Za-z0-9]{6,20})/i);
    
    const vencimentoMatch = credentialsText.match(/VENCIMENTO[:\s]+([^\n]+)/i) ||
                           credentialsText.match(/VALIDADE[:\s]+([^\n]+)/i) ||
                           credentialsText.match(/EXPIRA[:\s]+([^\n]+)/i);

    if (!usuarioMatch || !senhaMatch) {
      throw new Error(
        'Não foi possível extrair usuário e senha do texto fornecido. ' +
        'Certifique-se de copiar o texto completo com USUÁRIO e SENHA do site OnlineOffice. ' +
        'Formato esperado:\n' +
        'USUÁRIO: 123456\n' +
        'SENHA: abc123\n' +
        'VENCIMENTO: ...'
      );
    }

    const result = {
      usuario: usuarioMatch[1],
      senha: senhaMatch[1],
      vencimento: vencimentoMatch ? vencimentoMatch[1].trim() : undefined
    };
    
    console.log('✅ Credenciais extraídas com sucesso!');
    console.log(`📋 Usuário: ${result.usuario}`);
    console.log(`🔑 Senha: ${result.senha}`);
    if (result.vencimento) {
      console.log(`📅 Vencimento: ${result.vencimento}`);
    }
    
    return result;
  }
}

export default OnlineOfficeService;