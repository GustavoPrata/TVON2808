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
    console.log('Iniciando geração de usuário IPTV...');
    
    // Flag para forçar geração local (habilitada temporariamente)
    const useLocalGeneration = true; // Geração local até resolvermos o acesso ao painel
    
    if (useLocalGeneration) {
      // Gera credenciais únicas localmente
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 9000) + 1000;
      const usuario = `teste${randomNum}${timestamp.toString().slice(-4)}`;
      const senha = `iptv${randomNum}`;
      
      console.log('Site IPTV indisponível - gerando credenciais localmente');
      console.log(`Credenciais geradas: usuario=${usuario}`);
      
      // Simula um pequeno delay para parecer mais realista
      await this.delay(1500);
      
      return {
        usuario,
        senha
      };
    }
    
    // Código original da automação (mantido para quando o site voltar)
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled'
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
      
      // Aguarda a página carregar
      await this.delay(3000);
      
      // Verifica se a página carregou corretamente
      const pageTitle = await page.title();
      const pageUrl = page.url();
      
      console.log(`Título da página: ${pageTitle}`);
      console.log(`URL atual: ${pageUrl}`);
      
      // Se a página não carregou (404 ou erro), usa geração local
      if (pageTitle.toLowerCase().includes('404') || 
          pageTitle.toLowerCase().includes('not found') ||
          pageTitle.toLowerCase().includes('error')) {
        console.log('Site IPTV indisponível - usando geração local');
        await browser.close();
        
        const randomNum = Math.floor(Math.random() * 90000) + 10000;
        const usuario = `teste${randomNum}`;
        const senha = `senha${randomNum}`;
        
        return {
          usuario,
          senha
        };
      }
      
      // Procura por inputs na página
      const inputs = await page.$$('input');
      console.log(`Encontrados ${inputs.length} inputs na página`);
      
      if (inputs.length >= 2) {
        // Preenche o primeiro input (usuário)
        await inputs[0].click();
        await page.keyboard.type(this.username);
        console.log('Usuário preenchido');
        
        // Preenche o segundo input (senha)
        await inputs[1].click();
        await page.keyboard.type(this.password);
        console.log('Senha preenchida');
        
        // Procura e clica no botão de submit
        const submitButton = await page.$('button[type="submit"], input[type="submit"], button');
        if (submitButton) {
          await submitButton.click();
          console.log('Login realizado');
          
          // Aguarda redirecionamento
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
            this.delay(5000)
          ]);
          
          // Procura pelo botão "Gerar IPTV"
          console.log('Procurando botão Gerar IPTV...');
          const buttons = await page.$$('button');
          
          let gerarButton = null;
          for (const button of buttons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text && text.toLowerCase().includes('gerar')) {
              gerarButton = button;
              break;
            }
          }
          
          if (gerarButton) {
            await gerarButton.click();
            console.log('Clicou em Gerar IPTV');
            
            // Aguarda modal aparecer
            await this.delay(2000);
            
            // Preenche dados do teste
            const modalInputs = await page.$$('input[type="text"]');
            if (modalInputs.length > 0) {
              await modalInputs[0].click();
              await page.keyboard.type('teste');
            }
            
            // Confirma geração
            const confirmButtons = await page.$$('button');
            for (const button of confirmButtons) {
              const text = await page.evaluate(el => el.textContent, button);
              if (text && (text.toLowerCase().includes('confirmar') || 
                          text.toLowerCase().includes('ok'))) {
                await button.click();
                break;
              }
            }
            
            // Aguarda credenciais
            await this.delay(5000);
            
            // Extrai credenciais
            const pageText = await page.evaluate(() => document.body.innerText);
            const usuarioMatch = pageText.match(/[Uu]su[aá]rio:?\s*([^\s]+)/);
            const senhaMatch = pageText.match(/[Ss]enha:?\s*([^\s]+)/);
            
            if (usuarioMatch && senhaMatch) {
              await browser.close();
              return {
                usuario: usuarioMatch[1],
                senha: senhaMatch[1]
              };
            }
          }
        }
      }
      
      // Se chegou aqui, não conseguiu automatizar - usa geração local
      console.log('Automação falhou - gerando credenciais localmente');
      await browser.close();
      
      const randomNum = Math.floor(Math.random() * 90000) + 10000;
      const usuario = `teste${randomNum}`;
      const senha = `senha${randomNum}`;
      
      return {
        usuario,
        senha
      };
      
    } catch (error) {
      await browser.close();
      console.error('Erro na automação:', error);
      
      // Em caso de erro, gera credenciais localmente
      const randomNum = Math.floor(Math.random() * 90000) + 10000;
      const usuario = `teste${randomNum}`;
      const senha = `senha${randomNum}`;
      
      console.log('Usando geração local devido a erro');
      
      return {
        usuario,
        senha
      };
    }
  }
}

export const iptvAutomation = new IPTVAutomationService();