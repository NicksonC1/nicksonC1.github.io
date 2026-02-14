const FAVORITES_KEY = "vex-scout-favorites";
const DEFAULT_PROXY_PATH = "/api/scout";

const form = document.getElementById("scout-form");
const teamInput = document.getElementById("team-number");
const programInput = document.getElementById("program-id");
const seasonInput = document.getElementById("season-id");
const statusNode = document.getElementById("search-status");
const summaryNode = document.getElementById("result-summary");
const saveFavoriteButton = document.getElementById("save-favorite");
const favoritesNode = document.getElementById("favorites-list");
const clearButton = document.getElementById("clear-results");
const demoButton = document.getElementById("load-demo");
const eventsQualifiedOnly = document.getElementById("events-qualified-only");
const awardsQualifiedOnly = document.getElementById("awards-qualified-only");

const kpiCards = {
  events: document.querySelector('.kpi-card[data-key="events"] .kpi-value'),
  awards: document.querySelector('.kpi-card[data-key="awards"] .kpi-value'),
  record: document.querySelector('.kpi-card[data-key="record"] .kpi-value'),
  skillsRank: document.querySelector('.kpi-card[data-key="skills-rank"] .kpi-value'),
};

const profileNode = document.getElementById("team-profile");
const awardsNode = document.getElementById("awards-list");
const insightsNode = document.getElementById("insights-list");
const seasonFilterNode = document.getElementById("season-filter-list");

const eventsBody = document.querySelector("#events-table tbody");
const matchesBody = document.querySelector("#matches-table tbody");
const rankingsBody = document.querySelector("#rankings-table tbody");
const skillsBody = document.querySelector("#skills-table tbody");

const winsBar = document.querySelector("#record-bar .wins");
const lossesBar = document.querySelector("#record-bar .losses");
const tiesBar = document.querySelector("#record-bar .ties");

const configuredProxy = window.SCOUT_CONFIG?.proxyBaseUrl
  ? String(window.SCOUT_CONFIG.proxyBaseUrl).trim()
  : "";

let scoutState = {
  team: null,
  events: [],
  awards: [],
  matches: [],
  rankings: [],
  skills: [],
  record: { wins: 0, losses: 0, ties: 0, total: 0 },
  qualificationSignals: new Set(),
  seasons: [{ key: "all", label: "All seasons" }],
  activeSeasonKey: "all",
};

