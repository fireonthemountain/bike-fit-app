// ── Gravel Bike Fit App ──

(function() {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  let currentStep = 1;
  const totalSteps = 4;
  let allResults = [];
  let ideal = null;
  let compareList = [];
  let currentSort = { key: "score", dir: "desc" };

  // ── Start ──
  $("#start-btn").addEventListener("click", () => {
    $(".hero").classList.add("hidden");
    $("#wizard").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ── Test profile ──
  $("#test-btn").addEventListener("click", () => {
    $("#height-ft").value = "6";
    $("#height-in").value = "1";
    $("#inseam-in").value = "32";
    $("#armspan-in").value = "68";
    document.querySelector('input[name="style"][value="moderate"]').checked = true;

    $(".hero").classList.add("hidden");
    $("#wizard").classList.remove("hidden");

    const heightCm = (6 * 12 + 1) * 2.54;
    const inseamCm = 32 * 2.54;
    const armspanCm = 68 * 2.54;

    ideal = FitEngine.computeIdeal(heightCm, inseamCm, armspanCm, "moderate");
    allResults = FitEngine.scoreAll(ideal);
    computeValueScores();
    renderResults();
    $("#wizard").classList.add("hidden");
    $("#results").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      if (!h || h < 137 || h > 218) { shake(step); return false; }
    }
    if (step === 2) {
      const i = getInseam();
      if (!i || i < 58 || i > 107) { shake(step); return false; }
    }
    if (step === 3) {
      const a = getArmspan();
      if (!a || a < 137 || a > 224) { shake(step); return false; }
    }
    return true;
  }

  function shake(step) {
    const el = $(`.step[data-step="${step}"] .step-form`);
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "shake 0.4s ease";
  }

  // ── Read measurements (inches → cm) ──
  function getHeight() {
    const ft = parseFloat($("#height-ft").value) || 0;
    const inches = parseFloat($("#height-in").value) || 0;
    return (ft * 12 + inches) * 2.54;
  }

  function getInseam() {
    return parseFloat($("#inseam-in").value) * 2.54;
  }

  function getArmspan() {
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

    // Compute value scores
    computeValueScores();

    renderResults();
    $("#wizard").classList.add("hidden");
    $("#results").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ── Value score computation ──
  function computeValueScores() {
    const prices = allResults.filter(r => r.bike.price > 0).map(r => r.bike.price);
    const maxPrice = Math.max(...prices, 1);
    const minPrice = Math.min(...prices, 0);
    const range = maxPrice - minPrice || 1;

    allResults.forEach(r => {
      if (r.bike.price > 0) {
        const normalizedPrice = (r.bike.price - minPrice) / range;
        r.valueScore = Math.round(r.score * (1 + (1 - normalizedPrice)));
      } else {
        r.valueScore = 0;
      }
    });
  }

  // ── Back to measurements ──
  $("#back-to-measurements").addEventListener("click", () => {
    $("#results").classList.add("hidden");
    $("#wizard").classList.remove("hidden");
  });

  // ── Render results ──
  function renderResults() {
    renderSummary();
    renderDistribution();
    populateBrandFilter();
    renderTable(getFilteredResults());
  }

  function renderDistribution() {
    // Bucket scores into 5% increments
    const buckets = [];
    for (let i = 0; i < 20; i++) buckets.push({ min: i * 5, max: (i + 1) * 5, count: 0 });
    allResults.forEach(r => {
      const idx = Math.min(Math.floor(r.score / 5), 19);
      buckets[idx].count++;
    });

    const maxCount = Math.max(...buckets.map(b => b.count), 1);
    const barsEl = $("#dist-bars");

    barsEl.innerHTML = buckets.map(b => {
      const pct = (b.count / maxCount) * 100;
      let color;
      if (b.min >= 85) color = "var(--green)";
      else if (b.min >= 70) color = "var(--yellow)";
      else color = "var(--text3)";

      return `<div class="dist-bar-col">
        <div class="dist-bar" style="height:${Math.max(pct, b.count > 0 ? 3 : 0)}%;background:${color}" title="${b.min}-${b.max}%: ${b.count} bikes">
          ${b.count > 0 ? `<span class="dist-bar-count">${b.count}</span>` : ""}
        </div>
        <span class="dist-bar-label">${b.min}%</span>
      </div>`;
    }).join("");
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

  let selectedBrands = new Set(); // empty = all

  function populateBrandFilter() {
    const brands = [...new Set(allResults.map(r => r.bike.brand))].sort();
    selectedBrands = new Set(brands); // start with all selected
    const opts = $("#brand-options");
    opts.innerHTML = brands.map(b =>
      `<label class="ms-option"><input type="checkbox" value="${b}" checked>${b}</label>`
    ).join("");

    opts.querySelectorAll("input").forEach(cb => {
      cb.addEventListener("change", () => {
        if (cb.checked) selectedBrands.add(cb.value);
        else selectedBrands.delete(cb.value);
        updateBrandToggleLabel();
        renderTable(getFilteredResults());
      });
    });

    $("#brand-select-all").addEventListener("click", () => {
      selectedBrands = new Set(brands);
      opts.querySelectorAll("input").forEach(cb => cb.checked = true);
      updateBrandToggleLabel();
      renderTable(getFilteredResults());
    });

    $("#brand-select-none").addEventListener("click", () => {
      selectedBrands.clear();
      opts.querySelectorAll("input").forEach(cb => cb.checked = false);
      updateBrandToggleLabel();
      renderTable(getFilteredResults());
    });

    updateBrandToggleLabel();
  }

  function updateBrandToggleLabel() {
    const allBrands = [...new Set(allResults.map(r => r.bike.brand))];
    const btn = $("#brand-toggle");
    if (selectedBrands.size === 0) btn.innerHTML = 'No Brands <span class="ms-arrow">▾</span>';
    else if (selectedBrands.size === allBrands.length) btn.innerHTML = 'All Brands <span class="ms-arrow">▾</span>';
    else btn.innerHTML = `<span class="ms-badge">${selectedBrands.size}</span> Brand${selectedBrands.size !== 1 ? "s" : ""} <span class="ms-arrow">▾</span>`;
  }

  // Toggle dropdown
  $("#brand-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    $("#brand-dropdown").classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#brand-multi")) $("#brand-dropdown").classList.add("hidden");
  });

  function getFilteredResults() {
    let results = [...allResults];
    const fit = $("#fit-filter").value;
    const price = $("#price-filter").value;
    const bikepack = $("#bikepack-filter").value;

    if (selectedBrands.size > 0 && selectedBrands.size < new Set(allResults.map(r => r.bike.brand)).size) {
      results = results.filter(r => selectedBrands.has(r.bike.brand));
    } else if (selectedBrands.size === 0) {
      results = [];
    }
    if (fit === "excellent") results = results.filter(r => r.rating === "excellent");
    else if (fit === "good") results = results.filter(r => r.rating === "excellent" || r.rating === "good");

    if (price === "budget") results = results.filter(r => r.bike.price > 0 && r.bike.price < 1500);
    else if (price === "mid") results = results.filter(r => r.bike.price >= 1500 && r.bike.price <= 3000);
    else if (price === "upper") results = results.filter(r => r.bike.price > 3000 && r.bike.price <= 5000);
    else if (price === "premium") results = results.filter(r => r.bike.price > 5000 && r.bike.price <= 8000);
    else if (price === "ultra") results = results.filter(r => r.bike.price > 8000);

    if (bikepack === "3") results = results.filter(r => r.bike.bikepack === 3);
    else if (bikepack === "2+") results = results.filter(r => r.bike.bikepack >= 2);

    // Sort
    const sk = currentSort.key;
    const dir = currentSort.dir === "asc" ? 1 : -1;
    results.sort((a, b) => {
      let va, vb;
      if (sk === "brand") {
        va = a.bike.brand + " " + a.bike.model;
        vb = b.bike.brand + " " + b.bike.model;
        return dir * va.localeCompare(vb);
      }
      if (sk === "score") { va = a.score; vb = b.score; }
      else if (sk === "value") { va = a.valueScore; vb = b.valueScore; }
      else if (sk === "stack") { va = a.bike.stack; vb = b.bike.stack; }
      else if (sk === "reach") { va = a.bike.reach; vb = b.bike.reach; }
      else if (sk === "sr") { va = a.bike.sr; vb = b.bike.sr; }
      else if (sk === "price") { va = a.bike.price || 99999; vb = b.bike.price || 99999; }
      else if (sk === "bikepack") { va = a.bike.bikepack; vb = b.bike.bikepack; }
      else { va = a.score; vb = b.score; }
      return dir * (va - vb);
    });

    return results;
  }

  // ── Bikepacking label ──
  function bikepackLabel(val) {
    if (val === 3) return '<span class="bp-stars bp3" title="Excellent bikepacking">★★★</span>';
    if (val === 2) return '<span class="bp-stars bp2" title="Good bikepacking">★★</span>';
    if (val === 1) return '<span class="bp-stars bp1" title="Limited bikepacking">★</span>';
    return '<span class="bp-stars bp0" title="Race-focused">—</span>';
  }

  // ── Price format ──
  function fmtPrice(p) {
    if (!p) return '<span class="text-muted">—</span>';
    return "$" + p.toLocaleString();
  }

  // ── Render table ──
  function renderTable(results) {
    const tbody = $("#results-tbody");
    $("#result-count").textContent = `${results.length} bike${results.length !== 1 ? "s" : ""} found`;

    if (results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text3)">No bikes match your filters.</td></tr>';
      return;
    }

    const deltaClass = v => v > 5 ? "over" : v < -5 ? "under" : "ideal";
    const deltaStr = v => v > 0 ? `+${v}` : `${v}`;

    tbody.innerHTML = results.map((r, i) => {
      const b = r.bike;
      const d = r.deltas;
      const checked = compareList.some(c => c.bike.brand === b.brand && c.bike.model === b.model && c.bike.size === b.size);

      return `
        <tr class="result-row ${r.rating}" data-idx="${i}">
          <td class="col-bike">
            <div class="bike-name-cell">
              <span class="bike-brand">${b.brand}</span>
              <span class="bike-model">${b.model}</span>
              <span class="bike-size">Size ${b.size} · ${b.year}</span>
            </div>
          </td>
          <td class="col-score"><span class="fit-badge ${r.rating}">${r.score}%</span></td>
          <td class="col-value">${r.valueScore > 0 ? r.valueScore : '—'}</td>
          <td class="col-num">${b.stack} <small class="geo-delta ${deltaClass(d.stack)}">${deltaStr(d.stack)}</small></td>
          <td class="col-num">${b.reach} <small class="geo-delta ${deltaClass(d.reach)}">${deltaStr(d.reach)}</small></td>
          <td class="col-num">${b.sr}</td>
          <td class="col-num">${fmtPrice(b.price)}</td>
          <td class="col-center">${bikepackLabel(b.bikepack)}</td>
          <td class="col-center">
            <input type="checkbox" class="compare-cb" data-idx="${i}" ${checked ? "checked" : ""}>
          </td>
        </tr>
        <tr class="detail-row hidden" id="detail-${i}">
          <td colspan="9">
            <div class="detail-content">
              <div class="detail-grid">
                <div class="detail-row-item"><span class="dlabel">Eff. Top Tube</span><span class="dval">${b.ett}mm <small class="${deltaClass(d.ett)}">(${deltaStr(d.ett)})</small></span></div>
                <div class="detail-row-item"><span class="dlabel">Head Tube</span><span class="dval">${b.htLength}mm</span></div>
                <div class="detail-row-item"><span class="dlabel">Seat Tube</span><span class="dval">${b.stLength}mm <small class="${deltaClass(d.seatTube)}">(${deltaStr(d.seatTube)})</small></span></div>
                <div class="detail-row-item"><span class="dlabel">HT Angle</span><span class="dval">${b.htAngle}&deg;</span></div>
                <div class="detail-row-item"><span class="dlabel">ST Angle</span><span class="dval">${b.stAngle}&deg;</span></div>
                <div class="detail-row-item"><span class="dlabel">Chainstay</span><span class="dval">${b.chainstay}mm</span></div>
                <div class="detail-row-item"><span class="dlabel">Wheelbase</span><span class="dval">${b.wheelbase}mm</span></div>
                <div class="detail-row-item"><span class="dlabel">BB Drop</span><span class="dval">${b.bbDrop}mm</span></div>
                ${b.standover ? `<div class="detail-row-item"><span class="dlabel">Standover</span><span class="dval">${b.standover}mm</span></div>` : ""}
              </div>
              <div class="fit-explanation">${FitEngine.explainFit(r, ideal)}</div>
            </div>
          </td>
        </tr>`;
    }).join("");

    // Row click to expand details
    tbody.querySelectorAll(".result-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.type === "checkbox") return;
        const idx = row.dataset.idx;
        const det = $(`#detail-${idx}`);
        det.classList.toggle("hidden");
        row.classList.toggle("expanded");
      });
    });

    // Compare checkboxes
    tbody.querySelectorAll(".compare-cb").forEach(cb => {
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

  // ── Column sorting ──
  $$(".results-table th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (currentSort.key === key) {
        currentSort.dir = currentSort.dir === "desc" ? "asc" : "desc";
      } else {
        currentSort.key = key;
        currentSort.dir = (key === "brand") ? "asc" : "desc";
      }
      // Update header arrows
      $$(".results-table th.sortable").forEach(h => {
        h.classList.remove("sorted", "asc", "desc");
        h.querySelector(".sort-arrow").textContent = "";
      });
      th.classList.add("sorted", currentSort.dir);
      th.querySelector(".sort-arrow").textContent = currentSort.dir === "asc" ? "▲" : "▼";

      renderTable(getFilteredResults());
    });
  });

  // ── Filters ──
  ["fit-filter", "price-filter", "bikepack-filter"].forEach(id => {
    $(`#${id}`).addEventListener("change", () => renderTable(getFilteredResults()));
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
    renderTable(getFilteredResults());
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

  // ── Geometry overlay SVG ──
  function renderGeometryOverlay() {
    const svg = $("#overlay-svg");
    const colors = ["#4f8cff", "#6c5ce7", "#00d67e"];
    const idealColor = "#e74c3c";

    // Legend
    let legendHtml = "";
    compareList.forEach((r, i) => {
      legendHtml += `<div class="legend-item"><span class="legend-swatch" style="background:${colors[i]}"></span>${r.bike.brand} ${r.bike.model} (${r.bike.size})</div>`;
    });
    legendHtml += `<div class="legend-item"><span class="legend-swatch" style="background:${idealColor};height:2px;border-top:1px dashed ${idealColor}"></span>Your Ideal</div>`;
    $("#overlay-legend").innerHTML = legendHtml;

    // Compute frame geometry points for each bike
    // All bikes aligned at bottom bracket (BB). We draw:
    // BB -> Seat tube top (using ST angle + ST length)
    // BB -> Head tube bottom (using reach/stack to find HT bottom, then HT angle + HT length for HT top)
    // Rear axle (BB - chainstay, 0)
    // Front axle (BB + fork to front axle using wheelbase - chainstay offset)
    // Wheels drawn as circles (700c = 622mm BSD + ~50mm tire = ~336mm radius)

    const wheelRadius = 336; // ~700x40c
    const scale = 0.45; // scale mm to SVG px
    const svgW = svg.clientWidth || 860;
    const svgH = 400;
    svg.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);

    // Find centering offset: place BB at a good spot
    const bbX = svgW * 0.52;
    const bbY = svgH * 0.78;

    let paths = "";

    function drawBike(r, color, strokeW, dashArray) {
      const b = r.bike;
      const s = scale;

      // Seat tube: angle from horizontal, going up-left from BB
      const stRad = b.stAngle * Math.PI / 180;
      const stTopX = bbX - Math.cos(stRad) * b.stLength * s;
      const stTopY = bbY - Math.sin(stRad) * b.stLength * s;

      // Head tube bottom: use stack/reach from BB
      // Stack is vertical, reach is horizontal from BB
      const htBottomX = bbX + b.reach * s;
      const htBottomY = bbY - b.stack * s;

      // Head tube top: extend HT length along HT angle from bottom
      const htRad = b.htAngle * Math.PI / 180;
      const htTopX = htBottomX - Math.cos(htRad) * b.htLength * s;
      const htTopY = htBottomY - Math.sin(htRad) * b.htLength * s;

      // Top tube: seat tube top to head tube top
      // Down tube: BB area to head tube bottom

      // Rear axle: chainstay back from BB (roughly horizontal, accounting for BB drop)
      const rearAxleX = bbX - Math.sqrt(b.chainstay * b.chainstay - b.bbDrop * b.bbDrop) * s;
      const rearAxleY = bbY + b.bbDrop * s;

      // Front axle: wheelbase from rear axle
      const frontAxleX = rearAxleX + b.wheelbase * s;
      const frontAxleY = rearAxleY;

      const wr = wheelRadius * s;
      const da = dashArray ? ` stroke-dasharray="${dashArray}"` : "";

      // Frame lines
      paths += `
        <!-- ${b.brand} ${b.model} -->
        <line x1="${bbX}" y1="${bbY}" x2="${stTopX}" y2="${stTopY}" stroke="${color}" stroke-width="${strokeW}" opacity="0.85"${da}/>
        <line x1="${stTopX}" y1="${stTopY}" x2="${htTopX}" y2="${htTopY}" stroke="${color}" stroke-width="${strokeW}" opacity="0.85"${da}/>
        <line x1="${bbX}" y1="${bbY}" x2="${htBottomX}" y2="${htBottomY}" stroke="${color}" stroke-width="${strokeW}" opacity="0.85"${da}/>
        <line x1="${htBottomX}" y1="${htBottomY}" x2="${htTopX}" y2="${htTopY}" stroke="${color}" stroke-width="${strokeW * 1.5}" opacity="0.85"${da}/>
        <line x1="${bbX}" y1="${bbY}" x2="${rearAxleX}" y2="${rearAxleY}" stroke="${color}" stroke-width="${strokeW}" opacity="0.6"${da}/>
        <line x1="${htBottomX}" y1="${htBottomY}" x2="${frontAxleX}" y2="${frontAxleY}" stroke="${color}" stroke-width="${strokeW}" opacity="0.6"${da}/>
        <circle cx="${rearAxleX}" cy="${rearAxleY}" r="${wr}" fill="none" stroke="${color}" stroke-width="1" opacity="0.25"${da}/>
        <circle cx="${frontAxleX}" cy="${frontAxleY}" r="${wr}" fill="none" stroke="${color}" stroke-width="1" opacity="0.25"${da}/>
        <circle cx="${bbX}" cy="${bbY}" r="4" fill="${color}" opacity="0.7"/>
      `;
    }

    // Draw ideal as dashed reference
    if (ideal) {
      const idealBike = {
        bike: {
          brand: "Ideal", model: "", size: "",
          stack: ideal.stack, reach: ideal.reach,
          stAngle: 73.0, htAngle: 71.5,
          stLength: ideal.seatTube, htLength: 140,
          chainstay: 425, wheelbase: 1020,
          bbDrop: 72, ett: ideal.ett,
        }
      };
      drawBike(idealBike, idealColor, 1.5, "6,4");
    }

    // Draw selected bikes
    compareList.forEach((r, i) => {
      drawBike(r, colors[i], 2.5, "");
    });

    // BB marker
    paths += `<circle cx="${bbX}" cy="${bbY}" r="3" fill="var(--text3)"/>`;
    paths += `<text x="${bbX + 6}" y="${bbY + 14}" class="overlay-dim">BB</text>`;

    // Dimension annotations for first bike
    if (compareList.length > 0) {
      const b = compareList[0].bike;
      const s = scale;
      // Stack dimension line
      const stackTopY = bbY - b.stack * s;
      const dimX = bbX + b.reach * s + 20;
      paths += `<line x1="${dimX}" y1="${bbY}" x2="${dimX}" y2="${stackTopY}" stroke="var(--text3)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
      paths += `<text x="${dimX + 4}" y="${(bbY + stackTopY) / 2 + 4}" class="overlay-dim">Stack</text>`;

      // Reach dimension line
      const dimY = bbY + 20;
      const reachEndX = bbX + b.reach * s;
      paths += `<line x1="${bbX}" y1="${dimY}" x2="${reachEndX}" y2="${dimY}" stroke="var(--text3)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
      paths += `<text x="${(bbX + reachEndX) / 2 - 15}" y="${dimY + 14}" class="overlay-dim">Reach</text>`;
    }

    svg.innerHTML = paths;
  }

  function renderComparison() {
    const fields = [
      ["Fit Score", r => r.score + "%", (a, b) => parseInt(a) > parseInt(b)],
      ["Value Score", r => r.valueScore > 0 ? r.valueScore : "—", (a, b) => parseInt(a) > parseInt(b)],
      ["Price", r => r.bike.price ? "$" + r.bike.price.toLocaleString() : "—"],
      ["Bikepacking", r => ["—", "★", "★★", "★★★"][r.bike.bikepack]],
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
        "Value Score": "—",
        "Price": "—",
        "Bikepacking": "—",
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

    // Render geometry overlay
    renderGeometryOverlay();
  }

  // Shake animation
  const style = document.createElement("style");
  style.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`;
  document.head.appendChild(style);
})();
