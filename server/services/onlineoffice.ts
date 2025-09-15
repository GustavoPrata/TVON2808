import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

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
      console.log('🚀 Iniciando automação OnlineOffice...');
      
      const executablePath = this.getChromiumPath();
      
      // Inicia o navegador com configurações específicas
      browser = await puppeteer.launch({
        headless: 'new',
        executablePath: executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-accelerated-2d-canvas',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      const page = await browser.newPage();
      
      // Define user agent e viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 720 });

      console.log('📍 Navegando para OnlineOffice...');
      await page.goto('https://onlineoffice.zip/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Aguarda a página carregar e o botão ficar disponível
      console.log('⏳ Aguardando página carregar completamente...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('🔍 Procurando botão Gerar IPTV com XPath...');
      
      // Usa XPath preciso para encontrar o botão
      const buttonXPath = "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'gerar iptv') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'gerar teste')]";
      
      try {
        await page.waitForXPath(buttonXPath, { timeout: 10000 });
        const [gerarButton] = await page.$x(buttonXPath);
        
        if (gerarButton) {
          console.log('✅ Botão encontrado, clicando...');
          await gerarButton.click();
        } else {
          throw new Error('Botão Gerar IPTV não encontrado');
        }
      } catch (error) {
        console.log('⚠️ Não encontrou por XPath, tentando método alternativo...');
        
        // Fallback: tenta clicar usando evaluate
        const clicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const button = buttons.find(btn => {
            const text = btn.textContent?.toLowerCase() || '';
            return text.includes('gerar iptv') || text.includes('gerar teste');
          });
          
          if (button) {
            (button as HTMLElement).click();
            return true;
          }
          return false;
        });
        
        if (!clicked) {
          throw new Error('Não foi possível clicar no botão Gerar IPTV');
        }
      }

      // PRIMEIRO MODAL: Aguarda e confirma modal SweetAlert2 (nota do usuário)
      console.log('📝 Aguardando primeiro modal (SweetAlert2)...');
      
      try {
        await page.waitForSelector('.swal2-popup', { timeout: 5000 });
        console.log('✅ Primeiro modal detectado');
        
        // Pequena pausa para garantir que o modal está totalmente renderizado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Clica no botão de confirmar do SweetAlert2
        const confirmButton = await page.$('.swal2-confirm');
        if (confirmButton) {
          console.log('🔘 Clicando em confirmar primeiro modal...');
          await confirmButton.click();
        } else {
          // Tenta método alternativo
          await page.evaluate(() => {
            const btn = document.querySelector('.swal2-confirm') as HTMLElement;
            if (btn) btn.click();
          });
        }
      } catch (error) {
        console.log('⚠️ Primeiro modal não apareceu ou já foi fechado');
      }

      // SEGUNDO MODAL: Aguarda e confirma segundo modal (tempo de teste)
      console.log('⏱️ Aguardando segundo modal (tempo de teste)...');
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Pequena pausa entre modais
      
      try {
        await page.waitForSelector('.swal2-popup', { timeout: 5000 });
        console.log('✅ Segundo modal detectado');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Clica no botão de confirmar do segundo modal
        const confirmButton = await page.$('.swal2-confirm');
        if (confirmButton) {
          console.log('🔘 Clicando em confirmar segundo modal...');
          await confirmButton.click();
        } else {
          await page.evaluate(() => {
            const btn = document.querySelector('.swal2-confirm') as HTMLElement;
            if (btn) btn.click();
          });
        }
      } catch (error) {
        console.log('⚠️ Segundo modal não apareceu ou já foi fechado');
      }

      console.log('⏳ Aguardando resultado ser gerado...');
      
      // Aguarda o resultado aparecer (com polling e timeout maior)
      let result: IPTVTestResult | null = null;
      const maxAttempts = 30; // 30 segundos no máximo
      let attempts = 0;
      
      while (!result && attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Tentativa ${attempts}/${maxAttempts} de capturar credenciais...`);
        
        // Aguarda 1 segundo entre tentativas
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Tenta capturar os dados
        const capturedData = await page.evaluate(() => {
          // Procura primeiro em modais/containers de resultado
          const resultContainers = [
            '.swal2-html-container',
            '.swal2-content',
            '.result-container',
            '.credentials-container',
            '[class*="result"]',
            '[class*="credential"]',
            '[id*="result"]',
            '[id*="credential"]'
          ];
          
          for (const selector of resultContainers) {
            const container = document.querySelector(selector);
            if (container) {
              const text = container.textContent || '';
              
              // Procura por padrões específicos de credenciais
              const usuarioMatch = text.match(/USUÁRIO[:\s]+(\d{6,12})/i) ||
                                  text.match(/USER[:\s]+(\d{6,12})/i) ||
                                  text.match(/USUARIO[:\s]+(\d{6,12})/i) ||
                                  text.match(/Login[:\s]+(\d{6,12})/i);
              
              const senhaMatch = text.match(/SENHA[:\s]+([A-Za-z0-9]{6,20})/i) ||
                                text.match(/PASSWORD[:\s]+([A-Za-z0-9]{6,20})/i) ||
                                text.match(/PASS[:\s]+([A-Za-z0-9]{6,20})/i);
              
              if (usuarioMatch && senhaMatch) {
                const vencimentoMatch = text.match(/VENCIMENTO[:\s]+([^\n]+)/i) ||
                                       text.match(/EXPIRA[:\s]+([^\n]+)/i) ||
                                       text.match(/VALIDADE[:\s]+([^\n]+)/i) ||
                                       text.match(/VÁLIDO ATÉ[:\s]+([^\n]+)/i);
                
                return {
                  usuario: usuarioMatch[1],
                  senha: senhaMatch[1],
                  vencimento: vencimentoMatch ? vencimentoMatch[1].trim() : ''
                };
              }
            }
          }
          
          // Se não encontrou em containers, procura no body todo (mas com mais critério)
          const bodyText = document.body.innerText;
          
          // Divide o texto em linhas para análise mais precisa
          const lines = bodyText.split('\n');
          let usuario = '';
          let senha = '';
          let vencimento = '';
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Procura por linha com USUÁRIO
            if (line.match(/USUÁRIO[:\s]/i) || line.match(/USER[:\s]/i)) {
              const match = line.match(/[:\s]+(\d{6,12})/);
              if (match) usuario = match[1];
              // Ou pega a próxima linha se o valor estiver nela
              else if (i + 1 < lines.length && lines[i + 1].match(/^\d{6,12}$/)) {
                usuario = lines[i + 1].trim();
              }
            }
            
            // Procura por linha com SENHA
            if (line.match(/SENHA[:\s]/i) || line.match(/PASSWORD[:\s]/i)) {
              const match = line.match(/[:\s]+([A-Za-z0-9]{6,20})/);
              if (match && !match[1].startsWith('$')) { // Evita capturar valores monetários
                senha = match[1];
              }
              // Ou pega a próxima linha se o valor estiver nela
              else if (i + 1 < lines.length && lines[i + 1].match(/^[A-Za-z0-9]{6,20}$/)) {
                const nextLine = lines[i + 1].trim();
                if (!nextLine.startsWith('$')) {
                  senha = nextLine;
                }
              }
            }
            
            // Procura por vencimento
            if (line.match(/VENCIMENTO[:\s]/i) || line.match(/VALIDADE[:\s]/i)) {
              const match = line.match(/[:\s]+(.+)/);
              if (match) vencimento = match[1].trim();
              else if (i + 1 < lines.length) {
                vencimento = lines[i + 1].trim();
              }
            }
          }
          
          // Valida as credenciais capturadas
          if (usuario && senha && 
              usuario.match(/^\d{6,12}$/) && 
              senha.match(/^[A-Za-z0-9]{6,20}$/) &&
              !senha.startsWith('$')) {
            return {
              usuario,
              senha,
              vencimento
            };
          }
          
          return null;
        });
        
        if (capturedData && capturedData.usuario && capturedData.senha) {
          result = capturedData;
          console.log('✅ Credenciais capturadas com sucesso!');
          console.log(`📋 Usuário: ${result.usuario}`);
          console.log(`🔑 Senha: ${result.senha}`);
          if (result.vencimento) {
            console.log(`📅 Vencimento: ${result.vencimento}`);
          }
        }
      }
      
      // Se não conseguiu capturar após todas as tentativas
      if (!result) {
        // Tira screenshot para debug
        const screenshotPath = `/tmp/onlineoffice-error-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.error(`❌ Screenshot salvo em: ${screenshotPath}`);
        
        // Captura o HTML para debug
        const pageContent = await page.content();
        const htmlPath = `/tmp/onlineoffice-error-${Date.now()}.html`;
        const fs = require('fs');
        fs.writeFileSync(htmlPath, pageContent);
        console.error(`❌ HTML salvo em: ${htmlPath}`);
        
        throw new Error('Não foi possível capturar credenciais reais do OnlineOffice após 30 tentativas. Verifique se o site está funcionando corretamente.');
      }

      console.log('🎉 Teste IPTV gerado com sucesso!');
      return result;

    } catch (error) {
      console.error('❌ Erro na automação OnlineOffice:', error);
      
      // Se o browser estiver aberto, tira screenshot final
      if (browser) {
        try {
          const pages = await browser.pages();
          if (pages.length > 0) {
            const screenshotPath = `/tmp/onlineoffice-final-error-${Date.now()}.png`;
            await pages[0].screenshot({ path: screenshotPath, fullPage: true });
            console.error(`📸 Screenshot final salvo em: ${screenshotPath}`);
          }
        } catch (e) {
          console.error('Não foi possível tirar screenshot final:', e);
        }
      }
      
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async generateIPTVTestManual(credentialsText: string): Promise<IPTVTestResult> {
    // Extrai credenciais de texto copiado manualmente
    const usuarioMatch = credentialsText.match(/USUÁRIO[:\s]+(\d{6,12})/i);
    const senhaMatch = credentialsText.match(/SENHA[:\s]+([A-Za-z0-9]{6,20})/i);
    const vencimentoMatch = credentialsText.match(/VENCIMENTO[:\s]+([^\n]+)/i);

    if (!usuarioMatch || !senhaMatch) {
      throw new Error('Não foi possível extrair usuário e senha válidos do texto fornecido. Certifique-se de que o usuário contém apenas dígitos (6-12) e a senha é alfanumérica (6-20 caracteres).');
    }

    return {
      usuario: usuarioMatch[1],
      senha: senhaMatch[1],
      vencimento: vencimentoMatch ? vencimentoMatch[1].trim() : undefined
    };
  }
}

export default OnlineOfficeService;