/*
 * moon.js — lunar phase astronomy, no dependencies.
 *
 * Sources: Jean Meeus, "Astronomical Algorithms" (2nd ed., 1998):
 *   ch. 22  nutation / obliquity (not needed here)
 *   ch. 25  low-precision solar coordinates
 *   ch. 47  position of the Moon (truncated series)
 *   ch. 48  illuminated fraction of the Moon's disk
 *   ch. 49  phases of the Moon (full series incl. planetary terms)
 *
 * Accuracy: principal-phase instants to about ±1 minute; illuminated
 * fraction to about ±0.2 %. Times returned are JavaScript Date objects
 * in UT (civil time), i.e. TT with an approximate ΔT already removed.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Moon = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RAD = Math.PI / 180;
  const SYNODIC = 29.530588861;          // mean synodic month, days
  const J2000 = 2451545.0;
  const MS_PER_DAY = 86400000;

  const sin = (deg) => Math.sin(deg * RAD);
  const cos = (deg) => Math.cos(deg * RAD);
  const norm360 = (x) => ((x % 360) + 360) % 360;

  // ---- Julian day helpers -------------------------------------------------
  function dateToJD(date) {                   // UT Julian Day
    return date.getTime() / MS_PER_DAY + 2440587.5;
  }
  function jdToDate(jd) {
    return new Date((jd - 2440587.5) * MS_PER_DAY);
  }

  // ΔT = TT − UT in seconds. Espenak & Meeus polynomial fits (NASA eclipse
  // site), with a flat 2017–2030 segment reflecting measured values (~69 s).
  function deltaT(year) {
    const t = year - 2000;
    if (year >= 2017 && year < 2031) return 69.2 + 0.05 * (year - 2020);
    if (year >= 2005 && year < 2017) return 62.92 + 0.32217 * t + 0.005589 * t * t;
    if (year >= 2031 && year < 2050) return 62.92 + 0.32217 * t + 0.005589 * t * t;
    if (year >= 1986 && year < 2005) {
      return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
    }
    if (year >= 2050 && year < 2150) return -20 + 32 * ((year - 1820) / 100) ** 2 - 0.5628 * (2150 - year);
    const u = (year - 1820) / 100;
    return -20 + 32 * u * u;              // long-term parabola
  }

  // ---- Sun, low precision (Meeus ch. 25) ---------------------------------
  function sunLongitude(T) {              // apparent geocentric longitude, deg
    const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M)
            + (0.019993 - 0.000101 * T) * sin(2 * M)
            + 0.000289 * sin(3 * M);
    const trueLon = L0 + C;
    const omega = 125.04 - 1934.136 * T;
    return norm360(trueLon - 0.00569 - 0.00478 * sin(omega));
  }

  // ---- Moon (Meeus ch. 47, leading terms) --------------------------------
  // Terms: [D, M, M', F, coefficient] for longitude (Σl) and distance (Σr).
  const LON_TERMS = [
    [0,0,1,0, 6288774, -20905355],
    [2,0,-1,0, 1274027, -3699111],
    [2,0,0,0, 658314, -2955968],
    [0,0,2,0, 213618, -569925],
    [0,1,0,0, -185116, 48888],
    [0,0,0,2, -114332, -3149],
    [2,0,-2,0, 58793, 246158],
    [2,-1,-1,0, 57066, -152138],
    [2,0,1,0, 53322, -170733],
    [2,-1,0,0, 45758, -204586],
    [0,1,-1,0, -40923, -129620],
    [1,0,0,0, -34720, 108743],
    [0,1,1,0, -30383, 104755],
    [2,0,0,-2, 15327, 10321],
    [0,0,1,2, -12528, 0],
    [0,0,1,-2, 10980, 79661],
    [4,0,-1,0, 10675, -34782],
    [0,0,3,0, 10034, -23210],
    [4,0,-2,0, 8548, -21636],
    [2,1,-1,0, -7888, 24208],
    [2,1,0,0, -6766, 30824],
    [1,0,-1,0, -5163, -8379],
    [1,1,0,0, 4987, -16675],
    [2,-1,1,0, 4036, -12831],
    [2,0,2,0, 3994, -10445],
    [4,0,0,0, 3861, -11650],
    [2,0,-3,0, 3665, 14403],
    [0,1,-2,0, -2689, -7003],
    [2,0,-1,2, -2602, 0],
    [2,-1,-2,0, 2390, 10056],
    [1,0,1,0, -2348, 6322],
    [2,-2,0,0, 2236, -9884],
  ];
  const LAT_TERMS = [
    [0,0,0,1, 5128122],
    [0,0,1,1, 280602],
    [0,0,1,-1, 277693],
    [2,0,0,-1, 173237],
    [2,0,-1,1, 55413],
    [2,0,-1,-1, 46271],
    [2,0,0,1, 32573],
    [0,0,2,1, 17198],
    [2,0,1,-1, 9266],
    [0,0,2,-1, 8822],
    [2,-1,0,-1, 8216],
    [2,0,-2,-1, 4324],
    [2,0,1,1, 4200],
    [2,1,0,-1, -3359],
    [2,-1,-1,1, 2463],
    [2,-1,0,1, 2211],
    [2,-1,-1,-1, 2065],
    [0,1,-1,-1, -1870],
    [4,0,-1,-1, 1828],
    [0,1,0,1, -1794],
  ];

  function moonPosition(T) {
    const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T ** 3 / 538841 - T ** 4 / 65194000);
    const D  = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868 - T ** 4 / 113065000);
    const M  = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000);
    const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699 - T ** 4 / 14712000);
    const F  = norm360(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - T ** 3 / 3526000 + T ** 4 / 863310000);
    const A1 = norm360(119.75 + 131.849 * T);
    const A2 = norm360(53.09 + 479264.290 * T);
    const A3 = norm360(313.45 + 481266.484 * T);
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;

    let sl = 0, sr = 0, sb = 0;
    for (const [d, m, mp, f, cl, cr] of LON_TERMS) {
      const arg = d * D + m * M + mp * Mp + f * F;
      const e = Math.abs(m) === 1 ? E : (Math.abs(m) === 2 ? E * E : 1);
      sl += e * cl * sin(arg);
      sr += e * cr * cos(arg);
    }
    for (const [d, m, mp, f, cb] of LAT_TERMS) {
      const arg = d * D + m * M + mp * Mp + f * F;
      const e = Math.abs(m) === 1 ? E : (Math.abs(m) === 2 ? E * E : 1);
      sb += e * cb * sin(arg);
    }
    sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
    sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);

    return {
      longitude: norm360(Lp + sl / 1e6),  // deg
      latitude: sb / 1e6,                 // deg
      distance: 385000.56 + sr / 1000,    // km
    };
  }

  // ---- Illumination at an instant (Meeus ch. 48) --------------------------
  function illumination(date) {
    const jd = dateToJD(date) + deltaT(date.getUTCFullYear()) / 86400;  // → TT
    const T = (jd - J2000) / 36525;
    const sunLon = sunLongitude(T);
    const m = moonPosition(T);
    const R = 149597870.7;                 // Sun distance, km (1 AU; eccentricity ignored: <0.1 % effect)
    const psi = Math.acos(cos(m.latitude) * cos(m.longitude - sunLon)); // elongation, rad
    const i = Math.atan2(R * Math.sin(psi), m.distance - R * Math.cos(psi)); // phase angle, rad
    const fraction = (1 + Math.cos(i)) / 2;
    const elong = norm360(m.longitude - sunLon);  // 0..360, waxing if < 180
    return {
      fraction,                            // 0..1 illuminated
      phaseAngle: i / RAD,                 // deg, 0 = full, 180 = new
      elongation: elong,                   // deg east of Sun
      waxing: elong < 180,
      phaseFraction: elong / 360,          // 0 new, 0.25 FQ, 0.5 full, 0.75 LQ
      distanceKm: m.distance,
    };
  }

  // ---- Principal phases (Meeus ch. 49) -----------------------------------
  // phase: 0 = new, 1 = first quarter, 2 = full, 3 = last quarter.
  function phaseJDE(k) {
    const phase = Math.round((k % 1 + 1) % 1 * 4) % 4;
    const T = k / 1236.85;
    const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    let jde = 2451550.09766 + SYNODIC * k + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    const M  = norm360(2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3);
    const Mp = norm360(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
    const F  = norm360(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
    const Om = norm360(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);

    let c = 0;
    if (phase === 0 || phase === 2) {
      const n = phase === 0;
      c += (n ? -0.40720 : -0.40614) * sin(Mp)
         + (n ? 0.17241 : 0.17302) * E * sin(M)
         + (n ? 0.01608 : 0.01614) * sin(2 * Mp)
         + (n ? 0.01039 : 0.01043) * sin(2 * F)
         + (n ? 0.00739 : 0.00734) * E * sin(Mp - M)
         + (n ? -0.00514 : -0.00515) * E * sin(Mp + M)
         + (n ? 0.00208 : 0.00209) * E * E * sin(2 * M)
         - 0.00111 * sin(Mp - 2 * F)
         - 0.00057 * sin(Mp + 2 * F)
         + 0.00056 * E * sin(2 * Mp + M)
         - 0.00042 * sin(3 * Mp)
         + 0.00042 * E * sin(M + 2 * F)
         + 0.00038 * E * sin(M - 2 * F)
         - 0.00024 * E * sin(2 * Mp - M)
         - 0.00017 * sin(Om)
         - 0.00007 * sin(Mp + 2 * M)
         + 0.00004 * sin(2 * Mp - 2 * F)
         + 0.00004 * sin(3 * M)
         + 0.00003 * sin(Mp + M - 2 * F)
         + 0.00003 * sin(2 * Mp + 2 * F)
         - 0.00003 * sin(Mp + M + 2 * F)
         + 0.00003 * sin(Mp - M + 2 * F)
         - 0.00002 * sin(Mp - M - 2 * F)
         - 0.00002 * sin(3 * Mp + M)
         + 0.00002 * sin(4 * Mp);
    } else {
      c += -0.62801 * sin(Mp)
         + 0.17172 * E * sin(M)
         - 0.01183 * E * sin(Mp + M)
         + 0.00862 * sin(2 * Mp)
         + 0.00804 * sin(2 * F)
         + 0.00454 * E * sin(Mp - M)
         + 0.00204 * E * E * sin(2 * M)
         - 0.00180 * sin(Mp - 2 * F)
         - 0.00070 * sin(Mp + 2 * F)
         - 0.00040 * sin(3 * Mp)
         - 0.00034 * E * sin(2 * Mp - M)
         + 0.00032 * E * sin(M + 2 * F)
         + 0.00032 * E * sin(M - 2 * F)
         - 0.00028 * E * E * sin(Mp + 2 * M)
         + 0.00027 * E * sin(2 * Mp + M)
         - 0.00017 * sin(Om)
         - 0.00005 * sin(Mp - M - 2 * F)
         + 0.00004 * sin(2 * Mp + 2 * F)
         - 0.00004 * sin(Mp + M + 2 * F)
         + 0.00004 * sin(Mp - 2 * M)
         + 0.00003 * sin(Mp + M - 2 * F)
         + 0.00003 * sin(3 * M)
         + 0.00002 * sin(2 * Mp - 2 * F)
         + 0.00002 * sin(Mp - M + 2 * F)
         - 0.00002 * sin(3 * Mp + M);
      const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
      c += phase === 1 ? W : -W;
    }
    // planetary arguments
    const A = [
      299.77 + 0.107408 * k - 0.009173 * T2,
      251.88 + 0.016321 * k,
      251.83 + 26.651886 * k,
      349.42 + 36.412478 * k,
      84.66 + 18.206239 * k,
      141.74 + 53.303771 * k,
      207.14 + 2.453732 * k,
      154.84 + 7.306860 * k,
      34.52 + 27.261239 * k,
      207.19 + 0.121824 * k,
      291.34 + 1.844379 * k,
      161.72 + 24.198154 * k,
      239.56 + 25.513099 * k,
      331.55 + 3.592518 * k,
    ];
    const AC = [0.000325, 0.000165, 0.000164, 0.000126, 0.000110, 0.000062, 0.000060, 0.000056, 0.000047, 0.000042, 0.000040, 0.000037, 0.000035, 0.000023];
    for (let j = 0; j < 14; j++) c += AC[j] * sin(A[j]);

    return jde + c;   // TT
  }

  function phaseDate(k) {
    const jde = phaseJDE(k);
    const approxYear = 2000 + (jde - J2000) / 365.25;
    return jdToDate(jde - deltaT(approxYear) / 86400);
  }

  const PHASE_NAMES = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'];

  // All principal phases with instants between two Dates, in order.
  function phasesBetween(start, end) {
    const yStart = start.getUTCFullYear() + (dateToJD(start) - julianYearStart(start.getUTCFullYear())) / 365.25;
    let k = Math.floor((yStart - 2000) * 12.3685) - 1;   // step back one lunation to be safe
    const out = [];
    for (let guard = 0; guard < 20000; guard++) {
      for (let q = 0; q < 4; q++) {
        const kk = k + q / 4;
        const d = phaseDate(kk);
        if (d >= end) return out;
        if (d >= start) out.push({ phase: q, name: PHASE_NAMES[q], date: d, k: kk });
      }
      k += 1;
    }
    return out;
  }
  function julianYearStart(y) { return dateToJD(new Date(Date.UTC(y, 0, 1))); }

  // Previous and next principal phases around a date (±1 lunation window).
  function surroundingPhases(date) {
    const list = phasesBetween(new Date(date.getTime() - 32 * MS_PER_DAY), new Date(date.getTime() + 32 * MS_PER_DAY));
    let prev = null, next = null;
    for (const p of list) {
      if (p.date <= date) prev = p;
      else if (!next) next = p;
    }
    return { prev, next, list };
  }

  // Age in days since the last new moon (exact instant), and lunation length.
  function age(date) {
    const list = phasesBetween(new Date(date.getTime() - 32 * MS_PER_DAY), new Date(date.getTime() + 32 * MS_PER_DAY));
    let lastNew = null, nextNew = null;
    for (const p of list) {
      if (p.phase !== 0) continue;
      if (p.date <= date) lastNew = p;
      else if (!nextNew) nextNew = p;
    }
    const days = lastNew ? (date - lastNew.date) / MS_PER_DAY : NaN;
    const length = lastNew && nextNew ? (nextNew.date - lastNew.date) / MS_PER_DAY : SYNODIC;
    return { days, lunationLength: length, lastNew, nextNew };
  }

  // Descriptive phase name for an instant (eight-phase scheme). A principal
  // phase name is used when within ±`window` hours of its exact instant.
  function phaseName(date, windowHours = 12) {
    const { prev, next } = surroundingPhases(date);
    const w = windowHours * 3600000;
    if (prev && date - prev.date <= w) return PHASE_NAMES[prev.phase];
    if (next && next.date - date <= w) return PHASE_NAMES[next.phase];
    const ill = illumination(date);
    if (ill.waxing) return ill.fraction < 0.5 ? 'Waxing Crescent' : 'Waxing Gibbous';
    return ill.fraction < 0.5 ? 'Waning Crescent' : 'Waning Gibbous';
  }

  // Traditional (North American / Farmers' Almanac) full-moon names by month.
  const FULL_MOON_NAMES = ['Wolf Moon', 'Snow Moon', 'Worm Moon', 'Pink Moon', 'Flower Moon', 'Strawberry Moon', 'Buck Moon', 'Sturgeon Moon', 'Corn Moon', "Hunter's Moon", 'Beaver Moon', 'Cold Moon'];

  return {
    SYNODIC, PHASE_NAMES, FULL_MOON_NAMES,
    dateToJD, jdToDate, deltaT,
    illumination, phaseJDE, phaseDate, phasesBetween, surroundingPhases, age, phaseName,
    _internal: { sunLongitude, moonPosition },
  };
}));