const demoBundle = {
  team: {
    id: 999999,
    number: "169A",
    team_name: "Pulse Drive",
    robot_name: "Kinetic Arc",
    organization: "North Metro Robotics",
    city: "Seattle",
    region: "WA",
    country: "USA",
    grade: "High School",
  },
  events: [
    {
      id: 1,
      name: "Cascade Signature Event",
      start: "2025-01-18",
      location: { city: "Tacoma", region: "WA" },
      season: { id: 191, name: "High Stakes" },
    },
    {
      id: 2,
      name: "Washington State Championship",
      start: "2025-02-22",
      location: { city: "Yakima", region: "WA" },
      season: { id: 191, name: "High Stakes" },
    },
    {
      id: 3,
      name: "Pacific Northwest Regional",
      start: "2024-11-10",
      location: { city: "Everett", region: "WA" },
      season: { id: 190, name: "Over Under" },
    },
  ],
  awards: [
    {
      id: 11,
      title: "Excellence Award",
      event: { id: 2, name: "Washington State Championship", season: { id: 191, name: "High Stakes" } },
    },
    {
      id: 12,
      title: "Design Award",
      event: { id: 1, name: "Cascade Signature Event", season: { id: 191, name: "High Stakes" } },
    },
    {
      id: 13,
      title: "World Championship Qualification",
      event: { id: 2, name: "Washington State Championship", season: { id: 191, name: "High Stakes" } },
    },
  ],
  matches: [
    {
      id: 20,
      name: "Q12",
      event: { id: 1, name: "Cascade Signature Event", season: { id: 191, name: "High Stakes" } },
      alliances: {
        red: {
          score: 92,
          teams: [{ team: { number: "169A" } }, { team: { number: "4123B" } }],
        },
        blue: {
          score: 84,
          teams: [{ team: { number: "7K" } }, { team: { number: "9888X" } }],
        },
      },
    },
    {
      id: 21,
      name: "Q13",
      event: { id: 1, name: "Cascade Signature Event", season: { id: 191, name: "High Stakes" } },
      alliances: {
        red: {
          score: 76,
          teams: [{ team: { number: "111A" } }, { team: { number: "999Z" } }],
        },
        blue: {
          score: 76,
          teams: [{ team: { number: "169A" } }, { team: { number: "6008R" } }],
        },
      },
    },
    {
      id: 22,
      name: "Q14",
      event: { id: 2, name: "Washington State Championship", season: { id: 191, name: "High Stakes" } },
      alliances: {
        red: {
          score: 68,
          teams: [{ team: { number: "169A" } }, { team: { number: "2100J" } }],
        },
        blue: {
          score: 90,
          teams: [{ team: { number: "888G" } }, { team: { number: "3D" } }],
        },
      },
    },
  ],
  rankings: [
    {
      id: 31,
      rank: 3,
      wins: 8,
      losses: 1,
      ties: 1,
      wp: 17,
      event: { id: 1, name: "Cascade Signature Event", season: { id: 191, name: "High Stakes" } },
    },
    {
      id: 32,
      rank: 5,
      wins: 7,
      losses: 2,
      ties: 1,
      wp: 15,
      event: { id: 2, name: "Washington State Championship", season: { id: 191, name: "High Stakes" } },
    },
  ],
  skills: [
    {
      id: 41,
      type: { name: "Driver" },
      score: 74,
      rank: 29,
      event: { id: 2, name: "Washington State Championship", season: { id: 191, name: "High Stakes" } },
    },
    {
      id: 42,
      type: { name: "Programming" },
      score: 62,
      rank: 42,
      event: { id: 2, name: "Washington State Championship", season: { id: 191, name: "High Stakes" } },
    },
  ],
};

const setStatus = (message, state = "") => {
  if (!statusNode) {
    return;
  }
  statusNode.textContent = message;
  if (state) {
    statusNode.dataset.state = state;
  } else {
    delete statusNode.dataset.state;
  }
};

const toString = (value) =>
  value === undefined || value === null || value === "" ? "-" : String(value);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDate = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === "" || value === null || value === undefined) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== "" && entry !== null && entry !== undefined) {
          query.append(`${key}[]`, String(entry));
        }
      });
      return;
    }
    query.append(key, String(value));
  });
  return query.toString();
};

const proxyScoutUrl = (params) => {
  if (!configuredProxy) {
    return "";
  }
  const base = configuredProxy.endsWith("/") ? configuredProxy.slice(0, -1) : configuredProxy;
  const endpoint = base.endsWith(DEFAULT_PROXY_PATH) ? base : `${base}${DEFAULT_PROXY_PATH}`;
  const query = buildQuery(params);
  return `${endpoint}${query ? `?${query}` : ""}`;
};

const fetchScoutBundle = async ({ teamNumber, programId, seasonId }) => {
  const url = proxyScoutUrl({
    team: teamNumber,
    program: programId || "",
    season: seasonId || "",
  });

  if (!url) {
    throw new Error("Proxy URL missing");
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    mode: "cors",
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.error) {
        errorMessage = payload.error;
      }
    } catch (error) {
      // Keep fallback message.
    }
    throw new Error(errorMessage);
  }

  return response.json();
};

const checkProxyHealth = async () => {
  if (!configuredProxy) {
    return;
  }

  const base = configuredProxy.endsWith("/") ? configuredProxy.slice(0, -1) : configuredProxy;
  const healthUrl = base.endsWith("/api/health") ? base : `${base}/api/health`;

  try {
    const response = await fetch(healthUrl, {
      headers: { Accept: "application/json" },
      mode: "cors",
    });
    if (response.ok) {
      setStatus("Proxy connected. You can search teams now.", "success");
    } else {
      setStatus(`Proxy reachable but unhealthy (HTTP ${response.status}).`, "error");
    }
  } catch (error) {
    setStatus(
      "Cannot reach proxy URL. Verify js/scout-config.js and CORS allowlist in proxy/wrangler.toml.",
      "error"
    );
  }
};

