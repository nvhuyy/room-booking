# Room Booking · TypeScript Core & Node Runtime

A small app for managing meeting room bookings. It reads the rooms and bookings from JSON files,
prices each booking by the hour, adds up the revenue from confirmed bookings,
warns about overlapping bookings, and lets you add a booking from the command line.
This is the app we open up piece by piece during the training session.

Step-by-step setup guide: [SETUP.md](SETUP.md).

```text
$ npm start -- Trang Ocean 16 2
+ Booked: Ocean 16:00-18:00 for Trang
Saved 6 bookings to bookings.json
Bookings for 2026-11-12 (6)
  ✔ 09:00-11:00  Sky    Liam   400,000 VND
  ✔ 10:00-12:00  Sky    Minh   400,000 VND  ⚠ overlaps Liam
  ○ 13:00-14:00  Ocean  Lan    150,000 VND
  ✔ 14:00-17:00  Forest Huy    900,000 VND
  ✖ 15:00-16:00  Ocean  An     150,000 VND
  ✔ 16:00-18:00  Ocean  Trang  300,000 VND
Revenue (confirmed): 2,000,000 VND
⚠ 1 conflict(s) found
```

`✔` confirmed · `○` pending · `✖` cancelled.

## Requirements

- Node.js LTS (20 or newer)
- Git

## Install and run

```bash
npm install
npm run dev        # run the .ts files directly (while coding)
npm run check      # type-check only, no output files
npm run build      # compile .ts → .js into dist/
npm start          # run the compiled app
npm run reset      # put bookings.json back to the 5 original bookings
```

Add a booking from the command line (customer, room, start hour, hours):

```bash
npm start -- Trang Ocean 16 2
npm start -- Khoa Sky 9 1      # overlaps Liam: the app still books it, it only warns
```

For now the app only **warns** about overlapping bookings; it doesn't **block** them. That's the homework. Run `npm run reset` to go back to the original data.

## Structure

| File | Role |
| --- | --- |
| `src/models.ts` | Describes the data: `Booking`, `Room`, `RoomName`, `Status` |
| `src/repository.ts` | Data store: `Repository<T>`, used for both `Room` and `Booking` |
| `src/report.ts` | Prices, revenue (filter → map → reduce), overlap detection |
| `src/storage.ts` | Reads two files in parallel with `Promise.all`, writes with `async/await` |
| `src/main.ts` | Entry point |
| `src/demo/` | TypeScript demos (slides 9–11) |
| `src/lab/` | Node demos (slides 16–23) |
| `demos/` | JavaScript demos (`js-basics.js`, `bug.js`) |
| `rooms.json`, `bookings.json` | Data; `data/bookings.seed.json` is the original copy |
| `scripts/reset.mjs` | Resets the data |

## Demos by slide

Every demo runs on this exact version of the code; no need to check out older commits. For the TypeScript demos (slides 9–11), make one change at a time, look at the red underline and `npm run check`, then undo it:

- `src/demo/types.ts`: uncomment the line `addRevenue(400000, "900000")`.
- `src/demo/booking.ts`: try the 4 changes listed at the top of the file, or uncomment `console.log(found.customer)`.
- `src/demo/private.ts`: add the line `bookingRepo.items = [];` or `bookingRepo.add(roomRepo.getAll()[0]);`.

| Slide | Command or file | What you see |
| --- | --- | --- |
| 2 | `npm run reset`, `npm start`, `npm start -- Trang Ocean 16 2`, `npm start -- Khoa Sky 9 1` | The schedule, a new booking, an overlapping booking that only gets a warning |
| 6 | `npm run demo:js` | Three things to know about JavaScript |
| 7 | `npm run demo:bug` | The 400 billion bug: `400000900000 string` |
| 9 | `src/demo/types.ts` + `npm run check`, `npm run build` | Red underline on a wrong type; `dist/demo/types.js` has no types left |
| 10 | `src/demo/booking.ts` + `npm run check` | Room `"Moon"`, start `"09:00"`, a missing field, `found` possibly `undefined` |
| 11 | `src/demo/private.ts` + `npm run check` | `items` is private; a `Room` is not a `Booking` |
| 12 | `npm start` | Revenue with filter → map → reduce |
| 16 | `npm run lab:thread` | Principle 1: one thread (stop with Ctrl+C) |
| 17 | `npm run lab:wait` | Principle 2: waiting is handed to libuv |
| 18 | `npm run lab:queue` | Principle 3: results wait in line, run when V8 is free |
| 19 | `npm run lab:parallel` | Principle 4: A 3 s, B 1 s, C 3 s |
| 20 | `npm run lab:promise`, `npm run lab:pending` | Principle 5: `Promise { <pending> }`, in the app too |
| 21 | `npm run lab:await` | `await` pauses only the function: A, B, C, D |
| 22 | `npm run lab:fail` | With a catcher the program goes on; without one, Node stops |
| 23 | `npm run lab:nocatch`; rename `bookings.json`; break the JSON; `"start": "9"` | The error without `try/catch`, then how the app handles each kind of failure |
| Backup | `npm run lab:order` | Promises jump ahead of timers: 1, 4, 3, 2 |

