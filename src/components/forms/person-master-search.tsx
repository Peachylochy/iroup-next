"use client";

import { Loader2, Search, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PersonMasterResult = {
  id: string;
  personType: "student" | "staff" | "external" | "manual";
  sourceIdentifier: string | null;
  fullNameTh: string;
  fullNameEn: string | null;
  organizationUnitId: string | null;
  organizationUnitName: string | null;
  programOrPosition: string | null;
};

export function PersonMasterSearch({
  personType = "student",
  disabled,
  selected,
  onSelect,
}: {
  personType?: "student" | "staff";
  disabled?: boolean;
  selected?: PersonMasterResult | null;
  onSelect: (person: PersonMasterResult | null) => void;
}) {
  const requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonMasterResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || selected) {
      return;
    }
    const currentRequest = ++requestId.current;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      const response = await fetch(`/api/lookups/people?type=${personType}&q=${encodeURIComponent(term)}`);
      const payload = await response.json() as { results?: PersonMasterResult[] };
      if (currentRequest !== requestId.current) return;
      setResults(response.ok ? payload.results ?? [] : []);
      setLoading(false);
      setOpen(true);
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      requestId.current += 1;
    };
  }, [personType, query, selected]);

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);
    if (nextQuery.trim().length < 2) {
      setResults([]);
      setLoading(false);
    }
  }

  if (selected) {
    return (
      <div className="person-master-selected">
        <UserRound aria-hidden="true" />
        <span>
          <strong>{selected.fullNameTh || selected.fullNameEn}</strong>
          <small>{[selected.sourceIdentifier, selected.organizationUnitName, selected.programOrPosition].filter(Boolean).join(" · ")}</small>
        </span>
        {!disabled ? <Button aria-label="เปลี่ยนบุคคล" onClick={() => { onSelect(null); setQuery(""); }} size="icon" type="button" variant="ghost"><X /></Button> : null}
      </div>
    );
  }

  return (
    <div className="person-master-search">
      <label>
        <Search aria-hidden="true" />
        <Input
          disabled={disabled}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={personType === "student" ? "ค้นหารหัสนิสิตหรือชื่อจาก Data Master" : "ค้นหารหัสบุคลากรหรือชื่อจาก Data Master"}
          value={query}
        />
        {loading ? <Loader2 className="animate-spin" aria-label="กำลังค้นหา" /> : null}
      </label>
      {open && query.trim().length >= 2 ? (
        <div className="person-master-results">
          {results.length ? results.map((person) => (
            <button key={person.id} onClick={() => { onSelect(person); setOpen(false); setQuery(""); }} type="button">
              <UserRound aria-hidden="true" />
              <span>
                <strong>{person.fullNameTh || person.fullNameEn}</strong>
                <small>{[person.sourceIdentifier, person.organizationUnitName, person.programOrPosition].filter(Boolean).join(" · ")}</small>
              </span>
            </button>
          )) : loading ? null : <p>ไม่พบรายชื่อใน Data Master — ยังสามารถกรอกข้อมูลด้วยตนเองด้านล่างได้</p>}
        </div>
      ) : null}
    </div>
  );
}
