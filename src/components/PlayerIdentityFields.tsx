import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { identityFields, type IdentityDetails } from "@/lib/player-identification";

export function PlayerIdentityFields({ value, onChange }: { value: IdentityDetails; onChange: (value: IdentityDetails) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2">{identityFields.map(field => <div key={field.key} className="space-y-2">
    <Label htmlFor={`identity-${field.key}`}>{field.label}</Label>
    <Input id={`identity-${field.key}`} value={value[field.key]} maxLength={field.key === "anchorMoment" ? 400 : field.key === "firstOnIce" ? 80 : ["equipment", "lookalikes"].includes(field.key) ? 240 : 160} placeholder={field.placeholder} onChange={e => onChange({ ...value, [field.key]: e.target.value })} />
  </div>)}</div>;
}