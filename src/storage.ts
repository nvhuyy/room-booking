import { readFile, writeFile } from "node:fs/promises";
import { Booking, Room, RoomName, Status } from "./models.js";

const ROOM_NAMES: RoomName[] = ["Sky", "Ocean", "Forest"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isBooking(value: unknown): value is Booking {
  return isRecord(value)
    && typeof value.id === "string"
    && ROOM_NAMES.includes(value.room as RoomName)
    && typeof value.customer === "string"
    && isDate(value.date)
    && typeof value.start === "number" && Number.isInteger(value.start) && value.start >= 0 && value.start <= 23
    && typeof value.hours === "number" && Number.isInteger(value.hours) && value.hours >= 1 && value.start + value.hours <= 24
    && Object.values(Status).includes(value.status as Status);
}

function isRoom(value: unknown): value is Room {
  return isRecord(value)
    && ROOM_NAMES.includes(value.id as RoomName)
    && typeof value.pricePerHour === "number"
    && Number.isFinite(value.pricePerHour) && value.pricePerHour > 0;
}

// One generic loader for any list stored as JSON.
async function loadList<T>(file: string, guard: (value: unknown) => value is T): Promise<T[]> {
  try {
    const text = await readFile(file, "utf-8");
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || !parsed.every(guard)) {
      throw new Error(`${file} has invalid data; fix it before starting the program.`);
    }
    return parsed;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.log(`No ${file} yet, starting empty.`);
      return []; // no file yet: not a real error
    }
    throw err; // anything else: let main() report it
  }
}

export const loadRooms = () => loadList("rooms.json", isRoom);
export const loadBookings = () => loadList("bookings.json", isBooking);

export async function saveBookings(bookings: Booking[]): Promise<void> {
  await writeFile("bookings.json", JSON.stringify(bookings, null, 2), "utf-8");
}
