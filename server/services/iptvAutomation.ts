import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { storage } from '../storage';
const chromedriver = require('chromedriver');

interface IptvCredentials {
  usuario: string;
  senha: string;
  nota?: string;
  duracao: string;
}

interface IptvAutomationConfig {
  url: string;
  username: string;
  password: string;
  headless?: boolean;
}

class IptvAutomationService {
  private config: IptvAutomationConfig = {
    url: 'https://onlineoffice.zip/#/dashboard',
    username: 'gustavoprata17',
    password: 'iptv102030',
    headless: true // Executa sem interface gráfica
  };

  private driver: WebDriver | null = null;

  constructor(config?: Partial<IptvAutomationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  private async initDriver(): Promise<WebDriver> {
    const options = new chrome.Options();
    
    if (this.config.headless) {
      options.addArguments('--headless');
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
      options.addArguments('--disable-gpu');
    }
    
    // Configurações adicionais para evitar detecção de bot
    options.addArguments('--disable-blink-features=AutomationControlled');
    options.excludeSwitches('enable-automation');
    options.addArguments('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const service = new chrome.ServiceBuilder(chromedriver.path);
    
    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .setChromeService(service)
      .build();
    
    return this.driver;
  }

  async generateTest(
    nota: string = 'teste',
    duracao: '6 Horas' | '12 Horas' | '24 Horas' | '48 Horas' = '6 Horas'
  ): Promise<IptvCredentials | null> {
    try {
      const driver = await this.initDriver();
      
      // Navega para a página de login
      await driver.get(this.config.url);
      await driver.sleep(2000);
      
      // Preenche o campo de usuário
      const usernameField = await driver.wait(
        until.elementLocated(By.css('input[placeholder*="Usuário"], input#username, input[name="username"]')),
        10000
      );
      await usernameField.sendKeys(this.config.username);
      await driver.sleep(1000);
      
      // Preenche o campo de senha
      const passwordField = await driver.wait(
        until.elementLocated(By.css('input[type="password"], input#password, input[name="password"]')),
        10000
      );
      await passwordField.sendKeys(this.config.password);
      await driver.sleep(1000);
      
      // Tenta marcar o checkbox "Não sou um robô" se existir
      try {
        const recaptchaCheckbox = await driver.findElement(
          By.css('input[type="checkbox"][id*="recaptcha"], .recaptcha-checkbox')
        );
        await recaptchaCheckbox.click();
        await driver.sleep(1000);
      } catch (e) {
        // Se não encontrar o recaptcha, continua
        console.log('Recaptcha não encontrado, continuando...');
      }
      
      // Clica no botão de login
      const loginButton = await driver.wait(
        until.elementLocated(By.xpath('//button[contains(text(), "Logar")] | //button[contains(text(), "Login")]')),
        10000
      );
      await loginButton.click();
      await driver.sleep(3000);
      
      // Aguarda e clica no botão "Gerar IPTV"
      const gerarIptvButton = await driver.wait(
        until.elementLocated(By.xpath('//button[contains(text(), "Gerar IPTV")]')),
        10000
      );
      await gerarIptvButton.click();
      await driver.sleep(2000);
      
      // Preenche o campo de nota
      const notaField = await driver.wait(
        until.elementLocated(By.css('input[placeholder*="nota"]')),
        10000
      );
      await notaField.clear();
      await notaField.sendKeys(nota);
      await driver.sleep(1000);
      
      // Seleciona o tempo de teste
      const tempoDropdown = await driver.wait(
        until.elementLocated(By.css('select[placeholder*="tempo de teste"], select[name*="tempo"]')),
        10000
      );
      await tempoDropdown.click();
      await driver.sleep(500);
      
      const tempoOption = await driver.wait(
        until.elementLocated(By.xpath(`//option[text()="${duracao}"]`)),
        10000
      );
      await tempoOption.click();
      await driver.sleep(1000);
      
      // Clica no botão Confirmar
      const confirmarButton = await driver.wait(
        until.elementLocated(By.xpath('//button[contains(text(), "Confirmar")]')),
        10000
      );
      await confirmarButton.click();
      await driver.sleep(3000);
      
      // Extrai as credenciais geradas
      let usuario = '';
      let senha = '';
      
      try {
        // Tenta diferentes seletores para encontrar as credenciais
        const usuarioElement = await driver.findElement(
          By.xpath('//p[contains(text(), "USUÁRIO:")]/following-sibling::p[1] | //span[contains(text(), "USUÁRIO:")]/following-sibling::span[1] | //*[contains(text(), "USUÁRIO:")]/following::text()[1]')
        );
        usuario = await usuarioElement.getText();
        
        const senhaElement = await driver.findElement(
          By.xpath('//p[contains(text(), "SENHA:")]/following-sibling::p[1] | //span[contains(text(), "SENHA:")]/following-sibling::span[1] | //*[contains(text(), "SENHA:")]/following::text()[1]')
        );
        senha = await senhaElement.getText();
      } catch (e) {
        // Tenta capturar de outra forma
        const pageSource = await driver.getPageSource();
        const usuarioMatch = pageSource.match(/USU[ÁA]RIO:\s*([^\s<]+)/i);
        const senhaMatch = pageSource.match(/SENHA:\s*([^\s<]+)/i);
        
        if (usuarioMatch) usuario = usuarioMatch[1];
        if (senhaMatch) senha = senhaMatch[1];
      }
      
      if (usuario && senha) {
        const credentials: IptvCredentials = {
          usuario,
          senha,
          nota,
          duracao
        };
        
        return credentials;
      } else {
        throw new Error('Não foi possível capturar as credenciais');
      }
      
    } catch (error) {
      console.error('Erro na automação IPTV:', error);
      return null;
    } finally {
      if (this.driver) {
        await this.driver.quit();
        this.driver = null;
      }
    }
  }

  async cleanup() {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
    }
  }
}

export const iptvAutomation = new IptvAutomationService();