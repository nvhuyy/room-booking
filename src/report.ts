import { Booking, Room, Status } from "./models.js";

export function vnd(amount: number): string {
  return `${amount.toLocaleString("en-US")} VND`;
}

export function time(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function cost(b: Booking, rooms: Room[]): number {
  const price = rooms.find((r) => r.id === b.room)?.pricePerHour ?? 0;
  return Array.from({ length: b.hours }, (_, offset) => b.start + offset)
    .map((hour) => price * (isPeakHour(hour) ? 1.5 : 1))
    .reduce((sum, amount) => sum + amount, 0);
}

// Creative: 17:00-20:00 costs 50% more.
export function isPeakHour(hour: number): boolean {
  return hour >= 17 && hour < 20;
}

// Two bookings clash when they use the same room on the same day at overlapping hours.
export function overlaps(a: Booking, b: Booking): boolean {
  return a.room === b.room && a.date === b.date && a.start < b.start + b.hours && b.start < a.start + a.hours;
}

export function hasConflict(candidate: Booking, all: Booking[]): boolean {
  return candidate.status !== Status.Cancelled && all.some((booking) =>
    booking.id !== candidate.id && booking.status !== Status.Cancelled && overlaps(booking, candidate),
  );
}

export function findNearestFreeSlot(
  bookings: Booking[], room: Booking["room"], date: string, preferredStart: number, hours: number,
): number | undefined {
  const candidates = Array.from({ length: 24 - hours + 1 }, (_, start) => start)
    .sort((left, right) => Math.abs(left - preferredStart) - Math.abs(right - preferredStart) || left - right);
  return candidates.find((start) => !hasConflict({
    id: "candidate", room, customer: "", date, start, hours, status: Status.Pending,
  }, bookings));
}

export interface UsageStat {
  room: string;
  bookedHours: number;
  bookings: number;
}

export function dailyUsage(bookings: Booking[], rooms: Room[]): UsageStat[] {
  return rooms.map((room) => {
    const active = bookings.filter((booking) => booking.room === room.id && booking.status !== Status.Cancelled);
    return {
      room: room.id,
      bookedHours: active.map((booking) => booking.hours).reduce((sum, hours) => sum + hours, 0),
      bookings: active.length,
    };
  });
}

// The first earlier, non-cancelled booking that clashes with b (if any).
function clashWith(b: Booking, all: Booking[]): Booking | undefined {
  if (b.status === Status.Cancelled) return undefined;
  const earlier = all.slice(0, all.indexOf(b));
  return earlier.find((o) => o.status !== Status.Cancelled && overlaps(o, b));
}

function mark(status: Status): string {
  switch (status) {
    case Status.Confirmed:
      return "✔";
    case Status.Pending:
      return "○";
    case Status.Cancelled:
      return "✖";
  }
}

export function printReport(bookings: Booking[], rooms: Room[]): void {
  const lines = bookings.map((b) => {
    const clash = clashWith(b, bookings);
    const slot = `${time(b.start)}-${time(b.start + b.hours)}`;
    const warn = clash ? `  ⚠ overlaps ${clash.customer}` : "";
    return `  ${mark(b.status)} ${slot}  ${b.room.padEnd(7)}${b.customer.padEnd(7)}${vnd(cost(b, rooms)).padStart(11)}${warn}`;
  });
  console.log(lines.join("\n"));

  // The assembly line: filter -> map -> reduce
  const confirmed = bookings.filter((b) => b.status === Status.Confirmed);
  const amounts = confirmed.map((b) => cost(b, rooms));
  const revenue = amounts.reduce((sum, a) => sum + a, 0);
  console.log(`Revenue (confirmed, including peak pricing): ${vnd(revenue)}`);

  const conflicts = bookings.filter((b) => clashWith(b, bookings)).length;
  if (conflicts > 0) console.log(`⚠ ${conflicts} conflict(s) found`);
}
