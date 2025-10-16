import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface AuthStatus {
  authenticated: boolean;
  username?: string;
}

export function useAuth() {
  const [, setLocation] = useLocation();
  
  const { data, isLoading, error, refetch } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status"],
    queryFn: async () => {
      const response = await fetch("/api/auth/status");
      if (response.status === 401) {
        return { authenticated: false };
      }
      if (!response.ok) {
        throw new Error("Failed to check auth status");
      }
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: true,
  });

  const handleLogin = () => {
    // Redirect to Replit Auth login
    window.location.href = "/api/login";
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "GET" });
      refetch();
      setLocation("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return {
    isAuthenticated: data?.authenticated ?? false,
    username: data?.username,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
    refetch,
  };
}