import { useEffect } from "react";
import { Compass, FileText, Home } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: rota inexistente acessada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/70 bg-card/80 p-8 text-center shadow-elegant">
        <span className="brand-gradient mx-auto flex h-12 w-12 items-center justify-center rounded-xl">
          <Compass className="h-5 w-5 text-primary-foreground" />
        </span>
        <p className="mt-4 text-4xl font-semibold tracking-tight text-foreground">404</p>
        <h1 className="mt-2 text-base font-medium text-foreground">Página não encontrada</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A rota <span className="font-mono text-xs">{location.pathname}</span> não existe no QualyFlow.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" asChild>
            <a href="/emissor">
              <FileText className="h-4 w-4" />
              Ir para o Emissor
            </a>
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href="/">
              <Home className="h-4 w-4" />
              Voltar ao início
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default NotFound;
