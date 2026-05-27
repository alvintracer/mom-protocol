import type { Metadata } from "next";
import { AboutPageClient } from "./AboutPageClient";

export const metadata: Metadata = {
  title: "About momment.",
  description:
    "momment. — Social Prediction Platform powered by Agentic Oracle. Read by AI. Verified by Humans. Sealed on Chain.",
};

export default function AboutPage() {
  return <AboutPageClient />;
}
