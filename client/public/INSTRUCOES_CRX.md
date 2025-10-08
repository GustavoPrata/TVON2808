# Instruções para Converter ZIP em CRX

## O que é CRX?
CRX é o formato de arquivo nativo para extensões do Google Chrome. É basicamente um arquivo ZIP com assinatura digital.

## Métodos de Conversão

### Método 1: Usando o Chrome Developer Mode

1. Abra o Chrome e vá para `chrome://extensions/`
2. Ative o "Modo do desenvolvedor" (canto superior direito)
3. Clique em "Carregar sem compactação" e selecione a pasta descompactada da extensão
4. Após carregar, clique em "Empacotar extensão"
5. Selecione o diretório raiz da extensão
6. Clique em "Empacotar extensão"
7. O Chrome criará um arquivo .crx na pasta pai

### Método 2: Usando linha de comando (Chrome/Chromium)

```bash
# No Windows
chrome.exe --pack-extension=C:\caminho\para\extensao

# No Mac
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --pack-extension=/caminho/para/extensao

# No Linux
google-chrome --pack-extension=/caminho/para/extensao
```

### Método 3: Ferramenta Online
Existem ferramentas online que convertem ZIP para CRX, mas por segurança, recomendamos usar os métodos oficiais acima.

## Instalação do CRX

### Para Chrome versões antigas (antes da v21):
1. Arraste e solte o arquivo .crx na janela do Chrome
2. Confirme a instalação

### Para Chrome versões recentes:
Por questões de segurança, o Chrome moderno não permite instalação direta de CRX de fontes não confiáveis.

**Recomendação:** Use o modo desenvolvedor e carregue a extensão descompactada:
1. Extraia qualquer um dos arquivos ZIP fornecidos
2. Vá para `chrome://extensions/`
3. Ative "Modo do desenvolvedor"
4. Clique em "Carregar sem compactação"
5. Selecione a pasta extraída

## Solução de Problemas

### Erro "Arquivo corrompido" ou "Pacote inválido"
Tente as diferentes versões de ZIP fornecidas:
- `extensao-tv-on.zip` - Versão padrão com compressão
- `extensao-tv-on-flat.zip` - Arquivos na raiz do ZIP
- `extensao-tv-on-folder.zip` - Com pasta container
- `extensao-tv-on-store.zip` - Sem compressão (formato Chrome Web Store)

### Erro de permissões
Certifique-se de que o manifest.json tem as permissões corretas e que a versão do manifest é compatível com sua versão do Chrome.

### Erro de assinatura
CRX criados localmente não são assinados. Para distribuição oficial, publique na Chrome Web Store.

## Versões Disponíveis

Criamos múltiplas versões do ZIP para resolver problemas de compatibilidade:

1. **extensao-tv-on.zip** - Versão padrão com compressão normal
2. **extensao-tv-on-flat.zip** - Todos os arquivos na raiz (sem subpasta)
3. **extensao-tv-on-folder.zip** - Com pasta container "extensao-chrome"
4. **extensao-tv-on-store.zip** - Sem compressão (compatível com Chrome Web Store)

Teste cada versão até encontrar a que funciona melhor com sua configuração.