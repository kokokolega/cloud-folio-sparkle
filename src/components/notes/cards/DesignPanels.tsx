import { useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  ArrowUp,
  ArrowDown,
  Save,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import type { AlignOp, Asset, DesignElement, SavedComponent } from "@/lib/cardDesign";
import { CARD_TEMPLATES, ELEMENT_LIBRARY } from "@/lib/cardDesign";

/* ---------------- element library ---------------- */

export function ElementLibraryPanel({ onInsert }: { onInsert: (kind: string) => void }) {
  const groups = ["Elements", "Widgets", "Basics"] as const;
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g}>
          <Label className="text-[11px] text-muted-foreground">{g}</Label>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {ELEMENT_LIBRARY.filter((i) => i.group === g).map((i) => (
              <button
                key={i.kind + i.label}
                onClick={() => onInsert(i.kind)}
                className="rounded-lg border border-border px-2 py-2 text-left text-[11px] text-foreground transition-colors hover:border-primary hover:bg-primary/5"
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- templates ---------------- */

export function TemplatePanel({ onApply }: { onApply: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CARD_TEMPLATES.map((t) => (
        <button
          key={t.id}
          onClick={() => onApply(t.id)}
          className="rounded-lg border border-border p-1.5 text-left transition-all hover:scale-[1.02] hover:border-primary"
        >
          <div className="mb-1 h-10 rounded-md" style={{ background: t.accent }} />
          <span className="text-[10px] leading-none text-muted-foreground">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- layers ---------------- */

export function LayerPanel({
  elements,
  selectedIds,
  onSelect,
  onUpdate,
  onReorder,
  onDelete,
}: {
  elements: DesignElement[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onUpdate: (id: string, patch: Partial<DesignElement>) => void;
  onReorder: (id: string, dir: -1 | 1) => void;
  onDelete: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const sorted = [...elements].sort((a, b) => b.z - a.z);

  if (!elements.length) {
    return <p className="text-[11px] text-muted-foreground">No elements on this card yet. Add one from the Elements tab.</p>;
  }

  return (
    <div className="space-y-1">
      {sorted.map((el) => (
        <div
          key={el.id}
          onClick={() => onSelect([el.id])}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
            selectedIds.includes(el.id) ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/60"
          }`}
        >
          {renaming === el.id ? (
            <Input
              autoFocus
              defaultValue={el.name}
              onBlur={(e) => {
                onUpdate(el.id, { name: e.target.value || el.name });
                setRenaming(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="h-6 flex-1 text-[11px]"
            />
          ) : (
            <button className="flex-1 truncate text-left" onDoubleClick={() => setRenaming(el.id)}>
              {el.name}
            </button>
          )}
          <button className="p-1 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onReorder(el.id, 1); }} aria-label="Bring forward">
            <ArrowUp className="h-3 w-3" />
          </button>
          <button className="p-1 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onReorder(el.id, -1); }} aria-label="Send backward">
            <ArrowDown className="h-3 w-3" />
          </button>
          <button className="p-1 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onUpdate(el.id, { hidden: !el.hidden }); }} aria-label="Toggle visibility">
            {el.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
          <button className="p-1 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onUpdate(el.id, { locked: !el.locked }); }} aria-label="Toggle lock">
            {el.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
          <button className="p-1 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(el.id); }} aria-label="Delete element">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- alignment ---------------- */

const ALIGN_BUTTONS: Array<{ op: AlignOp; icon: any; label: string }> = [
  { op: "left", icon: AlignHorizontalJustifyStart, label: "Align left" },
  { op: "hcenter", icon: AlignHorizontalJustifyCenter, label: "Center horizontally" },
  { op: "right", icon: AlignHorizontalJustifyEnd, label: "Align right" },
  { op: "top", icon: AlignVerticalJustifyStart, label: "Align top" },
  { op: "vcenter", icon: AlignVerticalJustifyCenter, label: "Center vertically" },
  { op: "bottom", icon: AlignVerticalJustifyEnd, label: "Align bottom" },
  { op: "hdist", icon: AlignHorizontalSpaceAround, label: "Distribute horizontally" },
  { op: "vdist", icon: AlignVerticalSpaceAround, label: "Distribute vertically" },
];

export function AlignBar({ disabled, onAlign }: { disabled: boolean; onAlign: (op: AlignOp) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ALIGN_BUTTONS.map(({ op, icon: Icon, label }) => (
        <Button
          key={op}
          size="icon"
          variant="outline"
          disabled={disabled}
          aria-label={label}
          title={label}
          className="h-7 w-7"
          onClick={() => onAlign(op)}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}
    </div>
  );
}

/* ---------------- inspector ---------------- */

const num = (v: string, fb: number) => (Number.isFinite(Number(v)) ? Number(v) : fb);

export function InspectorPanel({
  element,
  onUpdate,
  onDuplicate,
  onDelete,
  onSaveComponent,
}: {
  element: DesignElement | null;
  onUpdate: (patch: Partial<DesignElement>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveComponent: () => void;
}) {
  if (!element) {
    return <p className="text-[11px] text-muted-foreground">Select an element on the card to edit its exact properties.</p>;
  }

  const setProp = (k: string, v: any) => onUpdate({ props: { ...element.props, [k]: v } });

  const fields: Array<[string, keyof DesignElement]> = [
    ["X", "x"],
    ["Y", "y"],
    ["W", "w"],
    ["H", "h"],
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="truncate text-[12px] font-medium">{element.name}</span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onDuplicate} aria-label="Duplicate"><Copy className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onSaveComponent} aria-label="Save as component"><Save className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onDelete} aria-label="Delete"><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {fields.map(([label, key]) => (
          <div key={key as string}>
            <Label className="text-[10px] text-muted-foreground">{label}</Label>
            <Input
              type="number"
              value={Math.round(element[key] as number)}
              onChange={(e) => onUpdate({ [key]: num(e.target.value, element[key] as number) } as any)}
              className="h-7 px-1.5 text-[11px]"
            />
          </div>
        ))}
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Rotation · {Math.round(element.rotation)}°</Label>
        <Slider value={[element.rotation]} min={-180} max={180} step={1} onValueChange={([v]) => onUpdate({ rotation: v })} className="mt-2" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Opacity · {Math.round(element.opacity * 100)}%</Label>
        <Slider value={[element.opacity * 100]} min={0} max={100} step={1} onValueChange={([v]) => onUpdate({ opacity: v / 100 })} className="mt-2" />
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={element.locked ? "default" : "outline"} className="h-7 flex-1 text-[11px]" onClick={() => onUpdate({ locked: !element.locked })}>
          {element.locked ? <Lock className="mr-1 h-3 w-3" /> : <Unlock className="mr-1 h-3 w-3" />}
          {element.locked ? "Locked" : "Lock"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px]" onClick={() => onUpdate({ hidden: !element.hidden })}>
          {element.hidden ? "Show" : "Hide"}
        </Button>
      </div>

      {/* content props */}
      <div className="space-y-2 border-t border-border pt-3">
        {Object.entries(element.props).map(([k, v]) => {
          if (Array.isArray(v)) return null;
          if (typeof v === "object" && v !== null) return null;
          return (
            <div key={k}>
              <Label className="text-[10px] capitalize text-muted-foreground">{k}</Label>
              <Input
                value={v === null || v === undefined ? "" : String(v)}
                onChange={(e) => setProp(k, typeof v === "number" ? num(e.target.value, v as number) : e.target.value)}
                className="h-7 text-[11px]"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- assets ---------------- */

export function AssetPanel({
  assets,
  onAdd,
  onUse,
  onRemove,
}: {
  assets: Asset[];
  onAdd: (files: FileList) => void;
  onUse: (a: Asset) => void;
  onRemove: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" className="h-8 w-full text-[11px]" onClick={() => input.current?.click()}>
        <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload icons, logos, images
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onAdd(e.target.files);
          e.target.value = "";
        }}
      />
      {assets.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Your uploaded assets stay on this device and can be reused in any note.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {assets.map((a) => (
            <div key={a.id} className="group relative">
              <button onClick={() => onUse(a)} className="w-full overflow-hidden rounded-lg border border-border">
                <img src={a.dataUrl} alt={a.name} className="aspect-square w-full object-cover" />
              </button>
              <button
                onClick={() => onRemove(a.id)}
                aria-label="Remove asset"
                className="absolute -right-1 -top-1 hidden rounded-full bg-destructive p-0.5 text-destructive-foreground group-hover:block"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- reusable components ---------------- */

export function ComponentPanel({
  components,
  canSave,
  onSave,
  onInsert,
  onRemove,
}: {
  components: SavedComponent[];
  canSave: boolean;
  onSave: (name: string) => void;
  onInsert: (c: SavedComponent) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Component name" className="h-8 text-[11px]" />
        <Button
          size="sm"
          className="h-8 text-[11px]"
          disabled={!canSave}
          onClick={() => {
            if (!name.trim()) return toast.error("Give the component a name");
            onSave(name.trim());
            setName("");
          }}
        >
          Save
        </Button>
      </div>
      {!canSave && <p className="text-[11px] text-muted-foreground">Select one or more elements to save them as a reusable component.</p>}
      {components.map((c) => (
        <div key={c.id} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5">
          <button className="flex-1 truncate text-left text-[11px]" onClick={() => onInsert(c)}>
            {c.name} <span className="text-muted-foreground">· {c.elements.length}</span>
          </button>
          <button onClick={() => onRemove(c.id)} aria-label="Delete component" className="p-1 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
