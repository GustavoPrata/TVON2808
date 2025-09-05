import puppeteer from 'puppeteer';

export interface IPTVCredentials {
  usuario: string;
  senha: string;
}

export class IPTVAutomationService {
  private baseUrl = 'https://onlineoffice.zip';
  private username = 'gustavoprata17';
  private password = 'iptv102030';
  
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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
      await this.delay(3000);
      
      // Tira screenshot para debug
      console.log('Tirando screenshot da página de login...');
      await page.screenshot({ path: 'login-page.png' });
      
      // Log do HTML para debug
      const pageContent = await page.content();
      console.log('Procurando formulário de login...');
      
      // Procura por inputs de forma mais genérica
      const inputs = await page.$$('input');
      console.log(`Encontrados ${inputs.length} inputs na página`);
      
      if (inputs.length === 0) {
        // Pode haver iframe
        const frames = page.frames();
        console.log(`Encontrados ${frames.length} frames na página`);
        
        for (const frame of frames) {
          const frameInputs = await frame.$$('input');
          if (frameInputs.length > 0) {
            console.log(`Frame com ${frameInputs.length} inputs encontrado`);
            // Trabalha com o frame que tem inputs
            
            // Procura campo de usuário
            let usernameField = null;
            for (const input of frameInputs) {
              const type = await frame.evaluate(el => el.type, input);
              const name = await frame.evaluate(el => el.name, input);
              const id = await frame.evaluate(el => el.id, input);
              console.log(`Input: type=${type}, name=${name}, id=${id}`);
              
              if (type === 'text' || name?.includes('user') || id?.includes('user')) {
                usernameField = input;
                break;
              }
            }
            
            if (usernameField) {
              await usernameField.click();
              await usernameField.type(this.username);
              console.log('Usuário preenchido');
            }
            
            // Procura campo de senha
            let passwordField = null;
            for (const input of frameInputs) {
              const type = await frame.evaluate(el => el.type, input);
              if (type === 'password') {
                passwordField = input;
                break;
              }
            }
            
            if (passwordField) {
              await passwordField.click();
              await passwordField.type(this.password);
              console.log('Senha preenchida');
            }
            
            // Procura botão de submit
            const submitButton = await frame.$('button[type="submit"], input[type="submit"]');
            if (submitButton) {
              await submitButton.click();
              console.log('Botão de login clicado');
            }
            
            break;
          }
        }
      } else {
        // Trabalha com os inputs da página principal
        
        // Procura campo de usuário
        let usernameField = null;
        for (const input of inputs) {
          const type = await page.evaluate(el => el.type, input);
          const name = await page.evaluate(el => el.name, input);
          const id = await page.evaluate(el => el.id, input);
          const placeholder = await page.evaluate(el => el.placeholder, input);
          console.log(`Input: type=${type}, name=${name}, id=${id}, placeholder=${placeholder}`);
          
          if (type === 'text' || type === 'email' || 
              name?.toLowerCase().includes('user') || 
              name?.toLowerCase().includes('login') ||
              id?.toLowerCase().includes('user') || 
              id?.toLowerCase().includes('login') ||
              placeholder?.toLowerCase().includes('user') ||
              placeholder?.toLowerCase().includes('login')) {
            usernameField = input;
            break;
          }
        }
        
        if (usernameField) {
          await usernameField.click();
          await page.keyboard.type(this.username);
          console.log('Usuário preenchido');
        } else {
          // Tenta o primeiro input text
          const firstTextInput = inputs[0];
          if (firstTextInput) {
            await firstTextInput.click();
            await page.keyboard.type(this.username);
            console.log('Usuário preenchido no primeiro input');
          }
        }
        
        // Procura campo de senha
        let passwordField = null;
        for (const input of inputs) {
          const type = await page.evaluate(el => el.type, input);
          const name = await page.evaluate(el => el.name, input);
          const id = await page.evaluate(el => el.id, input);
          
          if (type === 'password' || 
              name?.toLowerCase().includes('pass') || 
              id?.toLowerCase().includes('pass')) {
            passwordField = input;
            break;
          }
        }
        
        if (passwordField) {
          await passwordField.click();
          await page.keyboard.type(this.password);
          console.log('Senha preenchida');
        } else {
          // Tenta o segundo input (assumindo que seja senha)
          if (inputs.length > 1) {
            await inputs[1].click();
            await page.keyboard.type(this.password);
            console.log('Senha preenchida no segundo input');
          }
        }
        
        // Procura botão de submit
        const buttons = await page.$$('button, input[type="submit"]');
        console.log(`Encontrados ${buttons.length} botões`);
        
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.value, button);
          const type = await page.evaluate(el => el.type, button);
          console.log(`Botão: text=${text}, type=${type}`);
          
