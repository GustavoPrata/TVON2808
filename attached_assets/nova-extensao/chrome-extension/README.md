# OnlineOffice IPTV Automator - Chrome Extension

## Descrição
Esta extensão automatiza a geração de credenciais IPTV no site OnlineOffice.zip.

## Recursos

- 🚀 Geração automática de credenciais IPTV
- 💾 Salvamento automático no sistema
- 📋 Interface intuitiva com popup
- 🔄 Sincronização com a aplicação principal
- 🎨 Design moderno e responsivo

## Instalação

### Passo 1: Baixar a Extensão

1. Navegue até a pasta `chrome-extension` do projeto
2. Faça o download de toda a pasta

### Passo 2: Instalar no Chrome

1. Abra o Chrome e acesse `chrome://extensions/`
2. Ative o **Modo do desenvolvedor** (toggle no canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `chrome-extension` que você baixou
5. A extensão será instalada e aparecerá na barra de extensões

### Passo 3: Configurar

1. Clique no ícone da extensão (puzzle piece) na barra do Chrome
2. Clique na extensão "OnlineOffice IPTV Automator"
3. Configure a URL do servidor (padrão: `http://localhost:5000`)
4. Salve a configuração

## Como Usar

### Método 1: Geração Manual

1. Acesse [onlineoffice.zip](https://onlineoffice.zip)
2. Faça login em sua conta
3. Navegue até a página de geração de IPTV
4. Clique no ícone da extensão
5. Clique em "Gerar Credenciais"
6. As credenciais serão capturadas e salvas automaticamente

### Método 2: Geração Automática

1. Ative a opção "Geração Automática" na extensão
2. A extensão detectará automaticamente quando você estiver na página correta
3. Gerará e salvará as credenciais sem intervenção manual

## Estrutura da Extensão

```
chrome-extension/
├── manifest.json         # Configuração da extensão
├── content.js           # Script injetado no OnlineOffice
├── popup.html           # Interface do popup
├── popup.js            # Lógica do popup
├── popup.css           # Estilos do popup
├── background.js       # Service worker
└── icons/              # Ícones da extensão
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## API Endpoints

A extensão se comunica com os seguintes endpoints:

- `POST /api/office/save-credentials` - Salva as credenciais capturadas
- `POST /api/office/generate-human` - Gera credenciais humanizadas

## Desenvolvimento

### Recarregar a Extensão

Após fazer alterações no código:

1. Vá para `chrome://extensions/`
2. Encontre a extensão
3. Clique no botão de recarregar (ícone de seta circular)

### Debug

1. Clique com o botão direito no ícone da extensão
2. Selecione "Inspecionar popup" para debug do popup
3. Ou abra o DevTools (F12) no site para ver logs do content script

## Troubleshooting

### A extensão não aparece

- Verifique se o modo desenvolvedor está ativado
- Recarregue a página de extensões

### Não captura credenciais

- Verifique se está na página correta do OnlineOffice
- Abra o console (F12) e verifique por erros
- Certifique-se de que fez login no OnlineOffice

### Erro de conexão com servidor

- Verifique se o servidor está rodando (`npm run dev`)
- Confirme a URL do servidor nas configurações
- Verifique se há bloqueio de CORS

## Segurança

- A extensão só tem permissão para acessar onlineoffice.zip
- As credenciais são enviadas via HTTPS quando em produção
- Nenhuma informação pessoal é coletada ou armazenada

## Suporte

Em caso de problemas:

1. Verifique o console do navegador para mensagens de erro
2. Confirme que o servidor está rodando
3. Tente recarregar a extensão
4. Limpe o cache do navegador se necessário

## Licença

Uso interno - TV ON System