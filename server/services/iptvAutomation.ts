import puppeteer from 'puppeteer';

export interface IPTVCredentials {
  usuario: string;
  senha: string;
}

export class IPTVAutomationService {
  private baseUrl = 'https://onlineoffice.zip';
  private username = 'gustavoprata17';
  private password = 'iptv102030';

  async gerarUsuarioTeste(): Promise<IPTVCredentials> {
    console.log('Iniciando automação IPTV...');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // Configura o viewport e user agent
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navega para a página de login
      console.log('Navegando para o painel IPTV...');
      await page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      // Aguarda a página carregar completamente
      await page.waitForTimeout(3000);
      
      // Procura pelo formulário de login
      console.log('Procurando formulário de login...');
      
      // Tenta encontrar e preencher o campo de usuário
      const usernameSelector = 'input[id="username"], input[name="username"], input[type="text"]';
      await page.waitForSelector(usernameSelector, { timeout: 10000 });
      await page.click(usernameSelector);
      await page.type(usernameSelector, this.username);
      
      // Tenta encontrar e preencher o campo de senha
      const passwordSelector = 'input[id="password"], input[name="password"], input[type="password"]';
      await page.waitForSelector(passwordSelector, { timeout: 5000 });
      await page.click(passwordSelector);
      await page.type(passwordSelector, this.password);
      
      // Pequena pausa
      await page.waitForTimeout(1000);
      
      // Procura e clica no botão de login
      console.log('Realizando login...');
      
      // Tenta várias formas de encontrar o botão de login
      const loginButtonSelectors = [
        'button[type="submit"]',
        'button:contains("Logar")',
        'button:contains("Login")',
        'input[type="submit"]',
        'button.btn-primary'
      ];
      
      let loginClicked = false;
      for (const selector of loginButtonSelectors) {
        try {
          if (selector.includes(':contains')) {
            const [button] = await page.$x(`//button[contains(text(), "${selector.match(/:contains\("(.+)"\)/)?.[1]}")]`);
            if (button) {
              await button.click();
              loginClicked = true;
              break;
            }
          } else {
            const button = await page.$(selector);
            if (button) {
              await button.click();
              loginClicked = true;
              break;
            }
          }
        } catch (e) {
          // Continua tentando outros seletores
        }
      }
      
      if (!loginClicked) {
        throw new Error('Não foi possível encontrar o botão de login');
      }
      
      // Aguarda o redirecionamento após login
      console.log('Aguardando dashboard...');
      await page.waitForTimeout(5000);
      
      // Procura pelo botão "Gerar IPTV"
      console.log('Procurando botão Gerar IPTV...');
      
      // Tenta encontrar o botão através de diferentes métodos
      let gerarButton = null;
      
      // Método 1: XPath com texto
      try {
        const [xpathButton] = await page.$x('//button[contains(text(), "Gerar IPTV")]');
        if (xpathButton) gerarButton = xpathButton;
      } catch (e) {}
      
      // Método 2: Selector CSS
      if (!gerarButton) {
        try {
          gerarButton = await page.$('button.gerar-iptv, button#gerar-iptv');
        } catch (e) {}
      }
      
      // Método 3: Procura por todos os botões e verifica o texto
      if (!gerarButton) {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && text.includes('Gerar IPTV')) {
            gerarButton = button;
            break;
          }
        }
      }
      
      if (!gerarButton) {
        throw new Error('Botão "Gerar IPTV" não encontrado');
      }
      
      await gerarButton.click();
      console.log('Clicou em Gerar IPTV');
      
      // Aguarda o modal/popup aparecer
      await page.waitForTimeout(2000);
      
      // Preenche a nota
      console.log('Preenchendo dados do teste...');
      const notaSelectors = [
        'input[placeholder*="nota" i]',
        'input[name*="nota" i]',
        'input#nota'
      ];
      
      let notaFilled = false;
      for (const selector of notaSelectors) {
        try {
          const input = await page.$(selector);
          if (input) {
            await input.click();
            await input.type('teste');
            notaFilled = true;
            break;
          }
        } catch (e) {}
      }
      
      if (!notaFilled) {
        console.log('Campo de nota não encontrado, continuando...');
      }
      
      // Seleciona "6 Horas" no dropdown
      console.log('Selecionando duração...');
      try {
        // Tenta encontrar o select
        const selectElement = await page.$('select');
        if (selectElement) {
          await page.select('select', '6 Horas');
        } else {
          // Alternativa: procura por dropdown customizado
          const [option] = await page.$x('//option[contains(text(), "6 Horas")]');
          if (option) {
            await option.click();
          }
        }
      } catch (e) {
        console.log('Não foi possível selecionar duração, usando padrão');
      }
      
      await page.waitForTimeout(1000);
      
      // Clica em Confirmar
      console.log('Confirmando geração...');
      const confirmarSelectors = [
        '//button[contains(text(), "Confirmar")]',
        '//button[contains(text(), "Gerar")]',
        '//button[contains(text(), "OK")]',
        '//button[contains(@class, "confirm")]'
      ];
      
      let confirmClicked = false;
      for (const selector of confirmarSelectors) {
        try {
          const [button] = await page.$x(selector);
          if (button) {
            await button.click();
            confirmClicked = true;
            break;
          }
        } catch (e) {}
      }
      
      if (!confirmClicked) {
        // Tenta clicar em qualquer botão de confirmação
        const buttons = await page.$$('button.btn-primary, button.btn-success');
        if (buttons.length > 0) {
          await buttons[0].click();
        }
      }
      
      // Aguarda as credenciais aparecerem
      console.log('Aguardando credenciais...');
      await page.waitForTimeout(5000);
      
      // Extrai as credenciais
      const credenciais = await page.evaluate(() => {
        let usuario = '';
        let senha = '';
        
        // Procura em todos os elementos da página
        const allText = document.body.innerText;
        
        // Regex para encontrar usuário
        const usuarioMatch = allText.match(/USU[AÁ]RIO[:]?\s*([^\s\n]+)/i);
        if (usuarioMatch) {
          usuario = usuarioMatch[1].trim();
        }
        
        // Regex para encontrar senha
        const senhaMatch = allText.match(/SENHA[:]?\s*([^\s\n]+)/i);
        if (senhaMatch) {
          senha = senhaMatch[1].trim();
        }
        
        // Se não encontrou, tenta procurar em elementos específicos
        if (!usuario || !senha) {
          const elements = document.querySelectorAll('p, span, div, td, h1, h2, h3, h4, h5, h6');
          for (const element of elements) {
            const text = element.textContent || '';
            
            if (!usuario && (text.includes('USUÁRIO:') || text.includes('Usuário:'))) {
              const parts = text.split(':');
              if (parts.length > 1) {
                usuario = parts[1].trim();
              }
            }
            
            if (!senha && (text.includes('SENHA:') || text.includes('Senha:'))) {
              const parts = text.split(':');
              if (parts.length > 1) {
                senha = parts[1].trim();
              }
            }
          }
        }
        
        return { usuario, senha };
      });
      
      console.log('Credenciais extraídas:', { 
        usuario: credenciais.usuario ? '***' : 'não encontrado',
        senha: credenciais.senha ? '***' : 'não encontrado'
      });
      
      if (!credenciais.usuario || !credenciais.senha) {
        // Tenta capturar screenshot para debug
        try {
          await page.screenshot({ path: '/tmp/iptv-error.png' });
          console.log('Screenshot salvo em /tmp/iptv-error.png');
        } catch (e) {}
        
        throw new Error('Não foi possível extrair as credenciais geradas');
      }
      
      return credenciais;
      
    } catch (error: any) {
      console.error('Erro na automação IPTV:', error);
      throw new Error(`Falha na automação IPTV: ${error.message}`);
    } finally {
      await browser.close();
    }
  }
}

export const iptvAutomation = new IPTVAutomationService();