"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";
import { FieldErrorText, labelCls, timeInputCls } from "./fields";

function NumberBox<T extends FieldValues>({
  control,
  name,
  label,
  max,
  placeholder,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  max: number;
  placeholder: string;
}) {
  const { field, fieldState } = useController({ control, name });
  const id = `time-${name}`;
  return (
    <div className="flex-1">
      <label htmlFor={id} className="text-[10px] text-zinc-500 font-bold block mb-1">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        placeholder={placeholder}
        aria-invalid={Boolean(fieldState.error)}
        name={field.name}
        ref={field.ref}
        onBlur={field.onBlur}
        value={field.value ?? ""}
        onChange={(e) => field.onChange(e.target.value === "" ? "" : e.target.valueAsNumber)}
        className={timeInputCls}
      />
      <FieldErrorText error={fieldState.error} />
    </div>
  );
}

/** A min:sec start and end pair bound to four form fields. */
export function TimeRangeFields<T extends FieldValues>({
  control,
  title,
  hint,
  names,
  placeholders = ["0", "00", "0", "30"],
}: {
  control: Control<T>;
  title: string;
  hint?: string;
  names: { startMin: FieldPath<T>; startSec: FieldPath<T>; endMin: FieldPath<T>; endSec: FieldPath<T> };
  placeholders?: [string, string, string, string];
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-3 bg-black/40 p-3.5 rounded-2xl border border-[#282828]">
      <legend className="sr-only">{title}</legend>
      <div>
        <span className={`${labelCls} text-zinc-300 mb-1`}>{title} Start</span>
        <div className="flex items-start gap-2">
          <NumberBox control={control} name={names.startMin} label="Min" max={999} placeholder={placeholders[0]} />
          <span className="font-bold text-zinc-500 mt-6">:</span>
          <NumberBox control={control} name={names.startSec} label="Sec" max={59} placeholder={placeholders[1]} />
        </div>
      </div>
      <div>
        <span className={`${labelCls} text-zinc-300 mb-1`}>{title} End</span>
        <div className="flex items-start gap-2">
          <NumberBox control={control} name={names.endMin} label="Min" max={999} placeholder={placeholders[2]} />
          <span className="font-bold text-zinc-500 mt-6">:</span>
          <NumberBox control={control} name={names.endSec} label="Sec" max={59} placeholder={placeholders[3]} />
        </div>
      </div>
      {hint && <div className="col-span-2 text-[10px] text-zinc-500">{hint}</div>}
    </fieldset>
  );
}
