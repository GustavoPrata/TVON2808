-- Update bot config table with new columns for advanced bot functionality
-- Add columns for dynamic variables and better bot control

-- Update tipo column to allow new values (novos, clientes, testes)
ALTER TABLE bot_config ALTER COLUMN tipo TYPE varchar(20);

-- Add new columns for enhanced bot functionality
ALTER TABLE bot_config 
ADD COLUMN IF NOT EXISTS variaveis_disponiveis json DEFAULT '["{{nome}}", "{{telefone}}", "{{vencimento}}", "{{status}}", "{{valorTotal}}", "{{ultimoAcesso}}", "{{teste_dispositivo}}", "{{teste_aplicativo}}", "{{teste_expiracao}}", "{{teste_status}}"]',
ADD COLUMN IF NOT EXISTS mensagem_erro text DEFAULT 'Desculpe, não entendi sua solicitação. Por favor, escolha uma das opções disponíveis.',
ADD COLUMN IF NOT EXISTS mensagem_timeout text DEFAULT 'Tempo esgotado! Você levou muito tempo para responder. Digite qualquer coisa para continuar.',
ADD COLUMN IF NOT EXISTS permitir_texto_livre boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS redirecionar_humano boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS opcao_atendimento_humano boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS max_botoes_menu integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS mostrar_numeracao boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS permitir_voltar boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS menu_principal_texto text DEFAULT '📱 *Menu Principal*\nEscolha uma das opções abaixo:';

-- Update existing bot configs to use new tipo values
UPDATE bot_config SET tipo = 'novos' WHERE tipo = 'novos_clientes';
UPDATE bot_config SET tipo = 'clientes' WHERE tipo = 'clientes_existentes';

-- Insert default bot configs for the 3 types if they don't exist
INSERT INTO bot_config (tipo, mensagem_boas_vindas, opcoes, ativo)
SELECT 'novos', 
       '🎉 *Seja bem-vindo(a) à TV ON!*\n\nOlá! Sou o assistente virtual da TV ON e estou aqui para te ajudar.\n\nO que você gostaria de fazer hoje?',
       '[
         {
           "id": "1",
           "texto": "💰 Solicitar Orçamento",
           "descricao": "Receba um orçamento personalizado",
           "acao": "orcamento",
           "resposta": "📋 *Orçamento Personalizado*\n\nPara criar um orçamento ideal para você, preciso de algumas informações:\n\n• Quantos dispositivos você tem?\n• Qual tipo de dispositivo? (Smart TV, TV Box, Celular)\n• Tem interesse em qual aplicativo?\n\nPor favor, me conte mais detalhes!"
         },
         {
           "id": "2", 
           "texto": "🎮 Teste Grátis",
           "descricao": "Experimente nossos serviços",
           "acao": "teste",
           "resposta": "🆓 *Teste Grátis Disponível!*\n\nÓtima escolha! Oferecemos teste grátis para você conhecer nossos serviços.\n\n📱 Opções disponíveis:\n• 1 hora - Teste rápido\n• 3 horas - Teste completo\n• 6 horas - Teste estendido\n\nQual duração você prefere?"
         },
         {
           "id": "3",
           "texto": "👥 Falar com Atendente", 
           "descricao": "Atendimento humano personalizado",
           "acao": "humano",
           "resposta": "👨‍💼 *Atendimento Humano*\n\nPerfeito! Vou transferir você para um de nossos atendentes.\n\nEm breve alguém da nossa equipe entrará em contato para te ajudar pessoalmente."
         }
       ]'::json,
       true
WHERE NOT EXISTS (SELECT 1 FROM bot_config WHERE tipo = 'novos');

