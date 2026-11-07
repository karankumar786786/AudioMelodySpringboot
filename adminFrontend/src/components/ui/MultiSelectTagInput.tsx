"use client";

import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";

export interface MultiSelectTagInputProps {
  label?: string;
  placeholder?: string;
  values: string[];
  onChange: (newValues: string[]) => void;
  suggestions?: string[];
  error?: string;
  disabled?: boolean;
}

export function MultiSelectTagInput({
  label,
  placeholder = "Type and press Enter...",
  values,
  onChange,
  suggestions = [],
  error,
  disabled = false,
}: MultiSelectTagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize list of values
  const currentTags = Array.isArray(values) ? values : [];

  const addTag = (tagText: string) => {
    const trimmed = tagText.trim().replace(/^,+|,+$/g, "");
    if (!trimmed) return;

    // Check if comma-separated values inside the pasted/typed text
    const parts = trimmed
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const updated = [...currentTags];
    for (const part of parts) {
      if (!updated.some((t) => t.toLowerCase() === part.toLowerCase())) {
        updated.push(part);
      }
    }
    onChange(updated);
    setInputValue("");
  };

  const removeTag = (indexToRemove: number) => {
    const updated = currentTags.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && currentTags.length > 0) {
      e.preventDefault();
      removeTag(currentTags.length - 1);
    }
  };

  // Filter available suggestions (exclude already selected)
  const filteredSuggestions = suggestions.filter(
    (s) =>
      !currentTags.some((t) => t.toLowerCase() === s.toLowerCase()) &&
      (!inputValue.trim() ||
        s.toLowerCase().includes(inputValue.toLowerCase().trim()))
  );

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-zinc-300">
          {label}
        </label>
      )}

      <div
        onClick={() => inputRef.current?.focus()}
        className={`min-h-[42px] w-full bg-[#121215] border rounded-xl p-1.5 flex flex-wrap items-center gap-1.5 cursor-text transition-all ${
          isFocused
            ? "border-white/30 bg-[#16161a] ring-1 ring-white/10"
            : "border-white/[0.08] hover:border-white/[0.14]"
        } ${error ? "border-rose-500/50" : ""}`}
      >
        {currentTags.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/[0.08] text-white border border-white/[0.12] px-2.5 py-1 rounded-lg animate-in fade-in zoom-in-95 duration-100"
          >
            <span>{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(idx);
                }}
                className="text-zinc-400 hover:text-rose-400 transition-colors p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              if (inputValue.trim()) {
                addTag(inputValue);
              }
            }}
            placeholder={currentTags.length === 0 ? placeholder : "Add more..."}
            className="flex-1 min-w-[120px] bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none px-2 py-1"
          />
        )}
      </div>

      {/* Suggested chips below input */}
      {filteredSuggestions.length > 0 && isFocused && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[10px] text-zinc-500 self-center mr-1">Suggestions:</span>
          {filteredSuggestions.slice(0, 8).map((sugg) => (
            <button
              key={sugg}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click
                addTag(sugg);
              }}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.14] px-2 py-0.5 rounded-md transition-all cursor-pointer"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>{sugg}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[11px] text-rose-400 font-medium">{error}</p>}
    </div>
  );
}
