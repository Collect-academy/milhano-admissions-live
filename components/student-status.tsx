import { Check, CircleX, LockKeyhole, TriangleAlert } from "lucide-react";

import type { StudentFormStatus } from "@/lib/student-forms";

export function StudentStatusIcon({ status }: { status: StudentFormStatus }) {
  if (status === "complete") {
    return <span className="student-status student-status-complete" title="Completo"><Check size={16} /></span>;
  }
  if (status === "incomplete") {
    return <span className="student-status student-status-incomplete" title="Incompleto"><TriangleAlert size={15} /></span>;
  }
  return <span className="student-status student-status-none" title="Sin iniciar"><CircleX size={15} /></span>;
}

export function ConfidentialTooltip() {
  return (
    <span className="confidential-tooltip" tabIndex={0}>
      <LockKeyhole size={13} />
      <span className="confidential-bubble">Confidencial</span>
    </span>
  );
}
