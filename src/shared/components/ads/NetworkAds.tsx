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
 * These run page-wide so they are injected directly into the DOM.
 */
export function GlobalAdScripts() {
  const [scripts, setScripts] = useState<NetworkPlacement[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const supabase = createClient();

    async function load() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("ad_network_placements")
          .select("*")
          .eq("is_active", true)
          .eq("position", "global")
          .order("priority", { ascending: false });

        if (data) setScripts(data);
      } catch {
        // table might not exist yet
      }
    }

    load();
  }, []);

  if (scripts.length === 0) return null;

  return (
    <>
      {scripts.map((s) => (
        <DirectScriptInjector key={s.id} html={s.script_code} />
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
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("ad_network_placements")
          .select("*")
          .eq("is_active", true)
          .eq("position", position)
          .order("priority", { ascending: false })
          .limit(1);

        if (data && data.length > 0) setPlacement(data[0]);
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    }

    load();
  }, [position]);

  if (!loaded || !placement) return null;

  return (
    <div className={className}>
      <NetworkScriptRenderer html={placement.script_code} />
    </div>
  );
}

/**
 * Renders ad scripts inside an iframe for complete DOM isolation.
 * This allows the same ad script to be safely used in multiple positions
 * without duplicate-ID conflicts or script caching issues.
 */
export function NetworkScriptRenderer({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(250);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const srcdoc = `<!DOCTYPE html>
<html><head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { overflow: hidden; background: transparent; }
  #ad-wrapper {
    display: flex;
    justify-content: center;
    transform-origin: top center;
  }
</style>
</head><body>
<div id="ad-wrapper">
${html}
</div>
<script>
  // Auto-scale narrow ads to fill container width + report height
  function measure() {
    var wrapper = document.getElementById('ad-wrapper');
    if (!wrapper) return;
    // Find the widest child element (the actual ad)
    var children = wrapper.querySelectorAll('*');
    var maxW = 0;
    for (var i = 0; i < children.length; i++) {
      var w = children[i].offsetWidth;
      if (w > maxW) maxW = w;
    }
    var vw = window.innerWidth;
    if (maxW > 20 && maxW < vw * 0.95) {
      // Scale ad to fill the container width
      var scale = vw / maxW;
      wrapper.style.transform = 'scale(' + scale + ')';
      wrapper.style.transformOrigin = 'top center';
      // Report scaled height
      var naturalH = wrapper.scrollHeight;
      var scaledH = Math.ceil(naturalH * scale);
      window.parent.postMessage({ type: 'ad-resize', height: scaledH }, '*');
    } else {
      // No scaling needed, just report height
      var h = document.body.scrollHeight || document.documentElement.scrollHeight;
      if (h > 10) window.parent.postMessage({ type: 'ad-resize', height: h }, '*');
    }
  }
  // Check periodically for async-loaded ads
  var checks = 0;
  var interval = setInterval(function() {
    measure();
    checks++;
    if (checks > 20) clearInterval(interval);
  }, 500);
  window.addEventListener('load', measure);
</script>
</body></html>`;

    iframe.srcdoc = srcdoc;
  }, [html]);

  // Listen for height messages from the iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "ad-resize" && typeof e.data.height === "number") {
        // Only accept messages from our iframe
        if (iframeRef.current && e.source === iframeRef.current.contentWindow) {
          setHeight(Math.max(50, e.data.height));
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      style={{
        width: "100%",
        height,
        border: "none",
        overflow: "hidden",
        display: "block",
        background: "transparent",
      }}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      title="Advertisement"
    />
  );
}

/**
 * Directly injects HTML/scripts into the DOM (used for global scripts like popunder/social bar).
 * These don't need isolation since they run once per session.
 */
function DirectScriptInjector({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    if (injectedRef.current || !containerRef.current) return;
    injectedRef.current = true;

    const container = containerRef.current;
    const temp = document.createElement("div");
    temp.innerHTML = html;

    Array.from(temp.childNodes).forEach((node) => {
      if (node.nodeName === "SCRIPT") {
        const oldScript = node as HTMLScriptElement;
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
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