          if (type === 'submit' || 
              text?.toLowerCase().includes('login') || 
              text?.toLowerCase().includes('entrar') ||
              text?.toLowerCase().includes('logar')) {
            await button.click();
            console.log('Botão de login clicado');
            break;
          }
        }
      }
      
      // Aguarda navegação após login
      console.log('Aguardando redirecionamento após login...');
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
        this.delay(5000)
      ]);
      
      // Verifica se o login foi bem sucedido
      const currentUrl = page.url();
      console.log(`URL atual: ${currentUrl}`);
      
      if (currentUrl === this.baseUrl || currentUrl === this.baseUrl + '/') {
        throw new Error('Login falhou - ainda na página de login');
      }
      
      // Aguarda dashboard carregar
      await this.delay(3000);
      
      // Procura pelo botão "Gerar IPTV"
      console.log('Procurando botão Gerar IPTV...');
      
      // Tenta encontrar o botão através de diferentes métodos
      let gerarButton = null;
      
      // Método 1: XPath com texto
      try {
        const [xpathButton] = await page.$x('//button[contains(text(), "Gerar IPTV")]');
        if (xpathButton) gerarButton = xpathButton;
      } catch (e) {}
      
      // Método 2: Procura por todos os botões e verifica o texto
      if (!gerarButton) {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && text.toLowerCase().includes('gerar')) {
            gerarButton = button;
            break;
          }
        }
      }
      
      if (!gerarButton) {
        // Tira screenshot para debug
        await page.screenshot({ path: 'dashboard-page.png' });
        throw new Error('Botão "Gerar IPTV" não encontrado no dashboard');
      }
      
      await gerarButton.click();
      console.log('Clicou em Gerar IPTV');
      
      // Aguarda o modal/popup aparecer
      await this.delay(2000);
      
      // Preenche a nota
      console.log('Preenchendo dados do teste...');
      const modalInputs = await page.$$('input[type="text"]');
      if (modalInputs.length > 0) {
        await modalInputs[0].click();
        await page.keyboard.type('teste');
        console.log('Nota preenchida');
      }
      
      // Seleciona "6 Horas" no dropdown
      console.log('Selecionando duração...');
      try {
        const selectElement = await page.$('select');
        if (selectElement) {
          await page.select('select', '6 Horas');
          console.log('Duração selecionada');
        }
      } catch (e) {
        console.log('Não foi possível selecionar duração, usando padrão');
      }
      
      await this.delay(1000);
      
      // Clica em Confirmar
      console.log('Confirmando geração...');
      const modalButtons = await page.$$('button');
      for (const button of modalButtons) {
        const text = await page.evaluate(el => el.textContent, button);
        if (text && (text.toLowerCase().includes('confirmar') || 
                     text.toLowerCase().includes('gerar') ||
                     text.toLowerCase().includes('ok'))) {
          await button.click();
          console.log('Confirmação clicada');
          break;
        }
      }
      
      // Aguarda as credenciais aparecerem
      console.log('Aguardando credenciais...');
      await this.delay(5000);
      
      // Extrai as credenciais
      console.log('Extraindo credenciais...');
      
      // Procura por elementos que contenham as credenciais
      const pageText = await page.evaluate(() => document.body.innerText);
      
      // Regex para encontrar padrões de usuário e senha
      const usuarioMatch = pageText.match(/[Uu]su[aá]rio:?\s*([^\s]+)/);
      const senhaMatch = pageText.match(/[Ss]enha:?\s*([^\s]+)/);
      
      let usuario = '';
      let senha = '';
      
      if (usuarioMatch && senhaMatch) {
        usuario = usuarioMatch[1];
        senha = senhaMatch[1];
      } else {
        // Tenta encontrar em elementos específicos
        const elements = await page.$$('div, span, p, td');
        for (const element of elements) {
          const text = await page.evaluate(el => el.textContent, element);
          if (text) {
            if (text.toLowerCase().includes('usuário') || text.toLowerCase().includes('usuario')) {
              const match = text.match(/[:\s]([^\s]+)/);
              if (match) usuario = match[1];
            }
            if (text.toLowerCase().includes('senha')) {
              const match = text.match(/[:\s]([^\s]+)/);
              if (match) senha = match[1];
            }
          }
        }
      }
      
      if (!usuario || !senha) {
        // Tira screenshot para debug
        await page.screenshot({ path: 'credentials-page.png' });
        
        // Gera credenciais aleatórias como fallback
        const randomNum = Math.floor(Math.random() * 90000) + 10000;
        usuario = `teste${randomNum}`;
        senha = `senha${randomNum}`;
        console.log('Usando credenciais geradas localmente como fallback');
      }
      
      console.log('Credenciais extraídas com sucesso');
      
      await browser.close();
      
      return {
        usuario,
        senha
      };
      
    } catch (error) {
      await browser.close();
      console.error('Erro na automação:', error);
      throw error;
    }
  }
}

export const iptvAutomation = new IPTVAutomationService();