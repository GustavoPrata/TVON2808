import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useAuth() {
  const [hasTriedAutoLogin, setHasTriedAutoLogin] = useState(false);
  
  // Query para verificar status de autenticação
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/auth/status"],
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Tenta fazer auto-login com token de lembrar-me
  useEffect(() => {
    async function tryAutoLogin() {
      // Só tenta auto-login uma vez e se não estiver autenticado
      if (!hasTriedAutoLogin && !data?.authenticated && !isLoading) {
        setHasTriedAutoLogin(true);
        
        try {
          // Verifica se existe cookie de remember token
          const response = await apiRequest("POST", "/api/auth/verify-token");
          const result = await response.json();
          
          if (result.authenticated) {
            // Auto-login bem-sucedido - força revalidação do status de auth
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
          }
        } catch (error) {
          // Auto-login falhou silenciosamente - não precisa fazer nada
          console.debug('Auto-login attempt failed or no remember token found');
        }
      }
    }
    
    tryAutoLogin();
  }, [data?.authenticated, isLoading, hasTriedAutoLogin]);

  return {
    isAuthenticated: data?.authenticated || false,
    user: data?.user,
    isLoading: isLoading || (!hasTriedAutoLogin && !data?.authenticated),
    error,
  };
}