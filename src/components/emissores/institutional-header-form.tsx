import { useRef, useState } from "react";
import { ChevronDown, ImagePlus, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { fileToCompressedDataUrl } from "@/lib/image";
import type { QualyflowSettings } from "@/lib/report-document";
import { DEFAULT_SETTINGS, normalizeSettings } from "@/lib/report-document";
import { cn } from "@/lib/utils";

interface InstitutionalHeaderFormProps {
  settings: QualyflowSettings;
  onChange: (settings: QualyflowSettings) => void;
}

const HEADER_FIELDS: { key: keyof QualyflowSettings["header"]; label: string }[] = [
  { key: "title", label: "Órgão (linha 1)" },
  { key: "division", label: "Divisão (linha 2)" },
  { key: "addressLine", label: "Endereço" },
  { key: "phoneLine1", label: "Contatos (linha 1)" },
  { key: "phoneLine2", label: "Contatos (linha 2)" },
];

const LOGO_FIELDS: { key: keyof QualyflowSettings["logos"]; label: string; hint: string }[] = [
  {
    key: "sabesp",
    label: "Logotipo principal (SGZ e Pós 60)",
    hint: "Aparece à esquerda no cabeçalho da folha",
  },
  {
    key: "consortium",
    label: "Logotipo secundário (Pós 60)",
    hint: "Aparece à direita no cabeçalho da folha Pós 60",
  },
];

/**
 * Edição do cabeçalho institucional e das logos usadas nas folhas. Aceita
 * arrastar e soltar, trocar, remover e restaurar o padrão do modelo. Tudo fica
 * salvo neste navegador.
 */
export function InstitutionalHeaderForm({ settings, onChange }: InstitutionalHeaderFormProps) {
  const [textsOpen, setTextsOpen] = useState(false);
  const current = normalizeSettings(settings);

  const updateHeader = (key: keyof QualyflowSettings["header"], value: string) => {
    onChange({ ...current, header: { ...current.header, [key]: value } });
  };

  const updateLogo = (key: keyof QualyflowSettings["logos"], value: string) => {
    onChange({ ...current, logos: { ...current.logos, [key]: value } });
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            3. Seus logotipos e cabeçalho institucional
          </h2>
          <p className="text-xs text-muted-foreground">
            As logos ficam salvas no seu usuário e valem para os relatórios que você emite. Troque,
            remova ou restaure clicando (ou arrastando uma imagem) em cada campo.
          </p>
        </div>
        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={() => {
            onChange({ ...DEFAULT_SETTINGS, logos: { ...DEFAULT_SETTINGS.logos } });
            toast.success("Suas logos e o cabeçalho voltaram ao padrão do modelo");
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Restaurar padrão
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {LOGO_FIELDS.map((field) => (
          <LogoField
            key={field.key}
            label={field.label}
            hint={field.hint}
            value={current.logos[field.key]}
            onLogo={(value) => updateLogo(field.key, value)}
          />
        ))}
      </div>

      <Collapsible open={textsOpen} onOpenChange={setTextsOpen} className="mt-4">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-glass-border/50 bg-glass/30 px-3 py-2 text-left transition-smooth hover:border-primary/50"
          >
            <span className="text-xs font-medium text-foreground">
              Editar os textos do cabeçalho institucional (folha SGZ-156)
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-smooth",
                textsOpen && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {HEADER_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`header-${field.key}`} className="text-xs text-muted-foreground">
                  {field.label}
                </Label>
                <Input
                  id={`header-${field.key}`}
                  value={current.header[field.key]}
                  onChange={(event) => updateHeader(field.key, event.target.value)}
                  className="bg-background/70"
                />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface LogoFieldProps {
  label: string;
  hint: string;
  value: string;
  onLogo: (value: string) => void;
}

function LogoField({ label, hint, value, onLogo }: LogoFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Use um arquivo de imagem (PNG, JPG ou WEBP) para a logo.");
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 800, 0.95);
      onLogo(dataUrl);
      toast.success("Logotipo atualizado");
    } catch (error) {
      toast.error("Não foi possível usar esta imagem", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) {
          void handleFile(file);
        }
      }}
      className={cn(
        "space-y-2 rounded-xl border border-dashed p-3 transition-smooth",
        dragging ? "border-primary bg-accent/40 shadow-glow" : "border-glass-border/60 bg-glass/30",
      )}
    >
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md border border-glass-border/50 bg-background/70 p-1">
          {value ? (
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
              <ImagePlus className="h-4 w-4" />
              sem logo
            </span>
          )}
        </span>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant={value ? "glass" : "glow"}
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {value ? "Trocar" : "Inserir logo"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                onLogo("");
                toast.success("Logotipo removido dos seus relatórios");
              }}
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
