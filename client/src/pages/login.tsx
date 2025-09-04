import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, User, Eye, EyeOff, Tv } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function Login() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  // Load saved credentials on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("rememberedUser");
    const savedRemember = localStorage.getItem("rememberMe") === "true";
    if (savedUser && savedRemember) {
      setUser(savedUser);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !password) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/login", { user, password, rememberMe });
      const data = await response.json();
      
      if (data.success) {
        // Save or clear remembered credentials
        if (rememberMe) {
          localStorage.setItem("rememberedUser", user);
          localStorage.setItem("rememberMe", "true");
        } else {
          localStorage.removeItem("rememberedUser");
          localStorage.removeItem("rememberMe");
        }
        
        toast({
          title: "Sucesso",
          description: "Login realizado com sucesso!",
        });
        
        // Redirect to home page
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message || "Usuário ou senha inválidos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função temporária para login rápido
  const handleQuickLogin = async () => {
    setUser("gustavoprtt");
    setPassword("Gustavoprata1@");
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/login", { 
        user: "gustavoprtt", 
        password: "Gustavoprata1@", 
        rememberMe: false 
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Login realizado com sucesso!",
        });
        
        // Redirect to home page
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message || "Usuário ou senha inválidos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4">
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-50">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
      </div>
      
      <Card className="relative w-full max-w-md bg-slate-800/90 backdrop-blur-xl border-slate-700/50 shadow-2xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                <Tv className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            TV ON Sistema
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user" className="text-slate-200">
                Usuário
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="user"
                  type="text"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="Digite seu usuário"
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  disabled={isLoading}
                  data-testid="input-username"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="pl-10 pr-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  disabled={isLoading}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="border-slate-600 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-purple-600 data-[state=checked]:border-transparent"
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium text-slate-300 cursor-pointer select-none"
              >
                Lembrar-me neste dispositivo
              </label>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-6 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-5 w-5" />
                  Entrar no Sistema
                </>
              )}
            </Button>
          </form>
          
          {/* Botão temporário de login rápido - REMOVER DEPOIS */}
          <div className="mt-4">
            <Button
              type="button"
              onClick={handleQuickLogin}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-4 transition-all duration-300"
              disabled={isLoading}
              data-testid="button-quick-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fazendo login rápido...
                </>
              ) : (
                <>
                  ⚡ Login Rápido (TEMPORÁRIO - gustavoprtt)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}