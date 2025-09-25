import { storage } from './server/storage';
import { ExternalApiService } from './server/services/externalApi';

async function testSync() {
  console.log('Iniciando teste de sincronização...');
  
  // Usar a instância existente de storage
  const externalApiService = new ExternalApiService();

  try {
    // Executar sincronização
    console.log('Executando sincronização de sistemas...');
    const result = await storage.syncSistemasToApi(externalApiService);
    
    console.log('\n=== RESULTADO DA SINCRONIZAÇÃO ===');
    console.log(`✅ Sistemas criados: ${result.created}`);
    console.log(`✅ Sistemas atualizados: ${result.updated}`);
    console.log(`✅ Sistemas deletados: ${result.deleted}`);
    console.log(`✅ Usuários atualizados: ${result.usersUpdated}`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️ Erros encontrados:`);
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('\n=== FIM DO TESTE ===');
  } catch (error) {
    console.error('Erro durante o teste:', error);
  } finally {
    process.exit(0);
  }
}

// Executar o teste
testSync();