After renaming the file, breaking the JSON or adding bookings, run `npm run reset` to put `bookings.json` back to the 5 original bookings.

## Homework: Booking Manager

Turn the app into a booking program that keeps running and takes commands from the user.

**Must have (60 points)**

- Commands: `help`, `list <date>`, `book`, `confirm <id>`, `cancel <id>`, `available <room> <date>`, `revenue <date>`, `exit`
- **Reject double bookings**: don't allow a booking that overlaps a non-cancelled booking of the same room
- `Repository<T>` gets `update` and `remove`; the data stays `private`
- Revenue and lists use array methods, no `for` loops
- Read and write files with `fs/promises` and `await`, no `*Sync` functions
- Bad input (invalid hour, unknown room, wrong id): a clear error message, and the program keeps running
- `strict` on, no `any`, sensible modules

Hint: look at `node:readline/promises`. `rl.question()` returns a Promise.

**Creative (25 points):** pick at least 2 challenges, or propose your own, and explain your design in the README:
peak-hour pricing, weekly repeating bookings, a waitlist when a room is full, suggesting the nearest free slot,
daily room usage stats, exporting the schedule to Markdown/CSV, validating the JSON data with a type guard.

**Think (15 points), answer in the README:**

1. Change `"start": 9` in `bookings.json` to `"9"` and the app prints `09:00-92:00`, with no TypeScript error. Why? How would you handle it?
2. With 1 million bookings, where is the overlap check slow? What is V8 doing at that moment?
3. Two terminals book the same room, at the same time, and save the file at the same moment. What happens?

### How to submit

```bash
git checkout -b homework/<your-name>
# do the work, commit small and often
git push origin homework/<your-name>
```

Open a Pull Request titled `[Homework] <Full name>` and list the creative challenges you chose.

## Homework implementation

Run `npm run dev` and enter one command per line.  Booking uses the following
format so a customer name is a single word:

```text
book <customer> <room> <date> <start> <hours>
```

For example, `book Trang Ocean 2026-11-12 16 2`. New bookings start as
`PENDING`; use `confirm <id>` or `cancel <id>` afterwards. `help` displays all
commands. Every invalid command is handled at the prompt, so the program keeps
running. Bookings that overlap an active booking are rejected before writing
the file.

### Creative challenges completed

1. **Peak-hour pricing.** Each booked hour from 17:00 through 19:59 costs 50%
   more. The same `cost` function is used in the list report, revenue command,
   and exports so prices cannot disagree.
2. **Nearest free slot.** `suggest <room> <date> <start> <hours>` searches all
   valid starts in the day, ordered by distance from the requested start. A
   rejected `book` command also shows that suggestion when one exists.
3. **Daily room usage stats.** `usage <date>` reports the number of active
   bookings and total booked hours for every room. Cancelled bookings do not
   count.
4. **Exporting schedules.** `export markdown <date> [file]` and
   `export csv <date> [file]` write the day schedule with calculated prices.
   The default files are `schedule-<date>.md` and `schedule-<date>.csv`.

In addition, JSON is validated while loading. The parser receives `unknown`,
then runtime type guards check each room and booking before it reaches the
typed app. Thus a value such as `"start": "9"` is rejected with a useful
message instead of producing an invalid time.

### Think

1. TypeScript checks source code while compiling, but `bookings.json` is data
   received at runtime. A type assertion after `JSON.parse` only tells the
   compiler to trust the value; it does not convert or validate it. A string
   start leads to JavaScript's `+` string concatenation (`"9" + 2` becomes
   `"92"`). The runtime guards in `storage.ts` address this at the file
   boundary; command input is also parsed and range-checked.
2. The slow point is comparing a new booking against every relevant existing
   booking (and, in the report, searching earlier bookings for clashes). At one
   million entries this is linear work per check, or potentially quadratic when
   reporting all conflicts. V8 runs those JavaScript array callbacks on its
   single main thread, so the event loop cannot process another command until
   the calculation finishes. A production version would index bookings by room
   and date and keep each day's intervals sorted.
3. Both processes can read the same old file, both see the slot as free, and
   then both write a complete replacement file. The last write wins, so one
   booking can disappear (or an implementation might preserve both conflicting
   entries). Prevent it with a database transaction/unique exclusion rule, or
   at minimum a shared lock plus reload-and-check immediately before saving.
