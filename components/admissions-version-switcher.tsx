import Link from "next/link";

export function AdmissionsVersionSwitcher({ current }: { current: "v2" | "legacy" }) {
  return (
    <div className="admissions-version-switcher" aria-label="Admissions dashboard version">
      <Link className={current === "v2" ? "version-pill version-pill-active" : "version-pill"} href="/">
        V2 · Actual
      </Link>
      <Link className={current === "legacy" ? "version-pill version-pill-active" : "version-pill"} href="/legacy">
        V1 · Legacy
      </Link>
    </div>
  );
}
