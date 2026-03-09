// ── Bike Fit Engine ──
// Calculates ideal geometry from 4 body measurements and scores every bike

const FitEngine = (() => {

  // Style profiles affect stack/reach balance
  const STYLE_PROFILES = {
    aggressive: { srShift: -0.06, reachPct: 0.008, stackPct: -0.012, label: "Race / Aggressive" },
    moderate:   { srShift:  0.00, reachPct: 0.000, stackPct:  0.000, label: "All-Round" },
    endurance:  { srShift:  0.06, reachPct:-0.008, stackPct:  0.012, label: "Endurance / Upright" },
  };

  // Flexibility affects how low/aggressive the position can be
  const FLEX_PROFILES = {
    limited:   { stackAdj: 15, reachAdj: -8, label: "Limited" },    // needs higher stack, shorter reach
    average:   { stackAdj: 0,  reachAdj: 0,  label: "Average" },
    flexible:  { stackAdj: -10, reachAdj: 5, label: "Very Flexible" }, // can go lower, longer
  };

  /**
   * Derive ideal geometry from body measurements.
   * Uses LeMond-inspired torso+arm method for reach, inseam-driven stack.
   * Gravel-specific: higher S/R ratio (1.45-1.60) vs road (1.33-1.45).
   */
  function computeIdeal(heightCm, inseamCm, armspanCm, style, flexibility) {
    const profile = STYLE_PROFILES[style] || STYLE_PROFILES.moderate;
    const flex = FLEX_PROFILES[flexibility] || FLEX_PROFILES.average;

    // Convert to mm for all geometry calculations
    const heightMm = heightCm * 10;
    const inseamMm = inseamCm * 10;
    const armspanMm = armspanCm * 10;

    // Torso length: height - inseam - head (~220mm)
    const torsoMm = heightMm - inseamMm - 220;

    // Arm length from ape index
    const armLengthMm = (armspanMm - heightMm) / 2 + (heightMm * 0.44 - torsoMm);

    // ── Ideal Stack (mm) ──
    // Inseam-driven with flexibility adjustment
    // Gravel bikes run ~10-15mm higher stack than road
    let idealStack = inseamMm * 0.67 + 8 + flex.stackAdj;
    idealStack *= (1 + profile.stackPct);

    // ── Ideal Reach (mm) ──
    // LeMond-inspired: (torso + arm) / 2 drives cockpit length
    // We use height as primary with arm adjustment (more stable than torso alone)
    // Gravel: ~20mm shorter reach than road equivalent
    let idealReach = heightCm * 2.12 + armLengthMm * 0.02 + 2 + flex.reachAdj - 20;
    idealReach *= (1 + profile.reachPct);

    // ── Ideal Stack-to-Reach ratio ──
    // Gravel target: 1.45-1.60 (higher than road's 1.33-1.45)
    const idealSR = (idealStack / idealReach) + profile.srShift;

    // ── Ideal Effective Top Tube (mm) ──
    // LeMond: (torso + arm) / 2 + 40mm = TT + stem
    // We approximate for the frame only (minus ~100mm stem)
    const idealETT = heightCm * 3.05 + armLengthMm * 0.01 + 5;

    // ── Ideal Seat Tube (center-to-top) ──
    const idealST = inseamMm * 0.665;

    // ── Ideal Standover ──
    const idealStandover = inseamMm - 50;

    // ── Saddle Height (LeMond method: inseam × 0.883) ──
    // Measured from center of BB to top of saddle
    const saddleHeight = Math.round(inseamMm * 0.883);

    // ── Handlebar Width ──
    // Shoulder width ≈ armspan × 0.235, handlebars = shoulder width or slightly wider for gravel
    const shoulderWidthMm = armspanMm * 0.235;
    const handlebarWidth = Math.round(shoulderWidthMm / 10) * 10; // round to nearest 10mm

    return {
      stack: Math.round(idealStack),
      reach: Math.round(idealReach),
      stackReachRatio: Math.round(idealSR * 1000) / 1000,
      ett: Math.round(idealETT),
      seatTube: Math.round(idealST),
      standover: Math.round(idealStandover),
      saddleHeight,
      handlebarWidth,
      heightCm,
      inseamCm,
      armspanCm,
      style,
      styleLabel: profile.label,
      flexibility: flexibility || "average",
      flexLabel: flex.label,
    };
  }

  // Stem/spacer adjustment limits (mm)
  const STEM_REACH_RANGE = [-30, 30];  // shorter to longer stem vs stock 100mm
  const SPACER_STACK_RANGE = [-15, 25]; // remove spacers / flip stem to add spacers

  /**
   * Compute raw score from deltas (returns 0-1).
   */
  function rawScore(dStack, dReach, dETT, dST, dSR, standover, idealStandover) {
    const scoreStack = gaussian(dStack, 22);
    const scoreReach = gaussian(dReach, 15);
    const scoreSR    = gaussian(dSR, 0.035);
    const scoreETT   = gaussian(dETT, 18);
    const scoreST    = gaussian(dST, 25);

    let standoverPenalty = 0;
    if (standover > 0 && idealStandover > 0) {
      if (standover > idealStandover + 10) {
        standoverPenalty = Math.min(0.3, (standover - idealStandover - 10) * 0.02);
      }
    }

    return (
      scoreReach * 0.30 +
      scoreStack * 0.25 +
      scoreSR    * 0.20 +
      scoreETT   * 0.15 +
      scoreST    * 0.10
    ) - standoverPenalty;
  }

  /**
   * Score a single bike against ideal targets.
   * Returns 0–100 score with breakdown, plus adjusted score with optimal stem/spacers.
   */
  function scoreBike(bike, ideal) {
    const stack    = bike[B.STACK];
    const reach    = bike[B.REACH];
    const ett      = bike[B.ETT];
    const stLen    = bike[B.ST_LEN];
    const standover= bike[B.STANDOVER];
    const htAngle  = bike[B.HT_ANG] * Math.PI / 180;

    // Stock deltas
    const dStack = stack - ideal.stack;
    const dReach = reach - ideal.reach;
    const dETT   = ett - ideal.ett;
    const dST    = stLen - ideal.seatTube;
    const sr     = stack / reach;
    const dSR    = sr - ideal.stackReachRatio;

    // Stock score
    const stockRaw = rawScore(dStack, dReach, dETT, dST, dSR, standover, ideal.standover);
    const score = Math.max(0, Math.min(100, Math.round(stockRaw * 100)));

    // Adjusted score: find optimal stem length delta and spacer delta
    // Stem change affects reach (≈cos(htAngle)*delta) and stack (≈sin(htAngle)*delta) slightly
    // Spacers affect stack directly
    let bestAdj = stockRaw;
    let bestStemDelta = 0;
    let bestSpacerDelta = 0;

    for (let stemD = STEM_REACH_RANGE[0]; stemD <= STEM_REACH_RANGE[1]; stemD += 5) {
      for (let spacerD = SPACER_STACK_RANGE[0]; spacerD <= SPACER_STACK_RANGE[1]; spacerD += 5) {
        const adjReach = reach + stemD * Math.cos(htAngle);
        const adjStack = stack + spacerD + stemD * Math.sin(htAngle);
        const adjETT = ett + stemD; // ETT changes ~1:1 with stem length
        const adjSR = adjStack / adjReach;

        const adjRaw = rawScore(
          adjStack - ideal.stack,
          adjReach - ideal.reach,
          adjETT - ideal.ett,
          dST,
          adjSR - ideal.stackReachRatio,
          standover, ideal.standover
        );

        if (adjRaw > bestAdj) {
          bestAdj = adjRaw;
          bestStemDelta = stemD;
          bestSpacerDelta = spacerD;
        }
      }
    }

    const adjScore = Math.max(0, Math.min(100, Math.round(bestAdj * 100)));

    let rating;
    if (score >= 85) rating = "excellent";
    else if (score >= 70) rating = "good";
    else rating = "fair";

    let adjRating;
    if (adjScore >= 85) adjRating = "excellent";
    else if (adjScore >= 70) adjRating = "good";
    else adjRating = "fair";

    return {
      score,
      rating,
      adjScore,
      adjRating,
      stemDelta: bestStemDelta,
      spacerDelta: bestSpacerDelta,
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

  return { computeIdeal, scoreAll, explainFit, STYLE_PROFILES, FLEX_PROFILES };
})();
