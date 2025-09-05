import puppeteer from 'puppeteer';

export interface IPTVCredentials {
  usuario: string;
  senha: string;
}

export class IPTVAutomationService {
  private baseUrl = 'https://onlineoffice.zip/#/dashboard';
  private username = 'gustavoprata17';
  private password = 'iptv102030';

  async gerarUsuarioTeste(): Promise<IPTVCredentials> {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // Define viewport
      await page.setViewport({ width: 1280, height: 800 });
      
      // Navega para a página
      console.log('Navegando para o painel IPTV...');
      await page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Aguarda um pouco para a página carregar completamente
      await page.waitForTimeout(2000);
      
      // Aguarda o formulário de login carregar
      await page.waitForSelector('#username', { timeout: 10000 });
      
      // Preenche o usuário
      console.log('Preenchendo credenciais...');
      await page.type('#username', this.username);
      await page.waitForTimeout(500);
      
      // Preenche a senha
      await page.type('#password', this.password);
      await page.waitForTimeout(500);
      
      // Tenta marcar checkbox "Não sou um robô" se existir
      try {
        await page.waitForSelector('input[type="checkbox"]', { timeout: 2000 });
        await page.click('input[type="checkbox"]');
        await page.waitForTimeout(500);
      } catch (e) {
        console.log('Checkbox não encontrado, continuando...');
      }
      
      // Clica no botão de login
      console.log('Realizando login...');
      await page.waitForXPath('//button[contains(text(), "Logar")]', { timeout: 5000 });
      await page.click('button[type="submit"]');
      
      // Aguarda a página carregar após login
      await page.waitForTimeout(3000);
      
      // Aguarda e clica no botão "Gerar IPTV"
      console.log('Procurando botão Gerar IPTV...');
      await page.waitForTimeout(2000);
      const gerarButtonXPath = '//button[contains(text(), "Gerar IPTV")]';
      await page.waitForXPath(gerarButtonXPath, { timeout: 10000 });
      const [gerarButton] = await page.$x(gerarButtonXPath);
      await gerarButton?.click();
      
      // Aguarda modal/popup aparecer
      await page.waitForTimeout(2000);
      
      // Preenche a nota
      console.log('Preenchendo dados do teste...');
      const notaInputXPath = '//input[contains(@placeholder, "nota")]';
      await page.waitForXPath(notaInputXPath, { timeout: 5000 });
      const [notaInput] = await page.$x(notaInputXPath);
      await notaInput?.type('teste');
      await page.waitForTimeout(500);
      
      // Seleciona "6 Horas" no dropdown
      try {
        const selectElement = await page.waitForSelector('select', { timeout: 5000 });
        if (selectElement) {
          await page.select('select', '6 Horas');
        }
      } catch (e) {
        // Alternativa: tenta clicar na opção diretamente
        await page.click('select');
        await page.waitForTimeout(500);
        const optionXPath = '//option[contains(text(), "6 Horas")]';
        const [option] = await page.$x(optionXPath);
        await option?.click();
      }
      await page.waitForTimeout(500);
      
      // Clica em Confirmar
      console.log('Confirmando geração...');
      const confirmarButtonXPath = '//button[contains(text(), "Confirmar")]';
      await page.waitForXPath(confirmarButtonXPath, { timeout: 5000 });
      const [confirmarButton] = await page.$x(confirmarButtonXPath);
      await confirmarButton?.click();
      
      // Aguarda credenciais aparecerem
      await page.waitForTimeout(3000);
      
      // Extrai usuário e senha
      const credenciais = await page.evaluate(() => {
        let usuario = '';
        let senha = '';
        
        // Procura pelos elementos que contêm as credenciais
        const elements = document.querySelectorAll('p, span, div');
        
        for (let i = 0; i < elements.length; i++) {
          const text = elements[i].textContent || '';
          
          if (text.includes('USUÁRIO:') || text.includes('Usuário:')) {
            // Tenta pegar o próximo elemento ou o texto após os dois pontos
            if (elements[i + 1]) {
              usuario = elements[i + 1].textContent?.trim() || '';
            } else {
              const match = text.match(/USU[AÁ]RIO:\s*(.+)/i);
              if (match) usuario = match[1].trim();
            }
          }
          
          if (text.includes('SENHA:') || text.includes('Senha:')) {
            // Tenta pegar o próximo elemento ou o texto após os dois pontos
            if (elements[i + 1]) {
              senha = elements[i + 1].textContent?.trim() || '';
            } else {
              const match = text.match(/SENHA:\s*(.+)/i);
              if (match) senha = match[1].trim();
            }
          }
        }
        
        return { usuario, senha };
      });
      
      console.log('Credenciais extraídas:', credenciais);
      
      if (!credenciais.usuario || !credenciais.senha) {
        throw new Error('Não foi possível extrair as credenciais geradas');
      }
      
      return credenciais;
      
    } catch (error) {
      console.error('Erro na automação:', error);
      throw new Error(`Falha na automação IPTV: ${error.message}`);
    } finally {
      await browser.close();
    }
  }
}

export const iptvAutomation = new IPTVAutomationService();