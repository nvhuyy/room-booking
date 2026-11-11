import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Booking, Room, RoomName, Status } from "./models.js";
import { Repository } from "./repository.js";
import { cost, dailyUsage, findNearestFreeSlot, hasConflict, printReport, time, vnd } from "./report.js";
import { loadBookings, loadRooms, saveBookings } from "./storage.js";

const ROOM_NAMES: RoomName[] = ["Sky", "Ocean", "Forest"];

function isRoomName(value: string | undefined): value is RoomName {
  return ROOM_NAMES.includes(value as RoomName);
}

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function wholeHour(value: string | undefined, label: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 23) throw new Error(`${label} must be a whole hour from 0 to 23.`);
  return number;
}

function duration(value: string | undefined): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 24) throw new Error("hours must be a whole number from 1 to 24.");
  return number;
}

function assertSlot(start: number, hours: number): void {
  if (start + hours > 24) throw new Error("A booking cannot end after 24:00.");
}

function byDate(bookings: Booking[], date: string): Booking[] {
  return bookings.filter((booking) => booking.date === date).sort((a, b) => a.start - b.start);
}

function help(): void {
  console.log(`Commands:
  help
  list <date>
  book <customer> <room> <date> <start> <hours>
  confirm <id> | cancel <id>
  available <room> <date>
  revenue <date>
  suggest <room> <date> <start> <hours>     (creative)
  usage <date>                              (creative)
  export <markdown|csv> <date> [file]       (creative)
  exit
Peak hours (17:00-20:00) cost 50% extra.`);
}

function exportSchedule(format: string, date: string, bookings: Booking[], rooms: Room[]): string {
  const rows = byDate(bookings, date);
  if (format === "markdown") {
    return ["# Room schedule", "", `Date: ${date}`, "", "| Time | Room | Customer | Status | Price |", "| --- | --- | --- | --- | --- |",
      ...rows.map((b) => `| ${time(b.start)}-${time(b.start + b.hours)} | ${b.room} | ${b.customer} | ${b.status} | ${vnd(cost(b, rooms))} |`), ""].join("\n");
  }
  if (format === "csv") {
    return ["id,date,start,end,room,customer,status,price_vnd", ...rows.map((b) =>
      [b.id, b.date, time(b.start), time(b.start + b.hours), b.room, b.customer, b.status, cost(b, rooms)].join(",")), ""].join("\n");
  }
  throw new Error("Export format must be markdown or csv.");
}

