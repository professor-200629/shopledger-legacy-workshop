# Repository Guidelines

## Stack

Node.js, Express, and body-parser; plain HTML, CSS, and browser JavaScript; JSON file storage. Tests use Node's built-in test runner.

## Module Map

- `server.js`: Express setup, static files, API routes, and printable invoice endpoint.
- `routes/`: product, order, customer, pricing-preview, and reporting handlers.
- `lib/`: pricing, coupons, GST, inventory, orders, credit ledger, invoices, reports, dates, and JSON storage.
- `public/`: HTML, CSS, and browser JavaScript; no build step.
- `config.js`: shop details and business settings.
- `data/db.json`: mutable application database.
- `tests/`: characterization tests for checkout and printable invoices using saved orders.

## Commands

- `npm install`: install dependencies.
- `npm start`: run locally on port 3000 by default (`PORT` overrides it).
- `npm test`: run the characterization tests via `node --test`.

## Working Rules

1. Write characterization tests before changing behavior.
2. Change only the modules the ticket is about.
3. Tests never touch the data: never write to `data/db.json`; use read-only input and in-memory copies.
4. Add no dependency.
