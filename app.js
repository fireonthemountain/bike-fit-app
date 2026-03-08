// ── Gravel Bike Fit App ──

(function() {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  let currentStep = 1;
  const totalSteps = 4;
  let allResults = [];
  let ideal = null;
  let compareList = [];

  // ── Start ──
  $("#start-btn").addEventListener("click", () => {
    $(".hero").classList.add("hidden");
    $("#wizard").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ── Unit toggles ──
  $$(".unit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.field;
      const unit = btn.dataset.unit;
      const group = btn.closest(".input-group");
      group.querySelectorAll(".unit-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      group.querySelectorAll(".input-row").forEach(row => row.classList.add("hidden"));
      $(`#${field}-${unit}-input`).classList.remove("hidden");
    });
  });

  // ── Wizard navigation ──
  function showStep(n) {
    $$(".step").forEach(s => s.classList.remove("active"));
    $(`.step[data-step="${n}"]`).classList.add("active");
    currentStep = n;

    $("#progress-fill").style.width = `${(n / totalSteps) * 100}%`;
    $("#step-label").textContent = `Step ${n} of ${totalSteps}`;

    $("#prev-btn").classList.toggle("hidden", n === 1);
    $("#next-btn").classList.toggle("hidden", n === totalSteps);
    $("#calc-btn").classList.toggle("hidden", n !== totalSteps);
  }

  $("#next-btn").addEventListener("click", () => {
    if (validateStep(currentStep)) showStep(currentStep + 1);
  });
  $("#prev-btn").addEventListener("click", () => showStep(currentStep - 1));

  // ── Validation ──
  function validateStep(step) {
    if (step === 1) {
      const h = getHeight();
      if (!h || h < 140 || h > 215) { shake(step); return false; }
    }
    if (step === 2) {
      const i = getInseam();
      if (!i || i < 60 || i > 105) { shake(step); return false; }
    }
    if (step === 3) {
      const a = getArmspan();
      if (!a || a < 140 || a > 225) { shake(step); return false; }
    }
    return true;
  }

  function shake(step) {
    const el = $(`.step[data-step="${step}"] .step-form`);
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "shake 0.4s ease";
  }

  // ── Read measurements ──
  function getHeight() {
    if (!$(`#height-cm-input`).classList.contains("hidden")) {
      return parseFloat($("#height-cm").value);
    }
    const ft = parseFloat($("#height-ft").value) || 0;
    const inches = parseFloat($("#height-in").value) || 0;
    return (ft * 12 + inches) * 2.54;
  }

  function getInseam() {
    if (!$(`#inseam-cm-input`).classList.contains("hidden")) {
      return parseFloat($("#inseam-cm").value);
    }
    return parseFloat($("#inseam-in").value) * 2.54;
  }

  function getArmspan() {
    if (!$(`#armspan-cm-input`).classList.contains("hidden")) {
      return parseFloat($("#armspan-cm").value);
    }
    return parseFloat($("#armspan-in").value) * 2.54;
  }

  function getStyle() {
    return document.querySelector('input[name="style"]:checked').value;
  }

  // ── Calculate ──
  $("#calc-btn").addEventListener("click", () => {
    if (!validateStep(4)) return;

    const heightCm = getHeight();
    const inseamCm = getInseam();
    const armspanCm = getArmspan();
    const style = getStyle();

    ideal = FitEngine.computeIdeal(heightCm, inseamCm, armspanCm, style);
    allResults = FitEngine.scoreAll(ideal);

    renderResults();
    $("#wizard").classList.add("hidden");
    $("#results").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ── Back to measurements ──
  $("#back-to-measurements").addEventListener("click", () => {
    $("#results").classList.add("hidden");
    $("#wizard").classList.remove("hidden");
  });

  // ── Render results ──
  function renderResults() {
    renderSummary();
    populateBrandFilter();
    renderGrid(getFilteredResults());
  }

  function renderSummary() {
    const s = ideal;
    $("#fit-summary").innerHTML = `
      <div class="fit-stat"><span class="label">Height</span><span class="value">${Math.round(s.heightCm)} cm</span></div>
      <div class="fit-stat"><span class="label">Inseam</span><span class="value">${Math.round(s.inseamCm)} cm</span></div>
      <div class="fit-stat"><span class="label">Arm Span</span><span class="value">${Math.round(s.armspanCm)} cm</span></div>
      <div class="fit-stat"><span class="label">Style</span><span class="value">${s.styleLabel}</span></div>
      <div class="fit-stat"><span class="label">Ideal Stack</span><span class="value">${s.stack} mm</span></div>
      <div class="fit-stat"><span class="label">Ideal Reach</span><span class="value">${s.reach} mm</span></div>
      <div class="fit-stat"><span class="label">S/R Ratio</span><span class="value">${s.stackReachRatio}</span></div>
      <div class="fit-stat"><span class="label">Bikes Analyzed</span><span class="value">${allResults.length}</span></div>
    `;
  }

  function populateBrandFilter() {
    const brands = [...new Set(allResults.map(r => r.bike.brand))].sort();
    const sel = $("#brand-filter");
    sel.innerHTML = '<option value="all">All Brands</option>';
    brands.forEach(b => {
      sel.innerHTML += `<option value="${b}">${b}</option>`;
    });
  }

  function getFilteredResults() {
    let results = [...allResults];
    const brand = $("#brand-filter").value;
    const fit = $("#fit-filter").value;
    const sort = $("#sort-select").value;

    if (brand !== "all") results = results.filter(r => r.bike.brand === brand);
    if (fit === "excellent") results = results.filter(r => r.rating === "excellent");
    else if (fit === "good") results = results.filter(r => r.rating === "excellent" || r.rating === "good");

    if (sort === "brand") results.sort((a, b) => a.bike.brand.localeCompare(b.bike.brand) || b.score - a.score);
    else if (sort === "stack") results.sort((a, b) => a.bike.stack - b.bike.stack);
    else if (sort === "reach") results.sort((a, b) => a.bike.reach - b.bike.reach);
    // default: score desc (already sorted)

    return results;
  }

  function renderGrid(results) {
    const grid = $("#results-grid");
    $("#result-count").textContent = `${results.length} bike${results.length !== 1 ? "s" : ""} found`;

    if (results.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text3)">No bikes match your filters. Try broadening your search.</div>';
      return;
    }

    grid.innerHTML = results.map((r, i) => {
      const b = r.bike;
      const d = r.deltas;
      const deltaClass = v => v > 5 ? "over" : v < -5 ? "under" : "ideal";
      const deltaStr = v => v > 0 ? `+${v}` : `${v}`;
      const checked = compareList.some(c => c.bike.brand === b.brand && c.bike.model === b.model && c.bike.size === b.size);

      return `
        <div class="bike-card ${r.rating}" data-idx="${i}">
          <div class="card-top">
            <div>
              <span class="bike-brand">${b.brand}</span>
              <div class="bike-model">${b.model}</div>
              <span class="bike-size">Size ${b.size} &middot; ${b.year}</span>
            </div>
            <span class="fit-badge ${r.rating}">${r.score}% ${r.rating}</span>
          </div>
          <div class="score-bar"><div class="score-fill ${r.rating}" style="width:${r.score}%"></div></div>
          <div class="card-geo">
            <div class="geo-item">
              <span class="geo-label">Stack</span>
              <span class="geo-val">${b.stack}</span>
              <span class="geo-delta ${deltaClass(d.stack)}">${deltaStr(d.stack)}mm</span>
            </div>
            <div class="geo-item">
              <span class="geo-label">Reach</span>
              <span class="geo-val">${b.reach}</span>
              <span class="geo-delta ${deltaClass(d.reach)}">${deltaStr(d.reach)}mm</span>
            </div>
            <div class="geo-item">
              <span class="geo-label">S/R Ratio</span>
              <span class="geo-val">${b.sr}</span>
              <span class="geo-delta ${deltaClass(d.sr * 100)}">${d.sr > 0 ? "+" : ""}${d.sr}</span>
            </div>
          </div>
          <div class="card-actions">
            <label class="compare-check">
              <input type="checkbox" class="compare-cb" data-idx="${i}" ${checked ? "checked" : ""}>
              Compare
            </label>
            <button class="detail-toggle" data-idx="${i}">Details</button>
          </div>
          <div class="card-details" id="details-${i}">
            <div class="detail-grid">
              <div class="detail-row"><span class="dlabel">Eff. Top Tube</span><span class="dval">${b.ett}mm <small class="${deltaClass(d.ett)}">(${deltaStr(d.ett)})</small></span></div>
              <div class="detail-row"><span class="dlabel">Head Tube</span><span class="dval">${b.htLength}mm</span></div>
              <div class="detail-row"><span class="dlabel">Seat Tube</span><span class="dval">${b.stLength}mm <small class="${deltaClass(d.seatTube)}">(${deltaStr(d.seatTube)})</small></span></div>
              <div class="detail-row"><span class="dlabel">HT Angle</span><span class="dval">${b.htAngle}&deg;</span></div>
              <div class="detail-row"><span class="dlabel">ST Angle</span><span class="dval">${b.stAngle}&deg;</span></div>
              <div class="detail-row"><span class="dlabel">Chainstay</span><span class="dval">${b.chainstay}mm</span></div>
              <div class="detail-row"><span class="dlabel">Wheelbase</span><span class="dval">${b.wheelbase}mm</span></div>
              <div class="detail-row"><span class="dlabel">BB Drop</span><span class="dval">${b.bbDrop}mm</span></div>
              ${b.standover ? `<div class="detail-row"><span class="dlabel">Standover</span><span class="dval">${b.standover}mm</span></div>` : ""}
            </div>
            <div class="fit-explanation">${FitEngine.explainFit(r, ideal)}</div>
          </div>
        </div>`;
    }).join("");

    // Detail toggles
    grid.querySelectorAll(".detail-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const det = $(`#details-${btn.dataset.idx}`);
        det.classList.toggle("open");
        btn.textContent = det.classList.contains("open") ? "Hide" : "Details";
      });
    });

    // Compare checkboxes
    grid.querySelectorAll(".compare-cb").forEach(cb => {
      cb.addEventListener("change", () => {
        const idx = parseInt(cb.dataset.idx);
        const filtered = getFilteredResults();
        const result = filtered[idx];
        if (cb.checked) {
          if (compareList.length >= 3) { cb.checked = false; return; }
          compareList.push(result);
        } else {
          compareList = compareList.filter(c =>
            !(c.bike.brand === result.bike.brand && c.bike.model === result.bike.model && c.bike.size === result.bike.size));
        }
        updateComparePanel();
      });
    });
  }

  // ── Filters ──
  ["sort-select", "brand-filter", "fit-filter"].forEach(id => {
    $(`#${id}`).addEventListener("change", () => renderGrid(getFilteredResults()));
  });

  // ── Compare panel ──
  function updateComparePanel() {
    const panel = $("#compare-panel");
    if (compareList.length === 0) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    $("#compare-count").textContent = compareList.length;
    $("#compare-bikes").innerHTML = compareList.map(r =>
      `<span class="compare-chip">${r.bike.brand} ${r.bike.model} (${r.bike.size})</span>`
    ).join("");
    $("#compare-btn").disabled = compareList.length < 2;
  }

  $("#compare-clear").addEventListener("click", () => {
    compareList = [];
    updateComparePanel();
    renderGrid(getFilteredResults());
  });

  // ── Compare modal ──
  $("#compare-btn").addEventListener("click", () => {
    renderComparison();
    $("#compare-modal").classList.remove("hidden");
  });

  $("#modal-close").addEventListener("click", () => {
    $("#compare-modal").classList.add("hidden");
  });

  $("#compare-modal").addEventListener("click", (e) => {
    if (e.target === $("#compare-modal")) $("#compare-modal").classList.add("hidden");
  });

  function renderComparison() {
    const fields = [
      ["Fit Score", r => r.score + "%", (a, b) => parseInt(a) > parseInt(b)],
      ["Stack", r => r.bike.stack + "mm", (a, b) => Math.abs(parseInt(a) - ideal.stack) < Math.abs(parseInt(b) - ideal.stack)],
      ["Reach", r => r.bike.reach + "mm", (a, b) => Math.abs(parseInt(a) - ideal.reach) < Math.abs(parseInt(b) - ideal.reach)],
      ["S/R Ratio", r => r.bike.sr, (a, b) => Math.abs(parseFloat(a) - ideal.stackReachRatio) < Math.abs(parseFloat(b) - ideal.stackReachRatio)],
      ["Eff. Top Tube", r => r.bike.ett + "mm"],
      ["Head Tube Length", r => r.bike.htLength + "mm"],
      ["Seat Tube Length", r => r.bike.stLength + "mm"],
      ["HT Angle", r => r.bike.htAngle + "\u00B0"],
      ["ST Angle", r => r.bike.stAngle + "\u00B0"],
      ["Chainstay", r => r.bike.chainstay + "mm"],
      ["Wheelbase", r => r.bike.wheelbase + "mm"],
      ["BB Drop", r => r.bike.bbDrop + "mm"],
    ];

    let html = '<table class="compare-table"><thead><tr><th>Geometry</th>';
    compareList.forEach(r => {
      html += `<th>${r.bike.brand}<br>${r.bike.model} (${r.bike.size})</th>`;
    });
    html += `<th>Your Ideal</th></tr></thead><tbody>`;

    fields.forEach(([label, getter, bestFn]) => {
      const vals = compareList.map(r => getter(r));
      html += `<tr><td>${label}</td>`;
      vals.forEach((v, i) => {
        let cls = "";
        if (bestFn && vals.length > 1) {
          const isBest = vals.every((other, j) => j === i || bestFn(v, other));
          if (isBest) cls = ' class="best"';
        }
        html += `<td${cls}>${v}</td>`;
      });
      // Ideal column
      const idealVals = {
        "Fit Score": "100%",
        "Stack": ideal.stack + "mm",
        "Reach": ideal.reach + "mm",
        "S/R Ratio": ideal.stackReachRatio,
        "Eff. Top Tube": ideal.ett + "mm",
        "Seat Tube Length": ideal.seatTube + "mm",
      };
      html += `<td style="color:var(--text3)">${idealVals[label] || "—"}</td></tr>`;
    });
    html += "</tbody></table>";

    $("#compare-table-container").innerHTML = html;

    // Visual bar chart for stack/reach
    const colors = ["#4f8cff", "#6c5ce7", "#00d67e"];
    const chartFields = [
      { label: "Stack", key: "stack", min: 490, max: 660 },
      { label: "Reach", key: "reach", min: 340, max: 430 },
      { label: "ETT", key: "ett", min: 490, max: 620 },
    ];

    let chartHtml = "";
    chartFields.forEach(cf => {
      chartHtml += `<div class="chart-row"><span class="chart-label">${cf.label}</span><div class="chart-bars">`;
      compareList.forEach((r, i) => {
        const val = r.bike[cf.key];
        const pct = ((val - cf.min) / (cf.max - cf.min)) * 100;
        chartHtml += `<div class="chart-bar" style="width:${Math.max(5, pct)}%;background:${colors[i]}"><span>${val}</span></div>`;
      });
      // Ideal marker
      const ival = ideal[cf.key === "ett" ? "ett" : cf.key];
      if (ival) {
        const pct = ((ival - cf.min) / (cf.max - cf.min)) * 100;
        chartHtml += `<div style="position:absolute;left:${pct}%;top:-2px;bottom:-2px;width:2px;background:var(--red)" title="Ideal: ${ival}mm"></div>`;
      }
      chartHtml += "</div></div>";
    });
    $("#compare-chart").innerHTML = chartHtml;
  }

  // Shake animation
  const style = document.createElement("style");
  style.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`;
  document.head.appendChild(style);
})();
