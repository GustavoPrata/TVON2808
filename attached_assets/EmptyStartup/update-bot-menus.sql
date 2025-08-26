-- Update bot configurations with complete menus

-- Update "novos" bot
UPDATE bot_config 
SET 
  mensagem_boas_vindas = '👋 *Olá! Seja bem-vindo à TV ON!*

Sou o assistente virtual e estou aqui para ajudar você a conhecer nossos serviços.

Como posso ajudar?',
  opcoes = '[
    {"id": "1", "numero": "1", "texto": "📺 Conhecer nossos planos", "acao": "conhecer_planos"},
    {"id": "2", "numero": "2", "texto": "🎁 Fazer teste grátis", "acao": "fazer_teste"},
    {"id": "3", "numero": "3", "texto": "👤 Falar com vendedor", "acao": "falar_vendedor"},
    {"id": "4", "numero": "4", "texto": "🛠️ Suporte técnico", "acao": "suporte_tecnico"}
  ]'::jsonb
WHERE tipo = 'novos';

-- Update "clientes" bot
UPDATE bot_config
SET
  mensagem_boas_vindas = '👋 *Olá {{nome}}!*

Bem-vindo de volta à TV ON!

📅 Seu vencimento: {{vencimento}}
💰 Valor mensal: {{valorTotal}}

Como posso ajudar você hoje?',
  opcoes = '[
    {"id": "1", "numero": "1", "texto": "📅 Ver vencimento", "acao": "ver_vencimento"},
    {"id": "2", "numero": "2", "texto": "💳 Segunda via", "acao": "segunda_via"},
    {"id": "3", "numero": "3", "texto": "🔄 Renovar/Upgrade", "acao": "renovar_plano"},
    {"id": "4", "numero": "4", "texto": "🛠️ Suporte técnico", "acao": "suporte_cliente"},
    {"id": "5", "numero": "5", "texto": "👤 Falar com atendente", "acao": "atendimento_humano"}
  ]'::jsonb
WHERE tipo = 'clientes';

-- Update "testes" bot
UPDATE bot_config
SET
  mensagem_boas_vindas = '👋 *Olá! Você tem um teste ativo.*

📱 Dispositivo: {{teste_dispositivo}}
📺 App: {{teste_aplicativo}}
⏰ Expira: {{teste_expiracao}}

Como posso ajudar?',
  opcoes = '[
    {"id": "1", "numero": "1", "texto": "🧪 Ver status do teste", "acao": "status_teste"},
    {"id": "2", "numero": "2", "texto": "📱 Como configurar", "acao": "tutorial_config"},
    {"id": "3", "numero": "3", "texto": "⏰ Solicitar mais tempo", "acao": "mais_tempo"},
    {"id": "4", "numero": "4", "texto": "🎉 Virar cliente", "acao": "virar_cliente"},
    {"id": "5", "numero": "5", "texto": "🛠️ Suporte técnico", "acao": "suporte_teste"}
  ]'::jsonb
WHERE tipo = 'testes';