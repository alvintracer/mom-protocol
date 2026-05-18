<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:moment-product-rules -->
# moment. Product Rules

- Service name: `moment.` in lowercase, including the trailing period.
- Token/symbol name: `MOM`.
- Keep `MOM` only for symbol-specific product terms such as `MOM Energy`, `MOM 포인트`, token symbols, contract names, or legacy filenames that intentionally refer to the symbol.
- User-facing brand copy should say `moment.`, not `MOM`.
- UI must be internationalization-ready. Use `src/shared/i18n` dictionaries and localized mock data instead of hard-coded page copy.
- Current service languages are Korean, English, and Spanish. Korean remains the default, and the language system must allow adding more languages later.
- Always consider mobile web first. New pages need usable mobile navigation, readable card layouts, non-overlapping text, and touch-friendly controls.
- Before any UI or frontend work, read `docs/AGENT_DESIGN_SYNC.md` and follow the Antigravity agent's design rules exactly.
- Before any oracle, rules, resolution, or attention-finalization work, read `docs/moment_aio.md` and `docs/moment_AIO_Attention_Protocol_Plan.md`.
<!-- END:moment-product-rules -->
