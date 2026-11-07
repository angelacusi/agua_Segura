"use strict";

const defaults = {
  volume: 500,
  k: 0.02,
  reserve: 100,
  endTime: 1300,
  stepOne: 50,
  stepTwo: 25
};
const MAX_STEPS = 20000;
const numberFormat = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });
const chartColors = {
  exact: "#163A5F",
  heun: "#247BA0",
  rk: "#42B7C5"
};
const form = document.getElementById("simulation-form");
const validationMessage = document.getElementById("validation-message");
const inputs = {
  volume: document.getElementById("volume-input"),
  k: document.getElementById("k-input"),
  reserve: document.getElementById("reserve-input"),
  endTime: document.getElementById("end-time-input"),
  stepOne: document.getElementById("step-one-input"),
  stepTwo: document.getElementById("step-two-input")
};
function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es", { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);
}

function formatParameter(value) {
  return new Intl.NumberFormat("es", { maximumSignificantDigits: 8 }).format(value);
}

function formatError(value) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (Math.abs(value) < 0.0001) {
    return new Intl.NumberFormat("es", {
      notation: "scientific",
      maximumSignificantDigits: 6
    }).format(value);
  }
  return formatNumber(value, 8);
}

function formatTime(value) {
  return Number.isFinite(value) ? `${formatNumber(value)} min` : "No alcanzada";
}

function readParameters() {
  const values = {};
  const errors = [];
  for (const [key, input] of Object.entries(inputs)) {
    const value = input.value.trim() === "" ? NaN : Number(input.value);
    values[key] = value;
    input.setAttribute("aria-invalid", String(!Number.isFinite(value)));
    if (!Number.isFinite(value)) errors.push(`El campo «${input.labels[0].childNodes[0].textContent.trim()}» debe contener un número válido.`);
  }
  if (Number.isFinite(values.volume) && values.volume <= 0) errors.push("El volumen inicial debe ser mayor que cero.");
  if (Number.isFinite(values.k) && values.k <= 0) errors.push("La constante k debe ser positiva.");
  if (Number.isFinite(values.reserve) && values.reserve < 0) errors.push("La reserva mínima no puede ser negativa.");
  if (Number.isFinite(values.volume) && Number.isFinite(values.reserve) && values.reserve >= values.volume) errors.push("La reserva mínima debe ser menor que el volumen inicial.");
  if (Number.isFinite(values.endTime) && values.endTime <= 0) errors.push("El tiempo final debe ser positivo.");
  if (Number.isFinite(values.stepOne) && values.stepOne <= 0) errors.push("El tamaño de paso h₁ debe ser positivo.");
  if (Number.isFinite(values.stepTwo) && values.stepTwo <= 0) errors.push("El tamaño de paso h₂ debe ser positivo.");
  for (const key of ["volume", "k", "reserve", "endTime", "stepOne", "stepTwo"]) {
    if (Number.isFinite(values[key]) && values[key] > Number.MAX_VALUE / 100) {
      errors.push("Uno o más valores exceden el rango numérico admitido.");
      break;
    }
  }
  if (Number.isFinite(values.endTime)) {
    for (const stepKey of ["stepOne", "stepTwo"]) {
      if (Number.isFinite(values[stepKey]) && values.endTime / values[stepKey] > MAX_STEPS) {
        errors.push(`El experimento ${stepKey === "stepOne" ? "1" : "2"} requiere más de ${numberFormat.format(MAX_STEPS)} pasos. Aumenta el tamaño de paso o reduce el tiempo final.`);
      }
    }
  }
  if (errors.length) {
    validationMessage.textContent = errors.join(" ");
    validationMessage.hidden = false;
    return null;
  }
  validationMessage.hidden = true;
  for (const input of Object.values(inputs)) input.setAttribute("aria-invalid", "false");
  return values;
}

