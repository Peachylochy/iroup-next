"use client";

import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MasterSearchOption = {
  value: string;
  label: string;
  description?: string | null;
  keywords?: string[];
};

type Props = {
  name?: string;
  value: string;
  options: MasterSearchOption[];
  placeholder: string;
  emptyLabel?: string;
  disabled?: boolean;
  required?: boolean;
  onChange?: (value: string) => void;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("th");
}

export function MasterSearchSelect({
  name,
  value,
  options,
  placeholder,
  emptyLabel = "ไม่พบข้อมูลที่ค้นหา",
  disabled,
  required,
  onChange,
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [internalValue, setInternalValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const currentValue = onChange ? value : internalValue;
  const selected = options.find((option) => option.value === currentValue);
  const filtered = useMemo(() => {
    const term = normalize(query);
    if (!term) return options.slice(0, 100);
    return options
      .filter((option) =>
        [option.label, option.description, ...(option.keywords ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("th")
          .includes(term),
      )
      .slice(0, 100);
  }, [options, query]);

  useEffect(() => {
    // This is the uncontrolled variant: mirror a server-provided initial value when it changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop-to-uncontrolled state synchronization
    if (!onChange) setInternalValue(value);
  }, [onChange, value]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function select(nextValue: string) {
    if (onChange) onChange(nextValue);
    else setInternalValue(nextValue);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="master-search-select" ref={rootRef}>
      {name ? <input name={name} type="hidden" value={currentValue} /> : null}
      <Button
        aria-controls={`${id}-listbox`}
        aria-expanded={open}
        aria-required={required}
        className={cn("master-search-trigger", !selected && "text-muted-foreground")}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        role="combobox"
        type="button"
        variant="outline"
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronsUpDown aria-hidden="true" />
      </Button>
      {currentValue && !disabled ? (
        <Button aria-label="ล้างค่าที่เลือก" className="master-search-clear" onClick={() => select("")} size="icon" type="button" variant="ghost">
          <X />
        </Button>
      ) : null}
      {open ? (
        <div className="master-search-popover">
          <label className="master-search-input">
            <Search aria-hidden="true" />
            <input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="พิมพ์เพื่อค้นหา..." value={query} />
          </label>
          <div aria-label={placeholder} className="master-search-options" id={`${id}-listbox`} role="listbox">
            {filtered.length ? filtered.map((option) => (
              <button
                aria-selected={option.value === currentValue}
                className="master-search-option"
                key={option.value}
                onClick={() => select(option.value)}
                role="option"
                type="button"
              >
                <Check className={option.value === currentValue ? "" : "is-hidden"} />
                <span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>
              </button>
            )) : <p className="master-search-empty">{emptyLabel}</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
