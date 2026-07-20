(() => {
  const D = window.PC_DATA || { tiendas: [], producto: {} };
  const $ = id => document.getElementById(id);

  const money = n => new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0
  }).format(Number(n || 0));

  const moneyExact = n => new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Number(n || 0));

  const num = (n, d = 0) => new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: d
  }).format(Number(n || 0));

  const pct = n => `${num((n || 0) * 100, 1)}%`;

  const ICONS = {
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
    pulse:'<path d="M3 12h4l2.2-5 4.1 10 2.3-5H21"/>',
    bolt:'<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>',
    store:'<path d="M4 10v10h16V10"/><path d="M3 4h18l-2 6H5z"/><path d="M8 20v-6h8v6"/>',
    logout:'<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 4h6v16h-6"/>',
    spark:'<path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>',
    filter:'<path d="M4 5h16"/><path d="M7 12h10"/><path d="M10 19h4"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4V2M20 12h2"/>',
    focus:'<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/><circle cx="12" cy="12" r="3"/>',
    boxes:'<path d="m4 7 8-4 8 4-8 4z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    history:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/>'
  };

  function svg(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }

  document.querySelectorAll("[data-icon]").forEach(el => {
    el.innerHTML = svg(el.dataset.icon);
  });

  const users = {
    ventas: { pass: "ventas26", name: "Dirección", role: "Dirección", access: "all" },
    omar: { pass: "omar26", name: "Omar", role: "Supervisor", supervisor: "Omar" },
    alicia: { pass: "alicia26", name: "Alicia", role: "Supervisora", supervisor: "Alicia" },
    erick: { pass: "erick26", name: "Erick", role: "Supervisor", supervisor: "Erick" }
  };

  const state = {
    user: null,
    base: [],
    scope: [],
    view: [],
    metricMode: "money"
  };

  const statusLabel = s =>
    s === "en_ritmo" ? "En ritmo" :
    s === "recuperable" ? "Recuperable" : "Crítica";

  const statusFromTrajectory = value =>
    value >= 1 ? "en_ritmo" :
    value >= 0.85 ? "recuperable" : "critica";

  function productPrice(row) {
    return Number(row.precio || D.producto.precioReferencia || 20);
  }

  function remainingValue(row) {
    return Math.max(0, Number(row.metaTotalJulio || 0) - Number(row.ventaActual || 0));
  }

  function remainingPieces(row) {
    return Math.ceil(remainingValue(row) / Math.max(0.01, productPrice(row)));
  }

  function requiredPiecesDaily(row) {
    return Math.ceil(Number(row.metaDiariaDesdeHoy || 0) / Math.max(0.01, productPrice(row)));
  }
  function preImpulseDaily(row) {
    return Number(row.julio15 || 0) / 15;
  }

  function preImpulsePiecesDaily(row) {
    return preImpulseDaily(row) / Math.max(0.01, productPrice(row));
  }

  function campaignDailyRow(row) {
    return Number(row.ritmoCampana || 0);
  }

  function paceChange(current, previous) {
    if (!previous) return 0;
    return (Number(current || 0) / Number(previous)) - 1;
  }

  function paceChangeLabel(current, previous) {
    const change = paceChange(current, previous);
    if (Math.abs(change) < 0.005) return "sin cambio";
    return change > 0
      ? `↑ ${num(change * 100, 1)}% vs antes`
      : `↓ ${num(Math.abs(change) * 100, 1)}% vs antes`;
  }


  function roundedMoney(value) {
    return money(Math.round(Number(value || 0)));
  }

  function valueAsPieces(value, row) {
    return Math.ceil(Number(value || 0) / Math.max(0.01, productPrice(row)));
  }

  function formatMetric(value, row = null) {
    if (state.metricMode === "pieces") {
      const pieces = row ? valueAsPieces(value, row) : Math.round(Number(value || 0));
      return `${num(pieces)} pzas`;
    }
    return roundedMoney(value);
  }

  function metricWord() {
    return state.metricMode === "pieces" ? "piezas" : "dinero";
  }

  function deltaFromExpected(value) {
    const delta = Number(value || 0) - 1;
    const abs = Math.abs(delta);
    if (Math.abs(delta) < 0.001) {
      return { text: "En línea", cls: "neutral", symbol: "•" };
    }
    if (delta > 0) {
      return { text: `${num(abs * 100, 1)}% sobre`, cls: "positive", symbol: "↑" };
    }
    return {
      text: `${num(abs * 100, 1)}% bajo`,
      cls: value >= 0.85 ? "warning" : "negative",
      symbol: "↓"
    };
  }

  function trajectoryBadge(value, suffix = "lo esperado") {
    const d = deltaFromExpected(value);
    return `<span class="delta-read ${d.cls}"><b>${d.symbol}</b>${d.text} ${suffix}</span>`;
  }

  function setMetricMode(mode) {
    state.metricMode = mode;
    document.querySelectorAll("[data-metric-mode]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.metricMode === mode);
    });
    $("thActual").textContent = mode === "pieces" ? "Piezas actuales" : "Venta actual";
    $("thExpected").textContent = mode === "pieces" ? "Piezas esperadas" : "Esperado corte";
    $("thGoal").textContent = mode === "pieces" ? "Meta en piezas" : "Meta final";
    $("thGap").textContent = mode === "pieces" ? "Piezas faltantes" : "Faltante";
    $("thDaily").textContent = mode === "pieces" ? "Piezas/día" : "Requerido/día";
    render();
  }

  function login(username, password) {
    const key = String(username || "").trim().toLowerCase();
    const user = users[key];
    if (!user || user.pass !== password) return false;
    state.user = { key, ...user };
    sessionStorage.setItem("pc_user", key);
    return true;
  }

  function setAccess() {
    state.base = (D.tiendas || []).filter(row =>
      state.user.access === "all" || row.supervisor === state.user.supervisor
    );
  }

  function populateFilters() {
    const supervisors = [...new Set(state.base.map(r => r.supervisor))].sort();

    $("scopeSupervisor").innerHTML =
      '<option value="all">Vista general</option>' +
      supervisors.map(x => `<option value="${x}">${x}</option>`).join("");

    $("scopeControl").classList.toggle("hidden", state.user.access !== "all");
    refreshChannelOptions();
    syncMobileFilters();
  }

  function supervisorScopeRows() {
    if (state.user.access !== "all") return state.base;
    const supervisor = $("scopeSupervisor").value;
    return supervisor === "all"
      ? state.base
      : state.base.filter(row => row.supervisor === supervisor);
  }

  function refreshChannelOptions() {
    const previous = $("channelFilter").value || "all";
    const channels = [...new Set(supervisorScopeRows().map(r => r.canal))].sort();

    $("channelFilter").innerHTML =
      '<option value="all">Todos los canales</option>' +
      channels.map(x => `<option>${x}</option>`).join("");

    $("channelFilter").value = channels.includes(previous) ? previous : "all";
  }

  function setProductLabels() {
    const description = D.producto?.descripcion || "Botanas Riquísimos surtido grande 1 pz";
    const shortName = description.replace(/\s+1\s*pz$/i, "").trim();
    if ($("loginProductName")) $("loginProductName").textContent = shortName;
    if ($("headerProductName")) $("headerProductName").textContent = description;
  }

  function showApp() {
    setAccess();
    setProductLabels();
    $("login").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("userAvatar").textContent = state.user.name[0];
    $("freshness").textContent =
      `Corte ${D.actualizado} · ${D.diasRestantes} días para cierre`;
    populateFilters();
    applyFilters(false);
  }

  function syncMobileFilters() {
    const box = document.querySelector(".sheet-fields");
    if (!box) return;
    box.innerHTML = "";

    ["channelFilter", "statusFilter"].forEach(id => {
      const original = $(id);
      if (getComputedStyle(original).display === "none") return;
      const clone = original.cloneNode(true);
      clone.id = `mobile_${id}`;
      clone.value = original.value;
      box.appendChild(clone);
    });
  }

  function activeFilterCount() {
    return [
      $("channelFilter").value,
      $("statusFilter").value
    ].filter(value => value && value !== "all").length;
  }

  function detailScopeText() {
    const parts = [];
    const channel = $("channelFilter").value;
    const status = $("statusFilter").value;

    if (channel !== "all") parts.push(channel);
    if (status !== "all") parts.push(statusLabel(status));

    return parts.length ? parts.join(" · ") : "Todas las tiendas";
  }

  function executiveScopeRows() {
    const channel = $("channelFilter").value;
    return supervisorScopeRows().filter(row =>
      channel === "all" || row.canal === channel
    );
  }

  function updateExecutiveTitle() {
    const channel = $("channelFilter").value;
    const channelLabel = channel === "all" ? "" : ` · ${channel}`;

    if (state.user.access !== "all") {
      $("pageTitle").textContent = `Mi vista · ${state.user.name}${channelLabel}`;
      return;
    }

    const supervisor = $("scopeSupervisor").value;
    const baseTitle =
      supervisor === "all" ? "Vista general" : `Vista ejecutiva · ${supervisor}`;

    $("pageTitle").textContent = `${baseTitle}${channelLabel}`;
  }

  function applyFilters(navigateToDetail = false) {
    const status = $("statusFilter").value;
    const query = ($("search").value || "").toLowerCase();

    // Supervisor + canal definen la vista ejecutiva y recalculan todos los KPIs.
    state.scope = executiveScopeRows();

    // Estado y búsqueda sólo refinan las tiendas y acciones.
    state.view = state.scope.filter(row =>
      (status === "all" || row.estatus === status) &&
      (!query || row.tienda.toLowerCase().includes(query))
    );

    updateExecutiveTitle();
    $("activeFilters").textContent = activeFilterCount();
    $("detailScope").textContent = detailScopeText();

    render();

    if (navigateToDetail) {
      window.setTimeout(() => {
        $("tiendas").scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveNav("tiendas");
      }, 80);
    }
  }

  function agg(rows, objectiveOnly = true) {
    const filteredRows = objectiveOnly
      ? rows.filter(r => r.canal !== "AUTOSERVICIO")
      : rows;

    return filteredRows.reduce((a, row) => {
      a.venta += Number(row.ventaActual || 0);
      a.meta += Number(row.metaTotalJulio || 0);
      a.esperado += Number(row.esperadoCorte || 0);
      a.proy += Number(row.proyeccionCierre || 0);
      a.util += Number(row.utilidad || 0);
      a.pzas += Number(row.cantidad || 0);
      a.stock += Number(row.existencia || 0);
      a.camp += Number(row.ventaCampana || 0);
      a.req += Number(row.metaDiariaDesdeHoy || 0);
      a.gap += remainingValue(row);
      a.stockRisk += Number(row.brechaStock || 0) < 0 ? 1 : 0;
      a[row.estatus] += 1;
      return a;
    }, {
      venta: 0, meta: 0, esperado: 0, proy: 0, util: 0, pzas: 0,
      stock: 0, camp: 0, req: 0, gap: 0, stockRisk: 0,
      en_ritmo: 0, recuperable: 0, critica: 0
    });
  }

  function render() {
    // Los KPIs usan supervisor + canal seleccionados.
    const selectedChannel = $("channelFilter").value;
    const includeNonIncremental = selectedChannel === "AUTOSERVICIO";
    const global = agg(state.scope, !includeNonIncremental);
    const advance = global.meta ? global.venta / global.meta : 0;
    const trajectory = global.esperado ? global.venta / global.esperado : 0;
    const projection = global.meta ? global.proy / global.meta : 0;
    const campaignDaily = global.camp / Math.max(1, D.diasCampanaTranscurridos);
    const objectiveScope = includeNonIncremental
      ? state.scope
      : state.scope.filter(r => r.canal !== "AUTOSERVICIO");
    const beforeImpulseDaily = objectiveScope.reduce(
      (sum, row) => sum + preImpulseDaily(row), 0
    );
    const beforeImpulsePieces = objectiveScope.reduce(
      (sum, row) => sum + preImpulsePiecesDaily(row), 0
    );
    const paceUplift = paceChange(campaignDaily, beforeImpulseDaily);
    const dailyDelta = Math.max(0, global.req - campaignDaily);
    const globalStatus = statusFromTrajectory(trajectory);

    const objectiveRows = includeNonIncremental
      ? state.scope
      : state.scope.filter(r => r.canal !== "AUTOSERVICIO");
    const totalGap = objectiveRows.reduce((sum, r) => sum + remainingValue(r), 0);
    const topGap = [...objectiveRows]
      .sort((a, b) => remainingValue(b) - remainingValue(a))
      .slice(0, 5)
      .reduce((sum, r) => sum + remainingValue(r), 0);
    const concentration = totalGap ? topGap / totalGap : 0;

    $("heroPct").textContent = pct(advance);
    $("heroBar").className = `status-fill ${globalStatus}`;
    $("heroBar").style.width = `${Math.min(100, advance * 100)}%`;
    $("expectedMark").style.left =
      `${Math.min(100, global.meta ? (global.esperado / global.meta) * 100 : 0)}%`;

    $("heroProjection").textContent =
      `Proyección ${money(global.proy)} · ${pct(projection)} de la meta final`;
    $("heroExpected").textContent =
      `Esperado al corte ${money(global.esperado)} · trayectoria ${pct(trajectory)}`;

    if (trajectory >= 1) {
      $("heroTitle").textContent =
        `La operación está ${num((trajectory - 1) * 100, 1)}% arriba de la trayectoria`;
      $("heroText").textContent =
        `La prioridad es sostener la oferta y proteger inventario. Aún hay ${global.critica} tiendas que requieren intervención.`;
    } else {
      $("heroTitle").textContent =
        `Faltan ${money(dailyDelta)} diarios para alcanzar el ritmo necesario`;
      $("heroText").textContent =
        `La venta cubre ${pct(trajectory)} de lo esperado al corte. ${global.critica} tiendas están por debajo del 85% de su trayectoria.`;
    }

    $("heroActions").innerHTML =
      `<span>${global.en_ritmo} en ritmo</span>` +
      `<span>${global.recuperable} recuperables</span>` +
      `<span>${global.critica} críticas</span>`;

    const refPrice = Number(D.producto?.precioReferencia || 20);
    const globalCurrentPieces = Math.round(global.venta / refPrice);
    const globalExpectedPieces = Math.round(global.esperado / refPrice);
    const globalGoalPieces = Math.round(global.meta / refPrice);
    const globalGapPieces = Math.ceil(global.gap / refPrice);
    const globalProjectionPieces = Math.round(global.proy / refPrice);

    const metrics = state.metricMode === "pieces"
      ? [
          ["Piezas acumuladas", `${num(globalCurrentPieces)} pzas`, `${pct(advance)} de la meta final`, "pulse"],
          ["Piezas esperadas", `${num(globalExpectedPieces)} pzas`, deltaFromExpected(trajectory).text, "target"],
          ["Meta final", `${num(globalGoalPieces)} pzas`, `${num(globalGapPieces)} todavía por vender`, "focus"],
          ["Piezas faltantes", `${num(globalGapPieces)} pzas`, `${num(Math.ceil(global.req / refPrice))} requeridas por día`, "bolt"],
          ["Proyección cierre", `${num(globalProjectionPieces)} pzas`, `${pct(projection)} de cumplimiento`, "spark"],
          ["Inventario", `${num(global.stock)} pzas`, `${global.stockRisk} tiendas con riesgo`, "boxes"]
        ]
      : [
          ["Venta acumulada", roundedMoney(global.venta), `${pct(advance)} de la meta final`, "pulse"],
          ["Esperado al corte", roundedMoney(global.esperado), deltaFromExpected(trajectory).text, "target"],
          ["Meta final julio", roundedMoney(global.meta), `${roundedMoney(global.gap)} todavía por vender`, "focus"],
          ["Faltante total", roundedMoney(global.gap), `${num(globalGapPieces)} piezas`, "bolt"],
          ["Proyección cierre", roundedMoney(global.proy), `${pct(projection)} de cumplimiento`, "spark"],
          ["Margen", pct(global.venta ? global.util / global.venta : 0), `${num(global.pzas)} piezas vendidas`, "boxes"]
        ];

    $("kpis").innerHTML = metrics.map((metric, index) =>
      `<article class="metric-card ${index === 3 ? "highlight" : ""}">
        <div class="metric-label"><span>${svg(metric[3])}</span>${metric[0]}</div>
        <strong>${metric[1]}</strong>
        <small>${metric[2]}</small>
      </article>`
    ).join("");

    if (state.metricMode === "pieces") {
      $("briefBefore").textContent = `${num(beforeImpulsePieces, 1)} pzas`;
      $("briefBeforeText").textContent =
        `por día antes del impulso · actual ${num(campaignDaily / (D.producto?.precioReferencia || 20), 1)} pzas · ${paceUplift >= 0 ? "↑" : "↓"} ${num(Math.abs(paceUplift) * 100, 1)}%`;

      const refPrice = Number(D.producto?.precioReferencia || 20);
      $("briefDaily").textContent = `${num(Math.ceil(global.req / refPrice))} pzas`;
      $("briefDailyText").textContent =
        `requeridas por día · ritmo actual ${num(Math.round(campaignDaily / refPrice))} pzas`;
    } else {
      $("briefBefore").textContent = roundedMoney(beforeImpulseDaily);
      $("briefBeforeText").textContent =
        `por día antes del impulso · actual ${roundedMoney(campaignDaily)} · ${paceUplift >= 0 ? "↑" : "↓"} ${num(Math.abs(paceUplift) * 100, 1)}%`;

      $("briefDaily").textContent = roundedMoney(global.req);
      $("briefDailyText").textContent =
        `requeridos por día desde hoy · ritmo actual ${roundedMoney(campaignDaily)}`;
    }
    $("briefConcentration").textContent = pct(concentration);
    $("briefConcentrationText").textContent =
      "de la brecha está en las 5 tiendas con mayor presión";
    $("briefStock").textContent =
      `${global.stockRisk} tienda${global.stockRisk === 1 ? "" : "s"}`;
    $("briefStockText").textContent =
      global.stockRisk
        ? "requieren resurtido o redistribución"
        : "sin riesgo inmediato de inventario";

    renderChannels(state.scope);
    renderSupervisors(state.scope);
    renderPriorities(state.view);
    renderStores(state.view);
  }

  function renderChannels(rows) {
    const groups = {};
    rows.forEach(row => (groups[row.canal] ??= []).push(row));

    $("channelList").innerHTML = Object.entries(groups).map(([name, groupRows]) => {
      const values = agg(groupRows, name !== "AUTOSERVICIO");

      if (name === "AUTOSERVICIO") {
        return `<div class="channel-row">
          <div class="channel-name">
            <strong>${name}</strong>
            <small>Participa sin meta incremental</small>
          </div>
          <div class="goal-track neutral">
            <i class="actual-fill en_ritmo" style="width:100%"></i>
          </div>
          <div class="channel-value">
            <strong>Seguimiento</strong>
            <small>${money(values.venta)} vendidos</small>
          </div>
        </div>`;
      }

      const advance = values.meta ? values.venta / values.meta : 0;
      const expectedPosition = values.meta ? values.esperado / values.meta : 0;
      const trajectory = values.esperado ? values.venta / values.esperado : 0;
      const status = statusFromTrajectory(trajectory);

      return `<div class="channel-row">
        <div class="channel-name">
          <strong>${name}</strong>
          <small>${money(values.venta)} actual · ${money(values.meta)} meta</small>
        </div>
        <div class="goal-track" title="Barra: venta actual sobre meta final. Línea: esperado al corte.">
          <i class="actual-fill ${status}" style="width:${Math.min(100, advance * 100)}%"></i>
          <b class="expected-marker" style="left:${Math.min(100, expectedPosition * 100)}%"></b>
        </div>
        <div class="channel-value">
          <strong>${trajectoryBadge(trajectory)}</strong>
          <small>${state.metricMode === "pieces"
            ? `${num(Math.round(values.esperado / (D.producto?.precioReferencia || 20)))} pzas esperadas`
            : `${roundedMoney(values.esperado)} esperado`}</small>
        </div>
      </div>`;
    }).join("") || '<div class="empty">Sin datos.</div>';
  }

  function renderSupervisors(rows) {
    const groups = {};
    rows.forEach(row => (groups[row.supervisor] ??= []).push(row));

    $("supervisorPanelTitle").textContent =
      state.user.access === "all" ? "Pulso por supervisor" : "Estado de mis tiendas";
    $("trajectoryTag").textContent = `Día ${D.corteDia}`;

    $("supervisorBoard").innerHTML = Object.entries(groups).map(([name, groupRows]) => {
      const values = agg(groupRows);
      const trajectory = values.esperado ? values.venta / values.esperado : 0;
      const status = statusFromTrajectory(trajectory);

      return `<div class="supervisor-row">
        <div class="supervisor-top">
          <div class="supervisor-name">
            <div class="avatar">${name[0]}</div>
            <div>
              <strong>${name}</strong>
              <small>${groupRows.length} tiendas · ${values.critica} críticas</small>
            </div>
          </div>
          <div class="supervisor-score">
            <strong>${trajectoryBadge(trajectory, "")}</strong>
            <small>contra trayectoria</small>
          </div>
        </div>
        <div class="supervisor-progress">
          <i class="${status}" style="width:${Math.min(100, trajectory * 100)}%"></i>
        </div>
      </div>`;
    }).join("");
  }

  function preciseAction(row) {
    const faltante = remainingValue(row);
    const piezas = remainingPieces(row);
    const piezasDia = requiredPiecesDaily(row);

    if (faltante <= 0) {
      return "Meta alcanzada. Mantener disponibilidad y evitar canibalización.";
    }

    if (Number(row.brechaStock || 0) < 0) {
      return `Faltan ${roundedMoney(faltante)} (${num(piezas)} pzas). Resurtir ${num(Math.abs(row.brechaStock))} pzas y sostener ${roundedMoney(row.metaDiariaDesdeHoy)} diarios.`;
    }

    if (row.estatus === "critica") {
      return `Faltan ${roundedMoney(faltante)} (${num(piezas)} pzas). Debe vender ${roundedMoney(row.metaDiariaDesdeHoy)} o ${num(piezasDia)} pzas/día; antes del impulso vendía ${roundedMoney(preImpulseDaily(row))} diarios.`;
    }

    if (row.estatus === "recuperable") {
      return `Faltan ${roundedMoney(faltante)} (${num(piezas)} pzas). Es recuperable si sostiene ${roundedMoney(row.metaDiariaDesdeHoy)} diarios.`;
    }

    return `Faltan ${roundedMoney(faltante)} (${num(piezas)} pzas). Mantener el ritmo y proteger inventario.`;
  }

  function renderPriorities(rows) {
    const rank = { critica: 3, recuperable: 2, en_ritmo: 1 };
    const selected = [...rows]
      .filter(r => r.canal !== "AUTOSERVICIO")
      .sort((a, b) =>
        rank[b.estatus] - rank[a.estatus] ||
        remainingValue(b) - remainingValue(a)
      )
      .slice(0, 6);

    $("priorityCount").textContent =
      `${rows.filter(r => r.estatus === "critica").length} críticas`;

    $("priorityGrid").innerHTML = selected.map(row =>
      `<article class="priority-card ${row.estatus}">
        <div class="priority-top">
          <span class="status-pill ${row.estatus}">${statusLabel(row.estatus)}</span>
          <span class="priority-owner">${row.supervisor}</span>
        </div>
        <h4>${row.tienda}</h4>
        <p>${preciseAction(row)}</p>
        <div class="priority-metrics three">
          <div><small>Faltante</small><b>${moneyExact(remainingValue(row))}</b></div>
          <div><small>Piezas faltantes</small><b>${num(remainingPieces(row))}</b></div>
          <div><small>Requerido/día</small><b>${roundedMoney(row.metaDiariaDesdeHoy)}</b></div>
        </div>
      </article>`
    ).join("") || '<div class="empty">No hay prioridades con estos filtros.</div>';
  }

  function trajectoryCell(row) {
    const trajectory = Number(row.cumplimientoTrayectoria || 0);
    const advance = Number(row.metaTotalJulio || 0)
      ? Number(row.ventaActual || 0) / Number(row.metaTotalJulio || 0)
      : 0;
    const expectedPosition = Number(row.metaTotalJulio || 0)
      ? Number(row.esperadoCorte || 0) / Number(row.metaTotalJulio || 0)
      : 0;

    return `<div class="trajectory-cell">
      <div>
        ${trajectoryBadge(trajectory)}
        <span>${pct(advance)} de meta</span>
      </div>
      <div class="micro-track">
        <i class="actual-fill ${row.estatus}" style="width:${Math.min(100, advance * 100)}%"></i>
        <b class="expected-marker" style="left:${Math.min(100, expectedPosition * 100)}%"></b>
      </div>
    </div>`;
  }

  function renderStores(rows) {
    const sorted = [...rows].sort((a, b) =>
      a.cumplimientoTrayectoria - b.cumplimientoTrayectoria
    );

    $("tbody").innerHTML = sorted.map((row, index) => {
      const current = state.metricMode === "pieces"
        ? `${num(Math.round(Number(row.cantidad || valueAsPieces(row.ventaActual, row))))} pzas`
        : roundedMoney(row.ventaActual);
      const expected = state.metricMode === "pieces"
        ? `${num(valueAsPieces(row.esperadoCorte, row))} pzas`
        : roundedMoney(row.esperadoCorte);
      const goal = state.metricMode === "pieces"
        ? `${num(valueAsPieces(row.metaTotalJulio, row))} pzas`
        : roundedMoney(row.metaTotalJulio);
      const gap = state.metricMode === "pieces"
        ? `${num(remainingPieces(row))} pzas`
        : roundedMoney(remainingValue(row));
      const daily = state.metricMode === "pieces"
        ? `${num(requiredPiecesDaily(row))} pzas`
        : roundedMoney(row.metaDiariaDesdeHoy);

      return `<tr data-i="${index}">
        <td>
          <div class="store-title">
            <strong>${row.tienda}</strong>
            <small>${row.canal}</small>
          </div>
        </td>
        <td>${row.supervisor}</td>
        <td>${current}</td>
        <td>${expected}</td>
        <td>${goal}</td>
        <td>${trajectoryCell(row)}</td>
        <td class="gap-value">${gap}</td>
        <td>
          <strong>${daily}</strong>
          <small>${state.metricMode === "pieces"
            ? `antes ${num(preImpulsePiecesDaily(row), 1)} pzas/día`
            : `antes ${roundedMoney(preImpulseDaily(row))}/día`}</small>
        </td>
        <td class="${Number(row.brechaStock || 0) < 0 ? "stock-risk" : ""}">
          ${num(row.existencia)} pzas
        </td>
        <td><span class="status-pill ${row.estatus}">${statusLabel(row.estatus)}</span></td>
      </tr>`;
    }).join("");

    $("tbody").querySelectorAll("tr").forEach((row, index) => {
      row.onclick = () => openModal(sorted[index]);
    });

    $("mobileStoreList").innerHTML = sorted.map((row, index) => {
      const current = state.metricMode === "pieces"
        ? `${num(Math.round(Number(row.cantidad || valueAsPieces(row.ventaActual, row))))} pzas`
        : roundedMoney(row.ventaActual);
      const expected = state.metricMode === "pieces"
        ? `${num(valueAsPieces(row.esperadoCorte, row))} pzas`
        : roundedMoney(row.esperadoCorte);
      const goal = state.metricMode === "pieces"
        ? `${num(valueAsPieces(row.metaTotalJulio, row))} pzas`
        : roundedMoney(row.metaTotalJulio);
      const gap = state.metricMode === "pieces"
        ? `${num(remainingPieces(row))} pzas`
        : roundedMoney(remainingValue(row));
      const daily = state.metricMode === "pieces"
        ? `${num(requiredPiecesDaily(row))} pzas`
        : roundedMoney(row.metaDiariaDesdeHoy);

      const trajectory = Number(row.cumplimientoTrayectoria || 0);
      const advance = Number(row.metaTotalJulio || 0)
        ? Number(row.ventaActual || 0) / Number(row.metaTotalJulio || 0)
        : 0;
      const expectedPosition = Number(row.metaTotalJulio || 0)
        ? Number(row.esperadoCorte || 0) / Number(row.metaTotalJulio || 0)
        : 0;

      return `<article class="mobile-store-card ${row.estatus}" data-i="${index}">
        <div class="mobile-store-top">
          <div class="mobile-store-name">
            <strong>${row.tienda}</strong>
            <small>${row.canal} · ${row.supervisor}</small>
          </div>
          <span class="status-pill ${row.estatus}">${statusLabel(row.estatus)}</span>
        </div>

        <div class="mobile-progress-copy">
          ${trajectoryBadge(trajectory)}
          <span>${pct(advance)} de meta final</span>
        </div>
        <div class="mobile-goal-track">
          <i class="actual-fill ${row.estatus}" style="width:${Math.min(100, advance * 100)}%"></i>
          <b class="expected-marker" style="left:${Math.min(100, expectedPosition * 100)}%"></b>
        </div>

        <div class="mobile-store-grid precise">
          <div><span>Actual</span><b>${current}</b></div>
          <div><span>Meta final</span><b>${goal}</b></div>
          <div class="mobile-gap-cell"><span>Faltante</span><b>${gap}</b></div>
          <div class="mobile-daily-cell">
            <span>Requerido/día</span><b>${daily}</b>
            <small>${state.metricMode === "pieces"
              ? `antes ${num(preImpulsePiecesDaily(row), 1)} pzas`
              : `antes ${roundedMoney(preImpulseDaily(row))}`}</small>
          </div>
        </div>

        <div class="mobile-store-foot">
          <span>Stock: <b>${num(row.existencia)} pzas</b></span>
          <button type="button">Ver detalle <b>›</b></button>
        </div>
      </article>`;
    }).join("");

    $("mobileStoreList").querySelectorAll("article").forEach((card, index) => {
      card.onclick = () => openModal(sorted[index]);
    });
  }

  function openModal(row) {
    const productName = D.producto?.descripcion || "Botanas Riquísimos surtido grande 1 pz";
    const trajectory = Number(row.cumplimientoTrayectoria || 0);
    const advance = Number(row.metaTotalJulio || 0)
      ? Number(row.ventaActual || 0) / Number(row.metaTotalJulio || 0)
      : 0;
    const expectedPosition = Number(row.metaTotalJulio || 0)
      ? Number(row.esperadoCorte || 0) / Number(row.metaTotalJulio || 0)
      : 0;

    const currentPieces = Math.round(Number(
      row.cantidad || valueAsPieces(row.ventaActual, row)
    ));
    const expectedPieces = valueAsPieces(row.esperadoCorte, row);
    const goalPieces = valueAsPieces(row.metaTotalJulio, row);
    const gapPieces = remainingPieces(row);
    const dailyPieces = requiredPiecesDaily(row);
    const previousDaily = preImpulseDaily(row);
    const currentDaily = campaignDailyRow(row);
    const paceDelta = paceChange(currentDaily, previousDaily);
    const paceDirection = paceDelta >= 0 ? "positive" : "negative";
    const stockAfter = Number(row.brechaStock || 0);
    const stockClass = stockAfter < 0 ? "danger" : stockAfter < dailyPieces * 3 ? "warning" : "positive";

    $("modalBody").innerHTML =
      `<div class="modal-content modal-v8">
        <div class="modal-hero modal-hero-v8">
          <div class="modal-identity">
            <p class="overline light">${row.canal} · ${row.supervisor}</p>
            <h2>${row.tienda}</h2>
            <p><strong>${D.producto?.sku || "BOTA0068"}</strong> · ${productName}</p>
          </div>
          <div class="modal-state">
            <span class="status-pill ${row.estatus}">${statusLabel(row.estatus)}</span>
            ${trajectoryBadge(trajectory)}
          </div>
        </div>

        <section class="modal-command">
          <div class="modal-progress-panel">
            <div class="modal-panel-head">
              <div>
                <span>Avance a meta final</span>
                <strong>${pct(advance)}</strong>
              </div>
              <small>${trajectoryBadge(trajectory)}</small>
            </div>
            <div class="modal-goal-track">
              <i class="actual-fill ${row.estatus}" style="width:${Math.min(100, advance * 100)}%"></i>
              <b class="expected-marker" style="left:${Math.min(100, expectedPosition * 100)}%"></b>
            </div>
            <div class="modal-track-labels">
              <span>Actual ${roundedMoney(row.ventaActual)}</span>
              <span>Esperado ${roundedMoney(row.esperadoCorte)}</span>
              <span>Meta ${roundedMoney(row.metaTotalJulio)}</span>
            </div>
          </div>

          <div class="modal-gap-panel ${row.estatus}">
            <div class="goal-card-head">
              <span>Meta final</span>
              <b>${roundedMoney(row.metaTotalJulio)}</b>
            </div>

            <div class="goal-card-progress">
              <i class="actual-fill ${row.estatus}" style="width:${Math.min(100, advance * 100)}%"></i>
            </div>

            <div class="goal-card-main">
              <div>
                <small>Lleva</small>
                <strong>${roundedMoney(row.ventaActual)}</strong>
                <em>${pct(advance)} de la meta</em>
              </div>
              <div class="goal-card-gap">
                <small>Faltan</small>
                <strong>${roundedMoney(remainingValue(row))}</strong>
                <em>${num(gapPieces)} pzas pendientes</em>
              </div>
            </div>

            <div class="goal-card-daily">
              <span>Ritmo diario</span>
              <b>${num(dailyPieces)} pzas · ${roundedMoney(row.metaDiariaDesdeHoy)}</b>
            </div>
          </div>
        </section>

        <section class="modal-section">
          <div class="modal-section-title">
            <span>01</span><div><small>RESULTADO</small><h3>Actual, esperado y objetivo</h3></div>
          </div>
          <div class="modal-kpi-row">
            <article>
              <span>Venta actual</span>
              <strong>${roundedMoney(row.ventaActual)}</strong>
              <small>${num(currentPieces)} piezas</small>
            </article>
            <article>
              <span>Esperado al corte</span>
              <strong>${roundedMoney(row.esperadoCorte)}</strong>
              <small>${num(expectedPieces)} piezas</small>
            </article>
            <article>
              <span>Meta final</span>
              <strong>${roundedMoney(row.metaTotalJulio)}</strong>
              <small>${num(goalPieces)} piezas</small>
            </article>
            <article class="accent">
              <span>Proyección cierre</span>
              <strong>${roundedMoney(row.proyeccionCierre)}</strong>
              <small>${pct(Number(row.proyeccionCierre || 0) / Math.max(1, Number(row.metaTotalJulio || 0)))} de la meta</small>
            </article>
          </div>
        </section>

        <section class="modal-section">
          <div class="modal-section-title">
            <span>02</span><div><small>RITMO</small><h3>Antes, ahora y lo necesario</h3></div>
          </div>
          <div class="pace-flow">
            <article>
              <span>Antes del impulso</span>
              <strong>${roundedMoney(previousDaily)}</strong>
              <small>${num(preImpulsePiecesDaily(row), 1)} pzas/día</small>
            </article>
            <div class="pace-arrow ${paceDirection}">
              <b>${paceDelta >= 0 ? "↑" : "↓"}</b>
              <span>${num(Math.abs(paceDelta) * 100, 1)}%</span>
            </div>
            <article>
              <span>Ritmo campaña</span>
              <strong>${roundedMoney(currentDaily)}</strong>
              <small>${num(currentDaily / productPrice(row), 1)} pzas/día</small>
            </article>
            <div class="pace-arrow required">
              <b>→</b>
              <span>objetivo</span>
            </div>
            <article class="required-card">
              <span>Requerido desde hoy</span>
              <strong>${roundedMoney(row.metaDiariaDesdeHoy)}</strong>
              <small>${num(dailyPieces)} pzas/día</small>
            </article>
          </div>
        </section>

        <section class="modal-section">
          <div class="modal-section-title">
            <span>03</span><div><small>OPERACIÓN</small><h3>Inventario y capacidad de cumplimiento</h3></div>
          </div>
          <div class="operation-grid">
            <article>
              <span>Inventario actual</span>
              <strong>${num(row.existencia)} pzas</strong>
              <small>disponibles hoy</small>
            </article>
            <article>
              <span>Piezas por vender</span>
              <strong>${num(gapPieces)} pzas</strong>
              <small>para alcanzar meta</small>
            </article>
            <article class="${stockClass}">
              <span>Stock después de meta</span>
              <strong>${num(stockAfter)} pzas</strong>
              <small>${stockAfter < 0 ? `resurtir ${num(Math.abs(stockAfter))} piezas` : "inventario suficiente"}</small>
            </article>
            <article>
              <span>Margen</span>
              <strong>${pct(row.margen)}</strong>
              <small>rentabilidad del SKU</small>
            </article>
          </div>
        </section>

        <div class="modal-action modal-action-v8">
          <span class="action-signal">${row.estatus === "critica" ? "!" : row.estatus === "recuperable" ? "↗" : "✓"}</span>
          <div><small>SIGUIENTE ACCIÓN</small><p>${preciseAction(row)}</p></div>
        </div>
      </div>`;

    document.body.classList.add("modal-open");
    $("detailModal").showModal();
  }

  $("loginForm").onsubmit = event => {
    event.preventDefault();
    if (login($("userInput").value, $("passInput").value)) {
      showApp();
    } else {
      $("loginError").textContent = "Usuario o contraseña incorrectos.";
    }
  };

  $("logout").onclick = () => {
    sessionStorage.removeItem("pc_user");
    location.reload();
  };

  $("scopeSupervisor").onchange = () => {
    $("statusFilter").value = "all";
    $("search").value = "";
    refreshChannelOptions();
    $("channelFilter").value = "all";
    syncMobileFilters();
    applyFilters(false);
    $("inicio").scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveNav("inicio");
  };

  $("channelFilter").onchange = () => {
    $("statusFilter").value = "all";
    $("search").value = "";
    syncMobileFilters();
    applyFilters(false);
    $("inicio").scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveNav("inicio");
  };
  $("statusFilter").onchange = () => applyFilters(true);
  $("search").oninput = () => applyFilters(false);
  $("closeModal").onclick = () => {
    $("detailModal").close();
    document.body.classList.remove("modal-open");
  };

  $("detailModal").addEventListener("close", () => {
    document.body.classList.remove("modal-open");
  });

  function setActiveNav(target) {
    document.querySelectorAll(".rail-item,.bottom-nav button").forEach(button => {
      button.classList.toggle("active", button.dataset.target === target);
    });
  }

  document.querySelectorAll("[data-target]").forEach(button => {
    button.onclick = () => {
      const target = button.dataset.target;
      $(target).scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveNav(target);
    };
  });

  $("filterToggle").onclick = () => {
    syncMobileFilters();
    $("filterSheet").classList.remove("hidden");
    $("filterSheet").setAttribute("aria-hidden", "false");
  };

  function closeSheet() {
    $("filterSheet").classList.add("hidden");
    $("filterSheet").setAttribute("aria-hidden", "true");
  }

  $("closeFilters").onclick = closeSheet;
  $("filterBackdrop").onclick = closeSheet;

  $("applyFilters").onclick = () => {
    let shouldNavigate = false;

    ["channelFilter", "statusFilter"].forEach(id => {
      const mobile = $(`mobile_${id}`);
      if (!mobile) return;
      if (id === "statusFilter" && $(id).value !== mobile.value) shouldNavigate = true;
      $(id).value = mobile.value;
    });

    applyFilters(shouldNavigate);
    if (!shouldNavigate) {
      $("inicio").scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveNav("inicio");
    }
    closeSheet();
  };

  document.querySelectorAll("[data-metric-mode]").forEach(button => {
    button.onclick = () => setMetricMode(button.dataset.metricMode);
  });

  setProductLabels();

  const saved = sessionStorage.getItem("pc_user");
  if (saved && users[saved]) {
    state.user = { key: saved, ...users[saved] };
    showApp();
  }
})();
