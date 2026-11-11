# TradePilot AI

### Intelligent Trading. Controlled Risk. Simulated Execution.

TradePilot AI is a paper-trading simulation platform designed to demonstrate how trading decisions can be evaluated through strategy logic and risk-management rules before simulated execution.

The platform focuses on disciplined trading, transparent risk decisions and maintaining a record of trading activity.

## Key Features

- **Market Analysis:** Displays market indicators and sample market conditions.
- **Strategy Lab:** Evaluates trading opportunities using Moving Average Trend Following and Mean Reversion strategies.
- **Risk Governor:** Evaluates proposed trades against configurable risk limits.
- **Paper Trading:** Simulates trade execution using virtual funds.
- **Trade Journal:** Records accepted and rejected decisions for review.
- **Kill Switch:** Provides a mechanism to stop new simulated trades.

## Agent Workflow

The TradePilot workflow demonstrates the following stages:

1. Market data input
2. Data validation
3. Market analysis
4. Strategy selection
5. Signal generation
6. Trade evaluation
7. Risk validation
8. Approval or rejection
9. Simulated execution
10. Journal recording

## Technology Stack

- React 19
- TypeScript
- TanStack Router / Start
- Vite
- Tailwind CSS
- Recharts
- Supabase JavaScript client dependency

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

Clone the repository:

```bash
git clone https://github.com/naveenkumarkiran9-del/realworldproblemsolversagenticai.git
```

Navigate into the project:

```bash
cd realworldproblemsolversagenticai
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run automated tests:

```bash
npm test
```

Build the project:

```bash
npm run build
```

## Important Disclaimer

TradePilot AI is an educational paper-trading prototype.

- It does not execute real-money trades.
- It does not connect to real brokerage accounts.
- Strategy decisions are based on implemented rule-based logic.
- Market information and performance demonstrations may use sample or simulated data.

This project is not financial advice.

## Hackathon

Developed as a prototype for Hack4Hack.