const teamNumberEquals = (a, b) =>
  String(a || "")
    .trim()
    .toUpperCase() ===
  String(b || "")
    .trim()
    .toUpperCase();

const awardTitle = (award) =>
  award?.title || award?.name || award?.award?.title || award?.award?.name || "Unnamed Award";

const signalsWorldsQualification = (title) =>
  /(world\s*championship|worlds|qualif)/i.test(String(title || ""));

const textFromLocation = (item) => {
  const location = item?.location || item?.event?.location || {};
  const parts = [location.city, location.region, location.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "-";
};

const seasonFromItem = (item) => {
  const source = item?.season || item?.event?.season || null;
  if (!source) {
    return null;
  }
  if (typeof source === "string") {
    return { id: "", name: source };
  }
  if (typeof source === "number") {
    return { id: String(source), name: "" };
  }
  const id = source.id ?? source.season_id ?? "";
  const name = source.name || source.season_name || "";
  if (!id && !name) {
    return null;
  }
  return {
    id: id ? String(id) : "",
    name: name ? String(name) : "",
  };
};

const seasonKey = (info) => {
  if (!info) {
    return "";
  }
  if (info.id) {
    return `id:${info.id}`;
  }
  if (info.name) {
    return `name:${info.name.toLowerCase()}`;
  }
  return "";
};

const seasonLabel = (info) => {
  if (!info) {
    return "Unspecified";
  }
  if (info.name && info.id) {
    return `${info.name} (S${info.id})`;
  }
  if (info.name) {
    return info.name;
  }
  return `Season ${info.id}`;
};

const buildSeasonList = (collections) => {
  const map = new Map();
  collections.forEach((collection) => {
    collection.forEach((item) => {
      const info = seasonFromItem(item);
      const key = seasonKey(info);
      if (key && !map.has(key)) {
        map.set(key, { key, label: seasonLabel(info), id: info.id || "", name: info.name || "" });
      }
    });
  });

  const seasons = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  return [{ key: "all", label: "All seasons", id: "", name: "" }, ...seasons];
};

const getActiveSeasonLabel = () => {
  const found = scoutState.seasons.find((entry) => entry.key === scoutState.activeSeasonKey);
  return found ? found.label : "All seasons";
};

const matchesActiveSeason = (item) => {
  if (scoutState.activeSeasonKey === "all") {
    return true;
  }
  const info = seasonFromItem(item);
  const key = seasonKey(info);
  return key === scoutState.activeSeasonKey;
};

const getFilteredCollections = () => ({
  events: scoutState.events.filter(matchesActiveSeason),
  awards: scoutState.awards.filter(matchesActiveSeason),
  matches: scoutState.matches.filter(matchesActiveSeason),
  rankings: scoutState.rankings.filter(matchesActiveSeason),
  skills: scoutState.skills.filter(matchesActiveSeason),
});

const readAllianceTeams = (alliance) => {
  if (!alliance) {
    return [];
  }
  if (Array.isArray(alliance.teams)) {
    return alliance.teams
      .map((entry) =>
        entry?.team?.number || entry?.team_number || entry?.number || entry?.team?.name || ""
      )
      .filter(Boolean);
  }
  if (Array.isArray(alliance.team_numbers)) {
    return alliance.team_numbers.filter(Boolean);
  }
  return [];
};

const parseMatchForTeam = (match, teamNumber) => {
  const alliances = match?.alliances || {};
  const redAlliance = alliances.red || alliances["red"] || null;
  const blueAlliance = alliances.blue || alliances["blue"] || null;

  const redTeams = readAllianceTeams(redAlliance);
  const blueTeams = readAllianceTeams(blueAlliance);

  let side = null;
  if (redTeams.some((number) => teamNumberEquals(number, teamNumber))) {
    side = "red";
  } else if (blueTeams.some((number) => teamNumberEquals(number, teamNumber))) {
    side = "blue";
  }

  const redScore = toNumber(redAlliance?.score);
  const blueScore = toNumber(blueAlliance?.score);
  let outcome = "Unknown";

  if (side && redScore !== null && blueScore !== null) {
    if (redScore === blueScore) {
      outcome = "Tie";
    } else if ((side === "red" && redScore > blueScore) || (side === "blue" && blueScore > redScore)) {
      outcome = "Win";
    } else {
      outcome = "Loss";
    }
  }

  return {
    event: match?.event?.name || "-",
    matchName: match?.name || match?.match_name || `Match ${toString(match?.id)}`,
    side: side ? side.toUpperCase() : "-",
    score:
      redScore === null || blueScore === null
        ? "-"
        : side === "blue"
          ? `${blueScore}-${redScore}`
          : `${redScore}-${blueScore}`,
    outcome,
  };
};

const summarizeRecord = (parsedMatches) => {
  const summary = {
    wins: 0,
    losses: 0,
    ties: 0,
    total: 0,
  };

  parsedMatches.forEach((match) => {
    if (match.outcome === "Win") {
      summary.wins += 1;
      summary.total += 1;
    } else if (match.outcome === "Loss") {
      summary.losses += 1;
      summary.total += 1;
    } else if (match.outcome === "Tie") {
      summary.ties += 1;
      summary.total += 1;
    }
  });

  return summary;
};

const setRecordBar = (record) => {
  const denominator = Math.max(record.total, 1);
  const winsPercent = (record.wins / denominator) * 100;
  const lossesPercent = (record.losses / denominator) * 100;
  const tiesPercent = (record.ties / denominator) * 100;

  if (winsBar) {
    winsBar.style.width = `${winsPercent}%`;
  }
  if (lossesBar) {
    lossesBar.style.width = `${lossesPercent}%`;
  }
  if (tiesBar) {
    tiesBar.style.width = `${tiesPercent}%`;
  }
};

const createEmptyRow = (colspan, text = "No data available.") =>
  `<tr class="empty-row"><td colspan="${colspan}">${escapeHtml(text)}</td></tr>`;

const renderTable = (body, rowsHtml, colspan) => {
  if (!body) {
    return;
  }
  body.innerHTML = rowsHtml.length > 0 ? rowsHtml.join("") : createEmptyRow(colspan);
};

const renderSeasonFilters = () => {
  if (!seasonFilterNode) {
    return;
  }

  if (!scoutState.team) {
    seasonFilterNode.innerHTML = '<span class="scout-chip">Search a team to load seasons.</span>';
    return;
  }

  seasonFilterNode.innerHTML = scoutState.seasons
    .map((season) => {
      const activeClass = season.key === scoutState.activeSeasonKey ? "is-active" : "";
      return `<button class="scout-chip season-chip ${activeClass}" type="button" data-season-key="${escapeHtml(
        season.key
      )}">${escapeHtml(season.label)}</button>`;
    })
    .join("");
};

const renderProfile = () => {
  if (!profileNode) {
    return;
  }
  if (!scoutState.team) {
    profileNode.innerHTML = '<p class="empty-note">No team selected yet.</p>';
    return;
  }

  const team = scoutState.team;
  const collections = getFilteredCollections();
  const worldsAwardCount = collections.awards.filter((award) =>
    signalsWorldsQualification(awardTitle(award))
  ).length;

  const fields = [
    ["Team", toString(team.number)],
    ["Team Name", toString(team.team_name || team.name)],
    ["Robot Name", toString(team.robot_name)],
    ["Organization", toString(team.organization)],
    ["Grade", toString(team.grade)],
    ["Location", textFromLocation(team)],
    ["Worlds Signals", worldsAwardCount > 0 ? `${worldsAwardCount} found` : "None yet"],
  ];

  profileNode.innerHTML = fields
    .map(
      ([label, value]) =>
        `<div class="scout-list-item"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`
    )
    .join("");
};

const renderKpis = () => {
  const filtered = getFilteredCollections();
  const filteredRecord = summarizeRecord(
    filtered.matches.map((match) => parseMatchForTeam(match, scoutState.team?.number))
  );

  if (kpiCards.events) {
    kpiCards.events.textContent = String(filtered.events.length);
  }
  if (kpiCards.awards) {
    kpiCards.awards.textContent = String(filtered.awards.length);
  }
  if (kpiCards.record) {
    kpiCards.record.textContent = `${filteredRecord.wins}-${filteredRecord.losses}-${filteredRecord.ties}`;
  }

  const rankValues = filtered.skills
    .map((item) => toNumber(item?.rank || item?.world_rank || item?.skills_rank))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);

  if (kpiCards.skillsRank) {
    kpiCards.skillsRank.textContent = rankValues.length > 0 ? `#${rankValues[0]}` : "-";
  }
};

