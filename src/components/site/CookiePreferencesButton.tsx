"use client";

import { openCookiePreferences } from "@/lib/consent";

export function CookiePreferencesButton({ className = "btn btn-primary btn-sm" }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openCookiePreferences}>
      Cambiar mis preferencias
    </button>
  );
}
