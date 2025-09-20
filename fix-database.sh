#!/bin/bash

# Script para corrigir a conexão do banco de dados

echo "🔧 Configurando conexão do banco de dados..."

# Extrai as credenciais da DATABASE_URL atual
CURRENT_URL=$DATABASE_URL
echo "URL atual (ocultando senha): ${CURRENT_URL//:*@//:****@}"

# Verifica se está usando a porta incorreta
if [[ $CURRENT_URL == *":5432/"* ]]; then
  echo "⚠️ Detectada porta 5432, mudando para 6543 (pgbouncer)..."
  
  # Substitui porta 5432 por 6543 e adiciona parâmetros do pgbouncer
  NEW_URL="${CURRENT_URL//:5432\//:6543\/}"
  
  # Adiciona parâmetros do pgbouncer se não existirem
  if [[ $NEW_URL != *"?pgbouncer=true"* ]]; then
    NEW_URL="${NEW_URL}?pgbouncer=true&connection_limit=10"
  fi
  
  echo "✅ Nova URL configurada (ocultando senha): ${NEW_URL//:*@//:****@}"
  
  # Exporta a nova URL
  export DATABASE_URL="$NEW_URL"
  
  # Salva em arquivo temporário para persistência
  echo "export DATABASE_URL='$NEW_URL'" > /tmp/database_config.sh
  echo "✅ Configuração salva em /tmp/database_config.sh"
else
  echo "✅ Porta já está correta (6543)"
fi

echo "🔄 Testando conexão..."