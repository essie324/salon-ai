import type { CSSProperties } from "react";
import fs from "fs/promises";
import path from "path";
import RoleGate from "@/app/dashboard/_components/RoleGate";
import { getActiveRole } from "@/app/lib/roleCookies";
import type { AppRole } from "@/app/lib/roles";

type SectionKey = "competitors" | "strengths" | "weaknesses" | "how_we_beat_them";

const DOC_PATH = path.join(process.cwd(), "docs", "COMPETITOR_BENCHMARK.md");

function normalizeHeading(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ");
}

function sectionFromHeading(heading: string): SectionKey | null {
  const h = normalizeHeading(heading);
  if (h.includes("competitor")) return "competitors";
  if (h.includes("strength")) return "strengths";
  if (h.includes("weakness")) return "weaknesses";
  if (h.includes("beat") || (h.includes("how") && (h.includes("win") || h.includes("beat")))) return "how_we_beat_them";
  if (h.includes("how we beat")) return "how_we_beat_them";
  return null;
}

function extractSections(markdown: string): Record<SectionKey, string> {
  const sections: Record<SectionKey, string> = {
    competitors: "",
    strengths: "",
    weaknesses: "",
    how_we_beat_them: "",
  };

  const lines = markdown.split("\n");
  let current: SectionKey | null = null;

  const headingRe = /^(#{1,6})\s+(.+?)\s*$/;

  for (const line of lines) {
    const match = line.match(headingRe);
    if (match) {
      const headingText = match[2];
      const next = sectionFromHeading(headingText);
      current = next;
      continue;
    }

    if (current) {
      sections[current] += line + "\n";
    }
  }

  // Trim trailing whitespace/newlines for nicer rendering.
  for (const k of Object.keys(sections) as SectionKey[]) {
    sections[k] = sections[k].trim();
  }

  return sections;
}

async function loadBenchmarkDoc(): Promise<string> {
  try {
    return await fs.readFile(DOC_PATH, "utf8");
  } catch {
    return "";
  }
}

export default async function StrategyPage() {
  const role = (await getActiveRole()) as AppRole;

  return (
    <RoleGate role={role} allowed={["admin"]}>
      <StrategyContent />
    </RoleGate>
  );
}

function SectionCard({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  const bodyStyle: CSSProperties = {
    background: "#f8f8f8",
    border: "1px solid #e5e5e5",
    borderRadius: 12,
    padding: 16,
    whiteSpace: "pre-wrap",
    fontSize: 13,
    color: "#222",
    lineHeight: 1.45,
    marginTop: 10,
    minHeight: 44,
  };

  return (
    <section style={cardStyle}>
      <h2 style={cardTitleStyle}>{title}</h2>
      {content ? (
        <div style={bodyStyle}>{content}</div>
      ) : (
        <div style={{ ...bodyStyle, color: "#666" }}>
          Not found in `COMPETITOR_BENCHMARK.md`.
        </div>
      )}
    </section>
  );
}

async function StrategyContent() {
  const markdown = await loadBenchmarkDoc();

  const sections = extractSections(markdown);

  return (
    <div style={pageStyle}>
      <div style={headerRowStyle}>
        <div>
          <h1 style={titleStyle}>Internal Strategy</h1>
          <p style={subtitleStyle}>
            Competitor benchmark and positioning notes for the team.
          </p>
        </div>
      </div>

      <SectionCard title="Competitors" content={sections.competitors} />
      <SectionCard title="Strengths" content={sections.strengths} />
      <SectionCard title="Weaknesses" content={sections.weaknesses} />
      <SectionCard
        title="How We Beat Them"
        content={sections.how_we_beat_them}
      />
    </div>
  );
}

const pageStyle: CSSProperties = {
  padding: 4,
};

const headerRowStyle: CSSProperties = {
  marginBottom: 18,
};

const titleStyle: CSSProperties = {
  fontSize: "1.6rem",
  fontWeight: 900,
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  marginTop: 6,
  marginBottom: 0,
  fontSize: 13,
  color: "#666",
  lineHeight: 1.35,
};

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 18,
  marginBottom: 14,
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 900,
  color: "#111",
};