const renderEvents = () => {
  const collections = getFilteredCollections();
  const filtered = collections.events.filter((event) => {
    if (!eventsQualifiedOnly?.checked) {
      return true;
    }
    return scoutState.qualificationSignals.has(String(event?.id));
  });

  const rows = filtered
    .slice()
    .sort((a, b) => {
      const aDate = new Date(a?.start || a?.start_date || 0).getTime();
      const bDate = new Date(b?.start || b?.start_date || 0).getTime();
      return bDate - aDate;
    })
    .map((event) => {
      const isSignal = scoutState.qualificationSignals.has(String(event?.id));
      const location = textFromLocation(event);
      return `<tr>
        <td>${escapeHtml(event?.name || "Unnamed Event")}</td>
        <td>${escapeHtml(formatDate(event?.start || event?.start_date))}</td>
        <td>${escapeHtml(location)}</td>
        <td><span class="badge ${isSignal ? "good" : "dim"}">${isSignal ? "Signal" : "-"}</span></td>
      </tr>`;
    });

  renderTable(eventsBody, rows, 4);
};

const renderAwards = () => {
  if (!awardsNode) {
    return;
  }

  const collections = getFilteredCollections();
  const filtered = collections.awards.filter((award) => {
    if (!awardsQualifiedOnly?.checked) {
      return true;
    }
    return signalsWorldsQualification(awardTitle(award));
  });

  if (filtered.length === 0) {
    awardsNode.innerHTML = '<li class="scout-chip">No awards for this filter.</li>';
    return;
  }

  awardsNode.innerHTML = filtered
    .map((award) => {
      const title = awardTitle(award);
      const eventName = award?.event?.name || "Unknown event";
      const qualifies = signalsWorldsQualification(title);
      return `<li class="scout-chip ${qualifies ? "qualifies" : ""}"><strong>${escapeHtml(
        title
      )}</strong> <span>${escapeHtml(eventName)}</span></li>`;
    })
    .join("");
};

