# OnlineOffice IPTV Automator - Guia de Uso

## Instalação da Extensão

1. Abra o Chrome e navegue para `chrome://extensions/`
2. Ative o "Modo do desenvolvedor" no canto superior direito
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `chrome-extension` do projeto
5. A extensão será instalada e o ícone aparecerá na barra de ferramentas

## Como Usar

### Preparação
1. Acesse o site OnlineOffice (onlineoffice.zip ou tv-on.site)
2. Faça login com suas credenciais
3. Navegue até a página onde o botão "Gerar IPTV" está visível
4. Clique no ícone da extensão para abrir o popup

### Modo Manual (Gerar Um)
1. Com a extensão aberta e conectada ao site
2. Clique no botão "Gerar Um"
3. A extensão clicará automaticamente no botão "Gerar IPTV" do site
4. As credenciais geradas serão exibidas na extensão
5. Use os botões 📋 para copiar usuário e senha

### Modo Automático
1. Ative o toggle "Automação"
2. Configure:
   - **Quantidade**: Número de credenciais para gerar (1-100)
   - **Intervalo**: Tempo entre cada geração
     - Segundos: Para testes rápidos (⚠️ requer aba ativa)
     - Minutos: Recomendado (funciona em background)
     - Horas: Para gerações espaçadas
3. Clique em "Salvar Configuração"
4. A extensão gerará automaticamente as credenciais respeitando o intervalo

### Observações Importantes

- **Intervalos < 1 minuto**: O Chrome limita a execução em background. A aba deve permanecer ativa e visível
- **Intervalos ≥ 1 minuto**: Funciona perfeitamente mesmo com a aba em background
- **Progresso**: O contador mostra quantas credenciais foram geradas
- **Logs**: Acompanhe as atividades na seção de log da extensão
- **Credenciais**: São salvas automaticamente no servidor e exibidas na extensão

### Solução de Problemas

1. **Extensão não conecta**:
   - Verifique se está no site correto
   - Recarregue a página
   - Reabra o popup da extensão

2. **Automação para sozinha**:
   - Verifique se a quantidade configurada foi atingida
   - Para intervalos curtos, mantenha a aba ativa

3. **Credenciais não aparecem**:
   - Verifique o console do navegador (F12)
   - Certifique-se de que o botão "Gerar IPTV" está visível na página

### Arquitetura Técnica

A extensão usa uma arquitetura de 3 componentes:

- **background.js**: Gerencia toda a lógica de automação usando Chrome Alarms API
- **content.js**: Interage com a página web executando comandos
- **popup.js**: Interface do usuário que se comunica com o background

Credenciais são enviadas para o servidor via endpoint `/api/office/credentials` com CORS habilitado.