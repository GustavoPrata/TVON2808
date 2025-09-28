# 🚀 Extensão Chrome 24/7 - TV ON System

## ✅ MODIFICAÇÕES REALIZADAS PARA FUNCIONAMENTO 24/7

### 1. **Sistema de Alarmes Aprimorado**
- ⏰ **Polling de tarefas**: A cada 15 segundos (antes era 20s)
- 🔥 **Keep-alive**: A cada 30 segundos (mantém extensão sempre ativa)
- 🔍 **Verificação de aba**: A cada 30 segundos (garante aba sempre aberta)
- 💗 **Heartbeat**: A cada 30 segundos (comunicação constante com backend)

### 2. **Aba Sempre Aberta**
- 📌 **Aba pinada automaticamente** para evitar fechamento acidental
- 🔄 **Reabertura automática** se a aba for fechada (em 5 segundos)
- 🌐 **Funciona em background** sem precisar estar visível

### 3. **Inicialização 24/7**
- 🚀 **Inicia automaticamente** quando o Chrome abre
- ✅ **Não depende de configuração** de habilitado/desabilitado
- 🔧 **Sistema independente** de status do backend

## 📥 INSTALAÇÃO DA EXTENSÃO ATUALIZADA

### Passo 1: Remover Extensão Anterior (se houver)
1. Abra o Chrome e digite: `chrome://extensions/`
2. Procure por "OnlineOffice IPTV Automator"
3. Clique em **Remover**

### Passo 2: Instalar Nova Extensão
1. **Baixe o arquivo**: `chrome-extension-24-7.zip`
2. **Extraia** o arquivo ZIP em uma pasta
3. Abra o Chrome e digite: `chrome://extensions/`
4. Ative o **Modo do desenvolvedor** (canto superior direito)
5. Clique em **Carregar sem compactação**
6. Selecione a pasta onde extraiu a extensão

### Passo 3: Verificação
- ✅ A extensão deve abrir automaticamente uma aba do OnlineOffice
- ✅ A aba será **pinada** (pequena aba fixa)
- ✅ O ícone da extensão aparecerá na barra de ferramentas

## 🔧 CONFIGURAÇÃO DO CHROME PARA 24/7

### Configurações Recomendadas:

1. **Manter Chrome em Background**:
   - Configurações → Sistema
   - ✅ Ative: "Continuar executando apps em segundo plano quando o Chrome for fechado"

2. **Iniciar Chrome com o Windows**:
   - Windows + R → digite: `shell:startup`
   - Crie atalho do Chrome nesta pasta

3. **Desativar Suspensão de Abas**:
   - Digite na barra: `chrome://flags`
   - Procure: "Automatic tab discarding"
   - Defina como: **Disabled**

## 🚨 IMPORTANTE

### A extensão agora:
- ✅ **Funciona 24 horas por dia, 7 dias por semana**
- ✅ **Não precisa de aba visível ou ativa**
- ✅ **Mantém aba do OnlineOffice sempre aberta (pinada)**
- ✅ **Reabre automaticamente se fechada**
- ✅ **Envia heartbeat constante ao backend**
- ✅ **Verifica tarefas a cada 15 segundos**

### Logs da Extensão:
Para verificar se está funcionando:
1. Clique no ícone da extensão
2. Clique em "Ver Logs"
3. Você deve ver mensagens como:
   - "🚀 Sistema 24/7 ativo e funcionando!"
   - "⏰ Alarme disparado: pollBackend"
   - "💗 Heartbeat enviado com sucesso"

## 🔄 TROUBLESHOOTING

### Se a extensão não estiver funcionando:

1. **Verifique se a aba está aberta**:
   - Deve haver uma aba pinada do OnlineOffice
   - Se não houver, clique no ícone da extensão

2. **Recarregue a extensão**:
   - `chrome://extensions/`
   - Clique no botão de recarregar na extensão

3. **Verifique os logs**:
   - Clique com botão direito no ícone da extensão
   - "Gerenciar extensão" → "Visualizar Service Worker"
   - Veja o console para logs detalhados

## ✨ MELHORIAS IMPLEMENTADAS

1. **Sistema de Keep-Alive**: Mantém service worker sempre ativo
2. **Múltiplos Alarmes**: Redundância para garantir funcionamento
3. **Aba Pinada**: Evita fechamento acidental
4. **Reabertura Automática**: Se fechar, reabre em 5 segundos
5. **Heartbeat Constante**: Comunicação contínua com backend
6. **Polling Agressivo**: Verifica tarefas a cada 15 segundos

---

## 📞 SUPORTE

Se houver problemas:
1. Verifique os logs da extensão
2. Certifique-se que o Chrome está configurado corretamente
3. Reinicie o Chrome e verifique se a aba abre automaticamente
4. A extensão deve mostrar badge "ON" quando ativa

**Versão**: 2.0.0 (24/7 Edition)
**Última Atualização**: 28/09/2025