const DEFAULT_PROXY_SKILLS_PATH = "/api/skills";
const DEFAULT_PROXY_SEASONS_PATH = "/api/seasons";

const configuredProxy = window.SCOUT_CONFIG?.proxyBaseUrl
  ? String(window.SCOUT_CONFIG.proxyBaseUrl).trim()
  : "";

const form = document.getElementById("skills-form");
const programSelect = document.getElementById("skills-program");
const seasonSelect = document.getElementById("skills-season");
const teamSearchInput = document.getElementById("skills-team-search");
const perPageSelect = document.getElementById("skills-per-page");
const statusNode = document.getElementById("skills-status");
const summaryNode = document.getElementById("skills-summary");
const pageLabelNode = document.getElementById("skills-page-label");
const refreshButton = document.getElementById("skills-refresh");
const prevButton = document.getElementById("skills-prev");
const nextButton = document.getElementById("skills-next");

const tableBody = document.querySelector("#skills-table-all tbody");
const kpiRows = document.getElementById("skills-kpi-rows");
const kpiBest = document.getElementById("skills-kpi-best");
const kpiRank = document.getElementById("skills-kpi-rank");
const kpiTotal = document.getElementById("skills-kpi-total");

const state = {
  page: 1,
  lastPage: 1,
  perPage: 50,
  total: 0,
  rows: [],
  loaded: false,
};

const setStatus = (message, level = "") => {
  if (!statusNode) {
    return;
  }
  statusNode.textContent = message;
  if (level) {
    statusNode.dataset.state = level;
  } else {
    delete statusNode.dataset.state;
  }
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toText = (value) =>
  value === undefined || value === null || value === "" ? "-" : String(value);

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === "" || value === null || value === undefined) {
      return;
    }
    query.append(key, String(value));
  });
  return query.toString();
};

const proxyUrl = (path, params = {}) => {
  if (!configuredProxy) {
    return "";
  }
  const base = configuredProxy.endsWith("/") ? configuredProxy.slice(0, -1) : configuredProxy;
  const endpoint = base.endsWith(path) ? base : `${base}${path}`;
  const query = buildQuery(params);
  return `${endpoint}${query ? `?${query}` : ""}`;
};

const fetchJson = async (path, params = {}) => {
  const url = proxyUrl(path, params);
  if (!url) {
    throw new Error("Proxy URL missing");
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    mode: "cors",
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.error) {
        message = payload.error;
      }
    } catch (error) {
      // keep fallback
    }
    throw new Error(message);
  }

  return response.json();
};

const rowRank = (row) =>
  toText(row?.rank ?? row?.world_rank ?? row?.skills_rank ?? row?.season_rank);

const rowType = (row) => toText(row?.type?.name || row?.type || row?.run_type);
const rowScore = (row) => toText(row?.score ?? row?.value ?? row?.combined_score);
const rowTeamNumber = (row) =>
  toText(row?.team?.number || row?.team_number || row?.team?.name);
const rowTeamName = (row) => toText(row?.team?.team_name || row?.team_name || row?.team?.name);
const rowEvent = (row) => toText(row?.event?.name || row?.event_name);
const rowSeason = (row) =>
  toText(row?.season?.name || row?.event?.season?.name || row?.season_name);

const applyTeamSearch = (rows) => {
  const term = (teamSearchInput?.value || "").trim().toUpperCase();
  if (!term) {
    return rows;
  }
  return rows.filter((row) => {
    const number = rowTeamNumber(row).toUpperCase();
    const name = rowTeamName(row).toUpperCase();
    return number.includes(term) || name.includes(term);
  });
};

const renderTable = () => {
  if (!tableBody) {
    return;
  }

  const rows = applyTeamSearch(state.rows);
  if (rows.length === 0) {
    tableBody.innerHTML = '<tr class="empty-row"><td colspan="7">No skills runs found for this filter.</td></tr>';
    return;
  }

  tableBody.innerHTML = rows
    .map((row) => {
      const rank = rowRank(row);
      return `<tr>
        <td><span class="rank-chip">${escapeHtml(rank)}</span></td>
        <td>${escapeHtml(rowTeamNumber(row))}</td>
        <td>${escapeHtml(rowTeamName(row))}</td>
        <td>${escapeHtml(rowType(row))}</td>
        <td>${escapeHtml(rowScore(row))}</td>
        <td>${escapeHtml(rowEvent(row))}</td>
        <td>${escapeHtml(rowSeason(row))}</td>
      </tr>`;
    })
    .join("");
};

const renderKpis = () => {
  const rows = applyTeamSearch(state.rows);
  const scores = rows.map((row) => toNumber(row?.score ?? row?.value ?? row?.combined_score)).filter((x) => x !== null);
  const ranks = rows
    .map((row) => toNumber(row?.rank ?? row?.world_rank ?? row?.skills_rank ?? row?.season_rank))
    .filter((x) => x !== null)
    .sort((a, b) => a - b);

  if (kpiRows) {
    kpiRows.textContent = String(rows.length);
  }
  if (kpiBest) {
    kpiBest.textContent = scores.length > 0 ? String(Math.max(...scores)) : "-";
  }
  if (kpiRank) {
    kpiRank.textContent = ranks.length > 0 ? `#${ranks[0]}` : "-";
  }
  if (kpiTotal) {
    kpiTotal.textContent = state.total > 0 ? String(state.total) : "-";
  }
};

