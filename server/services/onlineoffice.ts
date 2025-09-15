import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { createCursor } from 'ghost-cursor';

// Adiciona o plugin stealth para evitar detecção de bots
puppeteer.use(StealthPlugin());

interface IPTVTestResult {
  usuario: string;
  senha: string;
  vencimento?: string;
}

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

  // Helper function to generate random delay
  private randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Helper function to generate random user agents
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  // Generate realistic viewport dimensions
  private getRandomViewport(): { width: number; height: number } {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 },
      { width: 1600, height: 900 }
    ];
    const viewport = viewports[Math.floor(Math.random() * viewports.length)];
    // Add small random variation
    return {
      width: viewport.width + this.randomDelay(-20, 20),
      height: viewport.height + this.randomDelay(-20, 20)
    };
  }

  // Simulate human-like scrolling
  private async humanScroll(page: any, cursor: any): Promise<void> {
    console.log('📜 Realizando scroll humanizado...');
    
    // Random number of scrolls
    const scrollCount = this.randomDelay(2, 4);
    
    for (let i = 0; i < scrollCount; i++) {
      // Move mouse to random position first
      const x = this.randomDelay(100, 800);
      const y = this.randomDelay(100, 600);
      await cursor.move({ x, y });
      await page.waitForTimeout(this.randomDelay(200, 500));
      
      // Scroll with random distance
      const scrollDistance = this.randomDelay(100, 300);
      const direction = Math.random() > 0.5 ? 1 : -1;
      
      await page.evaluate((distance) => {
        window.scrollBy({
          top: distance,
          behavior: 'smooth'
        });
      }, scrollDistance * direction);
      
      await page.waitForTimeout(this.randomDelay(500, 1500));
    }
    
    // Return to top smoothly
    await page.evaluate(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
    await page.waitForTimeout(this.randomDelay(500, 1000));
  }

  // Simulate random mouse movements
  private async randomMouseMovements(page: any, cursor: any, count: number = 3): Promise<void> {
    console.log('🖱️ Realizando movimentos aleatórios do mouse...');
    
    for (let i = 0; i < count; i++) {
      const x = this.randomDelay(100, 1200);
      const y = this.randomDelay(100, 700);
      
      // Use ghost-cursor for natural movement
      await cursor.move({ x, y });
      
      // Random pause between movements
      await page.waitForTimeout(this.randomDelay(300, 800));
    }
  }

  async generateIPTVWithHumanBehavior(): Promise<IPTVTestResult> {
    let browser;
    
    try {
      console.log('🎭 Iniciando automação OnlineOffice com comportamento humano avançado...');
      
      const executablePath = this.getChromiumPath();
      const viewport = this.getRandomViewport();
      const userAgent = this.getRandomUserAgent();
      
      console.log(`📐 Viewport: ${viewport.width}x${viewport.height}`);
      console.log(`🌐 User Agent: ${userAgent}`);
      
      // Launch browser with ultra-advanced anti-detection
      browser = await puppeteer.launch({
        headless: 'new', // Use new headless mode which is less detectable
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
          `--window-size=${viewport.width},${viewport.height}`,
          '--start-maximized',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--user-data-dir=/tmp/puppeteer_user_data_' + Date.now(),
          '--disable-gpu',
          `--user-agent=${userAgent}`
        ],
        defaultViewport: null,
        ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled'],
        protocolTimeout: 90000
      });

      const page = await browser.newPage();
      
      // Create ghost cursor for humanized mouse movements
      const cursor = createCursor(page);
      console.log('👻 Ghost cursor criado para movimentos humanizados');
      
      // Advanced anti-detection measures
      await page.evaluateOnNewDocument(() => {
        // Remove webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
        
        // Add realistic plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', description: 'PDF Viewer' },
            { name: 'Native Client', description: 'Native Client' },
            { name: 'Chromium PDF Plugin', description: 'Chromium PDF Plugin' },
            { name: 'Microsoft Edge PDF Plugin', description: 'Microsoft Edge PDF Plugin' }
          ]
        });
        
        // Set realistic languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['pt-BR', 'pt', 'en-US', 'en']
        });
        
        // Add chrome runtime
        (window as any).chrome = {
          runtime: {
            id: 'fake-extension-id-' + Math.random().toString(36)
          },
          loadTimes: function() {
            return {
              requestTime: Date.now() / 1000,
              startLoadTime: Date.now() / 1000 + 0.01,
              commitLoadTime: Date.now() / 1000 + 0.02,
              finishDocumentLoadTime: Date.now() / 1000 + 0.03,
              finishLoadTime: Date.now() / 1000 + 0.04,
              firstPaintTime: Date.now() / 1000 + 0.05,
              firstPaintAfterLoadTime: 0,
              navigationType: 'Other'
            };
          },
          csi: function() {
            return {
              onloadT: Date.now(),
              startE: Date.now() - 1000,
              pageT: 1000,
              tran: 15
            };
          }
        };
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // Add WebGL vendor and renderer
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          if (parameter === 37446) {
            return 'Intel Iris OpenGL Engine';
          }
          return getParameter.apply(this, [parameter]);
        };
        
        // Override timezone
        Date.prototype.getTimezoneOffset = function() { return -180; }; // Brazil timezone
        
        // Add battery API
        navigator.getBattery = () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 0.87
        });
      });
      
      // Set advanced HTTP headers
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Dnt': '1'
      });
      
      await page.setUserAgent(userAgent);
      await page.setViewport(viewport);

      // Simulate human delay before navigation
      console.log('⏱️ Aguardando tempo humano antes de navegar...');
      await delay(this.randomDelay(1000, 2000));
      
      // Navigate to the site
      console.log('📍 Navegando para OnlineOffice de forma humanizada...');
      
      let response;
      try {
        response = await page.goto('https://onlineoffice.zip/', {
          waitUntil: 'networkidle2',
          timeout: 45000
        });
      } catch (error) {
        console.error('❌ Erro ao navegar:', error.message);
        
        if (error.message.includes('ERR_NAME_NOT_RESOLVED') || error.message.includes('net::')) {
          throw new Error(
            'SITE_BLOQUEADO: O site OnlineOffice está bloqueando acessos. ' +
            'Use a opção manual para gerar credenciais.'
          );
        }
        throw error;
      }
      
      const status = response?.status();
      console.log(`📊 Status HTTP: ${status}`);
      
      if (status === 404 || status === 403) {
        throw new Error(
          'SITE_BLOQUEADO: O site retornou erro ' + status + '. ' +
          'Detecção de bot identificada. Use o método manual.'
        );
      }
      
      // Wait for page to load with human-like delay
      console.log('⏳ Aguardando página carregar com comportamento humano...');
      await delay(this.randomDelay(3000, 5000));
      
      // Perform random mouse movements
      await this.randomMouseMovements(page, cursor, this.randomDelay(2, 4));
      
      // Perform human-like scrolling
      await this.humanScroll(page, cursor);
      
      // More random movements after scroll
      await this.randomMouseMovements(page, cursor, 2);
      
      // Find the "Gerar IPTV" button
      console.log('🔍 Procurando botão "Gerar IPTV" de forma humanizada...');
      
      // Wait a bit before looking for button (human reading time)
      await delay(this.randomDelay(1500, 3000));
      
      // Try to find button using multiple strategies
      let buttonSelector = null;
      
      // Strategy 1: Find by text content
      const buttonByText = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const button = buttons.find(btn => {
          const text = btn.textContent?.trim().toLowerCase() || '';
          return text.includes('gerar iptv');
        });
        return button ? buttons.indexOf(button) : -1;
      });
      
      if (buttonByText >= 0) {
        buttonSelector = `button:nth-of-type(${buttonByText + 1})`;
      } else {
        // Strategy 2: Find by class
        const hasButtonByClass = await page.evaluate(() => {
          return !!document.querySelector('button.btn-outline-success');
        });
        
        if (hasButtonByClass) {
          buttonSelector = 'button.btn-outline-success';
        }
      }
      
      if (!buttonSelector) {
        throw new Error('Não foi possível encontrar o botão "Gerar IPTV"');
      }
      
      console.log('🎯 Botão encontrado! Movendo mouse de forma humanizada...');
      
      // Move mouse to button with natural curve
      await cursor.move(buttonSelector);
      
      // Hesitate before clicking (human behavior)
      const hesitationTime = this.randomDelay(300, 800);
      console.log(`⏸️ Hesitando por ${hesitationTime}ms antes de clicar...`);
      await delay(hesitationTime);
      
      // Small random movement near button (overshoot simulation)
      const buttonBox = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          width: rect.width,
          height: rect.height
        };
      }, buttonSelector);
      
      if (buttonBox) {
        // Move slightly away and back (overshoot)
        const overshootX = buttonBox.x + this.randomDelay(-20, 20);
        const overshootY = buttonBox.y + this.randomDelay(-20, 20);
        await cursor.move({ x: overshootX, y: overshootY });
        await delay(this.randomDelay(100, 300));
        await cursor.move(buttonSelector);
      }
      
      // Click with ghost cursor
      console.log('🖱️ Clicando no botão com movimento humanizado...');
      await cursor.click(buttonSelector);
      
      console.log('✅ Botão clicado!');

      // Handle modals with human-like delays
      console.log('📝 Aguardando e confirmando modais...');
      
      for (let i = 0; i < 3; i++) {
        await delay(this.randomDelay(1500, 2500));
        
        const modalButton = await page.evaluate(() => {
          const btn = document.querySelector('.swal2-confirm');
          return btn ? true : false;
        });
        
        if (modalButton) {
          console.log(`📋 Modal ${i + 1} detectado, movendo mouse...`);
          
          // Move to modal button naturally
          await cursor.move('.swal2-confirm');
          await delay(this.randomDelay(200, 500));
          await cursor.click('.swal2-confirm');
          
          console.log(`✅ Modal ${i + 1} confirmado`);
        }
      }

      // Wait for credentials with random movements
      console.log('⏳ Aguardando credenciais com movimentos aleatórios...');
      
      for (let i = 0; i < 3; i++) {
        await this.randomMouseMovements(page, cursor, 1);
        await delay(this.randomDelay(1000, 1500));
      }
      
      // Capture credentials
      const result = await page.evaluate(() => {
        const text = document.body.innerText || '';
        
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
        throw new Error(
          'Não foi possível capturar as credenciais. ' +
          'O site pode ter detectado a automação. Use o método manual.'
        );
      }

      console.log('🎉 Teste IPTV gerado com sucesso usando comportamento humano!');
      console.log(`📋 Usuário: ${result.usuario}`);
      console.log(`🔑 Senha: ${result.senha}`);
      if (result.vencimento) {
        console.log(`📅 Vencimento: ${result.vencimento}`);
      }
      
      // Final random movements before closing
      await this.randomMouseMovements(page, cursor, 2);
      await delay(this.randomDelay(1000, 2000));
      
      return result;

    } catch (error) {
      console.error('❌ Erro na automação humanizada:', error);
      
      if (error.message?.includes('SITE_BLOQUEADO')) {
        throw error;
      }
      
      // Screenshot for debugging
      if (browser) {
        try {
          const pages = await browser.pages();
          if (pages.length > 0) {
            const screenshotPath = `/tmp/onlineoffice-human-error-${Date.now()}.png`;
            await pages[0].screenshot({ path: screenshotPath, fullPage: true });
            console.error(`📸 Screenshot de erro: ${screenshotPath}`);
          }
        } catch (e) {
          console.error('Erro ao tirar screenshot:', e.message);
        }
      }
      
      throw error;
    } finally {
      if (browser) {
        try {
          // Human-like delay before closing
          await new Promise(resolve => setTimeout(resolve, this.randomDelay(500, 1000)));
          await browser.close();
        } catch (e) {
          console.error('Erro ao fechar browser:', e.message);
        }
      }
    }
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
        (window as any).chrome = {
          runtime: {}
        };
        
        // Sobrescreve permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => (
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
      await delay(5000);
      
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
      await delay(2000);
      
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
          await delay(1500);
        } catch (e) {
          // Ignora se não houver modal
        }
      }

      // Aguarda as credenciais aparecerem
      console.log('⏳ Aguardando credenciais...');
      await delay(3000);
      
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