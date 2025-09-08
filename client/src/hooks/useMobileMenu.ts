import { useState, useEffect } from 'react';

export function useMobileMenu() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      // Fecha o menu automaticamente ao mudar para desktop
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    // Verifica o tamanho inicial
    checkScreenSize();

    // Adiciona listener para mudanças de tamanho
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return {
    isMobile,
    isMobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
  };
}