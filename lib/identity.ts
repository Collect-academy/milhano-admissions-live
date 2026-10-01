const ADVISOR_ALIASES: Record<string, string> = {
  cinthia: "Cinthia Esquivel",
  "cinthia esquivel": "Cinthia Esquivel",
  "77kxc0w2hmphbcnyl9fe": "Cinthia Esquivel",
  "cvhk8cdzzt6a7zlxr5sg": "Miguel Campos",
  "ltjepadclnxpxud2mrxp": "Pathi Carrillo",
};

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ");
}

export function canonicalAdvisorName(
  value: string | null | undefined,
): string {
  const raw = value?.trim();

  if (!raw) {
    return "Sin asignar";
  }

  return ADVISOR_ALIASES[normalize(raw)] ?? raw;
}
