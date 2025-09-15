import OnlineOfficeService from './services/onlineoffice';

async function testOnlineOffice() {
  try {
    console.log('🧪 Iniciando teste da automação OnlineOffice...');
    
    const service = OnlineOfficeService.getInstance();
    const result = await service.generateIPTVTest();
    
    console.log('✅ Teste concluído com sucesso!');
    console.log('📋 Resultado:');
    console.log('  Usuário:', result.usuario);
    console.log('  Senha:', result.senha);
    console.log('  Vencimento:', result.vencimento || 'Não informado');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : '');
  }
}

// Executa o teste
testOnlineOffice().then(() => {
  console.log('🏁 Teste finalizado');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});