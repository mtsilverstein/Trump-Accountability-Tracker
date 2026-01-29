/**
 * update.js
 * Trump Accountability Tracker - auto-update script
 * Handles:
 *   - ICE incident merging with duplicate removal
 *   - Broken promises restoration
 *   - Lawsuit section addition
 *   - Data backup handling
 *   - Supabase table updates
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getCurrentData() {
  const { data, error } = await supabase
    .from('main')
    .select('data')
    .eq('id', 'main')
    .single();

  if (error) throw new Error(`Error fetching current data: ${error.message}`);
  return data.data;
}

function mergeIceIncidents(existingIncidents, newIncidents) {
  const merged = [];

  const incidentMap = {};

  // Index existing incidents by ID or date+name
  existingIncidents.forEach(incident => {
    const key = incident.id || `${incident.date}-${incident.name}`;
    incidentMap[key] = { ...incident };
  });

  // Merge in new incidents
  newIncidents.forEach(incident => {
    const key = incident.id || `${incident.date}-${incident.name}`;
    if (!incidentMap[key]) {
      incidentMap[key] = { ...incident };
    } else {
      // Merge details, preferring longer or non-empty strings
      const existing = incidentMap[key];
      for (const field in incident) {
        if (
          incident[field] &&
          (!existing[field] || incident[field].length > existing[field].length)
        ) {
          existing[field] = incident[field];
        }
      }
      incidentMap[key] = existing;
    }
  });

  // Convert map back to array
  for (const key in incidentMap) {
    merged.push(incidentMap[key]);
  }

  return merged;
}

function getBrokenPromises() {
  return [
    {
      id: "groceries-down",
      quote: "I won on groceries. I won an election based on that.",
      status: "BROKEN",
      promise: "Bring grocery prices way down",
      reality: [
        "Grocery prices UP 2.4% year-over-year (Dec 2025)",
        "December 2025: largest monthly grocery spike since Aug 2022",
        "Coffee up 20%, ground beef up 15.5%",
        "Trump claims prices are way down despite BLS data",
        "Grocery price inflation is picking up, defying Trump's claims."
      ],
      sources: ["CNN", "BLS", "ABC News", "Axios"],
      category: "Economy",
      progress: 0,
      statusColor: "#ff3333",
      datePromised: "December 2024"
    },
    {
      id: "manufacturing-jobs",
      quote: "Jobs and factories will come roaring back into our country.",
      status: "BROKEN",
      promise: "Manufacturing jobs roaring back",
      reality: [
        "Lost 72,000+ manufacturing jobs since Liberation Day",
        "Manufacturing declined 7 straight months",
        "73% of manufacturers cite tariffs as top challenge",
        "$18B+ clean energy projects cancelled",
        "Manufacturing jobs have dipped every month since 'Liberation Day'. Tariffs have not brought factories 'roaring back'.",
        "US has lost 72,000 manufacturing jobs since April 2025",
        "Manufacturing jobs are on the decline despite Trump's tariffs."
      ],
      sources: ["Washington Post", "CBC", "CAP", "NAM"],
      category: "Economy",
      progress: 0,
      statusColor: "#ff3333",
      datePromised: "April 2, 2025"
    },
    {
      id: "energy-50",
      quote: "I will cut your energy and electricity prices in half, 50%",
      status: "BROKEN",
      promise: "Cut energy bills in HALF within 12 months",
      reality: [
        "Gasoline down ~20% (not 50%)",
        "Electricity UP 9%",
        "Families paid $124 MORE for utilities"
      ],
      sources: ["NPR", "CNN", "BLS", "EIA"],
      category: "Economy",
      deadline: "January 20, 2026",
      progress: 20,
      statusColor: "#ff3333",
      datePromised: "August 14, 2024"
    },
    {
      id: "ukraine-24h",
      quote: "I will get that done within 24 hours",
      status: "BROKEN",
      promise: "End Ukraine war within 24 HOURS",
      reality: [
        "War continues 370+ days later",
        "Trump now says it was in jest"
      ],
      sources: ["CNN", "Time Magazine", "PolitiFact"],
      category: "Foreign Policy",
      deadline: "January 21, 2025",
      progress: 0,
      statusColor: "#ff3333",
      datePromised: "July 2023 - November 2024"
    },
    {
      id: "day-one-inflation",
      quote: "Starting on day one, we will end inflation",
      status: "BROKEN",
      promise: "End inflation on DAY ONE",
      reality: [
        "CPI accelerated to 3.0%",
        "Eggs spiked 15.2%",
        "Groceries up 2.7%"
      ],
      sources: ["BLS", "Newsweek", "CNN"],
      category: "Economy",
      deadline: "January 20, 2025",
      progress: 0,
      statusColor: "#ff3333",
      datePromised: "August 9, 2024"
    },
    {
      id: "epstein-files",
      quote: "I guess I would release the Epstein files",
      status: "MOSTLY BROKEN",
      promise: "Release the Epstein files",
      reality: [
        "Resisted for months",
        "Congress forced 427-1 vote",
        "DOJ missed deadline",
        "5.2M pages unreviewed"
      ],
      sources: ["NPR", "Axios", "CNBC"],
      category: "Transparency",
      progress: 30,
      statusColor: "#ff6600",
      datePromised: "June 2024"
    },
    {
      id: "drill-baby-drill",
      quote: "We are going to drill, baby, drill",
      status: "BROKEN",
      promise: "Drill, baby, drill",
      reality: [
        "Active rigs DOWN 6%+",
        "Low prices prevent drilling"
      ],
      sources: ["NPR", "American Petroleum Institute"],
      category: "Energy",
      progress: 0,
      statusColor: "#ff3333",
      datePromised: "2024 campaign"
    },
    {
      id: "medicare-medicaid",
      quote: "I will never do anything that will jeopardize Social Security or Medicare",
      status: "BROKEN",
      promise: "Protect Medicare and Medicaid - NO CUTS",
      reality: [
        "Signed largest healthcare cut in history",
        "17 million losing coverage"
      ],
      sources: ["CBS News", "Reuters"],
      category: "Healthcare",
      progress: 0,
      statusColor: "#ff3333",
      datePromised: "2024"
    }
  ];
}

function getLawsuits() {
  return [
    {
      id: "crew-2025",
      plaintiffs: ["CREW"],
      defendants: ["Trump"],
      court: "Federal Court",
      claim: "Ethics violations / misuse of government resources",
      status: "Pending",
      sources: ["CREW.org"]
    }
    // Add additional lawsuits here
  ];
}

async function updateTracker(newData) {
  try {
    const currentData = await getCurrentData();

    // Merge ICE incidents
    const mergedIce = mergeIceIncidents(
      currentData.iceVictims || [],
      newData.iceVictims || []
    );

    const updatedData = {
      ...currentData,
      iceVictims: mergedIce,
      brokenPromises: getBrokenPromises(),
      lawsuits: getLawsuits(),
      lastUpdated: new Date().toISOString(),
      lastUpdateReason: newData.lastUpdateReason || currentData.lastUpdateReason,
      lastUpdateSource: newData.lastUpdateSource || currentData.lastUpdateSource
    };

    // Backup current data before updating
    await supabase
      .from('main')
      .update({ data_backup: JSON.stringify(currentData) })
      .eq('id', 'main');

    // Update main table
    const { error } = await supabase
      .from('main')
      .update({ data: JSON.stringify(updatedData), updated_at: new Date() })
      .eq('id', 'main');

    if (error) throw new Error(`Error updating tracker: ${error.message}`);

    console.log("Update successful!");
  } catch (err) {
    console.error("Update failed:", err);
  }
}

// Example usage (replace with real feed or cronjob call)
(async () => {
  const newData = {
    iceVictims: [
      // Pull from your data source or API
    ],
    lastUpdateReason: "Automated update",
    lastUpdateSource: "Automated feed"
  };
  await updateTracker(newData);
})();
