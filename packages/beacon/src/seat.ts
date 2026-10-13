// A player id is "<seat>x<random hex>". The seat number (1, 2, 3 ...) is what the board and every roll are made from.
export const seatOfPid = (pid: string): number | null => { const m = /^(\d{1,7})x[0-9a-f]{8,}$/.exec(pid); const s = m ? Number(m[1]) : 0; return s >= 1 ? s : null; };
