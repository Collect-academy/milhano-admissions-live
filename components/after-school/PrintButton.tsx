"use client";

export default function PrintButton() {
  return (
    <button className="asBtn rosterNoPrint" type="button" onClick={() => window.print()}>
      Imprimir lista
    </button>
  );
}
