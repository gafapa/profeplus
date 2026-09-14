import { useId } from "react";
import type { ClassGroup } from "../db/types";

type ClassGroupSelectProps = {
  groups: ClassGroup[];
  value: string | null;
  onChange: (classId: string) => void | Promise<void>;
  id?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function ClassGroupSelect({
  groups,
  value,
  onChange,
  id,
  label = "Grupo",
  disabled = false,
  className = ""
}: ClassGroupSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <label className={(`group-context-selector${className ? ` ${className}` : ""}`) + " compact-field"} htmlFor={selectId}>
      <span>{label}</span>
      <select
        id={selectId}
        className="input"
        value={value ?? ""}
        disabled={disabled || groups.length === 0}
        onChange={(event) => void onChange(event.target.value)}
      >
        {groups.length === 0 ? <option value="">Sin grupos disponibles</option> : null}
        {groups.length > 0 && !value ? <option value="">Selecciona un grupo</option> : null}
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name || "Grupo sin nombre"} · {group.schoolYear}
          </option>
        ))}
      </select>
    </label>
  );
}
