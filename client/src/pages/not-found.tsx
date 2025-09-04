import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [location, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <Card className="w-full max-w-md mx-4 bg-slate-800 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-red-500/10 rounded-full">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            
            <h1 className="text-3xl font-bold text-white">Página não encontrada</h1>
            
            <p className="text-sm text-slate-400 max-w-sm">
              A página <code className="px-2 py-1 bg-slate-700 rounded text-blue-400">{location}</code> não existe no sistema.
            </p>
            
            <div className="pt-4">
              <Button 
                onClick={() => setLocation("/")}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                <Home className="w-4 h-4 mr-2" />
                Voltar ao Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
