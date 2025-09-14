import axios, { AxiosInstance } from 'axios';
import { storage } from '../storage';
import { db } from '../db';
import { pagamentosManual, pagamentos } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { whatsappService } from './whatsapp';
import { addMonths } from 'date-fns';

export interface PixPayment {
  id: string;
  amount: number;
  description: string;
  pixKey: string;
  qrCode: string;
  pixCopiaCola?: string;
  paymentLinkUrl?: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  createdAt: Date;
  paidAt?: Date;
  expiresAt: Date;
}

export class PixService {
  private client: AxiosInstance;
  private appId: string = '';
  private correlationID: string = '';
  private webhook: string = '';
  private expiresIn: number = 86400; // 24 horas padrão

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.openpix.com.br', // Woovi API endpoint
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    // Add request interceptor to ensure authorization header is always set
    this.client.interceptors.request.use((config) => {
      if (this.appId) {
        config.headers['Authorization'] = this.appId;
      }
      return config;
    }, (error) => {
      return Promise.reject(error);
    });

    this.initializeConfig();
  }

  private async initializeConfig() {
    try {
      console.log('🔧 Inicializando configuração do Woovi PIX...');
      
      // Priorizar WOOVI_API_KEY do ambiente
      const envApiKey = process.env.WOOVI_API_KEY;
      if (envApiKey) {
        console.log('✅ Usando WOOVI_API_KEY do ambiente');
        this.appId = envApiKey;
        this.correlationID = 'TVON_PIX';
        this.webhook = '';
        this.expiresIn = 86400;
        
        this.client.defaults.headers.common['Authorization'] = envApiKey;
        console.log('✅ API Key do ambiente configurada no cliente HTTP');
        return;
      }
      
      const integracao = await storage.getIntegracaoByTipo('pix');
      
      if (integracao && integracao.ativo) {
        const config = integracao.configuracoes as any;
        console.log('✅ Configuração encontrada no banco:', { 
          appId: config.appId ? 'Configurado' : 'Não configurado',
          correlationID: config.correlationID || 'Não configurado'
        });
        
        this.appId = config.appId || '';
        this.correlationID = config.correlationID || '';
        this.webhook = config.webhook || '';
        this.expiresIn = config.expiresIn || 86400; // 24h padrão se não configurado
        
        if (this.appId) {
          this.client.defaults.headers.common['Authorization'] = this.appId;
          console.log('✅ API Key configurada no cliente HTTP');
        }
      } else {
        console.log('⚠️ Nenhuma configuração PIX encontrada no banco');
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar configuração do Woovi PIX:', error);
    }
  }

  async updateConfig(appId: string, correlationID: string, webhook: string, expiresIn?: number) {
    this.appId = appId;
    this.correlationID = correlationID;
    this.webhook = webhook;
    this.expiresIn = expiresIn || 86400; // 24h padrão
    
    this.client.defaults.headers.common['Authorization'] = appId;

    // Salvar configuração
    const integracao = await storage.getIntegracaoByTipo('pix');
    if (integracao) {
      await storage.updateIntegracao(integracao.id, {
        configuracoes: { appId, correlationID, webhook, expiresIn: this.expiresIn },
        ativo: true
      });
    } else {
      await storage.createIntegracao({
        tipo: 'pix',
        configuracoes: { appId, correlationID, webhook, expiresIn: this.expiresIn },
        ativo: true
      });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Teste básico - você deve adaptar para sua API PIX específica
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('Erro ao testar conexão PIX:', error);
      return false;
    }
  }

  async generatePix(clienteId: number, amount: number, description: string, metadata?: any): Promise<PixPayment | null> {
    console.log('🚀 Gerando PIX...');
    return this.createPayment(clienteId, amount, description, metadata);
  }

  async createPayment(clienteId: number, amount: number, description: string, metadata?: any): Promise<PixPayment | null> {
    try {
      // Verificar se a configuração está presente
      if (!this.appId) {
        console.log('⚠️ PIX não configurado. Tentando carregar configuração...');
        await this.initializeConfig();
        
        if (!this.appId) {
          throw new Error('PIX não está configurado. Configure a API Key do Woovi primeiro.');
        }
      }
      
      // Para IDs negativos (conversas sem cliente), criar um cliente temporário
      let cliente = null;
      let isTemporaryClient = false;
      let pagamento = null;
      
      if (clienteId < 0) {
        // Cliente temporário para conversa sem cadastro
        isTemporaryClient = true;
        const telefone = metadata?.telefone || 'sem_telefone';
        cliente = {
          id: clienteId,
          nome: `Conversa ${telefone}`,
          telefone: telefone,
          email: `${telefone}@temp.com`,
          cpf: '00000000000',
          status: 'ativo'
        };
        console.log('👤 Cliente temporário criado:', cliente.nome);
        
        // IMPORTANTE: Para pagamentos manuais sem cliente, usar tabela pagamentos_manual
        // Pagamentos sem cliente vão para tabela separada
        pagamento = await storage.createPagamentoManual({
          telefone: telefone, // Campo telefone obrigatório
          valor: amount.toString(),
          status: 'pendente'
        });
        
        if (!pagamento) {
          throw new Error('Falha ao criar pagamento manual no banco de dados');
        }
        
        console.log('💾 Pagamento manual criado na tabela pagamentos_manual:', pagamento?.id || 'ID não disponível');
      } else {
        cliente = await storage.getClienteById(clienteId);
        if (!cliente) {
          throw new Error('Cliente não encontrado');
        }
        console.log('👤 Cliente encontrado:', cliente.nome);
        
        // Criar pagamento no banco local
        pagamento = await storage.createPagamento({
          clienteId,
          valor: amount.toString(),
          status: 'pendente',
          dataVencimento: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
        });
      }

      console.log('💾 Pagamento criado no banco:', pagamento.id);

      try {
        // Criar charge no Woovi - passar metadata para incluir número de meses
        const wooviCharge = await this.createWooviCharge(amount, description, cliente, metadata);
        
        console.log('✅ Charge criado no Woovi:', {
          id: wooviCharge.id,
          correlationID: wooviCharge.correlationID,
          status: wooviCharge.status,
          hasQrCode: !!wooviCharge.qrCodeImage,
          hasBrCode: !!wooviCharge.brCode,
          hasPaymentLink: !!wooviCharge.paymentLinkUrl
        });
        
        // Calcular data de expiração
        const expirationDate = new Date(wooviCharge.expirationDate || Date.now() + (this.expiresIn * 1000));
        
        // Extrair chargeId - priorizar o ID do Woovi, depois tentar extrair do brCode
        const brCode = wooviCharge.brCode || wooviCharge.pixQrCode || '';
        const chargeIdMatch = brCode.match(/([a-f0-9]{32})[0-9]{4}[A-F0-9]{4}$/);
        const extractedChargeId = chargeIdMatch ? chargeIdMatch[1] : '';
        // Usar o ID direto do Woovi como prioridade, senão usar o extraído do brCode
        const finalChargeId = wooviCharge.id || wooviCharge.identifier || extractedChargeId || wooviCharge.correlationID || '';
        
        console.log('🔑 ChargeId identificado:', {
          wooviId: wooviCharge.id,
          identifier: wooviCharge.identifier, 
          extractedFromBrCode: extractedChargeId,
          correlationId: wooviCharge.correlationID,
          finalChargeId: finalChargeId
        });
        
        // Preparar dados para atualização baseado no tipo de pagamento
        const updateData = isTemporaryClient ? {
          // Campos para pagamentos_manual (com underscore)
          pix_id: wooviCharge.correlationID || `TVON_${pagamento.id}`,
          chargeId: finalChargeId,
          qr_code: wooviCharge.qrCodeImage || wooviCharge.qrCode?.imageLinkURL || '',
          pix_copia_e_cola: brCode,
          data_vencimento: expirationDate,
          status: wooviCharge.status === 'ACTIVE' ? 'pendente' : 'expirado'
        } : {
          // Campos para pagamentos (sem underscore)
          pixId: wooviCharge.correlationID || `TVON_${pagamento.id}`,
          chargeId: finalChargeId,
          qrCode: wooviCharge.qrCodeImage || wooviCharge.qrCode?.imageLinkURL || '',
          pixCopiaECola: wooviCharge.brCode || wooviCharge.pixQrCode || '',
          paymentLinkUrl: wooviCharge.paymentLinkUrl || wooviCharge.paymentLink || '',
          expiresIn: wooviCharge.expiresIn || this.expiresIn,
          dataVencimento: expirationDate,
          status: wooviCharge.status === 'ACTIVE' ? 'pendente' : 'expirado'
        };
        
        console.log('🔄 Atualizando pagamento com dados do Woovi:', updateData);
        
        // Atualizar na tabela correta baseado no tipo de pagamento
        let result;
        if (isTemporaryClient) {
          // Usar SQL direto para pagamentos_manual para evitar problemas de mapeamento
          result = await db.execute(sql`
            UPDATE pagamentos_manual
            SET 
              pix_id = ${updateData.pix_id || ''},
              charge_id = ${updateData.chargeId || ''},
              qr_code = ${updateData.qr_code || ''},
              pix_copia_e_cola = ${updateData.pix_copia_e_cola || ''},
              data_vencimento = ${updateData.data_vencimento?.toISOString() || new Date().toISOString()},
              status = ${updateData.status || 'pendente'}
            WHERE id = ${pagamento.id}
            RETURNING *
          `);
          console.log('✅ Pagamento manual atualizado na tabela pagamentos_manual:', {
            id: result[0]?.id,
            chargeId: result[0]?.charge_id,
            status: result[0]?.status
          });
        } else {
          // Pagamentos de clientes cadastrados vão para tabela pagamentos
          result = await db.update(pagamentos)
            .set(updateData)
            .where(eq(pagamentos.id, pagamento.id))
            .returning();
          console.log('✅ Pagamento atualizado na tabela pagamentos:', result[0]);
        }

        const pixPayment: PixPayment = {
          id: wooviCharge.id,
          amount,
          description,
          pixKey: wooviCharge.pixKey || this.appId,
          qrCode: wooviCharge.qrCodeImage,
          pixCopiaCola: wooviCharge.brCode || wooviCharge.pixQrCode || '',
          paymentLinkUrl: wooviCharge.paymentLinkUrl || wooviCharge.paymentLink || '',
          status: 'pending',
          createdAt: new Date(),
          expiresAt: expirationDate
        };

        await this.logActivity('info', `PIX criado para cliente ${cliente.nome}`, { 
          paymentId: pagamento.id, 
          chargeId: finalChargeId,
          amount,
          isManual: isTemporaryClient
        });
        
        return pixPayment;
      } catch (wooviError: any) {
        console.error('❌ Erro ao criar charge no Woovi:', wooviError.response?.data || wooviError.message);
        
        // Mesmo com erro no Woovi, manter o pagamento no banco como pendente
        await this.logActivity('error', `Erro ao criar charge no Woovi: ${wooviError.message}`, { 
          clienteId, 
          amount,
          error: wooviError.response?.data 
        });
        
        // Retornar null para indicar falha
        return null;
      }
    } catch (error: any) {
      console.error('❌ Erro geral ao criar pagamento PIX:', error);
      await this.logActivity('error', `Erro ao criar PIX: ${error.message}`, { clienteId, amount });
      return null;
    }
  }

  private async createWooviCharge(amount: number, description: string, cliente: any, metadata?: any) {
    try {
      // Verificar se a API key está configurada
      if (!this.appId) {
        console.error('❌ WOOVI_API_KEY não está configurada!');
        throw new Error('WOOVI_API_KEY não configurada');
      }
      
      // Gerar correlationID único com timestamp
      const timestamp = Date.now();
      const uniqueCorrelationID = `${this.correlationID}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
      
      const charge: any = {
        correlationID: uniqueCorrelationID,
        value: Math.round(amount * 100), // Woovi espera valor em centavos como inteiro
        comment: description,
        expiresIn: this.expiresIn, // Tempo de expiração em segundos
        customer: {
          name: cliente.nome,
          phone: cliente.telefone,
          email: cliente.email || `${cliente.telefone}@tvon.com`
        }
      };
      
      // Adicionar metadata se fornecido (incluindo número de meses para renovação)
      if (metadata) {
        // Adicionar meses no comment para recuperar no webhook
        if (metadata.meses) {
          charge.comment = `${description} [MESES:${metadata.meses}]`;
        }
        // Adicionar informações do telefone no comment se for pagamento manual
        if (metadata.manual && metadata.telefone) {
          charge.comment = `${charge.comment || description} [TEL:${metadata.telefone}]`;
        }
        // NÃO adicionar additionalInfo pois a API Woovi não está aceitando corretamente
        // Todas as informações necessárias estão no comment
      }

      console.log('📤 Enviando charge para Woovi:', charge);
      console.log('🔑 Authorization header:', this.appId ? `Set (${this.appId.substring(0, 10)}...)` : 'Not set');
      console.log('📡 Request URL:', this.client.defaults.baseURL + '/api/v1/charge');
      
      // Garantir que o header de autorização está configurado para esta requisição específica
      const config = {
        headers: {
          'Authorization': this.appId,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      };
      
      console.log('🔐 Headers completos:', {
        ...config.headers,
        Authorization: `${config.headers.Authorization.substring(0, 20)}...`
      });
      
      const response = await this.client.post('/api/v1/charge', charge, config);
      console.log('📱 Resposta completa do Woovi:', JSON.stringify(response.data, null, 2));
      
      // A resposta tem a estrutura { charge: {...}, correlationID: ..., brCode: ... }
      const chargeData = response.data.charge || response.data;
      
      // Adicionar campos que podem estar no nível raiz
      if (!chargeData.brCode && response.data.brCode) {
        chargeData.brCode = response.data.brCode;
      }
      if (!chargeData.paymentLinkUrl && response.data.paymentLinkUrl) {
        chargeData.paymentLinkUrl = response.data.paymentLinkUrl;
      }
      if (!chargeData.qrCodeImage && response.data.qrCodeImage) {
        chargeData.qrCodeImage = response.data.qrCodeImage;
      }
      
      // Garantir que o correlationID usado seja retornado
      chargeData.correlationID = uniqueCorrelationID;
      
      return chargeData;
    } catch (error: any) {
      console.error('❌ Erro ao criar charge no Woovi:');
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Headers enviados:', error.config?.headers);
      console.error('Data:', error.response?.data ? 
        (typeof error.response.data === 'string' ? 
          error.response.data.substring(0, 500) : 
          JSON.stringify(error.response.data).substring(0, 500)) : 
        error.message);
      
      // Se for erro 403, significa problema de autorização
      if (error.response?.status === 403) {
        console.error('⚠️ Erro 403 - Verifique se a WOOVI_API_KEY está correta');
        console.error('API Key atual:', this.appId ? `${this.appId.substring(0, 20)}...` : 'NÃO CONFIGURADA');
      }
      
      throw error;
    }
  }

  async validateWebhookSignature(payload: any, signature: string): Promise<boolean> {
    try {
      // O Woovi usa HMAC-SHA256 para validar webhooks
      // Por enquanto, vamos retornar true para testes
      // Em produção, você deve validar a assinatura usando a chave secreta do webhook
      console.log('Validando assinatura do webhook:', signature);
      return true;
    } catch (error) {
      console.error('Erro ao validar assinatura:', error);
      return false;
    }
  }

  async processWebhook(data: any): Promise<void> {
    try {
      console.log('🔔 ==================================================');
      console.log('🔔 WEBHOOK PIX RECEBIDO DO WOOVI');
      console.log('🔔 ==================================================');
      console.log('📦 Payload completo do webhook:', JSON.stringify(data, null, 2));
      
      // O Woovi pode enviar a estrutura de diferentes formas
      const event = data.event || data.type;
      const charge = data.charge || data.data || data;
      
      console.log(`📌 Tipo de evento: ${event}`);
      console.log('📊 Estrutura do charge:', {
        id: charge?.id,
        identifier: charge?.identifier,
        correlationID: charge?.correlationID,
        status: charge?.status
      });
      
      // Processar eventos específicos
      switch (event) {
        case 'OPENPIX:CHARGE_COMPLETED':
          console.log('✅ Processando pagamento CONCLUÍDO...');
          await this.handlePaymentConfirmed(charge);
          break;
          
        case 'OPENPIX:CHARGE_EXPIRED':
          console.log('⏰ Processando pagamento EXPIRADO...');
          await this.handlePaymentExpired(charge);
          break;
          
        default:
          console.log(`⚠️ Evento não processado: ${event}`);
          await this.logActivity('info', `Evento de webhook ignorado: ${event}`, { data });
      }
      
      await this.logActivity('info', `Webhook processado: ${event}`, { data });
    } catch (error) {
      console.error('❌ Erro ao processar webhook:', error);
      await this.logActivity('error', `Erro ao processar webhook: ${error}`, data);
      throw error;
    }
  }

  private async handlePaymentConfirmed(charge: any) {
    try {
      console.log('🎉 Pagamento PIX confirmado - dados recebidos:', JSON.stringify(charge, null, 2));
      
      // Coletar TODOS os possíveis identificadores
      const possibleIds = [
        charge?.identifier,
        charge?.id,
        charge?.correlationID,
        charge?.chargeId,
        charge?.transactionId,
        charge?.transaction?.id,
        charge?.reference,
        charge?.externalReference
      ].filter(Boolean);
      
      // Se tiver brCode, extrair o chargeId dele também
      if (charge?.brCode) {
        const match = charge.brCode.match(/([a-f0-9]{32})/);
        if (match) {
          possibleIds.push(match[1]);
        }
      }
      
      console.log('🔍 Identificadores encontrados no webhook:', possibleIds);
      
      const value = charge?.value || charge?.amount;
      const payer = charge?.payer || charge?.customer;
      
      if (possibleIds.length === 0) {
        console.error('⚠️ Nenhum ID de transação encontrado no webhook');
        console.log('Estrutura completa recebida:', JSON.stringify(charge, null, 2));
        await this.logActivity('error', 'Webhook recebido sem identificadores', { charge });
        return;
      }
      
      // Buscar pagamento em diferentes abordagens
      let pagamento: any = null;
      let isPagamentoManual = false;
      
      console.log('🔍 Iniciando busca do pagamento em todas as tabelas...');
      
      // Tentar com cada identificador possível
      for (const id of possibleIds) {
        console.log(`\n🔎 Tentando com identificador: ${id}`);
        
        // 1. Tentar na tabela pagamentos_manual
        if (!pagamento) {
          console.log('  📋 Buscando na tabela pagamentos_manual...');
          pagamento = await storage.getPagamentoManualByChargeId(id);
          if (pagamento) {
            isPagamentoManual = true;
            console.log('  ✅ Encontrado na tabela pagamentos_manual!');
            break;
          }
        }
        
        // 2. Tentar na tabela pagamentos por chargeId
        if (!pagamento) {
          console.log('  📋 Buscando na tabela pagamentos por chargeId...');
          pagamento = await storage.getPagamentoByChargeId(id);
          if (pagamento) {
            console.log('  ✅ Encontrado na tabela pagamentos por chargeId!');
            break;
          }
        }
        
        // 3. Tentar na tabela pagamentos por pixId
        if (!pagamento) {
          console.log('  📋 Buscando na tabela pagamentos por pixId...');
          pagamento = await storage.getPagamentoByPixId(id);
          if (pagamento) {
            console.log('  ✅ Encontrado na tabela pagamentos por pixId!');
            break;
          }
        }
      }
      
      // Se ainda não encontrou, tentar busca direta no banco com SQL
      if (!pagamento) {
        console.log('\n🔍 Tentando busca direta no banco de dados...');
        
        for (const id of possibleIds) {
          // Buscar em pagamentos_manual
          const resultManual = await db.execute(sql`
            SELECT * FROM pagamentos_manual 
            WHERE charge_id = ${id} 
               OR pix_id = ${id}
            LIMIT 1
          `);
          
          if (resultManual.length > 0) {
            pagamento = resultManual[0];
            isPagamentoManual = true;
            console.log('✅ Encontrado via SQL na tabela pagamentos_manual!');
            break;
          }
          
          // Buscar em pagamentos
          const resultPagamentos = await db.execute(sql`
            SELECT * FROM pagamentos 
            WHERE charge_id = ${id} 
               OR pix_id = ${id}
            LIMIT 1
          `);
          
          if (resultPagamentos.length > 0) {
            pagamento = resultPagamentos[0];
            console.log('✅ Encontrado via SQL na tabela pagamentos!');
            break;
          }
        }
      }
      
      if (!pagamento) {
        console.error('❌ PAGAMENTO NÃO ENCONTRADO EM NENHUMA TABELA!');
        console.log('Identificadores testados:', possibleIds);
        console.log('Estrutura completa do webhook:', JSON.stringify(charge, null, 2));
        
        // Log adicional para debug
        await this.logActivity('error', 'Webhook recebido para pagamento não encontrado', {
          identificadores: possibleIds,
          value,
          payer,
          chargeData: charge
        });
        return;
      }
      
      // Atualizar status do pagamento para pago na tabela correta
      console.log('💾 Atualizando status do pagamento para PAGO...');
      if (isPagamentoManual) {
        const chargeIdToUpdate = pagamento.charge_id || pagamento.chargeId || possibleIds[0];
        console.log('🔄 Atualizando na tabela pagamentos_manual, chargeId:', chargeIdToUpdate);
        const updateResult = await storage.updatePagamentoManualByChargeId(chargeIdToUpdate, {
          status: 'pago'
        });
        if (updateResult) {
          console.log('✅ Status atualizado com sucesso na tabela pagamentos_manual!');
        } else {
          console.error('❌ Falha ao atualizar status na tabela pagamentos_manual');
        }
      } else {
        console.log('🔄 Atualizando na tabela pagamentos, ID:', pagamento.id);
        await storage.updatePagamento(pagamento.id, {
          status: 'pago',
          dataPagamento: new Date()
        });
        console.log('✅ Status atualizado com sucesso na tabela pagamentos!');
      }
      
      // Verificar se é um pagamento de conversa (clienteId null) ou cliente cadastrado
      console.log('📤 Verificando tipo de pagamento...');
      console.log('ClienteId:', pagamento.clienteId || pagamento.cliente_id);
      console.log('Telefone:', pagamento.telefone);
      
      if (pagamento.clienteId === null || pagamento.cliente_id === null) {
        // Pagamento de conversa sem cliente cadastrado
        console.log('💬 Pagamento de conversa sem cliente cadastrado');
        
        // Para pagamentos manuais, o telefone está diretamente no registro
        let telefone = pagamento.telefone;
        
        if (telefone) {
          // Normalizar o número de telefone para formato brasileiro
          telefone = telefone.replace(/\D/g, ''); // Remove todos os não-dígitos (incluindo +)
          
          // Se começar com 14 (número de Bauru), adicionar código do Brasil
          if (telefone.startsWith('14')) {
            telefone = '55' + telefone;
          }
          // Se não começar com 55, adicionar código do Brasil
          else if (!telefone.startsWith('55')) {
            telefone = '55' + telefone;
          }
          
          console.log('📨 Preparando para enviar mensagem WhatsApp para:', telefone);
          console.log('📱 Número normalizado:', telefone);
          
          // Formatar valor para exibição
          const valorFormatado = value ? (value / 100).toFixed(2).replace('.', ',') : pagamento.valor;
          
          // Enviar mensagem simples de confirmação
          const mensagem = `✅ Pagamento Confirmado!\n\nSeu pagamento PIX no valor de R$ ${valorFormatado} foi confirmado com sucesso.`;
          
          try {
            console.log('📨 Enviando mensagem WhatsApp...');
            await whatsappService.sendMessage(telefone, mensagem);
            console.log(`✅ Mensagem de confirmação enviada com sucesso para ${telefone}`);
          } catch (whatsError: any) {
            console.error('❌ Erro ao enviar mensagem WhatsApp:', whatsError);
            console.error('Detalhes do erro:', whatsError?.message || whatsError);
          }
          
          await this.logActivity('info', `Pagamento confirmado para conversa ${telefone}`, {
            chargeId: pagamento.charge_id || pagamento.chargeId || possibleIds[0],
            value: value ? value / 100 : pagamento.valor,
            telefone
          });
        } else {
          console.warn('Telefone não encontrado no metadata do pagamento');
        }
      } else {
        // Buscar e atualizar cliente normal
        const cliente = await storage.getClienteById(pagamento.clienteId);
        if (cliente) {
          // Por padrão, marcar cliente como ativo
          let updateData: any = { status: 'ativo' };
          
          // Por enquanto, adicionar 30 dias ao vencimento do cliente
          // Futuramente, podemos adicionar lógica para diferentes planos
          const baseDate = cliente.vencimento && new Date(cliente.vencimento) > new Date() 
            ? new Date(cliente.vencimento) 
            : new Date();
          
          // Verificar se o pagamento tem metadata com número de meses
          // Primeiro tentar extrair do comment no formato [MESES:X]
          let meses = 1; // Padrão 1 mês
          
          const comment = charge?.comment || charge?.description || '';
          const mesesMatch = comment.match(/\[MESES:(\d+)\]/);
          if (mesesMatch) {
            meses = parseInt(mesesMatch[1], 10);
            console.log(`📅 Número de meses extraído do comment: ${meses}`);
          } else {
            // Tentar outras fontes de metadata
            meses = charge?.metadata?.meses || charge?.meses || charge?.additionalInfo?.meses || pagamento.metadata?.meses || 1;
          }
          
          console.log(`📅 Adicionando ${meses} meses ao vencimento do cliente`);
          
          // Usar date-fns para adicionar meses corretamente
          let novoVencimento = addMonths(baseDate, meses);
          // Ajustar para 23:59:59 do dia de vencimento
          novoVencimento.setHours(23, 59, 59, 999);
          
          updateData.vencimento = novoVencimento;
          
          console.log(`Atualizando vencimento do cliente ${cliente.nome} para ${novoVencimento.toLocaleDateString('pt-BR')}`);
          
          
          // Atualizar cliente com status e vencimento (se aplicável)
          await storage.updateCliente(pagamento.clienteId, updateData);
          
          // Formatar valor para exibição
          const valorFormatado = value ? (value / 100).toFixed(2).replace('.', ',') : pagamento.valor;
          
          // Normalizar telefone do cliente antes de enviar
          let telefoneCliente = cliente.telefone.replace(/\D/g, ''); // Remove não-dígitos
          
          // Se começar com 14 (número de Bauru), adicionar código do Brasil
          if (telefoneCliente.startsWith('14')) {
            telefoneCliente = '55' + telefoneCliente;
          }
          // Se não começar com 55, adicionar código do Brasil
          else if (!telefoneCliente.startsWith('55')) {
            telefoneCliente = '55' + telefoneCliente;
          }
          
          console.log('📱 Enviando confirmação para cliente:', cliente.nome);
          console.log('📱 Telefone normalizado:', telefoneCliente);
          
          // Formatar a data de vencimento para exibição
          const dataVencimento = novoVencimento.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          
          // Enviar mensagem de confirmação via WhatsApp
          const mensagem = `✅ Pagamento Confirmado!\n\nSeu pagamento PIX no valor de R$ ${valorFormatado} foi confirmado com sucesso.\n\nNovo Vencimento: ${dataVencimento}`;
          
          try {
            await whatsappService.sendMessage(telefoneCliente, mensagem);
          } catch (whatsError: any) {
            console.error('Erro ao enviar mensagem WhatsApp:', whatsError);
            // Não interromper o processo se WhatsApp falhar
          }
          
          await this.logActivity('info', `Pagamento confirmado para cliente ${cliente.nome}`, {
            chargeId: pagamento.charge_id || pagamento.chargeId || possibleIds[0],
            value: value ? value / 100 : pagamento.valor,
            clienteId: pagamento.clienteId
          });
        }
      }
    } catch (error) {
      console.error('Erro ao processar confirmação de pagamento:', error);
      throw error;
    }
  }

  private async handlePaymentExpired(charge: any) {
    try {
      console.log('⏰ Pagamento PIX expirado - dados recebidos:', charge);
      
      // Extrair informações do charge
      const chargeId = charge?.id || charge?.transaction?.id || charge?.transactionId || charge?.identifier;
      const correlationId = charge?.correlationID || charge?.correlationId || charge?.correlation_id;
      
      if (!chargeId && !correlationId) {
        console.error('ID da transação não encontrado no webhook de expiração');
        return;
      }
      
      // Buscar pagamento pelo chargeId ou correlationID
      let pagamento = chargeId ? await storage.getPagamentoByChargeId(chargeId) : undefined;
      
      // Se não encontrar por chargeId, tentar por correlationID/pixId
      if (!pagamento && correlationId) {
        pagamento = await storage.getPagamentoByPixId(correlationId);
      }
      
      if (!pagamento) {
        console.warn('Pagamento expirado não encontrado no banco de dados');
        console.log('Procurado por chargeId:', chargeId);
        console.log('Procurado por correlationId:', correlationId);
        return;
      }
      
      // Atualizar status do pagamento para expirado
      await storage.updatePagamento(pagamento.id, {
        status: 'expirado'
      });
      
      // Buscar cliente para notificação
      const cliente = await storage.getClienteById(pagamento.clienteId);
      if (cliente) {
        // Normalizar telefone do cliente antes de enviar
        let telefoneCliente = cliente.telefone.replace(/\D/g, ''); // Remove não-dígitos
        
        // Se começar com 14 (número de Bauru), adicionar código do Brasil
        if (telefoneCliente.startsWith('14')) {
          telefoneCliente = '55' + telefoneCliente;
        }
        // Se não começar com 55, adicionar código do Brasil
        else if (!telefoneCliente.startsWith('55')) {
          telefoneCliente = '55' + telefoneCliente;
        }
        
        console.log('⏰ Enviando notificação de expiração para:', telefoneCliente);
        
        // Enviar mensagem de expiração via WhatsApp
        const mensagem = `⏰ *PIX Expirado*\n\nOlá ${cliente.nome},\n\nSeu PIX no valor de *R$ ${pagamento.valor}* expirou.\n\nPara continuar com o pagamento, solicite um novo código PIX.\n\n_TV ON Sistema_`;
        
        try {
          await whatsappService.sendMessage(telefoneCliente, mensagem);
        } catch (whatsError) {
          console.error('Erro ao enviar mensagem WhatsApp:', whatsError);
        }
        
        await this.logActivity('info', `PIX expirado para cliente ${cliente.nome}`, {
          chargeId: chargeId || '',
          clienteId: pagamento.clienteId
        });
      }
    } catch (error) {
      console.error('Erro ao processar expiração de pagamento:', error);
      throw error;
    }
  }

  async checkPaymentStatus(paymentId: string): Promise<'pending' | 'paid' | 'cancelled' | 'expired'> {
    try {
      // Aqui você faria a consulta na sua API PIX
      // Por ora, retornamos o status do banco local
      const pagamento = await storage.getPagamentosByClienteId(0).then(pagamentos => 
        pagamentos.find(p => p.pixId === paymentId)
      );
      
      if (!pagamento) return 'cancelled';
      
      switch (pagamento.status) {
        case 'pago': return 'paid';
        case 'cancelado': return 'cancelled';
        default: return 'pending';
      }
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      return 'pending';
    }
  }



  async cancelPayment(paymentId: string): Promise<boolean> {
    try {
      const pagamentos = await storage.getPagamentosByClienteId(0);
      const pagamento = pagamentos.find(p => p.pixId === paymentId);
      
      if (!pagamento) return false;

      await storage.updatePagamento(pagamento.id, {
        status: 'cancelado'
      });

      await this.logActivity('info', `Pagamento cancelado: ${paymentId}`);
      return true;
    } catch (error) {
      console.error('Erro ao cancelar pagamento:', error);
      await this.logActivity('error', `Erro ao cancelar pagamento: ${error}`, { paymentId });
      return false;
    }
  }

  private async logActivity(nivel: string, mensagem: string, detalhes?: any) {
    try {
      await storage.createLog({
        nivel,
        origem: 'PIX',
        mensagem,
        detalhes: detalhes ? JSON.stringify(detalhes) : null
      });
    } catch (error) {
      console.error('Erro ao criar log:', error);
    }
  }
}

export const pixService = new PixService();
