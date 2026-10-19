import { useRef, useState } from "react";
import { Building2, ChevronDown, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { fileToCompressedDataUrl } from "@/lib/image";
import type { QualyflowSettings } from "@/lib/report-document";
import { DEFAULT_SETTINGS } from "@/lib/report-document";
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

/**
 * Cabeçalho institucional e logos usados na folha SGZ-156, com os dados do
 * modelo oficial como padrão. Tudo fica salvo neste navegador.
 */
export function InstitutionalHeaderForm({ settings, onChange }: InstitutionalHeaderFormProps) {
  const [open, setOpen] = useState(false);

  const updateHeader = (key: keyof QualyflowSettings["header"], value: string) => {
    onChange({ ...settings, header: { ...settings.header, [key]: value } });
  };

  const updateLogo = (key: keyof QualyflowSettings["logos"], value: string) => {
    onChange({ ...settings, logos: { ...settings.logos, [key]: value } });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Building2 className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  Cabeçalho institucional e logos
                </span>
                <span className="block text-xs text-muted-foreground">
                  Usado na folha SGZ-156 (Divisão Santana - ONMS)
                </span>
              </span>
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-smooth", open && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 border-t border-border/70 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {HEADER_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`header-${field.key}`} className="text-xs text-muted-foreground">
                    {field.label}
                  </Label>
                  <Input
                    id={`header-${field.key}`}
                    value={settings.header[field.key]}
                    onChange={(event) => updateHeader(field.key, event.target.value)}
                    className="bg-background/70"
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <LogoUploader
                label="Logo Sabesp"
                value={settings.logos.sabesp}
                onLogo={(value) => updateLogo("sabesp", value)}
              />
              <LogoUploader
                label="Logo Consórcio Nova Norte"
                value={settings.logos.consortium}
                onLogo={(value) => updateLogo("consortium", value)}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                onChange(DEFAULT_SETTINGS);
                toast.success("Cabeçalho e logos restaurados para o padrão do modelo");
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar padrão do modelo
            </Button>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface LogoUploaderProps {
  label: string;
  value: string;
  onLogo: (value: string) => void;
}

function LogoUploader({ label, value, onLogo }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 640, 0.92);
      onLogo(dataUrl);
      toast.success(`${label} atualizada`);
    } catch (error) {
      toast.error("Não foi possível usar esta imagem", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-glass-border/50 bg-glass/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-24 items-center justify-center rounded-md border border-glass-border/50 bg-glass/60 p-1">
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        </span>
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
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Trocar logo
        </Button>
      </div>
    </div>
  );
}
