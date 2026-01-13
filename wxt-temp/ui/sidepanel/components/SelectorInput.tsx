import { Crosshair } from 'lucide-react';

type SelectorInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  onPick?: () => void;
  onFocus?: () => void;
};

export default function SelectorInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  onPick,
  onFocus,
}: SelectorInputProps) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <input
        className="input min-w-0 flex-1"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onFocus={onFocus}
      />
      <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={onPick} aria-label="Pick element">
        <Crosshair className="h-4 w-4" />
      </button>
    </div>
  );
}