function exactVolume(time, params) {
  const emptyTime = 2 * Math.sqrt(params.volume) / params.k;
  if (time >= emptyTime) return 0;
  const rootVolume = Math.sqrt(params.volume) - params.k * time / 2;
  return Math.max(0, rootVolume * rootVolume);
}

function slope(volume, k) {
  return -k * Math.sqrt(Math.max(0, volume));
}

function advanceHeun(volume, step, k) {
  const k1 = slope(volume, k);
  const k2 = slope(volume + step * k1, k);
  return Math.max(0, volume + step * (k1 + k2) / 2);
}

function advanceRk4(volume, step, k) {
  const k1 = slope(volume, k);
  const k2 = slope(volume + step * k1 / 2, k);
  const k3 = slope(volume + step * k2 / 2, k);
  const k4 = slope(volume + step * k3, k);
  return Math.max(0, volume + step * (k1 + 2 * k2 + 2 * k3 + k4) / 6);
}

function crossingTime(times, volumes, reserve) {
  for (let i = 1; i < volumes.length; i += 1) {
    const previous = volumes[i - 1];
    const current = volumes[i];
    if (previous > reserve && current <= reserve) {
      const interval = times[i] - times[i - 1];
      if (current === previous) return times[i];
      const fraction = (previous - reserve) / (previous - current);
      return times[i - 1] + fraction * interval;
    }
  }
  return NaN;
}

function simulateMethod(params, stepSize, method) {
  const times = [0];
  const volumes = [params.volume];
  let time = 0;
  let volume = params.volume;
  let stepCount = 0;
  while (time < params.endTime) {
    if (stepCount >= MAX_STEPS) throw new Error(`La simulación excede el máximo de ${numberFormat.format(MAX_STEPS)} pasos.`);
    const step = Math.min(stepSize, params.endTime - time);
    const nextVolume = volume === 0
      ? 0
      : method === "Heun"
        ? advanceHeun(volume, step, params.k)
        : advanceRk4(volume, step, params.k);
    if (!Number.isFinite(nextVolume)) throw new Error(`${method} produjo un volumen no finito; prueba otros parámetros o un paso menor.`);
    time += step;
    if (Math.abs(time - params.endTime) < Number.EPSILON * Math.max(1, params.endTime) * 4) time = params.endTime;
    volume = nextVolume;
    times.push(time);
    volumes.push(volume);
    stepCount += 1;
  }
  return { times, volumes, reserveTime: crossingTime(times, volumes, params.reserve) };
}