INSERT INTO bot_config (tipo, mensagem_boas_vindas, opcoes, ativo)
SELECT 'clientes',
       '👋 *Olá, {{nome}}!*\n\nSeja bem-vindo(a) de volta à TV ON!\n\nSeu status: *{{status}}*\nVencimento: *{{vencimento}}*\n\nComo posso ajudá-lo hoje?',
       '[
         {
           "id": "1",
           "texto": "📊 Meus Dados",
           "descricao": "Consultar informações da conta",
           "acao": "dados",
           "resposta": "📋 *Suas Informações*\n\n👤 *Nome:* {{nome}}\n📱 *Telefone:* {{telefone}}\n💰 *Valor Total:* R$ {{valorTotal}}\n📅 *Vencimento:* {{vencimento}}\n✅ *Status:* {{status}}\n🕐 *Último Acesso:* {{ultimoAcesso}}"
         },
         {
           "id": "2",
           "texto": "💳 Renovar Assinatura",
           "descricao": "Renovar seus serviços",
           "acao": "renovar", 
           "resposta": "💳 *Renovação de Assinatura*\n\nPara renovar sua assinatura:\n\n1️⃣ Valor: R$ {{valorTotal}}\n2️⃣ Vencimento atual: {{vencimento}}\n3️⃣ Forma de pagamento: PIX\n\nDeseja gerar um PIX para pagamento?"
         },
         {
           "id": "3",
           "texto": "🔧 Suporte Técnico",
           "descricao": "Ajuda com problemas técnicos",
           "acao": "suporte",
           "resposta": "🔧 *Suporte Técnico*\n\nEstou aqui para ajudar com problemas técnicos.\n\n🔍 *Problemas comuns:*\n• App não abre\n• Travamentos\n• Qualidade da imagem\n• Login não funciona\n\nDescreva seu problema que vou te ajudar!"
         },
         {
           "id": "4",
           "texto": "👥 Atendimento Humano",
           "descricao": "Falar com nossa equipe",
           "acao": "humano",
           "resposta": "👨‍💼 *Atendimento Personalizado*\n\nVou conectar você com nossa equipe de atendimento.\n\nEm instantes um atendente especializado irá conversar com você."
         }
       ]'::json,
       true
WHERE NOT EXISTS (SELECT 1 FROM bot_config WHERE tipo = 'clientes');

INSERT INTO bot_config (tipo, mensagem_boas_vindas, opcoes, ativo)
SELECT 'testes',
       '🧪 *Olá!*\n\nVejo que você está usando nosso teste gratuito!\n\n📱 *Seu teste:*\n• Dispositivo: {{teste_dispositivo}}\n• App: {{teste_aplicativo}}\n• Expira em: {{teste_expiracao}}\n• Status: {{teste_status}}\n\nComo posso ajudá-lo?',
       '[
         {
           "id": "1",
           "texto": "ℹ️ Info do Teste",
           "descricao": "Ver detalhes do seu teste",
           "acao": "info_teste",
           "resposta": "🧪 *Informações do seu Teste*\n\n📱 *Dispositivo:* {{teste_dispositivo}}\n📺 *Aplicativo:* {{teste_aplicativo}}\n⏰ *Expira em:* {{teste_expiracao}}\n✅ *Status:* {{teste_status}}\n\n💡 *Dica:* Aproveite para testar todos os recursos!"
         },
         {
           "id": "2",
           "texto": "💰 Virar Cliente",
           "descricao": "Assinar nossos serviços",
           "acao": "assinar",
           "resposta": "🎉 *Que ótimo que gostou do teste!*\n\nVamos transformar seu teste em assinatura:\n\n✨ *Benefícios de ser cliente:*\n• Acesso ilimitado\n• Suporte prioritário\n• Múltiplos dispositivos\n• Qualidade premium\n\nQuer um orçamento personalizado?"
         },
         {
           "id": "3",
           "texto": "🆘 Problemas no Teste",
           "descricao": "Reportar problemas técnicos",
           "acao": "problema_teste",
           "resposta": "🔧 *Suporte para Teste*\n\nQue pena que está tendo problemas!\n\n🔍 *Verificações rápidas:*\n• App atualizado?\n• Internet estável?\n• Dispositivo compatível?\n\nDescreva o problema que vou te ajudar a resolver!"
         },
         {
           "id": "4",
           "texto": "👥 Falar com Atendente",
           "descricao": "Atendimento personalizado",
           "acao": "humano",
           "resposta": "👨‍💼 *Atendimento Especializado*\n\nVou conectar você com um especialista em testes.\n\nNossa equipe vai te ajudar a aproveitar ao máximo seu teste!"
         }
       ]'::json,
       true
WHERE NOT EXISTS (SELECT 1 FROM bot_config WHERE tipo = 'testes');