import { Activity } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="no-print relative border-t border-glass-border/40 bg-glass/40 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground/80">
          <Activity className="h-3.5 w-3.5 text-primary" />
          QualyFlow
        </span>
        <span className="hidden sm:inline text-border">|</span>
        <span>Sistema Criado por Igor Ramalho</span>
        <span className="hidden sm:inline text-border">|</span>
        <span>Célula de Qualidade</span>
      </div>
    </footer>
  );
}
