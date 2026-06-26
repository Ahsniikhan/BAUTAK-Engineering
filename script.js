const DB = { _store: {}, _load() { try { const r = localStorage.getItem('bmc_db'); this._store = r ? JSON.parse(r) : {} } catch (e) { this._store = {} } }, _save() { try { localStorage.setItem('bmc_db', JSON.stringify(this._store)) } catch (e) { } }, collection(n) { if (!this._store[n]) this._store[n] = []; return { find: (q = {}) => { let d = [...this._store[n]]; Object.keys(q).forEach(k => { d = d.filter(x => x[k] === q[k]) }); return d }, findOne: (q = {}) => this._store[n].find(d => Object.keys(q).every(k => d[k] === q[k])) || null, insertOne: (doc) => { const _id = 'oid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); const nd = { _id, createdAt: new Date().toISOString(), ...doc }; this._store[n].push(nd); DB._save(); return { insertedId: _id, ops: [nd] } }, updateOne: (q, upd) => { const i = this._store[n].findIndex(d => Object.keys(q).every(k => d[k] === q[k])); if (i > -1) { this._store[n][i] = { ...this._store[n][i], ...upd.$set, updatedAt: new Date().toISOString() }; DB._save(); return { modifiedCount: 1 } } return { modifiedCount: 0 } }, deleteOne: (q) => { const i = this._store[n].findIndex(d => Object.keys(q).every(k => d[k] === q[k])); if (i > -1) { this._store[n].splice(i, 1); DB._save(); return { deletedCount: 1 } } return { deletedCount: 0 } }, deleteMany: () => { this._store[n] = []; DB._save(); return { deletedCount: 0 } }, count: () => this._store[n].length } } };
DB._load();
const DEFAULT_RATES = { cement_per_bag: 1250, sand_per_cft: 60, stone_crush_per_cft: 85, steel_per_kg: 280, brick_per_unit: 18, tile_per_sqft: 150, paint_per_liter: 500, excavation_per_cubic_meter: 1200, mason_per_day: 1800, helper_per_day: 1200, steel_fixer_per_day: 2000, carpenter_per_day: 2200, painter_per_day: 1500, plaster_per_sqft: 45, binding_wire_per_kg: 150, formwork_per_sqft: 80, electrical_per_sqft: 120, plumbing_per_sqft: 100, waterproofing_per_sqft: 65, doors_per_unit: 12000, windows_per_unit: 8000, last_updated: new Date().toISOString(), updated_by: 'admin' };
function getRates() { const s = DB.collection('rates').findOne({ updated_by: 'admin' }); return s ? { ...DEFAULT_RATES, ...s } : { ...DEFAULT_RATES } }
function initRates() { if (!DB.collection('rates').findOne({ updated_by: 'admin' })) DB.collection('rates').insertOne({ ...DEFAULT_RATES }) }
initRates();
let currentBuildingType = 'residential', lastResult = null, selectedHistoryId = null;
let pieCI = null, barCI = null, trendCI = null, typeCI = null;
function showPage(n) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn,.bnav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + n).classList.add('active');
    const nb = document.getElementById('nav-' + n); if (nb) nb.classList.add('active');
    const bb = document.getElementById('bnav-' + n); if (bb) bb.classList.add('active');
    if (n === 'rates') renderRatesPage();
    if (n === 'history') renderHistoryPage();
    if (n === 'dashboard') renderDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function selectType(el, t) { document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected')); el.classList.add('selected'); currentBuildingType = t }
['length', 'width', 'height', 'numFloors'].forEach(id => { document.getElementById(id).addEventListener('input', updateAreaPreview) });
function updateAreaPreview() {
    const L = parseFloat(document.getElementById('length').value) || 0;
    const W = parseFloat(document.getElementById('width').value) || 0;
    const H = parseFloat(document.getElementById('height').value) || 0;
    const F = parseInt(document.getElementById('numFloors').value) || 1;
    const p = document.getElementById('areaPreview');
    if (L > 0 && W > 0 && H > 0) { p.style.display = 'block'; document.getElementById('prev-floor').textContent = fmt(L * W); document.getElementById('prev-total').textContent = fmt(L * W * F); document.getElementById('prev-vol').textContent = fmt(L * W * H * F) }
    else p.style.display = 'none';
}
function calculateBOQ() {
    const L = parseFloat(document.getElementById('length').value);
    const W = parseFloat(document.getElementById('width').value);
    const H = parseFloat(document.getElementById('height').value);
    const floors = parseInt(document.getElementById('numFloors').value) || 1;
    const pn = document.getElementById('projectName').value || (currentBuildingType.charAt(0).toUpperCase() + currentBuildingType.slice(1) + ' Building');
    if (!L || !W || !H || L <= 0 || W <= 0 || H <= 0) { toast('Please enter valid Length, Width and Height.', 'error'); return }
    showLoading(true);
    setTimeout(() => {
        const r = getRates();
        const ft = document.getElementById('foundationType').value, wt = document.getElementById('wallType').value, rt = document.getElementById('roofType').value, fl = document.getElementById('finishingLevel').value;
        const ff = fl === 'luxury' ? 1.3 : fl === 'economy' ? 0.8 : 1.0;
        const fa = L * W, tfa = fa * floors, pl = 2 * (L + W), wa = pl * H * floors, oa = tfa * 0.12, nwa = wa - oa;
        const ed = ft === 'raft' ? 4 : 3, ev = L * W * ed;
        const fcv = ft === 'raft' ? L * W * 0.75 : (pl * 1.5 * 1.5), fsk = fcv * 0.0283168 * 80;
        const st = 0.5, sv = fa * st * floors, svm = sv * 0.0283168, ssk = svm * 100;
        const cv = (L * W / 400) * 1.5 * 1.5 * H * floors * 0.0283168, csk = cv * 160;
        const bv = ((L + W) / 15) * 1.0 * 1.5 * floors * 0.0283168, bsk = bv * 120;
        const tsk = (fsk + ssk + csk + bsk) * (currentBuildingType === 'commercial' ? 1.3 : 1.0);
        const wtf = wt === 'brick' ? 1 : wt === 'brick45' ? 0.55 : 0.7, bpf = wt === 'brick' ? 11 : 5.5;
        const tb = nwa * bpf * wtf, mcb = nwa * (wt === 'brick' ? 0.35 : 0.2), msc = mcb * 4;
        const pla = (nwa * 2 + tfa * floors * 1.1), ta = fa * 1.05, pa = nwa * 2 + tfa, pltr = pa / 70;
        const nd = Math.max(2, Math.round(tfa / 200) + (floors - 1)), nw = Math.max(3, Math.round(tfa / 100));
        const bd = Math.ceil(tfa / 15) * floors, md = Math.round(bd * 0.8), hd = Math.round(bd * 1.4), sfd = Math.round(bd * 0.3), cd = Math.round(bd * 0.2), pntd = Math.round(pa / 200);
        const bwk = tsk * 0.006, fwk = (sv / st) + (cv / 0.0283168 * 0.3) + (bv / 0.0283168 * 0.5);
        const boq = [
            { cat: true, desc: 'A. SITE PREPARATION & EXCAVATION' },
            { no: 'A1', desc: 'Excavation for Foundation', type: 'labour', qty: ev.toFixed(2), unit: 'Cft', rate: fmtPKR(r.excavation_per_cubic_meter / 35.3147), amount: ev * (r.excavation_per_cubic_meter / 35.3147) },
            { no: 'A2', desc: 'Anti-termite Treatment', type: 'material', qty: (L * W).toFixed(2), unit: 'Sqft', rate: fmtPKR(12), amount: L * W * 12 },
            { no: 'A3', desc: 'Levelling & Compaction', type: 'labour', qty: (L * W).toFixed(2), unit: 'Sqft', rate: fmtPKR(8), amount: L * W * 8 },
            { subcat: true, desc: 'Sub-total A', amount: ev * (r.excavation_per_cubic_meter / 35.3147) + L * W * 12 + L * W * 8 },
            { cat: true, desc: 'B. FOUNDATION WORKS' },
            { no: 'B1', desc: 'PCC 1:3:6 Foundation', type: 'material', qty: (fcv * 0.15 * 0.0283168).toFixed(3), unit: 'M³', rate: fmtPKR(12500), amount: fcv * 0.15 * 0.0283168 * 12500 },
            { no: 'B2', desc: 'RCC Foundation (M20)', type: 'material', qty: (fcv * 0.0283168).toFixed(3), unit: 'M³', rate: fmtPKR(18500), amount: fcv * 0.0283168 * 18500 },
            { no: 'B3', desc: 'Steel Reinforcement — Foundation', type: 'material', qty: fsk.toFixed(1), unit: 'Kg', rate: fmtPKR(r.steel_per_kg), amount: fsk * r.steel_per_kg },
            { no: 'B4', desc: 'Binding Wire — Foundation', type: 'material', qty: (fsk * 0.006).toFixed(2), unit: 'Kg', rate: fmtPKR(r.binding_wire_per_kg), amount: fsk * 0.006 * r.binding_wire_per_kg },
            { no: 'B5', desc: 'Formwork for Foundation', type: 'labour', qty: (pl * ed).toFixed(1), unit: 'Sqft', rate: fmtPKR(r.formwork_per_sqft), amount: pl * ed * r.formwork_per_sqft },
            { subcat: true, desc: 'Sub-total B', amount: fcv * 0.15 * 0.0283168 * 12500 + fcv * 0.0283168 * 18500 + fsk * r.steel_per_kg + fsk * 0.006 * r.binding_wire_per_kg + pl * ed * r.formwork_per_sqft },
            { cat: true, desc: 'C. SUPERSTRUCTURE — RCC FRAME' },
            { no: 'C1', desc: `RCC Columns (M25) — ${floors}F`, type: 'material', qty: cv.toFixed(3), unit: 'M³', rate: fmtPKR(21000), amount: cv * 21000 },
            { no: 'C2', desc: 'RCC Beams (M25)', type: 'material', qty: bv.toFixed(3), unit: 'M³', rate: fmtPKR(21000), amount: bv * 21000 },
            { no: 'C3', desc: `RCC Slab (${rt.toUpperCase()})`, type: 'material', qty: svm.toFixed(3), unit: 'M³', rate: fmtPKR(20500), amount: svm * 20500 },
            { no: 'C4', desc: 'Steel — Superstructure', type: 'material', qty: (ssk + csk + bsk).toFixed(1), unit: 'Kg', rate: fmtPKR(r.steel_per_kg), amount: (ssk + csk + bsk) * r.steel_per_kg },
            { no: 'C5', desc: 'Binding Wire — Superstructure', type: 'material', qty: bwk.toFixed(2), unit: 'Kg', rate: fmtPKR(r.binding_wire_per_kg), amount: bwk * r.binding_wire_per_kg },
            { no: 'C6', desc: 'Formwork for Slabs & Beams', type: 'labour', qty: fwk.toFixed(1), unit: 'Sqft', rate: fmtPKR(r.formwork_per_sqft), amount: fwk * r.formwork_per_sqft },
            { no: 'C7', desc: 'Steel Fixer Labour', type: 'labour', qty: sfd, unit: 'Days', rate: fmtPKR(r.steel_fixer_per_day), amount: sfd * r.steel_fixer_per_day },
            { subcat: true, desc: 'Sub-total C', amount: cv * 21000 + bv * 21000 + svm * 20500 + (ssk + csk + bsk) * r.steel_per_kg + bwk * r.binding_wire_per_kg + fwk * r.formwork_per_sqft + sfd * r.steel_fixer_per_day },
            { cat: true, desc: 'D. BRICK MASONRY' },
            { no: 'D1', desc: `Brickwork — ${wt === 'brick' ? '9" Wall' : wt === 'brick45' ? '4.5" Wall' : 'Block Wall'}`, type: 'material', qty: Math.round(tb), unit: 'Nos', rate: fmtPKR(r.brick_per_unit), amount: Math.round(tb) * r.brick_per_unit },
            { no: 'D2', desc: 'Cement for Mortar', type: 'material', qty: mcb.toFixed(1), unit: 'Bags', rate: fmtPKR(r.cement_per_bag), amount: mcb * r.cement_per_bag },
            { no: 'D3', desc: 'Sand for Mortar', type: 'material', qty: msc.toFixed(1), unit: 'Cft', rate: fmtPKR(r.sand_per_cft), amount: msc * r.sand_per_cft },
            { no: 'D4', desc: 'Mason Labour (Brickwork)', type: 'labour', qty: Math.round(md * 0.4), unit: 'Days', rate: fmtPKR(r.mason_per_day), amount: Math.round(md * 0.4) * r.mason_per_day },
            { no: 'D5', desc: 'Helper Labour (Brickwork)', type: 'labour', qty: Math.round(hd * 0.4), unit: 'Days', rate: fmtPKR(r.helper_per_day), amount: Math.round(hd * 0.4) * r.helper_per_day },
            { subcat: true, desc: 'Sub-total D', amount: Math.round(tb) * r.brick_per_unit + mcb * r.cement_per_bag + msc * r.sand_per_cft + Math.round(md * 0.4) * r.mason_per_day + Math.round(hd * 0.4) * r.helper_per_day },
            { cat: true, desc: 'E. PLASTER & RENDERING' },
            { no: 'E1', desc: 'Cement Plaster 12mm (1:4)', type: 'material', qty: pla.toFixed(1), unit: 'Sqft', rate: fmtPKR(r.plaster_per_sqft), amount: pla * r.plaster_per_sqft },
            { no: 'E2', desc: 'Cement for Plaster', type: 'material', qty: (pla * 0.06).toFixed(1), unit: 'Bags', rate: fmtPKR(r.cement_per_bag), amount: pla * 0.06 * r.cement_per_bag },
            { no: 'E3', desc: 'Sand for Plaster', type: 'material', qty: (pla * 0.2).toFixed(1), unit: 'Cft', rate: fmtPKR(r.sand_per_cft), amount: pla * 0.2 * r.sand_per_cft },
            { no: 'E4', desc: 'Mason Labour (Plastering)', type: 'labour', qty: Math.round(md * 0.35), unit: 'Days', rate: fmtPKR(r.mason_per_day), amount: Math.round(md * 0.35) * r.mason_per_day },
            { subcat: true, desc: 'Sub-total E', amount: pla * r.plaster_per_sqft + pla * 0.06 * r.cement_per_bag + pla * 0.2 * r.sand_per_cft + Math.round(md * 0.35) * r.mason_per_day },
            { cat: true, desc: 'F. FLOORING & TILING' },
            { no: 'F1', desc: `Floor Tiles (${fl})`, type: 'material', qty: ta.toFixed(1), unit: 'Sqft', rate: fmtPKR(r.tile_per_sqft * ff), amount: ta * r.tile_per_sqft * ff },
            { no: 'F2', desc: 'Tile Adhesive/Mortar Bed', type: 'material', qty: (ta * 0.08).toFixed(1), unit: 'Bags', rate: fmtPKR(r.cement_per_bag), amount: ta * 0.08 * r.cement_per_bag },
            { no: 'F3', desc: 'Tile Grout & Finishing', type: 'material', qty: ta.toFixed(1), unit: 'Sqft', rate: fmtPKR(8), amount: ta * 8 },
            { no: 'F4', desc: 'Tiler Labour', type: 'labour', qty: Math.round(ta / 80), unit: 'Days', rate: fmtPKR(r.mason_per_day), amount: Math.round(ta / 80) * r.mason_per_day },
            { subcat: true, desc: 'Sub-total F', amount: ta * r.tile_per_sqft * ff + ta * 0.08 * r.cement_per_bag + ta * 8 + Math.round(ta / 80) * r.mason_per_day },
            { cat: true, desc: 'G. DOORS, WINDOWS & GLAZING' },
            { no: 'G1', desc: `Doors (${fl})`, type: 'material', qty: nd, unit: 'Nos', rate: fmtPKR(r.doors_per_unit * ff), amount: nd * r.doors_per_unit * ff },
            { no: 'G2', desc: 'Windows (Aluminium)', type: 'material', qty: nw, unit: 'Nos', rate: fmtPKR(r.windows_per_unit * ff), amount: nw * r.windows_per_unit * ff },
            { no: 'G3', desc: 'Door/Window Frame Fixing', type: 'labour', qty: (nd + nw), unit: 'Nos', rate: fmtPKR(800), amount: (nd + nw) * 800 },
            { no: 'G4', desc: 'Carpenter Labour', type: 'labour', qty: cd, unit: 'Days', rate: fmtPKR(r.carpenter_per_day), amount: cd * r.carpenter_per_day },
            { subcat: true, desc: 'Sub-total G', amount: nd * r.doors_per_unit * ff + nw * r.windows_per_unit * ff + (nd + nw) * 800 + cd * r.carpenter_per_day },
            { cat: true, desc: 'H. PAINTING & FINISHING' },
            { no: 'H1', desc: `Interior Paint (${fl}, 2 coats)`, type: 'material', qty: (pltr * 0.7).toFixed(1), unit: 'Ltr', rate: fmtPKR(r.paint_per_liter * ff), amount: pltr * 0.7 * r.paint_per_liter * ff },
            { no: 'H2', desc: 'Exterior Paint (Weather Shield)', type: 'material', qty: (pltr * 0.3).toFixed(1), unit: 'Ltr', rate: fmtPKR(r.paint_per_liter * 1.2 * ff), amount: pltr * 0.3 * r.paint_per_liter * 1.2 * ff },
            { no: 'H3', desc: 'Putty / Primer Coat', type: 'material', qty: pa.toFixed(1), unit: 'Sqft', rate: fmtPKR(10), amount: pa * 10 },
            { no: 'H4', desc: 'Painter Labour', type: 'labour', qty: pntd, unit: 'Days', rate: fmtPKR(r.painter_per_day), amount: pntd * r.painter_per_day },
            { subcat: true, desc: 'Sub-total H', amount: pltr * 0.7 * r.paint_per_liter * ff + pltr * 0.3 * r.paint_per_liter * 1.2 * ff + pa * 10 + pntd * r.painter_per_day },
            { cat: true, desc: 'I. ELECTRICAL WORKS' },
            { no: 'I1', desc: 'Wiring & Conduits', type: 'material', qty: tfa.toFixed(1), unit: 'Sqft', rate: fmtPKR(r.electrical_per_sqft * 0.6 * ff), amount: tfa * r.electrical_per_sqft * 0.6 * ff },
            { no: 'I2', desc: 'Switches, Sockets & Fittings', type: 'material', qty: tfa.toFixed(1), unit: 'Sqft', rate: fmtPKR(r.electrical_per_sqft * 0.25 * ff), amount: tfa * r.electrical_per_sqft * 0.25 * ff },
            { no: 'I3', desc: 'Main Panel Board & MCBs', type: 'material', qty: floors, unit: 'Set', rate: fmtPKR(28000), amount: floors * 28000 },
            { no: 'I4', desc: 'Electrician Labour', type: 'labour', qty: Math.round(tfa / 120), unit: 'Days', rate: fmtPKR(1800), amount: Math.round(tfa / 120) * 1800 },
            { subcat: true, desc: 'Sub-total I', amount: tfa * r.electrical_per_sqft * 0.6 * ff + tfa * r.electrical_per_sqft * 0.25 * ff + floors * 28000 + Math.round(tfa / 120) * 1800 },
            { cat: true, desc: 'J. PLUMBING & SANITARY' },
            { no: 'J1', desc: 'Pipes & Fittings (CPVC)', type: 'material', qty: tfa.toFixed(1), unit: 'Sqft', rate: fmtPKR(r.plumbing_per_sqft * 0.55 * ff), amount: tfa * r.plumbing_per_sqft * 0.55 * ff },
            { no: 'J2', desc: 'Sanitary Ware (per floor)', type: 'material', qty: Math.max(1, floors), unit: 'Set', rate: fmtPKR(45000 * ff), amount: Math.max(1, floors) * 45000 * ff },
            { no: 'J3', desc: 'Overhead Water Tank', type: 'material', qty: floors, unit: 'Nos', rate: fmtPKR(18000), amount: floors * 18000 },
            { no: 'J4', desc: 'Plumber Labour', type: 'labour', qty: Math.round(tfa / 100), unit: 'Days', rate: fmtPKR(1600), amount: Math.round(tfa / 100) * 1600 },
            { subcat: true, desc: 'Sub-total J', amount: tfa * r.plumbing_per_sqft * 0.55 * ff + Math.max(1, floors) * 45000 * ff + floors * 18000 + Math.round(tfa / 100) * 1600 },
            { cat: true, desc: 'K. WATERPROOFING & DAMP PROOFING' },
            { no: 'K1', desc: 'Roof Waterproofing (Bitumen)', type: 'material', qty: fa.toFixed(1), unit: 'Sqft', rate: fmtPKR(r.waterproofing_per_sqft * 1.2), amount: fa * r.waterproofing_per_sqft * 1.2 },
            { no: 'K2', desc: 'Bathroom Waterproofing', type: 'material', qty: (tfa * 0.12).toFixed(1), unit: 'Sqft', rate: fmtPKR(r.waterproofing_per_sqft), amount: tfa * 0.12 * r.waterproofing_per_sqft },
            { no: 'K3', desc: 'DPC (Damp Proof Course)', type: 'material', qty: (pl * 0.5).toFixed(1), unit: 'Sqft', rate: fmtPKR(40), amount: pl * 0.5 * 40 },
            { subcat: true, desc: 'Sub-total K', amount: fa * r.waterproofing_per_sqft * 1.2 + tfa * 0.12 * r.waterproofing_per_sqft + pl * 0.5 * 40 },
            { cat: true, desc: 'L. MISCELLANEOUS & CONTINGENCIES' },
            { no: 'L1', desc: 'Staircase (RCC)', type: 'misc', qty: Math.max(0, floors - 1), unit: 'Flights', rate: fmtPKR(85000), amount: Math.max(0, floors - 1) * 85000 },
            { no: 'L2', desc: 'Overhead & Supervision (5%)', type: 'misc', qty: '5%', unit: 'L.S.', rate: '—', amount: 0, isPercent: true, pct: .05 },
            { no: 'L3', desc: 'Contingency (3%)', type: 'misc', qty: '3%', unit: 'L.S.', rate: '—', amount: 0, isPercent: true, pct: .03 },
        ];
        let ppt = 0; boq.forEach(x => { if (!x.cat && !x.subcat && !x.isPercent) ppt += (parseFloat(x.amount) || 0) });
        boq.forEach(x => { if (x.isPercent) x.amount = ppt * x.pct });
        boq.push({ subcat: true, desc: 'Sub-total L', amount: Math.max(0, floors - 1) * 85000 + ppt * 0.05 + ppt * 0.03 });
        let gt = 0; boq.forEach(x => { if (x.subcat && x.desc.startsWith('Sub-total')) gt += x.amount });
        renderBOQ(boq, gt, { L, W, H, floors, projectName: pn, totalFloorArea: tfa, floorArea: fa });
        lastResult = { projectName: pn, buildingType: currentBuildingType, L, W, H, floors, floorArea: fa, totalFloorArea: tfa, grandTotal: gt, boq, foundationType: ft, wallType: wt, roofType: rt, finishingLevel: fl, calculatedAt: new Date().toISOString() };
        showLoading(false);
        document.getElementById('results-area').classList.add('visible');
        document.getElementById('calc-placeholder').style.display = 'none';
        setTimeout(() => document.getElementById('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        toast('BOQ generated!', 'success');
    }, 600);
}
function renderBOQ(boq, gt, meta) {
    const { L, W, H, floors, projectName, totalFloorArea } = meta;
    document.getElementById('result-title').textContent = 'BOQ — ' + projectName;
    const ms = `${L}×${W}×${H}ft | ${floors}F | ${fmt(totalFloorArea)} sqft | ${currentBuildingType} | ${new Date().toLocaleString()}`;
    document.getElementById('result-meta').textContent = ms;
    document.getElementById('result-grand-total').textContent = 'PKR ' + fmtPKR(gt);
    document.getElementById('print-meta').textContent = ms;
    let mat = 0, lab = 0, misc = 0;
    boq.forEach(x => { if (!x.cat && !x.subcat) { const a = parseFloat(x.amount) || 0; if (x.type === 'material') mat += a; else if (x.type === 'labour') lab += a; else misc += a } });
    document.getElementById('summary-stats').innerHTML = `
    <div class="stat-card primary-card"><div class="stat-label">Grand Total</div><div class="stat-value" style="font-size:14px">PKR ${fmtPKR(gt)}</div><div class="stat-sub">Full estimate</div></div>
    <div class="stat-card info-card"><div class="stat-label">Materials</div><div class="stat-value" style="font-size:14px">PKR ${fmtPKR(mat)}</div><div class="stat-sub">${Math.round(mat / gt * 100)}%</div></div>
    <div class="stat-card accent-card"><div class="stat-label">Labour</div><div class="stat-value" style="font-size:14px">PKR ${fmtPKR(lab)}</div><div class="stat-sub">${Math.round(lab / gt * 100)}%</div></div>
    <div class="stat-card success-card"><div class="stat-label">Cost/Sqft</div><div class="stat-value" style="font-size:14px">PKR ${fmtPKR(Math.round(gt / totalFloorArea))}</div><div class="stat-sub">${fmt(totalFloorArea)} sqft</div></div>`;
    const mob = window.innerWidth <= 767;
    let html = '';
    boq.forEach(x => {
        if (x.cat) { html += `<tr class="category-row"><td colspan="${mob ? 4 : 7}">${x.desc}</td></tr>` }
        else if (x.subcat) { html += `<tr class="subtotal-row"><td colspan="${mob ? 2 : 5}"></td><td>${x.desc}</td><td>PKR ${fmtPKR(x.amount)}</td></tr>` }
        else {
            const b = x.type === 'material' ? '<span class="badge badge-material">Mat</span>' : x.type === 'labour' ? '<span class="badge badge-labour">Lab</span>' : '<span class="badge badge-misc">Misc</span>';
            if (mob) { html += `<tr><td style="font-family:var(--mono);font-size:10px;color:var(--text-muted)">${x.no}</td><td style="font-size:12px">${x.desc}<br><span style="font-size:10px;color:var(--text-muted)">${typeof x.qty === 'number' ? fmt(x.qty) : x.qty} ${x.unit}</span></td><td style="font-family:var(--mono);font-size:11px">${x.rate}</td><td style="font-family:var(--mono);font-size:12px">PKR ${fmtPKR(x.amount)}</td></tr>` }
            else { html += `<tr><td style="font-family:var(--mono);font-size:11px;color:var(--text-muted)">${x.no}</td><td>${x.desc}</td><td>${b}</td><td style="font-family:var(--mono)">${typeof x.qty === 'number' ? fmt(x.qty) : x.qty}</td><td style="color:var(--text-muted);font-size:12px">${x.unit}</td><td style="font-family:var(--mono);text-align:right">${x.rate}</td><td style="font-family:var(--mono)">PKR ${fmtPKR(x.amount)}</td></tr>` }
        }
    });
    html += `<tr class="total-row"><td colspan="${mob ? 2 : 5}"></td><td>🏗️ GRAND TOTAL</td><td>PKR ${fmtPKR(gt)}</td></tr>`;
    document.getElementById('boq-tbody').innerHTML = html;
    renderPieChart(mat, lab, misc); renderBarChart(boq, gt);
}
function renderPieChart(m, l, o) {
    if (pieCI) pieCI.destroy();
    pieCI = new Chart(document.getElementById('pieChart').getContext('2d'), { type: 'doughnut', data: { labels: ['Materials', 'Labour', 'Misc'], datasets: [{ data: [Math.round(m), Math.round(l), Math.round(o)], backgroundColor: ['#1a472a', '#f4a261', '#1971c2'], borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` PKR ${fmtPKR(ctx.raw)} (${Math.round(ctx.raw / (m + l + o) * 100)}%)` } } } } });
    const t = m + l + o;
    document.getElementById('pie-legend').innerHTML = [['#1a472a', 'Materials', m], ['#f4a261', 'Labour', l], ['#1971c2', 'Misc', o]].map(([c, n, v]) => `<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:${c}"></span>${n} ${Math.round(v / t * 100)}%</span>`).join('');
}
function renderBarChart(boq, gt) {
    if (barCI) barCI.destroy();
    const lb = [], dt = [];
    boq.forEach(x => { if (x.subcat && x.desc.startsWith('Sub-total')) { lb.push(x.desc.replace('Sub-total ', '')); dt.push(Math.round(x.amount)) } });
    barCI = new Chart(document.getElementById('barChart').getContext('2d'), { type: 'bar', data: { labels: lb, datasets: [{ data: dt, backgroundColor: '#1a472a', borderRadius: 4, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` PKR ${fmtPKR(ctx.raw)}` } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 30 } }, y: { grid: { color: '#f0f0f0' }, ticks: { callback: v => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v), font: { size: 9 } } } } } });
}
function saveToHistory() {
    if (!lastResult) { toast('No result to save.', 'error'); return }
    DB.collection('calculations').insertOne({ projectName: lastResult.projectName, buildingType: lastResult.buildingType, dimensions: { L: lastResult.L, W: lastResult.W, H: lastResult.H, floors: lastResult.floors }, floorArea: lastResult.floorArea, totalFloorArea: lastResult.totalFloorArea, grandTotal: lastResult.grandTotal, options: { foundationType: lastResult.foundationType, wallType: lastResult.wallType, roofType: lastResult.roofType, finishingLevel: lastResult.finishingLevel }, boq: lastResult.boq, calculatedAt: lastResult.calculatedAt });
    toast('Saved to history!', 'success');
}
function renderHistoryPage() {
    const recs = DB.collection('calculations').find().reverse();
    const g = document.getElementById('history-grid');
    if (!recs.length) { g.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No estimates saved yet</div><div class="empty-desc">Generate a BOQ and tap Save.</div></div>'; return }
    const ic = { residential: '🏠', commercial: '🏢', industrial: '🏭', custom: '📐' };
    g.innerHTML = recs.map(r => `<div class="history-card" onclick="viewHistory('${r._id}')"><div class="history-icon">${ic[r.buildingType] || '🏗️'}</div><div class="history-info"><div class="history-title">${r.projectName}</div><div class="history-meta">${r.buildingType} · ${r.dimensions.floors}F · ${r.options.finishingLevel}</div><div class="history-dims">${r.dimensions.L}×${r.dimensions.W}×${r.dimensions.H}ft | ${fmt(r.totalFloorArea)} sqft</div></div><div class="history-amount"><div class="history-total">PKR ${fmtPKR(r.grandTotal)}</div><div class="history-date">${new Date(r.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</div><div class="history-actions" onclick="event.stopPropagation()"><button class="btn btn-danger btn-sm" onclick="deleteHistory('${r._id}')">Delete</button></div></div></div>`).join('');
}
function viewHistory(id) {
    const r = DB.collection('calculations').findOne({ _id: id }); if (!r) return;
    selectedHistoryId = id;
    document.getElementById('historyModal-title').textContent = r.projectName;
    document.getElementById('historyModal-body').innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px"><div class="stat-card primary-card"><div class="stat-label">Grand Total</div><div class="stat-value" style="font-size:13px">PKR ${fmtPKR(r.grandTotal)}</div></div><div class="stat-card info-card"><div class="stat-label">Area</div><div class="stat-value" style="font-size:13px">${fmt(r.totalFloorArea)} sqft</div></div></div><table style="width:100%;font-size:12px;border-collapse:collapse">${[['Project', r.projectName], ['Type', r.buildingType], ['Dimensions', r.dimensions.L + '×' + r.dimensions.W + '×' + r.dimensions.H + 'ft (' + r.dimensions.floors + 'F)'], ['Foundation', r.options.foundationType], ['Wall', r.options.wallType], ['Finishing', r.options.finishingLevel], ['Cost/sqft', 'PKR ' + fmtPKR(Math.round(r.grandTotal / r.totalFloorArea))], ['Saved', new Date(r.createdAt).toLocaleString()]].map(([k, v], i) => `<tr style="${i % 2 ? 'background:var(--surface-2)' : ''}"><td style="padding:6px 8px;color:var(--text-muted);width:40%">${k}</td><td style="font-weight:600;padding:6px 8px">${v}</td></tr>`).join('')}</table>`;
    document.getElementById('historyModal').classList.add('open');
}
function loadFromHistory() {
    const r = DB.collection('calculations').findOne({ _id: selectedHistoryId }); if (!r) return;
    document.getElementById('projectName').value = r.projectName;
    document.getElementById('length').value = r.dimensions.L;
    document.getElementById('width').value = r.dimensions.W;
    document.getElementById('height').value = r.dimensions.H;
    document.getElementById('numFloors').value = r.dimensions.floors;
    document.getElementById('foundationType').value = r.options.foundationType;
    document.getElementById('wallType').value = r.options.wallType;
    document.getElementById('roofType').value = r.options.roofType;
    document.getElementById('finishingLevel').value = r.options.finishingLevel;
    currentBuildingType = r.buildingType;
    document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('selected', c.dataset.type === r.buildingType));
    closeModal('historyModal'); showPage('calculator'); updateAreaPreview(); calculateBOQ();
}
function deleteHistory(id) { if (!confirm('Delete?')) return; DB.collection('calculations').deleteOne({ _id: id }); renderHistoryPage(); toast('Deleted.', 'success') }
function clearHistory() { if (!confirm('Delete ALL history?')) return; DB.collection('calculations').deleteMany(); renderHistoryPage(); toast('Cleared.', 'success') }
const RS = [
    { title: 'Structural', icon: '🏗️', sub: 'Concrete & Steel', fields: [{ key: 'cement_per_bag', label: 'Cement (OPC)', unit: '/bag' }, { key: 'sand_per_cft', label: 'Fine Sand', unit: '/cft' }, { key: 'stone_crush_per_cft', label: 'Stone Crush', unit: '/cft' }, { key: 'steel_per_kg', label: 'Steel Rebar', unit: '/kg' }, { key: 'binding_wire_per_kg', label: 'Binding Wire', unit: '/kg' }] },
    { title: 'Masonry', icon: '🧱', sub: 'Bricks, Tiles & Paint', fields: [{ key: 'brick_per_unit', label: 'Brick (Class-A)', unit: '/unit' }, { key: 'tile_per_sqft', label: 'Floor Tiles', unit: '/sqft' }, { key: 'paint_per_liter', label: 'Paint', unit: '/ltr' }, { key: 'plaster_per_sqft', label: 'Plaster', unit: '/sqft' }, { key: 'formwork_per_sqft', label: 'Formwork', unit: '/sqft' }] },
    { title: 'Labour', icon: '👷', sub: 'Daily wages', fields: [{ key: 'mason_per_day', label: 'Mason', unit: '/day' }, { key: 'helper_per_day', label: 'Helper', unit: '/day' }, { key: 'steel_fixer_per_day', label: 'Steel Fixer', unit: '/day' }, { key: 'carpenter_per_day', label: 'Carpenter', unit: '/day' }, { key: 'painter_per_day', label: 'Painter', unit: '/day' }] },
    { title: 'Earthwork', icon: '⛏️', sub: 'Excavation', fields: [{ key: 'excavation_per_cubic_meter', label: 'Excavation', unit: '/m³' }] },
    { title: 'Services', icon: '⚡', sub: 'Elec, Plumbing & WP', fields: [{ key: 'electrical_per_sqft', label: 'Electrical', unit: '/sqft' }, { key: 'plumbing_per_sqft', label: 'Plumbing', unit: '/sqft' }, { key: 'waterproofing_per_sqft', label: 'Waterproofing', unit: '/sqft' }] },
    { title: 'Fixtures', icon: '🚪', sub: 'Doors & Windows', fields: [{ key: 'doors_per_unit', label: 'Door', unit: '/unit' }, { key: 'windows_per_unit', label: 'Window', unit: '/unit' }] },
];
function renderRatesPage() {
    const rates = getRates();
    document.getElementById('rates-last-updated').textContent = rates.last_updated ? new Date(rates.last_updated).toLocaleString() : 'Never';
    document.getElementById('rates-grid').innerHTML = RS.map(s => `<div class="rate-card"><div class="rate-card-header"><div class="rate-card-icon">${s.icon}</div><div><div class="rate-card-title">${s.title}</div><div class="rate-card-sub">${s.sub}</div></div></div>${s.fields.map(f => `<div class="rate-row"><div class="rate-name">${f.label}</div><div class="rate-input-wrap"><input type="number" class="rate-field" data-key="${f.key}" value="${rates[f.key] || ''}" min="0" step="1" inputmode="numeric"><span class="rate-unit">PKR${f.unit}</span></div></div>`).join('')}</div>`).join('');
}
function saveRates() {
    const u = {}; document.querySelectorAll('.rate-field').forEach(i => { u[i.dataset.key] = parseFloat(i.value) || 0 });
    u.last_updated = new Date().toISOString(); u.updated_by = 'admin';
    const e = DB.collection('rates').findOne({ updated_by: 'admin' });
    if (e) DB.collection('rates').updateOne({ updated_by: 'admin' }, { $set: u }); else DB.collection('rates').insertOne(u);
    document.getElementById('rates-last-updated').textContent = new Date().toLocaleString();
    toast('Rates saved!', 'success');
}
function resetRates() {
    if (!confirm('Reset to defaults?')) return;
    DB.collection('rates').updateOne({ updated_by: 'admin' }, { $set: { ...DEFAULT_RATES, last_updated: new Date().toISOString() } });
    renderRatesPage(); toast('Rates reset.', 'success');
}
function renderDashboard() {
    const recs = DB.collection('calculations').find();
    if (!recs.length) { document.getElementById('dashboard-stats').innerHTML = '<div class="stat-card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">No data yet</div><div class="empty-desc">Save estimates first.</div></div></div>'; document.getElementById('dashboard-tbody').innerHTML = ''; return }
    const tc = recs.reduce((a, r) => a + r.grandTotal, 0), ac = tc / recs.length, acps = recs.reduce((a, r) => a + (r.grandTotal / r.totalFloorArea), 0) / recs.length;
    document.getElementById('dashboard-stats').innerHTML = `<div class="stat-card primary-card"><div class="stat-label">Projects</div><div class="stat-value">${recs.length}</div><div class="stat-sub">Saved</div></div><div class="stat-card info-card"><div class="stat-label">Portfolio</div><div class="stat-value" style="font-size:14px">PKR ${fmtPKR(tc)}</div><div class="stat-sub">Total</div></div><div class="stat-card accent-card"><div class="stat-label">Avg Project</div><div class="stat-value" style="font-size:14px">PKR ${fmtPKR(Math.round(ac))}</div><div class="stat-sub">Per project</div></div><div class="stat-card success-card"><div class="stat-label">Avg/Sqft</div><div class="stat-value" style="font-size:14px">PKR ${fmtPKR(Math.round(acps))}</div><div class="stat-sub">Avg rate</div></div>`;
    const l10 = recs.slice(-10);
    if (trendCI) trendCI.destroy();
    trendCI = new Chart(document.getElementById('trendChart').getContext('2d'), { type: 'line', data: { labels: l10.map(r => r.projectName.length > 10 ? r.projectName.substr(0, 10) + '…' : r.projectName), datasets: [{ data: l10.map(r => Math.round(r.grandTotal)), borderColor: '#1a472a', backgroundColor: 'rgba(26,71,42,.08)', fill: true, tension: .35, pointRadius: 4, pointBackgroundColor: '#1a472a', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' PKR ' + fmtPKR(ctx.raw) } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 30 } }, y: { grid: { color: '#f0f0f0' }, ticks: { callback: v => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v), font: { size: 9 } } } } } });
    const tco = {}; recs.forEach(r => { tco[r.buildingType] = (tco[r.buildingType] || 0) + 1 });
    const tl = Object.keys(tco), td = tl.map(t => tco[t]), tcl = ['#1a472a', '#f4a261', '#1971c2', '#2b9348'];
    if (typeCI) typeCI.destroy();
    typeCI = new Chart(document.getElementById('typeChart').getContext('2d'), { type: 'doughnut', data: { labels: tl, datasets: [{ data: td, backgroundColor: tcl, borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } } } } });
    document.getElementById('type-legend').innerHTML = tl.map((t, i) => `<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:${tcl[i]}"></span>${t} (${tco[t]})</span>`).join('');
    const srt = [...recs].sort((a, b) => b.grandTotal - a.grandTotal);
    document.getElementById('dashboard-tbody').innerHTML = srt.map((r, i) => `<tr><td>${i + 1}</td><td style="font-weight:600;font-size:12px">${r.projectName}</td><td class="hide-mobile" style="font-size:12px">${r.buildingType}</td><td class="hide-mobile" style="font-family:var(--mono);font-size:11px">${r.dimensions.L}×${r.dimensions.W}×${r.dimensions.H}</td><td style="font-family:var(--mono);font-size:12px">${fmt(r.totalFloorArea)}</td><td style="font-weight:700;color:var(--primary);font-size:12px">PKR ${fmtPKR(r.grandTotal)}</td><td class="hide-mobile" style="font-family:var(--mono);font-size:11px">PKR ${fmtPKR(Math.round(r.grandTotal / r.totalFloorArea))}</td><td class="hide-mobile" style="font-size:11px;color:var(--text-muted)">${new Date(r.createdAt).toLocaleDateString()}</td></tr>`).join('');
}
function exportCSV() {
    if (!lastResult) { toast('No data.', 'error'); return }
    const rows = [['No', 'Description', 'Type', 'Qty', 'Unit', 'Rate PKR', 'Amount PKR']];
    lastResult.boq.forEach(x => { if (x.cat) rows.push(['', '=== ' + x.desc + ' ===', '', '', '', '', '']); else if (x.subcat) rows.push(['', '', '', '', '', x.desc, Math.round(x.amount)]); else rows.push([x.no, x.desc, x.type, x.qty, x.unit, x.rate.replace(/,/g, ''), Math.round(x.amount)]) });
    rows.push(['', '', '', '', '', 'GRAND TOTAL', Math.round(lastResult.grandTotal)]);
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `BOQ_${lastResult.projectName.replace(/\s+/g, '_')}.csv`; a.click();
    toast('CSV exported!', 'success');
}
function shareResult() {
    if (!lastResult) return;
    const t = `🏗️ BOQ — ${lastResult.projectName}\n📐 ${lastResult.L}×${lastResult.W}×${lastResult.H}ft (${lastResult.floors}F)\n📏 ${fmt(lastResult.totalFloorArea)} sqft\n💰 PKR ${fmtPKR(lastResult.grandTotal)}\n💵 PKR ${fmtPKR(Math.round(lastResult.grandTotal / lastResult.totalFloorArea))}/sqft`;
    if (navigator.share) navigator.share({ title: 'BOQ', text: t });
    else navigator.clipboard.writeText(t).then(() => toast('Copied!', 'success'));
}
function fmt(n) { return Math.round(n).toLocaleString() }
function fmtPKR(n) { return Math.round(n).toLocaleString() }
function showLoading(s) { document.getElementById('loadingOverlay').classList.toggle('show', s) }
function closeModal(id) { document.getElementById(id).classList.remove('open') }
function toast(msg, type = '') {
    const el = document.createElement('div'); el.className = 'toast' + (type ? ' ' + type : '');
    el.innerHTML = (type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : 'ℹ️ ') + msg;
    document.getElementById('toastContainer').appendChild(el); setTimeout(() => el.remove(), 3500);
}
document.querySelectorAll('.modal-overlay').forEach(o => { o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open') }) });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') calculateBOQ(); if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')) });
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (lastResult) renderBOQ(lastResult.boq, lastResult.grandTotal, lastResult) }, 300) });