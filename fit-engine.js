// ── Bike Fit Engine ──
// Calculates ideal geometry from 4 body measurements and scores every bike

const FitEngine = (() => {

  // Style multipliers: [stackReachRatioAdj, reachBias, stackBias]
  const STYLE_PROFILES = {
    aggressive: { srShift: -0.04, reachPct: 0.005, stackPct: -0.008, label: "Race / Aggressive" },
    moderate:   { srShift:  0.00, reachPct: 0.000, stackPct:  0.000, label: "All-Round" },
    endurance:  { srShift:  0.04, reachPct:-0.005, stackPct:  0.008, label: "Endurance / Upright" },
  };

  /**
   * Derive ideal geometry from body measurements.
   * @param {number} heightCm
   * @param {number} inseamCm
   * @param {number} armspanCm
   * @param {string} style - aggressive | moderate | endurance
   * @returns {object} ideal geometry targets
   */
  function computeIdeal(heightCm, inseamCm, armspanCm, style) {
    const profile = STYLE_PROFILES[style] || STYLE_PROFILES.moderate;

    // Torso length estimate (height minus inseam minus head ~22cm)
    const torso = heightCm - inseamCm - 22;

    // Arm length estimate from ape index
    const armLength = (armspanCm - heightCm) / 2 + (heightCm * 0.44 - torso);

    // ── Ideal Stack ──
    // Base: ~62% of inseam, adjusted by style
    let idealStack = inseamCm * 0.62 + torso * 0.18;
    idealStack *= (1 + profile.stackPct);

    // ── Ideal Reach ──
    // Base: torso * 0.95 + arm offset, capped proportionally
    let idealReach = torso * 0.72 + armLength * 0.16 + 12;
    idealReach *= (1 + profile.reachPct);

    // ── Ideal Stack-to-Reach ratio ──
    const idealSR = (idealStack / idealReach) + profile.srShift;

    // ── Ideal Effective Top Tube ──
    const idealETT = torso * 0.98 + armLength * 0.12 + 75;

    // ── Ideal Seat Tube (center-to-top) ──
    const idealST = inseamCm * 0.665;

    // ── Ideal Standover ──
    const idealStandover = inseamCm - 5; // 5cm clearance

    return {
      stack: Math.round(idealStack),
      reach: Math.round(idealReach),
      stackReachRatio: Math.round(idealSR * 1000) / 1000,
      ett: Math.round(idealETT),
      seatTube: Math.round(idealST),
      standover: Math.round(idealStandover),
      heightCm,
      inseamCm,
      armspanCm,
      style,
      styleLabel: profile.label,
    };
  }

  /**
   * Score a single bike against ideal targets.
   * Returns 0–100 score with breakdown.
   */
  function scoreBike(bike, ideal) {
    const stack    = bike[B.STACK];
    const reach    = bike[B.REACH];
    const ett      = bike[B.ETT];
    const stLen    = bike[B.ST_LEN];
    const standover= bike[B.STANDOVER];
    const sr       = stack / reach;

    // Deltas (mm)
    const dStack = stack - ideal.stack;
    const dReach = reach - ideal.reach;
    const dETT   = ett - ideal.ett;
    const dST    = stLen - ideal.seatTube;
    const dSR    = sr - ideal.stackReachRatio;

    // Scoring weights
    // Stack-reach relationship is the most important for fit
    const scoreStack = gaussian(dStack, 22);   // ±22mm = 1σ
    const scoreReach = gaussian(dReach, 15);   // ±15mm = 1σ (reach is more sensitive)
    const scoreSR    = gaussian(dSR, 0.035);   // ±0.035 ratio
    const scoreETT   = gaussian(dETT, 18);
    const scoreST    = gaussian(dST, 25);      // seat tube is less critical (seatpost adjusts)

    // Standover check (hard pass/fail with soft penalty)
    let standoverPenalty = 0;
    if (standover > 0 && ideal.standover > 0) {
      if (standover > ideal.standover + 10) {
        standoverPenalty = Math.min(0.3, (standover - ideal.standover - 10) * 0.02);
      }
    }

    // Weighted composite
    const raw = (
      scoreReach * 0.30 +
      scoreStack * 0.25 +
      scoreSR    * 0.20 +
      scoreETT   * 0.15 +
      scoreST    * 0.10
    ) - standoverPenalty;

    const score = Math.max(0, Math.min(100, Math.round(raw * 100)));

    let rating;
    if (score >= 85) rating = "excellent";
    else if (score >= 70) rating = "good";
    else rating = "fair";

    return {
      score,
      rating,
      deltas: { stack: dStack, reach: dReach, ett: dETT, seatTube: dST, sr: Math.round(dSR * 1000) / 1000 },
      actuals: { stack, reach, ett, sr: Math.round(sr * 1000) / 1000, stLen, standover },
      bike: {
        brand: bike[B.BRAND],
        model: bike[B.MODEL],
        year:  bike[B.YEAR],
        size:  bike[B.SIZE],
        stack, reach, ett,
        htLength:  bike[B.HT_LEN],
        stLength:  bike[B.ST_LEN],
        htAngle:   bike[B.HT_ANG],
        stAngle:   bike[B.ST_ANG],
        chainstay: bike[B.CS],
        wheelbase: bike[B.WB],
        bbDrop:    bike[B.BB_DROP],
        standover: bike[B.STANDOVER],
        sr: Math.round(sr * 1000) / 1000,
        price:     bike[B.PRICE] || 0,
        bikepack:  bike[B.BIKEPACK] || 0,
      },
    };
  }

  /**
   * Score all bikes, return sorted results.
   */
  function scoreAll(ideal) {
    return BIKE_DATA
      .map(bike => scoreBike(bike, ideal))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get a human-readable fit explanation.
   */
  function explainFit(result, ideal) {
    const d = result.deltas;
    const parts = [];

    if (Math.abs(d.reach) <= 5) parts.push("Reach is spot-on for your proportions.");
    else if (d.reach > 0) parts.push(`Reach is ${d.reach}mm longer than ideal — may feel stretched.`);
    else parts.push(`Reach is ${Math.abs(d.reach)}mm shorter than ideal — more upright position.`);

    if (Math.abs(d.stack) <= 8) parts.push("Stack height matches your needs well.");
    else if (d.stack > 0) parts.push(`Stack is ${d.stack}mm taller — more upright, comfortable on long rides.`);
    else parts.push(`Stack is ${Math.abs(d.stack)}mm lower — more aerodynamic, racier position.`);

    if (d.sr > 0.02) parts.push("Higher stack-to-reach ratio: more relaxed geometry.");
    else if (d.sr < -0.02) parts.push("Lower stack-to-reach ratio: more aggressive geometry.");

    if (Math.abs(d.seatTube) > 20) {
      parts.push(d.seatTube > 0
        ? "Seat tube is long — confirm seatpost insertion depth."
        : "Seat tube is short — you'll need more seatpost exposed.");
    }

    return parts.join(" ");
  }

  // Gaussian scoring: 1.0 at center, drops off with sigma
  function gaussian(delta, sigma) {
    return Math.exp(-0.5 * (delta / sigma) ** 2);
  }

  return { computeIdeal, scoreAll, explainFit, STYLE_PROFILES };
})();
