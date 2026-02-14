const ROBOTEVENTS_BASE = "https://www.robotevents.com/api/v2";
const TEAM_NUMBER_REGEX = /^[A-Za-z0-9-]{1,12}$/;

const jsonResponse = (payload, status, corsHeaders) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
      ...corsHeaders,
    },
  });

const parseAllowlist = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const corsFor = (request, env) => {
  const origin = request.headers.get("Origin") || "";
  const allowlist = parseAllowlist(env.ALLOWED_ORIGINS || "*");

  if (allowlist.includes("*")) {
    return { "Access-Control-Allow-Origin": "*" };
  }

  if (origin && allowlist.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    };
  }

  return {};
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && entry !== "") {
          query.append(`${key}[]`, String(entry));
        }
      });
      return;
    }
    query.append(key, String(value));
  });
  return query.toString();
};

const fetchJson = async (path, token, params = {}) => {
  const query = buildQuery(params);
  const url = `${ROBOTEVENTS_BASE}${path}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`RobotEvents ${path} failed (${response.status})`);
  }

  return response.json();
};

const requestCollection = async (path, token, params = {}, maxPages = 3) => {
  const first = await fetchJson(path, token, { ...params, page: 1, per_page: 250 });
  const firstData = Array.isArray(first?.data) ? first.data : [];
  const lastPage = Math.min(Number(first?.meta?.last_page || 1), maxPages);

  if (lastPage <= 1) {
    return firstData;
  }

  const rest = [];
  for (let page = 2; page <= lastPage; page += 1) {
    const payload = await fetchJson(path, token, { ...params, page, per_page: 250 });
    if (Array.isArray(payload?.data)) {
      rest.push(...payload.data);
    }
  }

  return [...firstData, ...rest];
};

const teamNumberEquals = (a, b) =>
  String(a || "")
    .trim()
    .toUpperCase() ===
  String(b || "")
    .trim()
    .toUpperCase();

const findTeam = async ({ token, teamNumber, programId, seasonId }) => {
  const params = { number: [teamNumber] };
  if (programId) {
    params.program = [programId];
  }
  if (seasonId) {
    params.season = [seasonId];
  }

  const teams = await requestCollection("/teams", token, params, 1);
  if (teams.length === 0) {
    return null;
  }

  const exact = teams.find((entry) => teamNumberEquals(entry?.number, teamNumber));
  return exact || teams[0];
};

const validateInput = ({ teamNumber, programId, seasonId }) => {
  if (!teamNumber || !TEAM_NUMBER_REGEX.test(teamNumber)) {
    return "Invalid team number.";
  }
  if (programId && !/^\d+$/.test(programId)) {
    return "Invalid program id.";
  }
  if (seasonId && !/^\d+$/.test(seasonId)) {
    return "Invalid season id.";
  }
  return "";
};

const parsePositiveInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const fetchSkillsPage = async ({ token, programId, seasonId, page, perPage }) => {
  const params = {
    page,
    per_page: perPage,
  };

  if (programId) {
    params.program = [programId];
  }
  if (seasonId) {
    params.season = [seasonId];
  }

  return fetchJson("/skills", token, params);
};

const listSeasons = async ({ token, programId }) => {
  const params = {};
  if (programId) {
    params.program = [programId];
  }
  const seasons = await requestCollection("/seasons", token, params, 2);
  return seasons;
};

const buildScoutPayload = async ({ token, teamNumber, programId, seasonId }) => {
  const team = await findTeam({ token, teamNumber, programId, seasonId });

  if (!team) {
    return {
      team: null,
      events: [],
      awards: [],
      matches: [],
      rankings: [],
      skills: [],
      warnings: [],
    };
  }

  const warnings = [];
  const params = seasonId ? { season: [seasonId] } : {};

  const safeLoad = async (label, path, maxPages = 3) => {
    try {
      return await requestCollection(path, token, params, maxPages);
    } catch (error) {
      warnings.push(`${label} unavailable (${error.message}).`);
      return [];
    }
  };

  const [events, awards, matches, rankings, skills] = await Promise.all([
    safeLoad("Events", `/teams/${team.id}/events`, 4),
    safeLoad("Awards", `/teams/${team.id}/awards`, 4),
    safeLoad("Matches", `/teams/${team.id}/matches`, 4),
    safeLoad("Rankings", `/teams/${team.id}/rankings`, 3),
    safeLoad("Skills", `/teams/${team.id}/skills`, 3),
  ]);

  return {
    team,
    events,
    awards,
    matches,
    rankings,
    skills,
    warnings,
  };
};

export default {
  async fetch(request, env) {
    const corsHeaders = corsFor(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return jsonResponse({}, 204, corsHeaders);
    }

    if (url.pathname === "/api/health") {
      return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    const token = env.ROBOTEVENTS_TOKEN;
    if (!token) {
      return jsonResponse({ error: "Server is missing ROBOTEVENTS_TOKEN secret." }, 500, corsHeaders);
    }

    if (url.pathname === "/api/seasons") {
      const programId = (url.searchParams.get("program") || "").trim();
      if (programId && !/^\d+$/.test(programId)) {
        return jsonResponse({ error: "Invalid program id." }, 400, corsHeaders);
      }
      try {
        const data = await listSeasons({ token, programId });
        return jsonResponse({ data }, 200, corsHeaders);
      } catch (error) {
        return jsonResponse(
          {
            error: "Failed to load seasons.",
            detail: error.message,
          },
          502,
          corsHeaders
        );
      }
    }

    if (url.pathname === "/api/skills") {
      const programId = (url.searchParams.get("program") || "").trim();
      const seasonId = (url.searchParams.get("season") || "").trim();

      if (programId && !/^\d+$/.test(programId)) {
        return jsonResponse({ error: "Invalid program id." }, 400, corsHeaders);
      }
      if (seasonId && !/^\d+$/.test(seasonId)) {
        return jsonResponse({ error: "Invalid season id." }, 400, corsHeaders);
      }

      const page = parsePositiveInt(url.searchParams.get("page"), 1, 1, 200);
      const perPage = parsePositiveInt(url.searchParams.get("per_page"), 50, 1, 100);

      try {
        const payload = await fetchSkillsPage({
          token,
          programId,
          seasonId,
          page,
          perPage,
        });
        return jsonResponse(payload, 200, corsHeaders);
      } catch (error) {
        return jsonResponse(
          {
            error: "Failed to load skills list.",
            detail: error.message,
          },
          502,
          corsHeaders
        );
      }
    }

    if (url.pathname !== "/api/scout") {
      return jsonResponse({ error: "Not found." }, 404, corsHeaders);
    }

    const teamNumber = (url.searchParams.get("team") || "").trim().toUpperCase();
    const programId = (url.searchParams.get("program") || "").trim();
    const seasonId = (url.searchParams.get("season") || "").trim();

    const validationError = validateInput({ teamNumber, programId, seasonId });
    if (validationError) {
      return jsonResponse({ error: validationError }, 400, corsHeaders);
    }

    try {
      const payload = await buildScoutPayload({
        token,
        teamNumber,
        programId,
        seasonId,
      });
      return jsonResponse(payload, 200, corsHeaders);
    } catch (error) {
      return jsonResponse(
        {
          error: "Failed to load RobotEvents data through proxy.",
          detail: error.message,
        },
        502,
        corsHeaders
      );
    }
  },
};
