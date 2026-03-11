export function detectPRs(activities) {

    let bestMile = { time: Infinity, id: null };
    let best5k = { time: Infinity, id: null };
    let best10k = { time: Infinity, id: null };

    for (const a of activities) {

      if (a.type !== "run") continue;

      const miles = Number(a.miles);
      const duration = Number(a.duration);

      if (!Number.isFinite(miles) || !Number.isFinite(duration)) continue;
      if (miles <= 0 || duration <= 0) continue;

      // Allow small GPS drift tolerance
      if (Math.abs(miles - 1.0) <= 0.1) {
        if (duration < bestMile.time) {
            bestMile = { time: duration, id: a.id };
        }
      }

      if (Math.abs(miles - 3.1) <= 0.25) {
        if (duration < best5k.time) {
            best5k = { time: duration, id: a.id };
        }
      }

      if (Math.abs(miles - 6.2) <= 0.45) {
        if (duration < best10k.time) {
            best10k = { time: duration, id: a.id };
        }
      }
    }

    return {  mile: bestMile, 
              fiveK: best5k, 
              tenK: best10k };

}