const renderMatches = () => {
  const collections = getFilteredCollections();
  const parsed = collections.matches.map((match) => parseMatchForTeam(match, scoutState.team?.number));
  const rows = parsed.map((entry) => {
    const badgeClass =
      entry.outcome === "Win" ? "good" : entry.outcome === "Loss" ? "warn" : "dim";
    return `<tr>
      <td>${escapeHtml(entry.event)}</td>
      <td>${escapeHtml(entry.matchName)}</td>
      <td>${escapeHtml(entry.side)}</td>
      <td>${escapeHtml(entry.score)}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(entry.outcome)}</span></td>
    </tr>`;
  });
  renderTable(matchesBody, rows, 5);
};

const renderRankings = () => {
  const collections = getFilteredCollections();
  const rows = collections.rankings.map((ranking) => {
    const rank = ranking?.rank ?? ranking?.position ?? "-";
    const wins = ranking?.wins ?? ranking?.record?.wins ?? 0;
    const losses = ranking?.losses ?? ranking?.record?.losses ?? 0;
    const ties = ranking?.ties ?? ranking?.record?.ties ?? 0;
    const score = ranking?.wp ?? ranking?.score ?? ranking?.ap ?? "-";
    return `<tr>
      <td>${escapeHtml(ranking?.event?.name || "-")}</td>
      <td>${escapeHtml(toString(rank))}</td>
      <td>${escapeHtml(`${wins}-${losses}-${ties}`)}</td>
      <td>${escapeHtml(toString(score))}</td>
    </tr>`;
  });

  renderTable(rankingsBody, rows, 4);
};

