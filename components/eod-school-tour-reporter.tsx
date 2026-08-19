"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { CalendarClock, Plus, Search, Trash2, UserRoundCheck } from "lucide-react";

import type {
  EodTourOpportunityCandidate,
  EodTourRecord,
} from "@/lib/eod-tours";
import type { Locale } from "@/lib/locale";

const LEVELS = ["unknown", "primaria", "secundaria", "prepa"] as const;
type Level = (typeof LEVELS)[number];

type BookingSlot = {
  id: string | null;
  clientKey: string;
  opportunityId: string;
  search: string;
  scheduledLocal: string;
  level: Level;
};

type BookingOption = {
  ref: string;
  label: string;
  bookingId: string | null;
  clientKey: string;
};

type OutcomeSlot = {
  key: string;
  bookingRef: string;
  attendanceStatus: "show" | "no_show";
  closeOutcome: "closed" | "not_closed";
  note: string;
};

function localDateTime(iso: string | null | undefined, fallbackDate: string): string {
  if (!iso) return `${fallbackDate}T09:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `${fallbackDate}T09:00`;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function candidateName(candidate: EodTourOpportunityCandidate): string {
  return candidate.studentName || candidate.contactName || candidate.opportunityName || "Sin nombre";
}

function candidateLabel(candidate: EodTourOpportunityCandidate): string {
  const phone = candidate.phone || "Sin teléfono";
  const stage = candidate.currentStage ? ` · ${candidate.currentStage}` : "";
  return `${phone} · ${candidateName(candidate)}${stage}`;
}

function bookingLabel(record: EodTourRecord): string {
  const name = record.studentName || record.contactName || "Sin nombre";
  const phone = record.phone || "Sin teléfono";
  const date = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(record.scheduledFor));
  return `${phone} · ${name} · ${date}`;
}

function newClientKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function digits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function blankBooking(eodDate: string): BookingSlot {
  return {
    id: null,
    clientKey: newClientKey(),
    opportunityId: "",
    search: "",
    scheduledLocal: `${eodDate}T09:00`,
    level: "unknown",
  };
}

function blankOutcome(index: number, legacyAttended: number, legacyClosed: number): OutcomeSlot {
  const closed = index < legacyClosed;
  const show = index < legacyAttended || closed;
  return {
    key: newClientKey(),
    bookingRef: "",
    attendanceStatus: show ? "show" : "no_show",
    closeOutcome: closed ? "closed" : "not_closed",
    note: "",
  };
}

function ContactSearch({
  slot,
  candidates,
  disabled,
  onChange,
}: {
  slot: BookingSlot;
  candidates: EodTourOpportunityCandidate[];
  disabled: boolean;
  onChange: (slot: BookingSlot) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = normalizeSearch(slot.search);
  const queryDigits = digits(slot.search);

  const matches = useMemo(() => {
    if (!slot.search.trim()) return candidates.slice(0, 8);
    return candidates.filter((candidate) => {
      const text = normalizeSearch([
        candidate.phone,
        candidate.contactName,
        candidate.studentName,
        candidate.opportunityName,
      ].filter(Boolean).join(" "));
      return text.includes(query) || (queryDigits.length >= 3 && digits(candidate.phone).includes(queryDigits));
    }).slice(0, 10);
  }, [candidates, query, queryDigits, slot.search]);

  const selected = candidates.find((candidate) => candidate.opportunityId === slot.opportunityId);

  return (
    <div className="tour-contact-search">
      <label>
        <span>Contacto / teléfono</span>
        <div className="tour-search-input-wrap">
          <Search size={15} />
          <input
            disabled={disabled}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange({ ...slot, search: event.target.value, opportunityId: "" });
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="9991234567 o nombre"
            type="search"
            value={slot.search}
          />
        </div>
      </label>

      {selected ? (
        <div className="tour-selected-contact">
          <strong>{candidateLabel(selected)}</strong>
          <button disabled={disabled} onClick={() => onChange({ ...slot, opportunityId: "", search: "" })} type="button">Cambiar</button>
        </div>
      ) : open && !disabled ? (
        <div className="tour-search-results">
          {matches.length ? matches.map((candidate) => (
            <button
              key={candidate.opportunityId}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange({
                  ...slot,
                  opportunityId: candidate.opportunityId,
                  search: candidateLabel(candidate),
                  level: (["primaria", "secundaria", "prepa"].includes(String(candidate.existingLevel).toLowerCase())
                    ? String(candidate.existingLevel).toLowerCase()
                    : slot.level) as Level,
                });
                setOpen(false);
              }}
              type="button"
            >
              <strong>{candidate.phone || "Sin teléfono"}</strong>
              <span>{candidateName(candidate)}</span>
              <small>{candidate.currentStage || "Sin stage"}</small>
            </button>
          )) : <span className="tour-empty-search">Sin coincidencias</span>}
        </div>
      ) : null}
    </div>
  );
}

export function EodSchoolTourReporter({
  locale,
  disabled,
  eodDate,
  submissionId,
  candidates,
  currentRecords,
  availableBookings,
  legacyBookedCount,
  legacyAttendedCount,
  legacyClosedCount,
}: {
  locale: Locale;
  disabled: boolean;
  eodDate: string;
  submissionId: string;
  candidates: EodTourOpportunityCandidate[];
  currentRecords: EodTourRecord[];
  availableBookings: EodTourRecord[];
  legacyBookedCount: number;
  legacyAttendedCount: number;
  legacyClosedCount: number;
}) {
  const currentBookedRecords = currentRecords.filter((record) => record.bookingSubmissionId === submissionId);
  const currentAttendanceRecords = currentRecords.filter((record) => record.attendanceSubmissionId === submissionId);

  const initialBookings = useMemo(() => {
    const rows: BookingSlot[] = currentBookedRecords.map((record) => ({
      id: record.id,
      clientKey: record.clientKey,
      opportunityId: record.opportunityId,
      search: bookingLabel(record),
      scheduledLocal: localDateTime(record.scheduledFor, eodDate),
      level: record.schoolLevel,
    }));
    while (rows.length < legacyBookedCount) rows.push(blankBooking(eodDate));
    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialOutcomes = useMemo(() => {
    const rows: OutcomeSlot[] = currentAttendanceRecords.map((record) => ({
      key: record.id,
      bookingRef: `id:${record.id}`,
      attendanceStatus: record.attendanceStatus === "no_show" ? "no_show" : "show",
      closeOutcome: record.closeOutcome === "closed" ? "closed" : "not_closed",
      note: record.outcomeNote ?? "",
    }));
    const needed = Math.max(legacyAttendedCount, legacyClosedCount);
    while (rows.length < needed) rows.push(blankOutcome(rows.length, legacyAttendedCount, legacyClosedCount));
    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [bookings, setBookings] = useState<BookingSlot[]>(initialBookings);
  const [outcomes, setOutcomes] = useState<OutcomeSlot[]>(initialOutcomes);

  const selectedCandidateByOpportunity = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.opportunityId, candidate])),
    [candidates],
  );

  const bookingOptions = useMemo(() => {
    const historical = availableBookings.map((record) => ({
      ref: `id:${record.id}`,
      label: bookingLabel(record),
      bookingId: record.id,
      clientKey: record.clientKey,
    }));
    const current = bookings
      .filter((slot) => slot.opportunityId)
      .map((slot) => {
        const candidate = selectedCandidateByOpportunity.get(slot.opportunityId);
        return {
          ref: slot.id ? `id:${slot.id}` : `client:${slot.clientKey}`,
          label: candidate ? `${candidateLabel(candidate)} · ${slot.scheduledLocal.replace("T", " ")}` : slot.search,
          bookingId: slot.id,
          clientKey: slot.clientKey,
        };
      });
    const unique = new Map<string, BookingOption>();
    [...current, ...historical].forEach((item) => unique.set(item.ref, item));
    return [...unique.values()];
  }, [availableBookings, bookings, selectedCandidateByOpportunity]);

  const showCount = outcomes.filter((row) => row.attendanceStatus === "show").length;
  const noShowCount = outcomes.filter((row) => row.attendanceStatus === "no_show").length;
  const closedCount = outcomes.filter((row) => row.attendanceStatus === "show" && row.closeOutcome === "closed").length;

  const bookingPayload = bookings.map((slot) => ({
    id: slot.id,
    client_key: slot.clientKey,
    ghl_opportunity_id: slot.opportunityId,
    scheduled_local: slot.scheduledLocal,
    school_level: slot.level,
  }));

  const attendancePayload = outcomes.map((row) => {
    const [kind, value] = row.bookingRef.split(":", 2);
    return {
      booking_id: kind === "id" ? value : null,
      booking_client_key: kind === "client" ? value : null,
      attendance_status: row.attendanceStatus,
      close_outcome: row.closeOutcome,
      outcome_note: row.note,
    };
  });

  const setBookedCount = (value: number) => {
    const next = Math.max(0, Math.min(25, Number.isFinite(value) ? value : 0));
    setBookings((current) => {
      if (next === current.length) return current;
      if (next < current.length) return current.slice(0, next);
      const rows = [...current];
      while (rows.length < next) rows.push(blankBooking(eodDate));
      return rows;
    });
  };

  return (
    <section className="tour-reporter">
      <input name="metric_key" type="hidden" value="school_tours_scheduled" />
      <input name="declared__school_tours_scheduled" type="hidden" value={bookings.length} />
      <input name="metric_key" type="hidden" value="school_tours_attended" />
      <input name="declared__school_tours_attended" type="hidden" value={showCount} />
      <input name="metric_key" type="hidden" value="closed_leads" />
      <input name="declared__closed_leads" type="hidden" value={closedCount} />
      <input name="school_tour_bookings_json" type="hidden" value={JSON.stringify(bookingPayload)} />
      <input name="school_tour_attendance_json" type="hidden" value={JSON.stringify(attendancePayload)} />

      <div className="tour-reporter-heading">
        <div>
          <p className="eyebrow">School Tours</p>
          <h3>{locale === "es" ? "Detalle manual por contacto" : "Manual contact detail"}</h3>
          <span>{locale === "es"
            ? "Los conteos de ST y Closed se guardan junto con el contacto, teléfono, horario, nivel y outcome."
            : "ST and Closed totals are saved together with contact, phone, schedule, level and outcome."}</span>
        </div>
        <div className="tour-outcome-totals">
          <span><b>{bookings.length}</b> Booked</span>
          <span><b>{showCount}</b> Show</span>
          <span><b>{noShowCount}</b> No Show</span>
          <span><b>{closedCount}</b> Closed</span>
        </div>
      </div>

      <div className="tour-section">
        <div className="tour-section-title">
          <div>
            <CalendarClock size={18} />
            <div><strong>ST Booked</strong><span>{locale === "es" ? "Escribe el total y completa un contacto por cada booking." : "Enter the total and complete one contact per booking."}</span></div>
          </div>
          <label className="tour-booked-count">
            <span>Total</span>
            <input
              disabled={disabled}
              min="0"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setBookedCount(Number(event.target.value))}
              type="number"
              value={bookings.length}
            />
          </label>
        </div>

        {bookings.length ? (
          <div className="tour-booking-list">
            {bookings.map((slot, index) => (
              <article className="tour-booking-row" key={slot.clientKey}>
                <div className="tour-row-index">{index + 1}</div>
                <ContactSearch
                  candidates={candidates}
                  disabled={disabled}
                  onChange={(next) => setBookings((rows) => rows.map((row) => row.clientKey === slot.clientKey ? next : row))}
                  slot={slot}
                />
                <label>
                  <span>{locale === "es" ? "Fecha y hora ST" : "ST date & time"}</span>
                  <input
                    disabled={disabled}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setBookings((rows) => rows.map((row) => row.clientKey === slot.clientKey ? { ...row, scheduledLocal: event.target.value } : row))}
                    type="datetime-local"
                    value={slot.scheduledLocal}
                  />
                </label>
                <label>
                  <span>{locale === "es" ? "Nivel" : "Level"}</span>
                  <select
                    disabled={disabled}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => setBookings((rows) => rows.map((row) => row.clientKey === slot.clientKey ? { ...row, level: event.target.value as Level } : row))}
                    value={slot.level}
                  >
                    <option value="unknown">{locale === "es" ? "Sin definir" : "Unknown"}</option>
                    <option value="primaria">Primaria</option>
                    <option value="secundaria">Secundaria</option>
                    <option value="prepa">Prepa</option>
                  </select>
                </label>
                {!disabled ? (
                  <button aria-label="Remove booking" className="tour-remove-button" onClick={() => setBookings((rows) => rows.filter((row) => row.clientKey !== slot.clientKey))} type="button"><Trash2 size={16} /></button>
                ) : null}
              </article>
            ))}
          </div>
        ) : <p className="tour-empty-state">{locale === "es" ? "Sin School Tours booked en este EOD." : "No School Tours booked in this EOD."}</p>}
      </div>

      <div className="tour-section">
        <div className="tour-section-title">
          <div>
            <UserRoundCheck size={18} />
            <div>
              <strong>{locale === "es" ? "Resultado de School Tours" : "School Tour outcomes"}</strong>
              <span>{locale === "es"
                ? "Elige un booking existente. Show cuenta como ST Attended; Closed cuenta también en Closed."
                : "Choose an existing booking. Show counts as ST Attended; Closed also counts in Closed."}</span>
            </div>
          </div>
          {!disabled ? (
            <button className="secondary-button" onClick={() => setOutcomes((rows) => [...rows, blankOutcome(rows.length, 0, 0)])} type="button"><Plus size={15} /> {locale === "es" ? "Añadir outcome" : "Add outcome"}</button>
          ) : null}
        </div>

        {outcomes.length ? (
          <div className="tour-outcome-list">
            {outcomes.map((row, index) => (
              <article className="tour-outcome-row" key={row.key}>
                <div className="tour-row-index">{index + 1}</div>
                <label className="tour-outcome-contact">
                  <span>{locale === "es" ? "ST Booked" : "Booked ST"}</span>
                  <select disabled={disabled} onChange={(event: ChangeEvent<HTMLSelectElement>) => setOutcomes((rows) => rows.map((item) => item.key === row.key ? { ...item, bookingRef: event.target.value } : item))} value={row.bookingRef}>
                    <option value="">{locale === "es" ? "Selecciona contacto / teléfono" : "Select contact / phone"}</option>
                    {bookingOptions.map((option) => <option key={option.ref} value={option.ref}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Attendance</span>
                  <select disabled={disabled} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    const status = event.target.value as OutcomeSlot["attendanceStatus"];
                    setOutcomes((rows) => rows.map((item) => item.key === row.key ? {
                      ...item,
                      attendanceStatus: status,
                      closeOutcome: status === "no_show" ? "not_closed" : item.closeOutcome,
                    } : item));
                  }} value={row.attendanceStatus}>
                    <option value="show">Show</option>
                    <option value="no_show">No Show</option>
                  </select>
                </label>
                <label>
                  <span>Outcome</span>
                  <select disabled={disabled || row.attendanceStatus === "no_show"} onChange={(event: ChangeEvent<HTMLSelectElement>) => setOutcomes((rows) => rows.map((item) => item.key === row.key ? { ...item, closeOutcome: event.target.value as OutcomeSlot["closeOutcome"] } : item))} value={row.closeOutcome}>
                    <option value="not_closed">Not Closed</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <label className="tour-outcome-note">
                  <span>{locale === "es" ? "Nota / motivo" : "Note / reason"}</span>
                  <input disabled={disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => setOutcomes((rows) => rows.map((item) => item.key === row.key ? { ...item, note: event.target.value } : item))} placeholder={locale === "es" ? "Qué pasó con este contacto..." : "What happened with this contact..."} value={row.note} />
                </label>
                {!disabled ? <button aria-label="Remove outcome" className="tour-remove-button" onClick={() => setOutcomes((rows) => rows.filter((item) => item.key !== row.key))} type="button"><Trash2 size={16} /></button> : null}
              </article>
            ))}
          </div>
        ) : <p className="tour-empty-state">{locale === "es" ? "Todavía no hay outcomes de ST reportados en este EOD." : "No ST outcomes reported in this EOD yet."}</p>}
      </div>

      <p className="tour-data-note">{locale === "es"
        ? "Importante: los School Tours históricos que solo tenían un conteo pueden aparecer como slots sin contacto. Al completar el detalle dejamos de depender de un número aislado."
        : "Important: historical School Tours that only had a count can appear as slots without a contact. Completing the detail removes dependence on an isolated number."}</p>
    </section>
  );
}
