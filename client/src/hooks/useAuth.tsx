import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/auth/status"],
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    isAuthenticated: data?.authenticated || false,
    user: data?.user,
    isLoading,
    error,
  };
}