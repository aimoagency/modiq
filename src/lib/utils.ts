export const toMin = (t: string) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };

const normLoc = (s?: string) => (s || "").trim().toLowerCase().replace(/\s+/g, "");

export const scheduleConflict = (aS: string, aE: string, bS: string, bE: string, typeA = "", typeB = "", locA?: string, locB?: string) => {
  if (!aS || !aE || !bS || !bE) return { conflict: false, reason: "", severity: "" };
  const as = toMin(aS), ae = toMin(aE), bs = toMin(bS), be = toMin(bE);
  if (as === null || ae === null || bs === null || be === null) return { conflict: false, reason: "", severity: "" };
  if (as < be && bs < ae) return { conflict: true, reason: "시간대 겹침", severity: "OVERLAP" };
  const gap = as >= be ? as - be : bs - ae;
  let need = (typeA === "MEETING" || typeB === "MEETING") ? 60 : 120;
  const la = normLoc(locA), lb = normLoc(locB);
  const differentPlace = !!la && !!lb && la !== lb;
  if (differentPlace) need += 60;
  if (gap < need) {
    const gapStr = `${Math.floor(gap / 60)}h ${gap % 60}m`;
    const needStr = `${need / 60}h`;
    const moveNote = differentPlace ? " 장소이동" : "";
    return { conflict: true, reason: `간격 ${gapStr} (${needStr} 미만${moveNote})`, severity: "BUFFER" };
  }
  return { conflict: false, reason: "", severity: "" };
};

export const findConflicts = (dayBookings: any[]) => {
  const conflictIds = new Set<string>();
  let worst = "";
  const byModel: Record<string, any[]> = {};
  dayBookings.forEach(b => {
    if (b.status === "CANCELLED") return;
    (byModel[b.model_id] = byModel[b.model_id] || []).push(b);
  });
  Object.values(byModel).forEach(list => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const c = scheduleConflict(a.start_time, a.end_time, b.start_time, b.end_time, a.booking_type, b.booking_type, a.location, b.location);
        if (c.conflict) {
          conflictIds.add(a.id); conflictIds.add(b.id);
          if (c.severity === "OVERLAP") worst = "OVERLAP";
          else if (c.severity === "BUFFER" && worst !== "OVERLAP") worst = "BUFFER";
        }
      }
    }
  });
  return { conflictIds, worst };
};
