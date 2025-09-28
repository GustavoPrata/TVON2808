// Função para comunicação direta com API
async function makeApiRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Extension-Key': 'chrome-extension-secret-2024',
    'Accept': 'application/json'
  };

  try {
    const url = `${BACKEND_URL}${endpoint}`;
    await logger.debug(`🔄 Fazendo requisição para ${url}`);
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal: AbortSignal.timeout(15000), // 15 segundos timeout
      mode: 'cors',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      success: true,
      data
    };

  } catch (error) {
    await logger.error(`❌ Erro na requisição para ${endpoint}:`, { error: error.message });
    throw error;
  }
}