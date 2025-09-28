# Extensão OnlineOffice IPTV Automator v2.0 - Modo 24/7

## 🚀 O que mudou nesta versão

Esta versão foi modificada para funcionar **24 horas por dia, 7 dias por semana**, completamente em background:

✅ **Funciona sem aba aberta** - Não precisa mais manter aba do OnlineOffice aberta
✅ **Funciona sem login** - Processa tarefas independentemente 
✅ **Funciona 24/7** - Sistema de alarmes mantém extensão sempre ativa
✅ **Auto-recuperação** - Reconecta automaticamente em caso de erros
✅ **Heartbeat contínuo** - Envia status para o servidor a cada 30 segundos

## 📦 Como instalar

1. Descompacte o arquivo `extensao_background_24h.zip`
2. Abra o Chrome e acesse: `chrome://extensions/`
3. Ative o **Modo do desenvolvedor** (canto superior direito)
4. Clique em **Carregar sem compactação**
5. Selecione a pasta `chrome-extension` descompactada
6. A extensão será instalada e começará a funcionar automaticamente

## 🔧 Como funciona agora

### Sistema de Alarmes
- **Polling Backend**: Verifica novas tarefas a cada 15 segundos
- **Keep Alive**: Mantém service worker ativo a cada 30 segundos  
- **Heartbeat**: Envia status ao servidor a cada 30 segundos

### Modo Background
- Não abre abas automaticamente
- Funciona mesmo com navegador minimizado
- Continua funcionando após reiniciar o Chrome
- Processa tarefas de renovação automaticamente

### Monitoramento
- Clique no ícone da extensão para ver o status
- Logs detalhados disponíveis no popup da extensão
- Badge no ícone mostra se está ativo (verde) ou inativo (cinza)

## ⚙️ Configuração

A extensão se conecta automaticamente ao servidor configurado. Servidores disponíveis:
1. Servidor principal Replit
2. tv-on.site (backup)
3. localhost:5000 (desenvolvimento)

## 🔍 Solução de Problemas

### Se a extensão parar de funcionar:
1. Verifique se o Chrome está atualizado
2. Recarregue a extensão em `chrome://extensions/`
3. Verifique os logs clicando no ícone da extensão

### Se não processar tarefas:
1. Verifique se o servidor está online
2. Certifique-se que há tarefas na fila
3. Verifique os logs para mensagens de erro

## 📊 Recursos

- **Logs persistentes**: Até 1000 entradas salvas
- **Filtros de log**: Por nível (DEBUG, INFO, WARN, ERROR)
- **Busca nos logs**: Pesquise por texto
- **Export de logs**: Baixe logs como arquivo texto

## 🔒 Segurança

- Comunicação criptografada com servidor
- Autenticação via chave secreta
- Não armazena credenciais localmente
- Reconexão segura em caso de falha

## 📱 Compatibilidade

- Chrome 88+ (recomendado: última versão)
- Funciona em Windows, Mac e Linux
- Suporte para múltiplas abas e janelas

## ❓ Suporte

Em caso de problemas:
1. Verifique os logs da extensão
2. Recarregue a extensão
3. Reinicie o Chrome se necessário