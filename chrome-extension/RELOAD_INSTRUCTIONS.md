# Instruções para Recarregar a Extensão

## ⚠️ CORREÇÕES APLICADAS - RELOAD NECESSÁRIO

### Correções implementadas:
1. ✅ Adicionado reset automático de `isProcessingTask` na inicialização
2. ✅ Implementado timeout de segurança (5 minutos) para evitar travamentos
3. ✅ Melhorado tratamento de erros com reset garantido no bloco finally
4. ✅ Adicionado suporte ao tipo `single_generation` de tarefa
5. ✅ Logs de debug detalhados para rastrear o estado de processamento
6. ✅ Timeout de 10 minutos para tarefas e 30 segundos para geração de credenciais

### Como recarregar a extensão:

1. **Abra o Chrome** e acesse: `chrome://extensions/`

2. **Ative o Modo de Desenvolvedor** (toggle no canto superior direito)

3. **Encontre a extensão "OnlineOffice IPTV Automator"**

4. **Clique no botão "Recarregar"** (ícone de seta circular) na extensão

5. **Verifique o console da extensão:**
   - Clique em "service worker" ou "background page"
   - Procure pela mensagem: `🔄 Estado inicial resetado`
   - Deve aparecer: `isProcessingTask: false`

### Verificar se a correção funcionou:

1. **Abra o console do service worker da extensão**
2. **Observe os logs** - você deve ver:
   ```
   🔄 Estado inicial resetado { isProcessingTask: false }
   🔍 Buscando tarefas em: http://localhost:5000/api/office/automation/next-task
   📦 Resposta do servidor: { hasTask: true, isEnabled: true, taskType: "single_generation" }
   🎯 PROCESSANDO TAREFA DO BACKEND
   ```

3. **Se houver tarefas pendentes**, elas devem começar a ser processadas automaticamente

### Comandos úteis no console da extensão:

```javascript
// Verificar estado atual
console.log('isProcessingTask:', isProcessingTask);
console.log('processingStartTime:', processingStartTime);

// Forçar reset manual (se necessário)
isProcessingTask = false;
processingStartTime = null;
checkForTasks();
```

### Notas importantes:
- A extensão agora reseta automaticamente `isProcessingTask` se travar por mais de 5 minutos
- Cada tarefa tem timeout máximo de 10 minutos
- Os logs são muito mais detalhados para debug
- O tipo `single_generation` agora é reconhecido corretamente

### Se ainda não funcionar:
1. Verifique se a aba do OnlineOffice está aberta
2. Confirme que está logado no OnlineOffice
3. Verifique os logs do backend para ver se há tarefas pendentes
4. Use o comando: `curl http://localhost:5000/api/office/automation/next-task`