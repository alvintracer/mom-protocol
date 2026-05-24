"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/shared/lib/supabase/client";

type NetworkPlacement = {
  id: string;
  network_name: string;
  unit_name: string;
  unit_type: string;
  position: string;
  script_code: string;
  is_active: boolean;
  priority: number;
};

/**
 * Loads global ad scripts (popunder, social_bar) once per session.
 * Placed in the root layout.
 */
export function GlobalAdScripts() {
  const [scripts, setScripts] = useState<NetworkPlacement[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const supabase = createClient();

    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("ad_network_placements")
        .select("*")
        .eq("is_active", true)
        .eq("position", "global")
        .order("priority", { ascending: false });

      if (data) setScripts(data);
    }

    load();
  }, []);

  if (scripts.length === 0) return null;

  return (
    <>
      {scripts.map((s) => (
        <ScriptInjector key={s.id} html={s.script_code} />
      ))}
    </>
  );
}

/**
 * Renders an ad network script in a specific position (e.g., sidebar).
 */
export function NetworkAdSlot({ position, className = "" }: { position: string; className?: string }) {
  const [placement, setPlacement] = useState<NetworkPlacement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("ad_network_placements")
        .select("*")
        .eq("is_active", true)
        .eq("position", position)
        .order("priority", { ascending: false })
        .limit(1);

      if (data && data.length > 0) setPlacement(data[0]);
      setLoaded(true);
    }

    load();
  }, [position]);

  if (!loaded || !placement) return null;

  return (
    <div className={className}>
      <ScriptInjector html={placement.script_code} />
    </div>
  );
}

/**
 * Safely injects arbitrary HTML (including <script> tags) into the DOM.
 */
function ScriptInjector({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    if (injectedRef.current || !containerRef.current) return;
    injectedRef.current = true;

    const container = containerRef.current;
    const temp = document.createElement("div");
    temp.innerHTML = html;

    // Move all children (including text nodes)
    Array.from(temp.childNodes).forEach((node) => {
      if (node.nodeName === "SCRIPT") {
        const oldScript = node as HTMLScriptElement;
        const newScript = document.createElement("script");
        // Copy attributes
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        // Copy inline content
        if (oldScript.textContent) {
          newScript.textContent = oldScript.textContent;
        }
        container.appendChild(newScript);
      } else {
        container.appendChild(node.cloneNode(true));
      }
    });
  }, [html]);

  return <div ref={containerRef} />;
}