const renderSkills = () => {
  const collections = getFilteredCollections();
  const sorted = collections.skills
    .slice()
    .sort((a, b) => (toNumber(b?.score) || 0) - (toNumber(a?.score) || 0));

  const rows = sorted.map((skill) => {
    const type = skill?.type?.name || skill?.type || "Skill";
    const score = toString(skill?.score || skill?.value);
    const rank = toString(skill?.rank || skill?.world_rank || skill?.skills_rank);
    return `<tr>
      <td>${escapeHtml(type)}</td>
      <td>${escapeHtml(score)}</td>
      <td>${escapeHtml(rank)}</td>
      <td>${escapeHtml(skill?.event?.name || "-")}</td>
    </tr>`;
  });

  renderTable(skillsBody, rows, 4);
};

const renderInsights = () => {
  if (!insightsNode) {
    return;
  }

  if (!scoutState.team) {
    insightsNode.innerHTML = '<li class="empty-note">Insights will appear after search.</li>';
    return;
  }

  const notes = [];
  const collections = getFilteredCollections();
  const worldsSignals = collections.awards.filter((award) =>
    signalsWorldsQualification(awardTitle(award))
  ).length;

  if (worldsSignals > 0) {
    notes.push(`Worlds qualification signals found in ${worldsSignals} award(s).`);
  } else {
    notes.push("No explicit worlds-qualification award text found in current results.");
  }

  const filteredRecord = summarizeRecord(
    collections.matches.map((match) => parseMatchForTeam(match, scoutState.team?.number))
  );

  if (filteredRecord.total > 0) {
    const winRate = Math.round((filteredRecord.wins / filteredRecord.total) * 100);
    notes.push(`Match win rate: ${winRate}% across ${filteredRecord.total} scored matches.`);
  } else {
    notes.push("No scored matches available to compute W/L/T.");
  }

  const bestRank = collections.rankings
    .map((ranking) => toNumber(ranking?.rank || ranking?.position))
    .filter((value) => value !== null)
    .sort((a, b) => a - b)[0];

  if (bestRank !== undefined) {
    notes.push(`Best event ranking found: #${bestRank}.`);
  }

  const bestSkill = collections.skills
    .map((skill) => ({
      score: toNumber(skill?.score || skill?.value),
      type: skill?.type?.name || skill?.type || "Skill",
    }))
    .filter((item) => item.score !== null)
    .sort((a, b) => b.score - a.score)[0];

  if (bestSkill) {
    notes.push(`Highest ${bestSkill.type.toLowerCase()} score in results: ${bestSkill.score}.`);
  } else {
    notes.push("No skills runs available in current payload.");
  }

  notes.push("Qualification filter uses award-title heuristics. Verify in official event docs.");

  insightsNode.innerHTML = notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
};

const renderSummary = () => {
  if (!summaryNode) {
    return;
  }
  if (!scoutState.team) {
    summaryNode.textContent = "Search a team to populate scouting data.";
    return;
  }

  const collections = getFilteredCollections();
  const filteredRecord = summarizeRecord(
    collections.matches.map((match) => parseMatchForTeam(match, scoutState.team?.number))
  );
  summaryNode.textContent = `${scoutState.team.number} • ${collections.events.length} events • ${collections.awards.length} awards • record ${filteredRecord.wins}-${filteredRecord.losses}-${filteredRecord.ties} • ${getActiveSeasonLabel()}`;
};

const renderAll = () => {
  const collections = getFilteredCollections();
  const filteredRecord = summarizeRecord(
    collections.matches.map((match) => parseMatchForTeam(match, scoutState.team?.number))
  );
  renderSeasonFilters();
  renderSummary();
  renderKpis();
  renderProfile();
  renderEvents();
  renderAwards();
  renderMatches();
  renderRankings();
  renderSkills();
  renderInsights();
  setRecordBar(filteredRecord);
};

const clearState = () => {
  scoutState = {
    team: null,
    events: [],
    awards: [],
    matches: [],
    rankings: [],
    skills: [],
    record: { wins: 0, losses: 0, ties: 0, total: 0 },
    qualificationSignals: new Set(),
    seasons: [{ key: "all", label: "All seasons", id: "", name: "" }],
    activeSeasonKey: "all",
  };
  renderAll();
};

