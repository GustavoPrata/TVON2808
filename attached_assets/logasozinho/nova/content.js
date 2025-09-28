// Função para esperar elementos
function waitForElement(selector, callback, maxAttempts = 50, interval = 300) {
  let attempts = 0;
  const checkExist = setInterval(() => {
    const element = document.querySelector(selector);
    if (element || attempts >= maxAttempts) {
      clearInterval(checkExist);
      if (element) callback(element);
      else console.log(`Elemento ${selector} não encontrado`);
    }
    attempts++;
  }, interval);
}

// Espera a página carregar
window.addEventListener('load', function() {
  setTimeout(() => {
    // Preenche usuário
    waitForElement('input[placeholder*="Usuário"], input[type="email"], #username, .form-control[placeholder*="usuário"]', (userField) => {
      userField.value = 'gustavoprata17';
      userField.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('Usuário preenchido');
    });

    // Preenche senha
    waitForElement('input[placeholder*="Senha"], input[type="password"], #password, .form-control[type="password"]', (passField) => {
      passField.value = 'iptv102030';
      passField.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('Senha preenchida');
    });

    // Clica no Logar após delay (dá tempo pro reCAPTCHA)
    waitForElement('button.btn.btn-primary.my-4', (loginButton) => {
      setTimeout(() => {
        if (loginButton.textContent.trim() === 'Logar') {
          loginButton.click();
          console.log('Botão Logar clicado');
        }
      }, 3000); // 3s para reCAPTCHA marcar
    });
  }, 1000);
});