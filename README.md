# Numera — Financial Statement Analyzer

Numera ingests corporate financial statements, normalises the line items, verifies the
accounting identity `Assets = Liabilities + Equity`, runs vertical and horizontal analysis,
and computes the full Corporate Finance Institute (CFI) financial-ratio suite — with every
figure traceable back to its source line item and formula.

It is a self-contained Next.js application with a bespoke, dependency-light financial engine
(parser → analyzer → ratios) and a warm, ledger-inspired interface.

---

## Features

- **Multiple input paths**
  - **Manual entry** — type figures by hand with an editable-period grid and a searchable
    line-item combobox.
  - **Paste text** — drop in statement text; it is chunked and parsed automatically.
  - **Upload file** — PDF, Excel (`.xlsx`/`.xls`) or CSV.
- **Automatic line-item mapping** — 44-category taxonomy with exact, substring and
  fuzzy (Jaccard ≥ 0.6) matching; unit scaling is detected from `(in thousands/millions)` notes.
- **Balance-sheet validation** — proves `Assets = Liabilities + Equity` within a configurable
  tolerance and surfaces clear, actionable warnings.
- **Vertical & horizontal analysis** — every line item as a share of revenue/total assets, plus
  period-over-period variance (Δ and %) with sortable tables.
- **CFI ratio engine** — 26 ratios across liquidity, profitability, leverage, efficiency and
  valuation, each reported as `computed`, `partial` or `unavailable` with an audit trail.
- **Multi-period ratios** — every ratio is computed for every period (with true average
  balances once a prior period exists), so values, cards and charts follow the selected period
  and trends are visible at a glance.
- **Configurable day-count basis** — 365 (default) or 360-day convention for receivables,
  inventory and defensive-interval days; every day-based solution shows the chosen basis.
- **Transparent solutions** — each ratio exposes its formula, the substituted source values
  (data lineage) and the step-by-step result.
- **Visual analysis** — trend and ratio-comparison charts.
- **Input validation** — malformed numbers, duplicate periods, unbalanced statements and
  unreadable files are caught up front with minimisable alert banners.

---

## Ratio coverage

| Category | Ratios |
| --- | --- |
| Profitability | Return on Equity, Return on Assets, Return on Capital Employed, Gross Margin, Operating Margin, Net Profit Margin |
| Leverage | Debt-to-Equity, Equity Ratio, Debt Ratio |
| Efficiency | AR Turnover, AR Days, Asset Turnover, Inventory Turnover, Inventory Days |
| Liquidity | Current Ratio, Quick Ratio, Cash Ratio, Defensive Interval Ratio, Times Interest Earned, TIE (Cash Basis), CAPEX to Operating Cash, Operating Cash Flow Ratio |
| Valuation | P/E Ratio, EV/EBITDA, EV/EBIT, EV/Revenue |

Percent ratios are stored already scaled (`40` ⇒ `40.00%`); `times` ratios hold the raw multiple.
Each `RatioResult` carries its formula, substituted values, notes and availability so the UI can
render a full solution breakdown.

---

## Tech stack

- **Framework:** Next.js 15 (App Router) · React 19 · TypeScript 5
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Parsing:** `pdf-parse` (PDF), SheetJS `xlsx` (Excel/CSV)
- **Testing:** Vitest

---

## Getting started

Requirements: Node.js 20+ (developed on Node 24) and npm.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |

> **Note:** do not run `npm run build` / `npm run start` while `npm run dev` is running — they
> share the `.next` directory. Stop the dev server first.

---

## Usage

1. Choose an input mode (Manual entry, Paste text, or Upload file).
2. Provide the statement figures. Periods are the editable column headers.
3. Optionally expand **Market & cash-flow inputs** to feed valuation and cash-flow ratios
   (share price, shares outstanding, market cap, enterprise value, operating cash flow, capex,
   EBITDA, EBIT, total debt, cash), and to pick the **day-count basis** (365 or 360 days) used by
   the receivables, inventory and defensive-interval day ratios.
4. Analyse. Review the validation banners, then explore the overview, vertical/horizontal
   tables, ratios and charts — every number backed by its formula and solution.

A built-in **Load sample** action in the paste-text panel fills a three-year example so you can
try the engine immediately.

---

## Project structure

```
src/
  app/                     Next.js routes (page, layout, API: analyze, categories)
  components/              UI (AnalyzerApp, panels, tables, banners, charts)
  lib/
    engine/
      parser.ts            Ingestion, taxonomy matching, normalisation, validation
      analyzer.ts          Vertical & horizontal analysis
      ratios.ts            CFI ratio computation engine
    chartData.ts           Client-safe chart data builders
    validation.ts          Client-safe input validation
    types.ts               Shared client-safe types
    format.ts              Formatting helpers
    sample.ts              Embedded sample statement
tests/                     Vitest suites (engine, validation, pipeline)
```

---

## Testing

```bash
npm test          # run once
npm run typecheck # static checks
```

The suite covers the parser, manual/paste ingestion, balance-sheet validation, the ratio
engine (benchmarks and edge cases) and full pipeline integration.

---

## License

Released under the MIT License. © 2026 Jacob Conrad M. Quendangan. See [LICENSE](LICENSE).

## Author

**Jacob Conrad M. Quendangan**