const readFavorites = () => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const writeFavorites = (items) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(items.slice(0, 12)));
};

const renderFavorites = () => {
  if (!favoritesNode) {
    return;
  }

  const favorites = readFavorites();
  if (favorites.length === 0) {
    favoritesNode.innerHTML = '<li class="scout-chip">No favorites saved yet.</li>';
    return;
  }

  favoritesNode.innerHTML = favorites
    .map((item, index) => {
      const seasonText = item.seasonId ? `S${item.seasonId}` : "all seasons";
      return `<li>
        <button class="scout-chip" type="button" data-fav-index="${index}">
          <strong>${escapeHtml(item.teamNumber)}</strong>
          <span>${escapeHtml(item.programLabel)} • ${escapeHtml(seasonText)}</span>
        </button>
      </li>`;
    })
    .join("");
};

const saveCurrentFavorite = () => {
  const teamNumber = teamInput?.value.trim().toUpperCase();
  if (!teamNumber) {
    setStatus("Enter a team number first.", "error");
    return;
  }

  const favorites = readFavorites();
  const programLabel =
    programInput?.selectedOptions?.[0]?.textContent?.trim() || "All programs";

  const existingIndex = favorites.findIndex(
    (entry) => entry.teamNumber === teamNumber && String(entry.programId) === String(programInput?.value || "")
  );

  const payload = {
    teamNumber,
    programId: programInput?.value || "",
    programLabel,
    seasonId: seasonInput?.value.trim() || "",
    savedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    favorites.splice(existingIndex, 1);
  }

  favorites.unshift(payload);
  writeFavorites(favorites);
  renderFavorites();
  setStatus(`Saved ${teamNumber} as a favorite.`, "success");
};

const applyFavorite = (index) => {
  const favorites = readFavorites();
  const chosen = favorites[index];
  if (!chosen) {
    return;
  }
  teamInput.value = chosen.teamNumber || "";
  programInput.value = chosen.programId || "";
  seasonInput.value = chosen.seasonId || "";
  setStatus(`Loaded favorite ${chosen.teamNumber}.`, "success");
};

const getSearchParams = () => {
  const teamNumber = teamInput?.value.trim().toUpperCase();
  const programId = programInput?.value || "";
  const seasonId = seasonInput?.value.trim() || "";
  return { teamNumber, programId, seasonId };
};

const applyBundle = ({ team, events, awards, matches, rankings, skills }) => {
  const parsedMatches = matches.map((match) => parseMatchForTeam(match, team?.number));
  const record = summarizeRecord(parsedMatches);
  const seasons = buildSeasonList([events, awards, matches, rankings, skills]);
  const typedSeasonId = seasonInput?.value.trim() || "";
  const preferredSeason = typedSeasonId
    ? seasons.find((entry) => entry.id && entry.id === typedSeasonId)
    : null;

  const signals = new Set();
  awards.forEach((award) => {
    const title = awardTitle(award);
    if (signalsWorldsQualification(title)) {
      const eventId = award?.event?.id;
      if (eventId !== undefined && eventId !== null) {
        signals.add(String(eventId));
      }
    }
  });

  scoutState = {
    team,
    events,
    awards,
    matches,
    rankings,
    skills,
    record,
    qualificationSignals: signals,
    seasons,
    activeSeasonKey: preferredSeason ? preferredSeason.key : "all",
  };

  renderAll();
};

