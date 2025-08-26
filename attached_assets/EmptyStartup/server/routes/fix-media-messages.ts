// Comprehensive fix for media messages in conversations
export async function fixMediaMessages(storage: any) {
  try {
    const conversations = await storage.getConversas();
    let fixed = 0;
    
    for (const conversa of conversations) {
      console.log(`Checking conversation ${conversa.id}: ultimaMensagem='${conversa.ultimaMensagem}', tipo='${conversa.tipoUltimaMensagem}', typeofTipo=${typeof conversa.tipoUltimaMensagem}`);
      
      let needsFix = false;
      let newMessage = conversa.ultimaMensagem;
      
      // Check if it's a media message but not properly formatted as JSON
      if (conversa.tipoUltimaMensagem && conversa.tipoUltimaMensagem !== 'text') {
        console.log(`Conversation ${conversa.id} is media type ${conversa.tipoUltimaMensagem}, checking JSON...`);
        // Try to parse as JSON first
        try {
          const parsed = JSON.parse(conversa.ultimaMensagem);
          console.log(`Conversation ${conversa.id} already has valid JSON: ${JSON.stringify(parsed)}, skipping`);
          // Already valid JSON, skip
          continue;
        } catch (e) {
          // Not valid JSON, needs fixing
          console.log(`Conversation ${conversa.id} has invalid JSON (${e.message}), will fix`);
          needsFix = true;
        }
        
        // Generate proper JSON based on message type
        switch (conversa.tipoUltimaMensagem) {
          case 'audio':
            // Extract duration if present in text like "🎵 Áudio (5s)"
            const audioMatch = conversa.ultimaMensagem.match(/(\d+)s/);
            const duration = audioMatch ? parseInt(audioMatch[1]) : 0;
            newMessage = JSON.stringify({ duration });
            break;
            
          case 'image':
            // Extract caption if present
            let imageCaption = '';
            if (conversa.ultimaMensagem.includes('Foto:')) {
              imageCaption = conversa.ultimaMensagem.replace(/^.*Foto:\s*/, '').trim();
            } else if (conversa.ultimaMensagem && !conversa.ultimaMensagem.includes('📷')) {
              // The whole message might be a caption
              imageCaption = conversa.ultimaMensagem;
            }
            newMessage = imageCaption ? JSON.stringify({ caption: imageCaption }) : JSON.stringify({ type: 'image' });
            break;
            
          case 'video':
            // Extract caption if present
            let videoCaption = '';
            if (conversa.ultimaMensagem.includes('Vídeo:')) {
              videoCaption = conversa.ultimaMensagem.replace(/^.*Vídeo:\s*/, '').trim();
            } else if (conversa.ultimaMensagem && !conversa.ultimaMensagem.includes('📹')) {
              // The whole message might be a caption
              videoCaption = conversa.ultimaMensagem;
            }
            newMessage = videoCaption ? JSON.stringify({ caption: videoCaption }) : JSON.stringify({ type: 'video' });
            break;
            
          case 'document':
            // Extract filename if present
            let fileName = 'documento';
            if (conversa.ultimaMensagem && !conversa.ultimaMensagem.includes('📎')) {
              fileName = conversa.ultimaMensagem;
            }
            newMessage = JSON.stringify({ fileName });
            break;
            
          case 'sticker':
            newMessage = JSON.stringify({ type: 'sticker' });
            break;
        }
      }
      
      // Also fix empty messages with media type
      if (conversa.ultimaMensagem === '' && conversa.tipoUltimaMensagem) {
        needsFix = true;
        switch (conversa.tipoUltimaMensagem) {
          case 'audio':
            newMessage = JSON.stringify({ duration: 0 });
            break;
          case 'image':
            newMessage = JSON.stringify({ type: 'image' });
            break;
          case 'video':
            newMessage = JSON.stringify({ type: 'video' });
            break;
          case 'document':
            newMessage = JSON.stringify({ fileName: 'documento' });
            break;
          case 'sticker':
            newMessage = JSON.stringify({ type: 'sticker' });
            break;
        }
      }
      
      if (needsFix && newMessage !== conversa.ultimaMensagem) {
        console.log(`Updating conversation ${conversa.id} - old: '${conversa.ultimaMensagem}' new: '${newMessage}'`);
        await storage.updateConversa(conversa.id, {
          ultimaMensagem: newMessage
        });
        fixed++;
        console.log(`Successfully fixed conversation ${conversa.id}`);
      } else if (needsFix) {
        console.log(`Conversation ${conversa.id} needs fix but newMessage same as old: '${newMessage}'`);
      }
    }
    
    return fixed;
  } catch (error) {
    console.error('Error fixing media messages:', error);
    throw error;
  }
}