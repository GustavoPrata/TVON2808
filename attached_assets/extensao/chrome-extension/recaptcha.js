// Script para iframe do reCAPTCHA - Marca o checkbox automaticamente
window.addEventListener('load', function() {
  setTimeout(() => {
    const checkbox = document.querySelector('#recaptcha-anchor, .recaptcha-checkbox-border, .recaptcha-checkbox');
    if (checkbox) {
      // Simula foco e clique humano
      checkbox.focus();
      checkbox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      checkbox.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('reCAPTCHA marcado automaticamente no iframe');
    } else {
      console.log('Checkbox do reCAPTCHA não encontrado');
    }
  }, 1500); // Delay de 1.5s para o iframe carregar
});