# CONFIGURAÇÃO DE SEGURANÇA - SESSION_SECRET

## 🚨 IMPORTANTE: Vulnerabilidade Crítica Corrigida

Este sistema anteriormente usava um session secret hardcoded (`tv-on-secret-key-2024`), o que era uma vulnerabilidade crítica de segurança. Agora, o sistema **EXIGE** uma SESSION_SECRET configurada via variável de ambiente.

## ✅ O que foi corrigido

1. **Remoção do secret hardcoded**: O servidor não usa mais valores padrão inseguros
2. **Validação obrigatória**: O servidor RECUSA inicializar sem SESSION_SECRET configurada
3. **Validação de segurança**: O sistema verifica:
   - Comprimento mínimo (32 caracteres recomendado)
   - Detecção de valores fracos ou previsíveis
   - Em produção, rejeita secrets inseguros

## 📝 Como configurar a SESSION_SECRET

### No Replit:

1. Clique na aba **"Secrets"** (ícone de cadeado no painel lateral)
2. Adicione uma nova secret:
   - **Nome**: `SESSION_SECRET`
   - **Valor**: Use um valor seguro (veja abaixo como gerar)
3. Reinicie o servidor

### Como gerar um secret seguro:

Execute este comando no terminal:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Este comando gera uma string hexadecimal de 96 caracteres, criptograficamente segura.

## ⚠️ Avisos de Segurança

1. **NUNCA** compartilhe ou exponha a SESSION_SECRET
2. **NUNCA** use valores previsíveis como "password", "123456", "secret", etc.
3. **SEMPRE** use pelo menos 32 caracteres (recomendado: 64+ caracteres)
4. **DIFERENTE** para cada ambiente (dev, staging, production)
5. **ROTAÇÃO** periódica em produção (a cada 3-6 meses)

## 🔄 Invalidação de Sessões

Quando a SESSION_SECRET muda:
- Todas as sessões anteriores são automaticamente invalidadas
- Todos os usuários precisarão fazer login novamente
- O nome do cookie de sessão muda automaticamente (inclui hash do secret)

## 🛡️ Validações Implementadas

O servidor agora verifica:

1. **Presença**: Se SESSION_SECRET não existir → servidor não inicia
2. **Comprimento**: Se < 32 caracteres → aviso de segurança
3. **Força**: Se contém palavras comuns ou padrões fracos → erro em produção
4. **Unicidade**: Cookie name único baseado no secret → invalida sessões antigas

## 📊 Logs de Validação

No startup do servidor, você verá:
- ✅ `SESSION_SECRET configurada corretamente (comprimento: XX caracteres)` - Tudo OK
- ⚠️ `AVISO DE SEGURANÇA: SESSION_SECRET muito curta!` - Funciona mas inseguro
- 🚨 `ERRO CRÍTICO DE SEGURANÇA: SESSION_SECRET não configurada!` - Servidor não inicia
- 🔴 `ERRO: SESSION_SECRET INSEGURA DETECTADA!` - Secret fraco detectado

## 🔧 Troubleshooting

### Erro: "SESSION_SECRET não configurada"
- Verifique se a variável de ambiente está configurada
- No Replit, verifique a aba Secrets
- Reinicie o servidor após configurar

### Erro: "SESSION_SECRET INSEGURA DETECTADA"
- Gere um novo secret usando o comando fornecido
- Evite palavras comuns ou padrões simples
- Use pelo menos 32 caracteres aleatórios

### Usuários desconectados após mudança
- Isso é esperado e intencional por segurança
- Quando o secret muda, todas as sessões antigas são invalidadas
- Informe os usuários antes de fazer a mudança em produção

## 📅 Melhores Práticas

1. **Documentar** quando e por que o secret foi alterado
2. **Notificar** equipe antes de alterações em produção
3. **Backup** seguro do secret atual (cofre de senhas)
4. **Auditoria** regular da força e idade do secret
5. **Monitorar** tentativas de ataque de sessão

---

**Data da correção**: 10 de outubro de 2025
**Implementado por**: Sistema de segurança automatizado
**Criticidade**: ALTA - Correção de vulnerabilidade crítica