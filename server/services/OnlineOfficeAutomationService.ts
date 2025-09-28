import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { storage } from '../storage';
import { discordNotificationService } from './DiscordNotificationService';
import path from 'path';
import fs from 'fs';

// Aplicar stealth plugin para evitar detecção
puppeteer.use(StealthPlugin());

interface RenewalTask {
  sistemaId: string;
  username: string;
  password: string;
  expirationDate: Date;
  retryCount?: number;
}

export class OnlineOfficeAutomationService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isRunning = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private watchdogInterval: NodeJS.Timeout | null = null;
  private renewalQueue: RenewalTask[] = [];
  private isProcessingQueue = false;
  private readonly userDataDir = path.join(process.cwd(), 'puppeteer-user-data');
  private readonly screenshotDir = path.join(process.cwd(), 'screenshots');

  constructor() {
    // Criar diretórios necessários
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ OnlineOfficeAutomationService já está rodando');
      return;
    }

    console.log('🚀 Iniciando OnlineOfficeAutomationService...');
    this.isRunning = true;

    try {
      // Lançar browser headless com configurações persistentes
      await this.launchBrowser();
      
      // Fazer login automático
      await this.autoLogin();
      
      // Iniciar heartbeat
      this.startHeartbeat();
      
      // Iniciar watchdog
      this.startWatchdog();
      
      // Processar fila de renovações
      this.startQueueProcessor();

      await storage.createLog({
        nivel: 'info',
        origem: 'OnlineOfficeAutomation',
        mensagem: 'Serviço iniciado com sucesso',
        detalhes: { headless: true, userDataDir: this.userDataDir }
      });

      console.log('✅ OnlineOfficeAutomationService iniciado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao iniciar OnlineOfficeAutomationService:', error);
      await this.handleError(error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log('⏹️ Parando OnlineOfficeAutomationService...');
    this.isRunning = false;

    // Parar intervalos
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }

    // Fechar browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }

    // Atualizar status
    await storage.updateAutomationStatus({
      isActive: false,
      isLoggedIn: false,
      currentUrl: null,
      lastError: null
    });

    await storage.createLog({
      nivel: 'info',
      origem: 'OnlineOfficeAutomation',
      mensagem: 'Serviço parado',
      detalhes: null
    });

    console.log('✅ OnlineOfficeAutomationService parado');
  }

  private async launchBrowser(): Promise<void> {
    console.log('🌐 Lançando browser Puppeteer headless...');

    this.browser = await puppeteer.launch({
      headless: true, // Rodando headless no servidor
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080'
      ],
      userDataDir: this.userDataDir, // Persistir dados da sessão
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    // Abrir nova página
    this.page = await this.browser.newPage();

    // Configurar user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Configurar timeout padrão
    this.page.setDefaultTimeout(30000);

    console.log('✅ Browser Puppeteer lançado com sucesso');
  }

  private async autoLogin(): Promise<void> {
    if (!this.page) throw new Error('Browser não está inicializado');

    console.log('🔐 Fazendo login automático no OnlineOffice...');

    try {
      // Buscar credenciais do banco
      const credentials = await storage.getOfficeCredentials();
      if (!credentials || credentials.length === 0) {
        throw new Error('Nenhuma credencial encontrada no banco de dados');
      }

      // Usar a primeira credencial ativa
      const activeCredential = credentials.find(c => c.status === 'active');
      if (!activeCredential) {
        throw new Error('Nenhuma credencial ativa encontrada');
      }

      // Navegar para OnlineOffice
      await this.page.goto('https://onlineoffice.zip', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Aguardar página carregar
      await this.page.waitForTimeout(3000);

      // Verificar se já está logado
      const isLoggedIn = await this.checkIfLoggedIn();
      if (isLoggedIn) {
        console.log('✅ Já está logado no OnlineOffice');
        await this.updateStatus(true, true, this.page.url());
        return;
      }

      // Fazer login
      console.log('📝 Preenchendo formulário de login...');

      // Procurar campos de login
      await this.page.waitForSelector('input[type="text"], input[name="username"], input#username', { timeout: 10000 });
      await this.page.waitForSelector('input[type="password"], input[name="password"], input#password', { timeout: 10000 });

      // Preencher username
      const usernameSelectors = ['input[type="text"]', 'input[name="username"]', 'input#username'];
      for (const selector of usernameSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          await element.click();
          await element.type(activeCredential.username, { delay: 100 });
          break;
        }
      }

      // Preencher password
      const passwordSelectors = ['input[type="password"]', 'input[name="password"]', 'input#password'];
      for (const selector of passwordSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          await element.click();
          await element.type(activeCredential.password, { delay: 100 });
          break;
        }
      }

      // Clicar no botão de login
      const loginButtonSelectors = ['button[type="submit"]', 'button:contains("Login")', 'button:contains("Entrar")', 'input[type="submit"]'];
      let loginClicked = false;
      for (const selector of loginButtonSelectors) {
        try {
          await this.page.click(selector);
          loginClicked = true;
          break;
        } catch {
          // Tentar próximo seletor
        }
      }

      if (!loginClicked) {
        // Tentar pressionar Enter
        await this.page.keyboard.press('Enter');
      }

      // Aguardar navegação
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // Verificar se login foi bem-sucedido
      await this.page.waitForTimeout(3000);
      const loggedIn = await this.checkIfLoggedIn();

      if (loggedIn) {
        console.log('✅ Login realizado com sucesso');
        await this.updateStatus(true, true, this.page.url());
      } else {
        // Verificar se tem captcha
        const hasCaptcha = await this.page.$('.captcha, #captcha, [data-captcha]');
        if (hasCaptcha) {
          throw new Error('Captcha detectado - intervenção manual necessária');
        }
        throw new Error('Login falhou - credenciais podem estar incorretas');
      }

    } catch (error: any) {
      console.error('❌ Erro no login automático:', error);
      
      // Capturar screenshot para debug
      const screenshotPath = path.join(this.screenshotDir, `login-error-${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      
      // Notificar via Discord
      await discordNotificationService.notify(
        'error',
        'Login Automático Falhou',
        `Erro ao fazer login no OnlineOffice: ${error.message}\nScreenshot salvo em: ${screenshotPath}`
      );

      await this.updateStatus(true, false, this.page.url(), error.message);
      throw error;
    }
  }

  private async checkIfLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Verificar se está na página principal (após login)
      const url = this.page.url();
      if (url.includes('#/dashboard') || url.includes('#/users-iptv') || url.includes('#/home')) {
        return true;
      }

      // Verificar elementos que só aparecem quando logado
      const loggedInSelectors = [
        '.user-menu',
        '.logout-button',
        '[data-logged-in="true"]',
        '#user-profile',
        '.dashboard'
      ];

      for (const selector of loggedInSelectors) {
        const element = await this.page.$(selector);
        if (element) return true;
      }

      // Verificar se NÃO está na página de login
      const loginSelectors = [
        'input[type="password"]',
        'button:contains("Login")',
        '.login-form'
      ];

      for (const selector of loginSelectors) {
        const element = await this.page.$(selector);
        if (element) return false;
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar status de login:', error);
      return false;
    }
  }

  private startHeartbeat(): void {
    // Heartbeat a cada 30 segundos
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isRunning || !this.page) return;

      try {
        const isLoggedIn = await this.checkIfLoggedIn();
        const currentUrl = this.page.url();
        
        await this.updateStatus(true, isLoggedIn, currentUrl);

        // Se não está logado, tentar relogar
        if (!isLoggedIn && this.isRunning) {
          console.log('⚠️ Sessão expirada, tentando relogar...');
          await this.autoLogin();
        }

      } catch (error) {
        console.error('Erro no heartbeat:', error);
      }
    }, 30000);
  }

  private startWatchdog(): void {
    // Watchdog a cada 60 segundos
    this.watchdogInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        // Verificar se browser ainda está ativo
        if (!this.browser || !this.browser.isConnected()) {
          console.log('⚠️ Browser desconectado, reiniciando...');
          await this.restart();
        }

        // Verificar se página responde
        if (this.page) {
          try {
            await this.page.evaluate(() => document.title);
          } catch {
            console.log('⚠️ Página não responde, reiniciando...');
            await this.restart();
          }
        }

      } catch (error) {
        console.error('Erro no watchdog:', error);
      }
    }, 60000);
  }

  private async restart(): Promise<void> {
    console.log('🔄 Reiniciando serviço...');
    
    try {
      // Parar serviço
      await this.stop();
      
      // Aguardar um pouco
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Iniciar novamente
      await this.start();
    } catch (error) {
      console.error('Erro ao reiniciar serviço:', error);
      await discordNotificationService.notify(
        'error',
        'Falha ao Reiniciar Automação',
        `Erro ao reiniciar OnlineOfficeAutomationService: ${error}`
      );
    }
  }

  private startQueueProcessor(): void {
    // Processar fila a cada 10 segundos
    setInterval(async () => {
      if (!this.isRunning || !this.page || this.isProcessingQueue) return;
      
      await this.processRenewalQueue();
    }, 10000);
  }

  async addToRenewalQueue(task: RenewalTask): Promise<void> {
    this.renewalQueue.push(task);
    console.log(`📋 Tarefa adicionada à fila: Sistema ${task.sistemaId}`);
  }

  private async processRenewalQueue(): Promise<void> {
    if (this.renewalQueue.length === 0) return;
    if (!this.page || !this.isRunning) return;
    
    this.isProcessingQueue = true;

    try {
      const task = this.renewalQueue.shift();
      if (!task) return;

      console.log(`🔄 Processando renovação: Sistema ${task.sistemaId}`);
      await this.renewSystem(task.sistemaId, task.username, task.password);

    } catch (error: any) {
      console.error('Erro ao processar fila:', error);
      
      // Recolocar na fila com retry count
      const task = this.renewalQueue[0];
      if (task && (task.retryCount || 0) < 3) {
        task.retryCount = (task.retryCount || 0) + 1;
        this.renewalQueue.push(task);
      } else {
        await discordNotificationService.notify(
          'error',
          'Renovação Falhou',
          `Falha ao renovar sistema ${task?.sistemaId} após 3 tentativas: ${error.message}`
        );
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async renewSystem(sistemaId: string, username: string, password: string): Promise<boolean> {
    if (!this.page) throw new Error('Browser não está inicializado');

    console.log(`🔄 Renovando sistema ${sistemaId} - Usuário: ${username}`);

    try {
      // Navegar para página de renovação
      await this.page.goto('https://onlineoffice.zip/#/users-iptv', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Aguardar página carregar
      await this.page.waitForTimeout(2000);

      // Buscar usuário na lista
      console.log(`🔍 Buscando usuário ${username}...`);
      
      // Tentar usar campo de busca se existir
      const searchInput = await this.page.$('input[type="search"], input[placeholder*="search"], input[placeholder*="buscar"]');
      if (searchInput) {
        await searchInput.click();
        await searchInput.type(username);
        await this.page.waitForTimeout(1000);
      }

      // Procurar linha do usuário
      const userRowSelector = `tr:contains("${username}"), div:contains("${username}")[class*="row"]`;
      await this.page.waitForSelector(userRowSelector, { timeout: 10000 });

      // Clicar no botão de renovar
      const renewButtonSelectors = [
        `${userRowSelector} button:contains("Renovar")`,
        `${userRowSelector} button:contains("Renew")`,
        `${userRowSelector} button.btn-renew`,
        `${userRowSelector} button[title*="renew"]`
      ];

      let renewClicked = false;
      for (const selector of renewButtonSelectors) {
        try {
          await this.page.click(selector);
          renewClicked = true;
          break;
        } catch {
          // Tentar próximo seletor
        }
      }

      if (!renewClicked) {
        throw new Error('Botão de renovação não encontrado');
      }

      // Aguardar modal ou nova página
      await this.page.waitForTimeout(2000);

      // Confirmar renovação se necessário
      const confirmSelectors = [
        'button:contains("Confirmar")',
        'button:contains("Confirm")',
        'button.btn-confirm',
        'button[type="submit"]'
      ];

      for (const selector of confirmSelectors) {
        try {
          await this.page.click(selector);
          break;
        } catch {
          // Ignorar se não encontrar
        }
      }

      // Aguardar resposta
      await this.page.waitForTimeout(3000);

      // Verificar se renovação foi bem-sucedida
      const successIndicators = [
        'text:contains("sucesso")',
        'text:contains("success")',
        'text:contains("renovado")',
        'text:contains("renewed")',
        '.alert-success',
        '.success-message'
      ];

      let isSuccess = false;
      for (const selector of successIndicators) {
        const element = await this.page.$(selector);
        if (element) {
          isSuccess = true;
          break;
        }
      }

      if (isSuccess) {
        console.log(`✅ Sistema ${sistemaId} renovado com sucesso`);
        
        // Atualizar banco de dados
        await storage.updateSistemaRenewalStatus(sistemaId, {
          lastRenewalAt: new Date(),
          renewalCount: 1 // Incrementar contador
        });

        // Notificar sucesso
        await discordNotificationService.notify(
          'success',
          'Renovação Automática Bem-Sucedida',
          `Sistema ${sistemaId} (${username}) foi renovado com sucesso!`
        );

        return true;
      } else {
        throw new Error('Renovação não confirmada - verificar manualmente');
      }

    } catch (error: any) {
      console.error(`❌ Erro ao renovar sistema ${sistemaId}:`, error);
      
      // Capturar screenshot
      const screenshotPath = path.join(this.screenshotDir, `renewal-error-${sistemaId}-${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });

      // Notificar erro
      await discordNotificationService.notify(
        'error',
        'Erro na Renovação Automática',
        `Falha ao renovar sistema ${sistemaId} (${username}): ${error.message}\nScreenshot: ${screenshotPath}`
      );

      return false;
    }
  }

  private async updateStatus(isActive: boolean, isLoggedIn: boolean, currentUrl: string | null, lastError: string | null = null): Promise<void> {
    try {
      await storage.updateAutomationStatus({
        isActive,
        isLoggedIn,
        currentUrl,
        lastHeartbeat: new Date(),
        lastError,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  }

  private async handleError(error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await storage.createLog({
      nivel: 'error',
      origem: 'OnlineOfficeAutomation',
      mensagem: 'Erro no serviço de automação',
      detalhes: { error: errorMessage, stack: error.stack }
    });

    await this.updateStatus(false, false, null, errorMessage);
    
    await discordNotificationService.notify(
      'error',
      'OnlineOfficeAutomationService - Erro',
      errorMessage
    );
  }

  // Método para obter status atual
  async getStatus() {
    return {
      isRunning: this.isRunning,
      browserConnected: this.browser?.isConnected() || false,
      pageUrl: this.page?.url() || null,
      queueSize: this.renewalQueue.length,
      isProcessingQueue: this.isProcessingQueue
    };
  }
}

// Singleton
export const onlineOfficeAutomationService = new OnlineOfficeAutomationService();