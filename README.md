# Trump Administration Accountability Tracker

Objective, fact-based tracking of the Trump administration with verifiable sources.

## What It Tracks

- **National Debt** - Live counter based on Treasury data
- **Personal Wealth Gains** - Forbes estimates with breakdown
- **Broken Campaign Promises** - Exact quotes, deadlines, and outcomes
- **Self-Dealing** - Taxpayer money spent at Trump properties
- **ICE/CBP Deaths** - US citizens killed by federal immigration agents

## Philosophy

This tracker is designed to be **objective and bipartisan**:

- Every claim has a source
- Exact quotes with dates and locations
- No editorializing - just data
- Built for anyone who values facts over spin

## Deploy to Vercel

### Option 1: One-Click (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/trump-accountability-tracker)

### Option 2: Manual

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/trump-accountability-tracker
cd trump-accountability-tracker
npm install

# Run locally
npm start

# Deploy
vercel --prod
```

## Data Sources

| Category | Sources |
|----------|---------|
| National Debt | Treasury Dept, JEC, CBO |
| Wealth | Forbes, Bloomberg, NYT |
| Golf Costs | GAO, HuffPost, CREW |
| Self-Dealing | CREW, American Oversight, House Oversight |
| Promises | PolitiFact, CNN, NPR, BLS, EIA |
| ICE Deaths | Wikipedia, NPR, AP, ACLU, Vera Institute |

## Updating Data

The current version uses hardcoded data in `src/App.js`. To update:

1. Find the `DATA` object at the top of the file
2. Update values with sources
3. Commit and push - Vercel auto-deploys

### Future: Auto-Updates with Gemini

The `/api` folder contains scaffolding for Gemini-powered news monitoring that can:
- Parse news articles for new data
- Validate claims across sources
- Auto-update the tracker

To enable, deploy the API separately and set `GEMINI_API_KEY`.

## Contributing

Found an error? Open an issue or PR. All corrections must include sources.

## License

MIT - Use freely, attribute if you want.
