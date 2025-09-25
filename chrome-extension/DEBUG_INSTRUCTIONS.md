# INSTRUÇÕES DE DEBUG - Extensão Chrome OnlineOffice

## CORREÇÕES IMPLEMENTADAS ✅

### 1. Sistema de Debug Avançado no content.js
- **Função `debugPageElements()`**: Analisa toda a página e registra:
  - Todos os botões encontrados (com texto, classes, IDs)
  - Links de ação (criar, adicionar, novo, gerar, etc.)
  - Ícones clicáveis
  - Inputs visíveis
  - Modais e dialogs
  
### 2. Múltiplos Seletores de Busca
- **Função `findButtonByMultipleSelectors()`**: Procura botões por:
  - Textos variados: "Gerar", "Criar", "Adicionar", "Novo", "Add", "Test", etc.
  - Classes CSS: add, plus, create
  - Atributos: data-action, ng-click, onclick
  - Ícones: fa-plus, mdi-plus, etc.

### 3. Extração Inteligente de Credenciais
- **Função `findCredentialsInPage()`**: Busca credenciais em:
  - Inputs (especialmente readonly)
  - Conteúdo de modais
  - Tabelas (células td/th)
  - Texto da página com padrões regex

### 4. Botão de Debug no Popup
- Adicionado botão "Debug Página OnlineOffice" no popup
- Executa análise completa da página
- Mostra resultado no console do navegador

## COMO USAR O DEBUG 🔍

1. **Abra o site OnlineOffice**:
   - Navegue para https://onlineoffice.zip
   - Faça login normalmente
   - Vá para a página de usuários IPTV

2. **Execute o Debug**:
   - Clique no ícone da extensão
   - Clique em "Debug Página OnlineOffice"
   - Abra o Console do navegador (F12)
   - Veja os elementos encontrados

3. **Analise os resultados**:
   - Procure por botões com textos relacionados a criar/gerar
   - Identifique inputs onde credenciais aparecem
   - Note modais ou popups que surgem

## LOGS IMPORTANTES PARA PROCURAR 🎯

No console, procure por:
```
🔍 === INICIANDO DEBUG DETALHADO DA PÁGINA ===
🔘 Total de botões encontrados: X
🔗 Links de ação encontrados:
📝 Inputs encontrados:
💬 Modais/Dialogs encontrados:
```

## CORREÇÕES ADICIONAIS POSSÍVEIS 🔧

Se o debug revelar elementos não detectados:

1. **Adicione novos seletores** em `findButtonByMultipleSelectors()`:
```javascript
const possibleTexts = [
  'SEU_TEXTO_AQUI',
  // adicione textos específicos encontrados
];
```

2. **Ajuste padrões de extração** em `extractCredentialsFromText()`:
```javascript
// Adicione novos padrões regex para capturar credenciais
const patterns = [
  /seu_padrao_aqui/i,
];
```

3. **Configure timeouts** se necessário:
```javascript
// Aumente o tempo de espera se a página for lenta
await new Promise(resolve => setTimeout(resolve, 3000));
```

## FALLBACK IMPLEMENTADO ⚡

Se não encontrar elementos específicos:
1. Tenta capturar credenciais existentes na página
2. Faz varredura completa do texto da página
3. Retorna debug detalhado com informações encontradas

## TESTE RÁPIDO 🚀

Para testar manualmente:
1. Abra o Console (F12)
2. Execute: `chrome.runtime.sendMessage({action: 'generateOne'}, console.log)`
3. Veja o resultado no console

## STATUS ATUAL ✨

✅ Debug avançado implementado
✅ Múltiplos seletores de busca
✅ Extração inteligente de credenciais
✅ Botão de debug no popup
✅ Logs detalhados para diagnóstico

## PRÓXIMOS PASSOS 📋

1. Execute o debug no site real
2. Identifique os elementos corretos
3. Ajuste os seletores se necessário
4. Teste a geração de credenciais

---
**NOTA**: A extensão está preparada para se adaptar a diferentes layouts. Use o debug para descobrir a estrutura específica do OnlineOffice na sua instalação.