const renderPager = () => {
  if (pageLabelNode) {
    pageLabelNode.textContent = `Page ${state.page} of ${state.lastPage}`;
  }
  if (prevButton) {
    prevButton.disabled = state.page <= 1;
  }
  if (nextButton) {
    nextButton.disabled = state.page >= state.lastPage;
  }
};

const renderSummary = () => {
  if (!summaryNode) {
    return;
  }
  if (!state.loaded) {
    summaryNode.textContent = "Load data to view rankings.";
    return;
  }
  summaryNode.textContent = `${state.rows.length} rows on current page • ${state.total} total entries`;
};

const renderAll = () => {
  renderSummary();
  renderTable();
  renderKpis();
  renderPager();
};

const loadSeasons = async () => {
  if (!seasonSelect) {
    return;
  }

  const selected = seasonSelect.value;
  seasonSelect.innerHTML = '<option value="">All seasons</option>';

  if (!configuredProxy) {
    return;
  }

  try {
    const payload = await fetchJson(DEFAULT_PROXY_SEASONS_PATH, {
      program: programSelect?.value || "",
    });
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    rows.forEach((season) => {
      const id = season?.id ?? season?.season_id;
      const name = season?.name || season?.season_name || `Season ${id}`;
      if (!id) {
        return;
      }
      const option = document.createElement("option");
      option.value = String(id);
      option.textContent = `${name} (S${id})`;
      seasonSelect.append(option);
    });

    if (selected) {
      seasonSelect.value = selected;
    }
  } catch (error) {
    setStatus(`Seasons list unavailable: ${error.message}`, "error");
  }
};

const loadSkills = async () => {
  if (!configuredProxy) {
    setStatus("Proxy URL not configured. Set js/scout-config.js first.", "error");
    return;
  }

  setStatus("Loading skills rankings...", "");

  try {
    const payload = await fetchJson(DEFAULT_PROXY_SKILLS_PATH, {
      page: state.page,
      per_page: perPageSelect?.value || state.perPage,
      program: programSelect?.value || "",
      season: seasonSelect?.value || "",
    });

    state.rows = Array.isArray(payload?.data) ? payload.data : [];
    state.total = toNumber(payload?.meta?.total) || state.rows.length;
    state.page = toNumber(payload?.meta?.current_page) || state.page;
    state.lastPage = Math.max(toNumber(payload?.meta?.last_page) || 1, 1);
    state.perPage = toNumber(payload?.meta?.per_page) || toNumber(perPageSelect?.value) || 50;
    state.loaded = true;

    setStatus("Skills board loaded.", "success");
    renderAll();
  } catch (error) {
    state.rows = [];
    state.total = 0;
    state.lastPage = 1;
    state.loaded = true;
    setStatus(`Load failed: ${error.message}`, "error");
    renderAll();
  }
};

const checkProxy = async () => {
  if (!configuredProxy) {
    setStatus("Set window.SCOUT_CONFIG.proxyBaseUrl in js/scout-config.js.", "error");
    return;
  }

  try {
    const base = configuredProxy.endsWith("/") ? configuredProxy.slice(0, -1) : configuredProxy;
    const healthUrl = base.endsWith("/api/health") ? base : `${base}/api/health`;
    const response = await fetch(healthUrl, {
      headers: { Accept: "application/json" },
      mode: "cors",
    });

    if (response.ok) {
      setStatus("Proxy connected.", "success");
    } else {
      setStatus(`Proxy check failed (HTTP ${response.status}).`, "error");
    }
  } catch (error) {
    setStatus("Cannot reach proxy URL.", "error");
  }
};

const attachEvents = () => {
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.page = 1;
      await loadSkills();
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await loadSkills();
    });
  }

  if (prevButton) {
    prevButton.addEventListener("click", async () => {
      if (state.page <= 1) {
        return;
      }
      state.page -= 1;
      await loadSkills();
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", async () => {
      if (state.page >= state.lastPage) {
        return;
      }
      state.page += 1;
      await loadSkills();
    });
  }

  if (teamSearchInput) {
    teamSearchInput.addEventListener("input", () => {
      renderAll();
    });
  }

  if (programSelect) {
    programSelect.addEventListener("change", async () => {
      await loadSeasons();
    });
  }

  if (perPageSelect) {
    perPageSelect.addEventListener("change", () => {
      state.page = 1;
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
    ".hero-copy, .hero-panel, .section-head, .card, .utility-card"
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

const init = async () => {
  attachEvents();
  renderAll();
  await checkProxy();
  await loadSeasons();
  initCursorGlow();
  initParallax();
  initReveal();
};

init();
