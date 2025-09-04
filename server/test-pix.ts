import { PixService } from './services/pix';
import { storage } from './storage';

async function testPix() {
  try {
    console.log('🔍 Testando geração de PIX...');
    console.log('=========================================\n');
    
    // Inicializar serviço
    const pixService = new PixService();
    await pixService.initializeConfig();
    
    // Verificar se está configurado  
    const hasApiKey = !!process.env.WOOVI_API_KEY;
    console.log('📊 Status Woovi:');
    console.log('   - API Key presente:', hasApiKey);
    console.log('   - App ID:', pixService.appId || 'Não configurado');
    
    if (!hasApiKey) {
      console.log('\n⚠️ PROBLEMA ENCONTRADO:');
      console.log('   Woovi não está configurado!');
      console.log('   Configure a API Key do Woovi em Configurações > Integração PIX');
      return;
    }
    
    // Buscar conversa de teste
    const conversas = await storage.getConversas();
    const conversaTeste = conversas.find(c => !c.clienteId);
    
    if (!conversaTeste) {
      console.log('\n⚠️ Nenhuma conversa sem cliente encontrada para teste');
      return;
    }
    
    console.log('\n📱 Conversa de teste:');
    console.log('   - ID:', conversaTeste.id);
    console.log('   - Telefone:', conversaTeste.telefone);
    
    // Testar geração para conversa sem cliente
    console.log('\n🚀 Gerando PIX para conversa sem cliente...');
    const result = await pixService.generatePix(
      -conversaTeste.id, // ID negativo indica conversa sem cliente
      50.00,
      'Teste pagamento TV ON',
      {
        conversaId: conversaTeste.id,
        telefone: conversaTeste.telefone
      }
    );
    
    if (result) {
      console.log('\n✅ PIX GERADO COM SUCESSO!');
      console.log('   - ID:', result.id);
      console.log('   - Valor:', result.amount);
      console.log('   - QR Code:', result.qrCode ? '✓ Disponível' : '✗ Não disponível');
      console.log('   - Copia e Cola:', result.pixCopiaCola ? '✓ Disponível' : '✗ Não disponível');
      console.log('   - Status:', result.status);
      
      // Verificar se foi salvo no banco
      const pagamentoSalvo = await storage.getPagamentoManualByChargeId(result.id);
      console.log('\n💾 Salvo no banco:', pagamentoSalvo ? '✓ Sim' : '✗ Não');
    } else {
      console.log('\n❌ ERRO: PIX não foi gerado (retornou null)');
    }
  } catch (error: any) {
    console.error('\n❌ ERRO AO GERAR PIX:', error.message);
    if (error.response?.data) {
      console.error('   Detalhes da API:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('\n📋 Stack trace:');
      console.error(error.stack);
    }
  }
}

// Executar teste
testPix().then(() => {
  console.log('\n=========================================');
  console.log('Teste finalizado');
  process.exit(0);
}).catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});