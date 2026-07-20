"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

export function VerifyLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      className="glass-panel mx-auto flex max-w-[540px] flex-col gap-3 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const id = value.trim().split("/").pop();
        if (id) router.push(`/verify/${id}`);
      }}
    >
      <label htmlFor="verification-id" className="micro-label">
        Verification ID or link
      </label>
      <div className="flex gap-2">
        <input
          id="verification-id"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. 3fK9…  or a full /verify link"
          className="field forensic flex-1"
        />
        <button
          type="submit"
          className="action-primary shrink-0 px-4"
          aria-label="Verify"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="text-[11.5px] text-text-muted">
        Generate an asset through the gate to mint a verification link.
      </p>
    </form>
  );
}