const runSearch = async () => {
  const { teamNumber, programId, seasonId } = getSearchParams();

  if (!teamNumber) {
    setStatus("Enter a team number.", "error");
    return;
  }

  if (!configuredProxy) {
    setStatus("Proxy URL not configured. Set window.SCOUT_CONFIG.proxyBaseUrl in js/scout-config.js.", "error");
    return;
  }

  setStatus("Searching team and loading scouting data...", "");

  try {
    const bundle = await fetchScoutBundle({ teamNumber, programId, seasonId });
    const team = bundle?.team || null;
    if (!team) {
      clearState();
      setStatus(`No team found for ${teamNumber}.`, "error");
      return;
    }

    applyBundle({
      team,
      events: Array.isArray(bundle.events) ? bundle.events : [],
      awards: Array.isArray(bundle.awards) ? bundle.awards : [],
      matches: Array.isArray(bundle.matches) ? bundle.matches : [],
      rankings: Array.isArray(bundle.rankings) ? bundle.rankings : [],
      skills: Array.isArray(bundle.skills) ? bundle.skills : [],
    });

    if (Array.isArray(bundle.warnings) && bundle.warnings.length > 0) {
      setStatus(
        `Loaded ${team.number}. Some endpoints were unavailable: ${bundle.warnings.join(" ")}`,
        "error"
      );
    } else {
      setStatus(`Loaded scouting profile for ${team.number}.`, "success");
    }
  } catch (error) {
    clearState();
    const likelyCors = /Failed to fetch/i.test(error.message || "");
    if (likelyCors) {
      setStatus(
        "Request blocked. Verify proxy URL and CORS allowlist.",
        "error"
      );
      return;
    }
    setStatus(`Search failed: ${error.message}`, "error");
  }
};

const loadDemo = () => {
  applyBundle(demoBundle);
  setStatus("Demo data loaded. Configure proxy to query live data.", "success");
};

const attachEvents = () => {
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await runSearch();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      clearState();
      setStatus("Cleared scouting output.", "");
    });
  }

  if (demoButton) {
    demoButton.addEventListener("click", loadDemo);
  }

  if (saveFavoriteButton) {
    saveFavoriteButton.addEventListener("click", saveCurrentFavorite);
  }

  if (favoritesNode) {
    favoritesNode.addEventListener("click", (event) => {
      const target = event.target.closest("[data-fav-index]");
      if (!target) {
        return;
      }
      applyFavorite(Number(target.dataset.favIndex));
    });
  }

  if (eventsQualifiedOnly) {
    eventsQualifiedOnly.addEventListener("change", renderEvents);
  }

  if (awardsQualifiedOnly) {
    awardsQualifiedOnly.addEventListener("change", renderAwards);
  }

  if (seasonFilterNode) {
    seasonFilterNode.addEventListener("click", (event) => {
      const target = event.target.closest("[data-season-key]");
      if (!target) {
        return;
      }
      const nextKey = target.dataset.seasonKey || "all";
      scoutState.activeSeasonKey = nextKey;
      renderAll();
    });
  }
};

const initCursorGlow = () => {
  const glow = document.querySelector(".cursor-glow");
  if (!glow) {
    return;
  }

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  const update = () => {
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;
    glow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(update);
  };

  update();

  window.addEventListener("mousemove", (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
  });

  window.addEventListener("touchstart", () => {
    glow.style.display = "none";
  });
};

const initParallax = () => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  if (window.matchMedia("(max-width: 700px)").matches) {
    return;
  }

  const items = Array.from(document.querySelectorAll("[data-parallax]"));
  if (items.length === 0) {
    return;
  }

  let ticking = false;

  const update = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    document.documentElement.style.setProperty("--scroll-y", `${scrollY}px`);
    items.forEach((item) => {
      const speed = Number.parseFloat(item.dataset.parallax) || 0;
      const offset = scrollY * speed * -1;
      item.style.transform = `translate3d(0, ${offset}px, 0)`;
    });
    ticking = false;
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
};

const initReveal = () => {
  const items = document.querySelectorAll(
    ".hero-copy, .hero-panel, .section-head, .card, .utility-card, .cta-card, .favorites-block"
  );
  if (items.length === 0) {
    return;
  }

  items.forEach((item) => item.classList.add("reveal"));

  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  items.forEach((item) => observer.observe(item));
};

const init = () => {
  attachEvents();
  renderFavorites();
  clearState();
  if (!configuredProxy) {
    setStatus("Set window.SCOUT_CONFIG.proxyBaseUrl in js/scout-config.js before live search.", "error");
  } else {
    checkProxyHealth();
  }
  initCursorGlow();
  initParallax();
  initReveal();
};

init();