function buildExperiment(params, step) {
  const heun = simulateMethod(params, step, "Heun");
  const rk4 = simulateMethod(params, step, "RK4");
  const exact = heun.times.map(time => exactVolume(time, params));
  return { step, times: heun.times, exact, heun: heun.volumes, rk4: rk4.volumes, heunTime: heun.reserveTime, rk4Time: rk4.reserveTime };
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function renderReference(params) {
  const exactTime = 2 * (Math.sqrt(params.volume) - Math.sqrt(params.reserve)) / params.k;
  setText("analytic-time-model", formatTime(exactTime));
  setText("analytic-hours-model", `${formatNumber(exactTime / 60)} horas`);
  setText("analytic-expression", `V(t) = (√${formatParameter(params.volume)} − ${formatParameter(params.k / 2)}t)²`);
}

function renderMetrics(params, experiments) {
  const exactTime = 2 * (Math.sqrt(params.volume) - Math.sqrt(params.reserve)) / params.k;
  setText("metric-initial", `${formatNumber(params.volume)} L`);
  setText("metric-final-time", `a los ${formatNumber(params.endTime)} min`);
  setText("metric-exact-time", formatTime(exactTime));
  setText("metric-heun-time", formatTime(experiments[0].heunTime));
  setText("metric-rk-time", formatTime(experiments[0].rk4Time));
  setText("metric-heun-delta", Number.isFinite(experiments[0].heunTime) ? `Aproximado · error ${formatError(Math.abs(experiments[0].heunTime - exactTime))} min` : "No cruza la reserva en el intervalo");
  setText("metric-rk-delta", Number.isFinite(experiments[0].rk4Time) ? `Aproximado · error ${formatError(Math.abs(experiments[0].rk4Time - exactTime))} min` : "No cruza la reserva en el intervalo");
  setText("primary-heun-label", `Heun · h = ${formatNumber(experiments[0].step)} min`);
  setText("primary-rk-label", `RK4 · h = ${formatNumber(experiments[0].step)} min`);
  setText("experiment-one-step", formatNumber(experiments[0].step));
  setText("experiment-two-step", formatNumber(experiments[1].step));
  setText("step-one-heading", `h = ${formatNumber(experiments[0].step)} min`);
  setText("step-two-heading", `h = ${formatNumber(experiments[1].step)} min`);
  renderStepComparison(experiments, exactTime);
  const chosen = experiments[1];
  const finalVolume = chosen.rk4[chosen.rk4.length - 1];
  const percent = params.volume > 0 ? 100 * finalVolume / params.volume : 0;
  setText("metric-final", `${formatNumber(finalVolume)} L`);
  setText("tank-liters", `${formatNumber(finalVolume)} L`);
  setText("tank-percent", `${formatNumber(percent)}% del volumen inicial`);
  setText("gauge-top-label", `${formatNumber(params.volume)} L`);
  setText("gauge-reserve-label", `Reserva mínima: ${formatNumber(params.reserve)} L`);
  setText("gauge-caption", `Nivel al minuto ${formatNumber(params.endTime)}, calculado con RK4 y h₂ = ${formatNumber(experiments[1].step)} min.`);
  const water = document.getElementById("gauge-water");
  water.style.height = `${Math.max(0, Math.min(100, percent))}%`;
  const alert = finalVolume <= params.reserve;
  water.classList.toggle("alert", alert);
  const status = document.getElementById("tank-status");
  status.textContent = alert ? "Nivel de alerta" : "Agua disponible";
  status.classList.toggle("alert", alert);
  const reservePercent = Math.max(0, Math.min(100, 100 * params.reserve / params.volume));
  const reserveZone = document.getElementById("gauge-reserve-zone");
  const reserveLine = document.getElementById("gauge-reserve-line");
  reserveZone.style.height = `${reservePercent}%`;
  reserveLine.style.bottom = `${reservePercent}%`;
}

function renderStepComparison(experiments, exactTime) {
  const [first, second] = experiments;
  const rows = [
    { name: "heun", results: [first.heunTime, second.heunTime] },
    { name: "rk", results: [first.rk4Time, second.rk4Time] }
  ];
  for (const { name, results } of rows) {
    for (let index = 0; index < results.length; index += 1) {
      const time = results[index];
      const suffix = index === 0 ? "one" : "two";
      setText(`comparison-${name}-${suffix}`, formatTime(time));
      setText(
        `comparison-${name}-${suffix}-error`,
        Number.isFinite(time)
          ? `Error temporal: ${formatError(Math.abs(time - exactTime))} min`
          : "Error temporal: no calculable"
      );
    }
  }
  setText(
    "step-explanation",
    `Al reducir h se hacen más cálculos y generalmente mejora la aproximación. Con estos parámetros, el error temporal de Heun ${describeErrorChange(first.heunTime, second.heunTime, exactTime)} y el de RK4 ${describeErrorChange(first.rk4Time, second.rk4Time, exactTime)}.`
  );
}

function describeErrorChange(firstTime, secondTime, exactTime) {
  if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) {
    return "no se puede comparar porque uno de los experimentos no cruza la reserva";
  }
  const firstError = Math.abs(firstTime - exactTime);
  const secondError = Math.abs(secondTime - exactTime);
  if (secondError < firstError) return "disminuye al pasar al segundo experimento";
  if (secondError > firstError) return "aumenta al pasar al segundo experimento";
  return "se mantiene igual entre los dos experimentos";
}

function makeSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function renderChart(params, experiments) {
  const svg = document.getElementById("comparison-chart");
  const legend = document.getElementById("chart-legend");
  svg.replaceChildren();
  legend.replaceChildren();
  const width = 1000;
  const height = 460;
  const margin = { top: 23, right: 26, bottom: 44, left: 66 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xMax = params.endTime;
  const yMax = params.volume * 1.08;
  const x = value => margin.left + value / xMax * plotWidth;
  const y = value => margin.top + (1 - value / yMax) * plotHeight;

  for (let tick = 0; tick <= 5; tick += 1) {
    const value = params.volume * tick / 5;
    const py = y(value);
    svg.append(makeSvgElement("line", { x1: margin.left, x2: width - margin.right, y1: py, y2: py, class: "chart-gridline" }));
    const label = makeSvgElement("text", { x: margin.left - 10, y: py + 4, "text-anchor": "end", class: "chart-label" });
    label.textContent = formatNumber(value, 0);
    svg.append(label);
  }
  for (let tick = 0; tick <= 5; tick += 1) {
    const value = xMax * tick / 5;
    const px = x(value);
    svg.append(makeSvgElement("line", { x1: px, x2: px, y1: margin.top, y2: margin.top + plotHeight, class: "chart-gridline" }));
    const label = makeSvgElement("text", { x: px, y: height - 19, "text-anchor": "middle", class: "chart-label" });
    label.textContent = formatNumber(value, 0);
    svg.append(label);
  }
  svg.append(makeSvgElement("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, class: "chart-axis" }));
  svg.append(makeSvgElement("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, class: "chart-axis" }));
  const reserveY = y(params.reserve);
  svg.append(makeSvgElement("line", { x1: margin.left, x2: width - margin.right, y1: reserveY, y2: reserveY, class: "chart-reserve" }));
  const reserveLabel = makeSvgElement("text", { x: width - margin.right - 4, y: reserveY - 7, "text-anchor": "end", class: "chart-reserve-label" });
  reserveLabel.textContent = `Reserva ${formatNumber(params.reserve)} L`;
  svg.append(reserveLabel);

  const exactPoints = [];
  const exactCount = Math.max(2, Math.ceil(300 * params.endTime / 1300));
  for (let i = 0; i <= exactCount; i += 1) {
    const time = params.endTime * i / exactCount;
    exactPoints.push([time, exactVolume(time, params)]);
  }
  const series = [
    { name: "Solución analítica", color: chartColors.exact, points: exactPoints, smooth: true },
    { name: `Heun · h = ${formatNumber(experiments[0].step)} min`, color: chartColors.heun, points: experiments[0].times.map((time, i) => [time, experiments[0].heun[i]]) },
    { name: `RK4 · h = ${formatNumber(experiments[0].step)} min`, color: chartColors.rk, points: experiments[0].times.map((time, i) => [time, experiments[0].rk4[i]]) },
    { name: `Heun · h = ${formatNumber(experiments[1].step)} min`, color: chartColors.heun, dash: "7 5", points: experiments[1].times.map((time, i) => [time, experiments[1].heun[i]]) },
    { name: `RK4 · h = ${formatNumber(experiments[1].step)} min`, color: chartColors.rk, dash: "7 5", points: experiments[1].times.map((time, i) => [time, experiments[1].rk4[i]]) }
  ];
  for (const item of series) {
    const pathData = item.points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point[0]).toFixed(2)},${y(point[1]).toFixed(2)}`).join(" ");
    const path = makeSvgElement("path", { d: pathData, class: "chart-line", stroke: item.color });
    if (item.dash) path.setAttribute("stroke-dasharray", item.dash);
    svg.append(path);
    if (!item.smooth) {
      for (const [time, volume] of item.points) {
        const point = makeSvgElement("circle", { cx: x(time), cy: y(volume), r: 3.2, fill: item.color, class: "chart-point" });
        const title = makeSvgElement("title");
        title.textContent = `${item.name}: t = ${formatNumber(time)} min, V = ${formatNumber(volume)} L`;
        point.append(title);
        svg.append(point);
      }
    }
    const legendItem = document.createElement("span");
    legendItem.className = "legend-item";
    const swatch = document.createElement("i");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = item.color;
    if (item.dash) {
      swatch.style.backgroundColor = "transparent";
      swatch.style.borderTop = `2px dashed ${item.color}`;
    }
    legendItem.append(swatch, document.createTextNode(item.name));
    legend.append(legendItem);
  }
}

function percentError(exact, approximate) {
  if (exact === 0) return "No definido";
  return `${formatError(Math.abs(exact - approximate) / Math.abs(exact) * 100)}%`;
}

function buildTable(experiment, index) {
  const card = document.createElement("article");
  card.className = "table-card";
  const heading = document.createElement("h4");
  heading.textContent = `Experimento ${index + 1} · h = ${formatNumber(experiment.step)} min`;
  const description = document.createElement("p");
  description.textContent = "Heun y RK4 usan el mismo paso; el último se ajusta al tiempo final si es necesario.";
  const wrapper = document.createElement("div");
  wrapper.className = "data-table-wrap";
  const table = document.createElement("table");
  table.className = "data-table";
  table.innerHTML = `<thead><tr>
    <th>Iter.</th><th>Tiempo<br>(min)</th><th>Exacta<br>(L)</th><th>Heun<br>(L)</th><th>RK4<br>(L)</th>
    <th>Error abs.<br>Heun</th><th>Error abs.<br>RK4</th><th>Error rel. %<br>Heun</th><th>Error rel. %<br>RK4</th>
  </tr></thead>`;
  const tbody = document.createElement("tbody");
  for (let i = 0; i < experiment.times.length; i += 1) {
    const exact = experiment.exact[i];
    const heun = experiment.heun[i];
    const rk4 = experiment.rk4[i];
    const row = document.createElement("tr");
    const cells = [
      i,
      formatNumber(experiment.times[i], 4),
      formatNumber(exact, 6),
      formatNumber(heun, 6),
      formatNumber(rk4, 6),
      formatError(Math.abs(exact - heun)),
      formatError(Math.abs(exact - rk4)),
      percentError(exact, heun),
      percentError(exact, rk4)
    ];
    for (let j = 0; j < cells.length; j += 1) {
      const cell = document.createElement(j === 0 ? "th" : "td");
      cell.textContent = String(cells[j]);
      if (j === 2) cell.className = "table-exact";
      if (j === 3 || j === 5 || j === 7) cell.classList.add("table-heun");
      if (j === 4 || j === 6 || j === 8) cell.classList.add("table-rk");
      row.append(cell);
    }
    tbody.append(row);
  }
  table.append(tbody);
  wrapper.append(table);
  card.append(heading, description, wrapper);
  return card;
}

function renderTables(experiments) {
  const container = document.getElementById("comparison-tables");
  container.replaceChildren(...experiments.map(buildTable));
}

function methodAccuracy(methodTime, exactTime) {
  if (!Number.isFinite(methodTime)) return Infinity;
  return Math.abs(methodTime - exactTime);
}

function renderInterpretation(params, experiments) {
  const exactTime = 2 * (Math.sqrt(params.volume) - Math.sqrt(params.reserve)) / params.k;
  const e1 = experiments[0];
  const e2 = experiments[1];
  const cards = [];
  const reachText = value => Number.isFinite(value) ? `aproximadamente ${formatNumber(value)} minutos (${formatNumber(value / 60)} horas)` : "no se alcanza dentro del intervalo de simulación";
  cards.push(["Autonomía estimada", `La solución analítica predice ${reachText(exactTime)} hasta llegar a la reserva mínima de ${formatNumber(params.reserve)} L.`]);
  const h1Best = methodAccuracy(e1.heunTime, exactTime) <= methodAccuracy(e1.rk4Time, exactTime) ? "Heun" : "RK4";
  const h2Best = methodAccuracy(e2.heunTime, exactTime) <= methodAccuracy(e2.rk4Time, exactTime) ? "Heun" : "RK4";
  const timeComparison = ["Heun", "RK4"].map(method => {
    const value = method === "Heun" ? e1.heunTime : e1.rk4Time;
    return `${method}: ${reachText(value)}; diferencia absoluta respecto al tiempo exacto: ${Number.isFinite(value) ? `${formatError(Math.abs(value - exactTime))} min` : "no calculable"}`;
  }).join(". ");
  cards.push(["Diferencia con el valor exacto", timeComparison + "."]);
  const bestMethodText = (experiment, best) => {
    if (!Number.isFinite(experiment.heunTime) && !Number.isFinite(experiment.rk4Time)) return "no se puede determinar porque ninguno cruza la reserva";
    return `${best} (h = ${formatNumber(experiment.step)} min)`;
  };
  cards.push(["Método con menor error", `Con h = ${formatNumber(e1.step)} min, el menor error temporal es de ${bestMethodText(e1, h1Best)}; con h = ${formatNumber(e2.step)} min, es de ${bestMethodText(e2, h2Best)}.`]);
  const heunErrorOne = methodAccuracy(e1.heunTime, exactTime);
  const heunErrorTwo = methodAccuracy(e2.heunTime, exactTime);
  const rkErrorOne = methodAccuracy(e1.rk4Time, exactTime);
  const rkErrorTwo = methodAccuracy(e2.rk4Time, exactTime);
  const showError = value => Number.isFinite(value) ? `${formatError(value)} min` : "no disponible";
  const trend = (first, second) => !Number.isFinite(first) && !Number.isFinite(second)
    ? "no se pudo comparar porque ninguno cruza la reserva"
    : second < first
      ? "disminuye"
      : second === first
        ? "se mantiene"
        : "aumenta";
  cards.push(["Efecto del tamaño de paso", `Al reducir h de ${formatNumber(e1.step)} a ${formatNumber(e2.step)} min, el error temporal de Heun ${trend(heunErrorOne, heunErrorTwo)} (${showError(heunErrorOne)} → ${showError(heunErrorTwo)}); el de RK4 ${trend(rkErrorOne, rkErrorTwo)} (${showError(rkErrorOne)} → ${showError(rkErrorTwo)}). El resultado corresponde a estos parámetros y pasos.`]);
  cards.push(["Importancia y limitaciones", `La estimación puede orientar la planificación del uso del agua, pero no sustituye mediciones: el modelo usa parámetros hipotéticos, supone una descarga simplificada y no representa un tanque real comprobado. La aplicación muestra cómo ecuaciones diferenciales y métodos numéricos ayudan a estudiar ese comportamiento.`]);
  const container = document.getElementById("interpretation-content");
  container.replaceChildren();
  for (const [title, body] of cards) {
    const item = document.createElement("article");
    item.className = "interpretation-item";
    const heading = document.createElement("h4");
    heading.textContent = title;
    const text = document.createElement("p");
    text.textContent = body;
    item.append(heading, text);
    container.append(item);
  }
}

function runSimulation(params, isDefault = false) {
  const experiments = [buildExperiment(params, params.stepOne), buildExperiment(params, params.stepTwo)];
  renderReference(params);
  renderMetrics(params, experiments);
  renderChart(params, experiments);
  renderTables(experiments);
  renderInterpretation(params, experiments);
  setText("run-status", isDefault ? "Parámetros predeterminados" : "Simulación actualizada");
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const params = readParameters();
  if (!params) return;
  try {
    runSimulation(params);
  } catch (error) {
    validationMessage.textContent = `No fue posible ejecutar la simulación: ${error.message}`;
    validationMessage.hidden = false;
  }
});

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    validationMessage.hidden = true;
    for (const input of Object.values(inputs)) input.setAttribute("aria-invalid", "false");
    runSimulation(defaults, true);
  }, 0);
});

for (const input of Object.values(inputs)) {
  input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
}

runSimulation(defaults, true);