async function main(): Promise<void> {
  const [rooms, bookings] = await Promise.all([loadRooms(), loadBookings()]);
  const roomRepo = new Repository<Room>(rooms);
  const bookingRepo = new Repository<Booking>(bookings);
  const rl = createInterface({ input, output });
  console.log("Room Booking Manager. Type 'help' for commands.");

  try {
    while (true) {
      const line = (await rl.question("> ")).trim();
      const [command = "", ...args] = line.split(/\s+/);
      try {
        if (!command) continue;
        if (command === "exit") break;
        if (command === "help") help();
        else if (command === "list") {
          if (!validDate(args[0])) throw new Error("Use a valid date: YYYY-MM-DD.");
          const list = byDate(bookingRepo.getAll(), args[0]);
          console.log(`Bookings for ${args[0]} (${list.length})`);
          printReport(list, roomRepo.getAll());
        } else if (command === "book") {
          const [customer, room, date, startText, hoursText] = args;
          if (!customer) throw new Error("Usage: book <customer> <room> <date> <start> <hours>");
          if (!isRoomName(room)) throw new Error(`Unknown room: ${room ?? ""}.`);
          if (!validDate(date)) throw new Error("Use a valid date: YYYY-MM-DD.");
          const start = wholeHour(startText, "start");
          const hours = duration(hoursText);
          assertSlot(start, hours);
          const booking: Booking = { id: `bk-${Date.now()}`, customer, room, date, start, hours, status: Status.Pending };
          if (hasConflict(booking, bookingRepo.getAll())) {
            const suggestion = findNearestFreeSlot(bookingRepo.getAll(), room, date, start, hours);
            const tip = suggestion === undefined ? " No free slot fits that day." : ` Try ${time(suggestion)}-${time(suggestion + hours)}.`;
            throw new Error(`That room is already booked for this time.${tip}`);
          }
          bookingRepo.add(booking);
          await saveBookings(bookingRepo.getAll());
          console.log(`Created pending booking ${booking.id}. Use confirm ${booking.id} to confirm it.`);
        } else if (command === "confirm" || command === "cancel") {
          const id = args[0];
          if (!id) throw new Error(`Usage: ${command} <id>`);
          const booking = bookingRepo.findById(id);
          if (!booking) throw new Error(`No booking with id ${id}.`);
          const status = command === "confirm" ? Status.Confirmed : Status.Cancelled;
          bookingRepo.update(id, { status });
          await saveBookings(bookingRepo.getAll());
          console.log(`${id} is now ${status.toLowerCase()}.`);
        } else if (command === "available") {
          const [room, date] = args;
          if (!isRoomName(room)) throw new Error(`Unknown room: ${room ?? ""}.`);
          if (!validDate(date)) throw new Error("Use a valid date: YYYY-MM-DD.");
          const used = byDate(bookingRepo.getAll(), date).filter((b) => b.room === room && b.status !== Status.Cancelled);
          const hours = Array.from({ length: 24 }, (_, hour) => hour).filter((hour) => !used.some((b) => hour >= b.start && hour < b.start + b.hours));
          console.log(`${room} free hours on ${date}: ${hours.length ? hours.map(time).join(", ") : "none"}`);
        } else if (command === "revenue") {
          if (!validDate(args[0])) throw new Error("Use a valid date: YYYY-MM-DD.");
          const total = byDate(bookingRepo.getAll(), args[0]).filter((b) => b.status === Status.Confirmed).map((b) => cost(b, roomRepo.getAll())).reduce((sum, value) => sum + value, 0);
          console.log(`Revenue for ${args[0]} (including peak pricing): ${vnd(total)}`);
        } else if (command === "suggest") {
          const [room, date, startText, hoursText] = args;
          if (!isRoomName(room)) throw new Error(`Unknown room: ${room ?? ""}.`);
          if (!validDate(date)) throw new Error("Use a valid date: YYYY-MM-DD.");
          const start = wholeHour(startText, "start");
          const hours = duration(hoursText);
          assertSlot(start, hours);
          const slot = findNearestFreeSlot(bookingRepo.getAll(), room, date, start, hours);
          console.log(slot === undefined ? "No slot fits that day." : `Nearest free slot: ${room} ${time(slot)}-${time(slot + hours)}.`);
        } else if (command === "usage") {
          if (!validDate(args[0])) throw new Error("Use a valid date: YYYY-MM-DD.");
          dailyUsage(byDate(bookingRepo.getAll(), args[0]), roomRepo.getAll()).forEach((stat) => console.log(`${stat.room}: ${stat.bookedHours} booked hour(s), ${stat.bookings} booking(s)`));
        } else if (command === "export") {
          const [format, date, filename] = args;
          if (!validDate(date)) throw new Error("Use a valid date: YYYY-MM-DD.");
          const extension = format === "markdown" ? "md" : "csv";
          const file = filename ?? `schedule-${date}.${extension}`;
          await writeFile(file, exportSchedule(format ?? "", date, bookingRepo.getAll(), roomRepo.getAll()), "utf-8");
          console.log(`Exported ${file}.`);
        } else throw new Error(`Unknown command: ${command}. Type help for commands.`);
      } catch (error) {
        console.log(`Error: ${(error as Error).message}`);
      }
    }
  } finally {
    rl.close();
  }
  console.log("Goodbye.");
}

main().catch((error) => {
  console.error("Something went wrong:", (error as Error).message);
  process.exitCode = 1;
});
