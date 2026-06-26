// ═══════════════════════════════════════════════════════
// MONGODB SIMULATION (localStorage as persistent store)
// Mimics MongoDB collection structure with _id, timestamps
// ═══════════════════════════════════════════════════════
const DB = {
  _store: {},

  _load() {
    try {
      const raw = localStorage.getItem('bmc_db');
      this._store = raw ? JSON.parse(raw) : {};
    } catch(e) { this._store = {}; }
  },

  _save() {
    try { localStorage.setItem('bmc_db', JSON.stringify(this._store)); } catch(e) {}
  },

  collection(name) {
    if (!this._store[name]) this._store[name] = [];
    return {
      find: (query = {}) => {
        let docs = this._store[name];
        Object.keys(query).forEach(k => { docs = docs.filter(d => d[k] === query[k]); });
        return [...docs];
      },
      findOne: (query = {}) => {
        const docs = this._store[name];
        return docs.find(d => Object.keys(query).every(k => d[k] === query[k])) || null;
      },
      insertOne: (doc) => {
        const _id = 'oid_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
        const newDoc = { _id, createdAt: new Date().toISOString(), ...doc };
        this._store[name].push(newDoc);
        DB._save();
        return { insertedId: _id, ops: [newDoc] };
      },
      updateOne: (query, update) => {
        const idx = this._store[name].findIndex(d => Object.keys(query).every(k => d[k] === query[k]));
        if (idx > -1) {
          this._store[name][idx] = { ...this._store[name][idx], ...update.$set, updatedAt: new Date().toISOString() };
          DB._save();
          return { modifiedCount: 1 };
        }
        return { modifiedCount: 0 };
      },
      deleteOne: (query) => {
        const idx = this._store[name].findIndex(d => Object.keys(query).every(k => d[k] === query[k]));
        if (idx > -1) { this._store[name].splice(idx, 1); DB._save(); return { deletedCount: 1 }; }
        return { deletedCount: 0 };
      },
      deleteMany: () => { this._store[name] = []; DB._save(); return { deletedCount: 0 }; },
      count: () => this._store[name].length
    };
  }
};
DB._load();

// ═══════════════════════════════════════════════════════
// DEFAULT RATES (Collection: rates)
// ═══════════════════════════════════════════════════════
const DEFAULT_RATES = {
  cement_per_bag: 1250,
  sand_per_cft: 60,
  stone_crush_per_cft: 85,
  steel_per_kg: 280,
  brick_per_unit: 18,
  tile_per_sqft: 150,
  paint_per_liter: 500,
  excavation_per_cubic_meter: 1200,
  mason_per_day: 1800,
  helper_per_day: 1200,
  steel_fixer_per_day: 2000,
  carpenter_per_day: 2200,
  painter_per_day: 1500,
  plaster_per_sqft: 45,
  binding_wire_per_kg: 150,
  formwork_per_sqft: 80,
  electrical_per_sqft: 120,
  plumbing_per_sqft: 100,
  waterproofing_per_sqft: 65,
  doors_per_unit: 12000,
  windows_per_unit: 8000,
  last_updated: new Date().toISOString(),
  updated_by: 'admin'
};

function getRates() {
  const saved = DB.collection('rates').findOne({ updated_by: 'admin' });
  return saved ? { ...DEFAULT_RATES, ...saved } : { ...DEFAULT_RATES };
}

function initRates() {
  const exists = DB.collection('rates').findOne({ updated_by: 'admin' });
  if (!exists) DB.collection('rates').insertOne({ ...DEFAULT_RATES });
}
initRates();

// ═══════════════════════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════════════════════
let currentBuildingType = 'residential';
let lastResult = null;
let selectedHistoryId = null;
let pieChartInst = null, barChartInst = null, trendChartInst = null, typeChartInst = null;

// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
  if (name === 'rates') renderRatesPage();
  if (name === 'history') renderHistoryPage();
  if (name === 'dashboard') renderDashboard();
}

// ═══════════════════════════════════════════════════════
// BUILDING TYPE SELECTION
// ═══════════════════════════════════════════════════════
function selectType(el, type) {
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  currentBuildingType = type;
}

// ═══════════════════════════════════════════════════════
// LIVE AREA PREVIEW
// ═══════════════════════════════════════════════════════
['length','width','height','numFloors'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateAreaPreview);
});

function updateAreaPreview() {
  const L = parseFloat(document.getElementById('length').value) || 0;
  const W = parseFloat(document.getElementById('width').value) || 0;
  const H = parseFloat(document.getElementById('height').value) || 0;
  const F = parseInt(document.getElementById('numFloors').value) || 1;
  const prev = document.getElementById('areaPreview');
  if (L > 0 && W > 0 && H > 0) {
    prev.style.display = 'block';
    document.getElementById('prev-floor').textContent = fmt(L * W);
    document.getElementById('prev-total').textContent = fmt(L * W * F);
    document.getElementById('prev-vol').textContent = fmt(L * W * H * F);
  } else {
    prev.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════
// MAIN CALCULATION ENGINE
// ═══════════════════════════════════════════════════════
function calculateBOQ() {
  const L = parseFloat(document.getElementById('length').value);
  const W = parseFloat(document.getElementById('width').value);
  const H = parseFloat(document.getElementById('height').value);
  const floors = parseInt(document.getElementById('numFloors').value) || 1;
  const projectName = document.getElementById('projectName').value || `${currentBuildingType.charAt(0).toUpperCase()+currentBuildingType.slice(1)} Building`;

  if (!L || !W || !H || L <= 0 || W <= 0 || H <= 0) {
    toast('Please enter valid Length, Width, and Height values.', 'error');
    return;
  }

  showLoading(true);
  setTimeout(() => {
    const rates = getRates();
    const foundationType = document.getElementById('foundationType').value;
    const wallType = document.getElementById('wallType').value;
    const roofType = document.getElementById('roofType').value;
    const finishingLevel = document.getElementById('finishingLevel').value;
    const finFactor = finishingLevel === 'luxury' ? 1.30 : finishingLevel === 'economy' ? 0.80 : 1.00;

    // ── DIMENSIONS ──
    const floorArea = L * W;                           // sqft per floor
    const totalFloorArea = floorArea * floors;          // sqft total
    const perimeterLength = 2 * (L + W);               // ft
    const wallArea = perimeterLength * H * floors;      // sqft (gross)
    const openingsArea = totalFloorArea * 0.12;         // ~12% for doors/windows
    const netWallArea = wallArea - openingsArea;        // sqft
    const totalVolume = L * W * H * floors;             // cft
    const totalVolumeM3 = totalVolume * 0.0283168;     // m³

    // ── FOUNDATION ──
    const excavDepth = foundationType === 'raft' ? 4 : 3; // ft
    const excavVol = L * W * excavDepth;
    const foundConcreteVol = foundationType === 'raft' ? L * W * 0.75 : (perimeterLength * 1.5 * 1.5);
    const foundSteelKg = foundConcreteVol * 0.0283168 * 80; // 80kg per m³ concrete

    // ── SUPERSTRUCTURE ──
    const slabThickness = 0.5;  // ft
    const slabVol = floorArea * slabThickness * floors;
    const slabVolM3 = slabVol * 0.0283168;
    const slabSteelKg = slabVolM3 * 100; // 100kg/m³ for slabs

    const columnVol = (L * W / 400) * 1.5 * 1.5 * H * floors * 0.0283168; // m³ columns
    const columnSteelKg = columnVol * 160; // 160kg/m³ for columns

    const beamVol = ((L + W) / 15) * 1.0 * 1.5 * floors * 0.0283168;
    const beamSteelKg = beamVol * 120;

    const totalSteelKg = (foundSteelKg + slabSteelKg + columnSteelKg + beamSteelKg) * (currentBuildingType === 'commercial' ? 1.3 : 1.0);

    // ── CONCRETE MIX (1:2:4) ──
    const totalConcreteM3 = (foundConcreteVol + slabVol + columnVol * 35.3147 + beamVol * 35.3147) * 0.0283168;
    const cementBags = totalConcreteM3 * 6.5;  // ~6.5 bags per m³
    const sandCft = totalConcreteM3 * 35.3147 * 2 / 4 * 1.33; // extra 33% for wastage
    const crushCft = totalConcreteM3 * 35.3147 * 4 / 4 * 1.33;

    // ── BRICKWORK ──
    const wallThickFactor = wallType === 'brick' ? 1 : wallType === 'brick45' ? 0.55 : 0.7;
    const bricksPerSqft = wallType === 'brick' ? 11 : 5.5;
    const totalBricks = netWallArea * bricksPerSqft * wallThickFactor;
    const mortarCementBags = netWallArea * (wallType === 'brick' ? 0.35 : 0.2);
    const mortarSandCft = mortarCementBags * 4;

    // ── PLASTERING ──
    const plasterArea = (netWallArea * 2 + totalFloorArea * floors * 1.1);

    // ── TILES ──
    const tileArea = totalFloorArea * 1.05; // 5% wastage

    // ── PAINT ──
    const paintArea = netWallArea * 2 + totalFloorArea;
    const paintLiters = paintArea / 70; // ~70 sqft per liter (2 coats)

    // ── DOORS & WINDOWS ──
    const numDoors = Math.max(2, Math.round(totalFloorArea / 200) + (floors - 1));
    const numWindows = Math.max(3, Math.round(totalFloorArea / 100));

    // ── LABOUR DAYS ──
    const baseDays = Math.ceil(totalFloorArea / 15) * floors;
    const masonDays = Math.round(baseDays * 0.8);
    const helperDays = Math.round(baseDays * 1.4);
    const steelFixerDays = Math.round(baseDays * 0.3);
    const carpenterDays = Math.round(baseDays * 0.2);
    const painterDays = Math.round(paintArea / 200);

    // ── BINDING WIRE ──
    const bindingWireKg = totalSteelKg * 0.006;

    // ── FORMWORK ──
    const formworkSqft = (slabVol / slabThickness) + (columnVol / 0.0283168 * 0.3) + (beamVol / 0.0283168 * 0.5);

    // ── ELECTRICAL & PLUMBING ──
    const electricalCost = totalFloorArea * rates.electrical_per_sqft * finFactor;
    const plumbingCost = totalFloorArea * rates.plumbing_per_sqft * finFactor;
    const waterproofingCost = (floorArea + totalFloorArea * 0.3) * rates.waterproofing_per_sqft;

    // ══════════════════════════════════════════════════
    // BUILD BOQ ITEMS
    // ══════════════════════════════════════════════════
    const boq = [
      // ── CATEGORY: SITE PREPARATION ──
      { cat: true, desc: 'A. SITE PREPARATION & EXCAVATION', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'A1', desc: 'Excavation for Foundation', type: 'labour', qty: excavVol.toFixed(2), unit: 'Cft', rate: fmtPKR(rates.excavation_per_cubic_meter / 35.3147), amount: excavVol * (rates.excavation_per_cubic_meter / 35.3147) },
      { no: 'A2', desc: 'Anti-termite Treatment (chemical)', type: 'material', qty: (L*W).toFixed(2), unit: 'Sqft', rate: fmtPKR(12), amount: L*W*12 },
      { no: 'A3', desc: 'Levelling & Compaction of Site', type: 'labour', qty: (L*W).toFixed(2), unit: 'Sqft', rate: fmtPKR(8), amount: L*W*8 },
      { subcat: true, desc: 'Sub-total A', amount: excavVol*(rates.excavation_per_cubic_meter/35.3147)+L*W*12+L*W*8 },

      // ── CATEGORY: FOUNDATION ──
      { cat: true, desc: 'B. FOUNDATION WORKS', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'B1', desc: `Plain Cement Concrete (PCC 1:3:6) — ${foundationType.charAt(0).toUpperCase()+foundationType.slice(1)} Foundation`, type: 'material', qty: (foundConcreteVol*0.15*0.0283168).toFixed(3), unit: 'M³', rate: fmtPKR(12500), amount: foundConcreteVol*0.15*0.0283168*12500 },
      { no: 'B2', desc: 'Reinforced Concrete Foundation (M20 mix)', type: 'material', qty: (foundConcreteVol*0.0283168).toFixed(3), unit: 'M³', rate: fmtPKR(18500), amount: foundConcreteVol*0.0283168*18500 },
      { no: 'B3', desc: 'Steel Reinforcement — Foundation', type: 'material', qty: foundSteelKg.toFixed(1), unit: 'Kg', rate: fmtPKR(rates.steel_per_kg), amount: foundSteelKg*rates.steel_per_kg },
      { no: 'B4', desc: 'Binding Wire for Foundation', type: 'material', qty: (foundSteelKg*0.006).toFixed(2), unit: 'Kg', rate: fmtPKR(rates.binding_wire_per_kg), amount: foundSteelKg*0.006*rates.binding_wire_per_kg },
      { no: 'B5', desc: 'Formwork for Foundation', type: 'labour', qty: (perimeterLength*excavDepth).toFixed(1), unit: 'Sqft', rate: fmtPKR(rates.formwork_per_sqft), amount: perimeterLength*excavDepth*rates.formwork_per_sqft },
      { subcat: true, desc: 'Sub-total B', amount: foundConcreteVol*0.15*0.0283168*12500+foundConcreteVol*0.0283168*18500+foundSteelKg*rates.steel_per_kg+foundSteelKg*0.006*rates.binding_wire_per_kg+perimeterLength*excavDepth*rates.formwork_per_sqft },

      // ── CATEGORY: SUPERSTRUCTURE ──
      { cat: true, desc: 'C. SUPERSTRUCTURE — RCC FRAME', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'C1', desc: `RCC Columns (M25 mix) — ${floors} Floor(s)`, type: 'material', qty: (columnVol).toFixed(3), unit: 'M³', rate: fmtPKR(21000), amount: columnVol*21000 },
      { no: 'C2', desc: 'RCC Beams (M25 mix)', type: 'material', qty: (beamVol).toFixed(3), unit: 'M³', rate: fmtPKR(21000), amount: beamVol*21000 },
      { no: 'C3', desc: `RCC Slab (${roofType.toUpperCase()}) — All Floors`, type: 'material', qty: (slabVolM3).toFixed(3), unit: 'M³', rate: fmtPKR(20500), amount: slabVolM3*20500 },
      { no: 'C4', desc: 'Steel Reinforcement — Superstructure', type: 'material', qty: (slabSteelKg+columnSteelKg+beamSteelKg).toFixed(1), unit: 'Kg', rate: fmtPKR(rates.steel_per_kg), amount: (slabSteelKg+columnSteelKg+beamSteelKg)*rates.steel_per_kg },
      { no: 'C5', desc: 'Binding Wire — Superstructure', type: 'material', qty: (bindingWireKg).toFixed(2), unit: 'Kg', rate: fmtPKR(rates.binding_wire_per_kg), amount: bindingWireKg*rates.binding_wire_per_kg },
      { no: 'C6', desc: 'Formwork for Slabs & Beams', type: 'labour', qty: formworkSqft.toFixed(1), unit: 'Sqft', rate: fmtPKR(rates.formwork_per_sqft), amount: formworkSqft*rates.formwork_per_sqft },
      { no: 'C7', desc: 'Steel Fixer Labour', type: 'labour', qty: steelFixerDays, unit: 'Days', rate: fmtPKR(rates.steel_fixer_per_day), amount: steelFixerDays*rates.steel_fixer_per_day },
      { subcat: true, desc: 'Sub-total C', amount: columnVol*21000+beamVol*21000+slabVolM3*20500+(slabSteelKg+columnSteelKg+beamSteelKg)*rates.steel_per_kg+bindingWireKg*rates.binding_wire_per_kg+formworkSqft*rates.formwork_per_sqft+steelFixerDays*rates.steel_fixer_per_day },

      // ── CATEGORY: BRICKWORK ──
      { cat: true, desc: 'D. BRICK MASONRY & BLOCK WORK', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'D1', desc: `Brickwork — ${wallType === 'brick' ? '9" Brick Wall' : wallType === 'brick45' ? '4.5" Brick Wall' : 'Concrete Block Wall'}`, type: 'material', qty: Math.round(totalBricks), unit: 'Nos', rate: fmtPKR(rates.brick_per_unit), amount: Math.round(totalBricks)*rates.brick_per_unit },
      { no: 'D2', desc: 'Cement for Mortar (Brick Joints)', type: 'material', qty: mortarCementBags.toFixed(1), unit: 'Bags', rate: fmtPKR(rates.cement_per_bag), amount: mortarCementBags*rates.cement_per_bag },
      { no: 'D3', desc: 'Sand for Mortar', type: 'material', qty: mortarSandCft.toFixed(1), unit: 'Cft', rate: fmtPKR(rates.sand_per_cft), amount: mortarSandCft*rates.sand_per_cft },
      { no: 'D4', desc: 'Mason Labour (Brickwork)', type: 'labour', qty: Math.round(masonDays*0.4), unit: 'Days', rate: fmtPKR(rates.mason_per_day), amount: Math.round(masonDays*0.4)*rates.mason_per_day },
      { no: 'D5', desc: 'Helper Labour (Brickwork)', type: 'labour', qty: Math.round(helperDays*0.4), unit: 'Days', rate: fmtPKR(rates.helper_per_day), amount: Math.round(helperDays*0.4)*rates.helper_per_day },
      { subcat: true, desc: 'Sub-total D', amount: Math.round(totalBricks)*rates.brick_per_unit+mortarCementBags*rates.cement_per_bag+mortarSandCft*rates.sand_per_cft+Math.round(masonDays*0.4)*rates.mason_per_day+Math.round(helperDays*0.4)*rates.helper_per_day },

      // ── CATEGORY: PLASTER ──
      { cat: true, desc: 'E. PLASTER & RENDERING', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'E1', desc: 'Cement Plaster 12mm thick (1:4)', type: 'material', qty: plasterArea.toFixed(1), unit: 'Sqft', rate: fmtPKR(rates.plaster_per_sqft), amount: plasterArea*rates.plaster_per_sqft },
      { no: 'E2', desc: 'Cement for Plaster Mix', type: 'material', qty: (plasterArea*0.06).toFixed(1), unit: 'Bags', rate: fmtPKR(rates.cement_per_bag), amount: plasterArea*0.06*rates.cement_per_bag },
      { no: 'E3', desc: 'Sand for Plaster', type: 'material', qty: (plasterArea*0.2).toFixed(1), unit: 'Cft', rate: fmtPKR(rates.sand_per_cft), amount: plasterArea*0.2*rates.sand_per_cft },
      { no: 'E4', desc: 'Mason Labour (Plastering)', type: 'labour', qty: Math.round(masonDays*0.35), unit: 'Days', rate: fmtPKR(rates.mason_per_day), amount: Math.round(masonDays*0.35)*rates.mason_per_day },
      { subcat: true, desc: 'Sub-total E', amount: plasterArea*rates.plaster_per_sqft+plasterArea*0.06*rates.cement_per_bag+plasterArea*0.2*rates.sand_per_cft+Math.round(masonDays*0.35)*rates.mason_per_day },

      // ── CATEGORY: FLOORING ──
      { cat: true, desc: 'F. FLOORING & TILING', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'F1', desc: `Floor Tiles (${finishingLevel} quality)`, type: 'material', qty: tileArea.toFixed(1), unit: 'Sqft', rate: fmtPKR(rates.tile_per_sqft * finFactor), amount: tileArea*rates.tile_per_sqft*finFactor },
      { no: 'F2', desc: 'Tile Adhesive / Cement Mortar Bed', type: 'material', qty: (tileArea*0.08).toFixed(1), unit: 'Bags', rate: fmtPKR(rates.cement_per_bag), amount: tileArea*0.08*rates.cement_per_bag },
      { no: 'F3', desc: 'Tile Grout & Finishing', type: 'material', qty: tileArea.toFixed(1), unit: 'Sqft', rate: fmtPKR(8), amount: tileArea*8 },
      { no: 'F4', desc: 'Tiler Labour', type: 'labour', qty: Math.round(tileArea/80), unit: 'Days', rate: fmtPKR(rates.mason_per_day), amount: Math.round(tileArea/80)*rates.mason_per_day },
      { subcat: true, desc: 'Sub-total F', amount: tileArea*rates.tile_per_sqft*finFactor+tileArea*0.08*rates.cement_per_bag+tileArea*8+Math.round(tileArea/80)*rates.mason_per_day },

      // ── CATEGORY: DOORS & WINDOWS ──
      { cat: true, desc: 'G. DOORS, WINDOWS & GLAZING', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'G1', desc: `Main & Room Doors (${finishingLevel} grade)`, type: 'material', qty: numDoors, unit: 'Nos', rate: fmtPKR(rates.doors_per_unit*finFactor), amount: numDoors*rates.doors_per_unit*finFactor },
      { no: 'G2', desc: `Windows & Ventilators (Aluminium)`, type: 'material', qty: numWindows, unit: 'Nos', rate: fmtPKR(rates.windows_per_unit*finFactor), amount: numWindows*rates.windows_per_unit*finFactor },
      { no: 'G3', desc: 'Door & Window Frame Fixing Labour', type: 'labour', qty: (numDoors+numWindows), unit: 'Nos', rate: fmtPKR(800), amount: (numDoors+numWindows)*800 },
      { no: 'G4', desc: 'Carpenter Labour (frames & finishing)', type: 'labour', qty: carpenterDays, unit: 'Days', rate: fmtPKR(rates.carpenter_per_day), amount: carpenterDays*rates.carpenter_per_day },
      { subcat: true, desc: 'Sub-total G', amount: numDoors*rates.doors_per_unit*finFactor+numWindows*rates.windows_per_unit*finFactor+(numDoors+numWindows)*800+carpenterDays*rates.carpenter_per_day },

      // ── CATEGORY: PAINTING ──
      { cat: true, desc: 'H. PAINTING & FINISHING', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'H1', desc: `Wall Paint — Interior (${finishingLevel} grade, 2 coats)`, type: 'material', qty: (paintLiters*0.7).toFixed(1), unit: 'Ltr', rate: fmtPKR(rates.paint_per_liter*finFactor), amount: paintLiters*0.7*rates.paint_per_liter*finFactor },
      { no: 'H2', desc: 'Wall Paint — Exterior (Weather Shield)', type: 'material', qty: (paintLiters*0.3).toFixed(1), unit: 'Ltr', rate: fmtPKR(rates.paint_per_liter*1.2*finFactor), amount: paintLiters*0.3*rates.paint_per_liter*1.2*finFactor },
      { no: 'H3', desc: 'Putty / Primer Coat', type: 'material', qty: paintArea.toFixed(1), unit: 'Sqft', rate: fmtPKR(10), amount: paintArea*10 },
      { no: 'H4', desc: 'Painter Labour', type: 'labour', qty: painterDays, unit: 'Days', rate: fmtPKR(rates.painter_per_day), amount: painterDays*rates.painter_per_day },
      { subcat: true, desc: 'Sub-total H', amount: paintLiters*0.7*rates.paint_per_liter*finFactor+paintLiters*0.3*rates.paint_per_liter*1.2*finFactor+paintArea*10+painterDays*rates.painter_per_day },

      // ── CATEGORY: ELECTRICAL ──
      { cat: true, desc: 'I. ELECTRICAL WORKS', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'I1', desc: 'Complete Electrical Wiring & Conduits', type: 'material', qty: totalFloorArea.toFixed(1), unit: 'Sqft', rate: fmtPKR(rates.electrical_per_sqft*0.6*finFactor), amount: totalFloorArea*rates.electrical_per_sqft*0.6*finFactor },
      { no: 'I2', desc: 'Switches, Sockets & Fittings', type: 'material', qty: totalFloorArea.toFixed(1), unit: 'Sqft', rate: fmtPKR(rates.electrical_per_sqft*0.25*finFactor), amount: totalFloorArea*rates.electrical_per_sqft*0.25*finFactor },
      { no: 'I3', desc: 'Main Panel Board & MCBs', type: 'material', qty: floors, unit: 'Set', rate: fmtPKR(28000), amount: floors*28000 },
      { no: 'I4', desc: 'Electrician Labour', type: 'labour', qty: Math.round(totalFloorArea/120), unit: 'Days', rate: fmtPKR(1800), amount: Math.round(totalFloorArea/120)*1800 },
      { subcat: true, desc: 'Sub-total I', amount: totalFloorArea*rates.electrical_per_sqft*0.6*finFactor+totalFloorArea*rates.electrical_per_sqft*0.25*finFactor+floors*28000+Math.round(totalFloorArea/120)*1800 },

      // ── CATEGORY: PLUMBING ──
      { cat: true, desc: 'J. PLUMBING & SANITARY WORKS', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'J1', desc: 'Plumbing Pipes (CPVC/PVC) & Fittings', type: 'material', qty: totalFloorArea.toFixed(1), unit: 'Sqft', rate: fmtPKR(rates.plumbing_per_sqft*0.55*finFactor), amount: totalFloorArea*rates.plumbing_per_sqft*0.55*finFactor },
      { no: 'J2', desc: 'Sanitary Ware (WC, Basin, Shower)', type: 'material', qty: Math.max(1, floors), unit: 'Set', rate: fmtPKR(45000*finFactor), amount: Math.max(1,floors)*45000*finFactor },
      { no: 'J3', desc: 'Overhead Water Tank (500 Gal each floor)', type: 'material', qty: floors, unit: 'Nos', rate: fmtPKR(18000), amount: floors*18000 },
      { no: 'J4', desc: 'Plumber Labour', type: 'labour', qty: Math.round(totalFloorArea/100), unit: 'Days', rate: fmtPKR(1600), amount: Math.round(totalFloorArea/100)*1600 },
      { subcat: true, desc: 'Sub-total J', amount: totalFloorArea*rates.plumbing_per_sqft*0.55*finFactor+Math.max(1,floors)*45000*finFactor+floors*18000+Math.round(totalFloorArea/100)*1600 },

      // ── CATEGORY: WATERPROOFING ──
      { cat: true, desc: 'K. WATERPROOFING & DAMP PROOFING', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'K1', desc: 'Roof Waterproofing (Bitumen membrane)', type: 'material', qty: floorArea.toFixed(1), unit: 'Sqft', rate: fmtPKR(rates.waterproofing_per_sqft*1.2), amount: floorArea*rates.waterproofing_per_sqft*1.2 },
      { no: 'K2', desc: 'Bathroom Floor Waterproofing', type: 'material', qty: (totalFloorArea*0.12).toFixed(1), unit: 'Sqft', rate: fmtPKR(rates.waterproofing_per_sqft), amount: totalFloorArea*0.12*rates.waterproofing_per_sqft },
      { no: 'K3', desc: 'DPC (Damp Proof Course)', type: 'material', qty: (perimeterLength*0.5).toFixed(1), unit: 'Sqft', rate: fmtPKR(40), amount: perimeterLength*0.5*40 },
      { subcat: true, desc: 'Sub-total K', amount: floorArea*rates.waterproofing_per_sqft*1.2+totalFloorArea*0.12*rates.waterproofing_per_sqft+perimeterLength*0.5*40 },

      // ── CATEGORY: MISCELLANEOUS ──
      { cat: true, desc: 'L. MISCELLANEOUS & CONTINGENCIES', type: '', qty: '', unit: '', rate: '', amount: '' },
      { no: 'L1', desc: 'Staircase Construction (RCC)', type: 'misc', qty: Math.max(0, floors-1), unit: 'Flights', rate: fmtPKR(85000), amount: Math.max(0,floors-1)*85000 },
      { no: 'L2', desc: 'Site Overhead & Supervision (5%)', type: 'misc', qty: '5%', unit: 'L.S.', rate: '—', amount: 0, isPercent: true, pct: 0.05 },
      { no: 'L3', desc: 'Contingency & Unforeseen (3%)', type: 'misc', qty: '3%', unit: 'L.S.', rate: '—', amount: 0, isPercent: true, pct: 0.03 },
    ];

    // Compute subtotals for percent items
    let prePercentTotal = 0;
    boq.forEach(r => {
      if (!r.cat && !r.subcat && !r.isPercent) prePercentTotal += (parseFloat(r.amount) || 0);
    });
    boq.forEach(r => {
      if (r.isPercent) r.amount = prePercentTotal * r.pct;
    });

    const stairAmount = Math.max(0,floors-1)*85000;
    const overheadAmount = prePercentTotal * 0.05;
    const contingencyAmount = prePercentTotal * 0.03;
    const subL = stairAmount + overheadAmount + contingencyAmount;
    boq.push({ subcat: true, desc: 'Sub-total L', amount: subL });

    // Grand Total
    let grandTotal = 0;
    boq.forEach(r => {
      if (r.subcat && r.desc.startsWith('Sub-total')) grandTotal += r.amount;
    });

    // ── RENDER ──
    renderBOQ(boq, grandTotal, { L, W, H, floors, projectName, totalFloorArea, floorArea });

    lastResult = {
      projectName, buildingType: currentBuildingType, L, W, H, floors,
      floorArea, totalFloorArea, grandTotal, boq,
      foundationType, wallType, roofType, finishingLevel,
      calculatedAt: new Date().toISOString()
    };

    showLoading(false);
    document.getElementById('results-area').classList.add('visible');
    document.getElementById('calc-placeholder').style.display = 'none';
    setTimeout(() => document.getElementById('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    toast('BOQ generated successfully!', 'success');
  }, 600);
}

// ═══════════════════════════════════════════════════════
// RENDER BOQ TABLE
// ═══════════════════════════════════════════════════════
function renderBOQ(boq, grandTotal, meta) {
  const { L, W, H, floors, projectName, totalFloorArea, floorArea } = meta;
  document.getElementById('result-title').textContent = `BOQ — ${projectName}`;
  document.getElementById('result-meta').textContent = `${L}ft × ${W}ft × ${H}ft | ${floors} Floor(s) | Total Area: ${fmt(totalFloorArea)} sqft | ${currentBuildingType.charAt(0).toUpperCase()+currentBuildingType.slice(1)} | Generated: ${new Date().toLocaleString()}`;
  document.getElementById('result-grand-total').textContent = `PKR ${fmtPKR(grandTotal)}`;
  document.getElementById('print-meta').textContent = document.getElementById('result-meta').textContent;

  // Summary stats
  let matTotal = 0, labTotal = 0, miscTotal = 0;
  boq.forEach(r => {
    if (!r.cat && !r.subcat) {
      const amt = parseFloat(r.amount) || 0;
      if (r.type === 'material') matTotal += amt;
      else if (r.type === 'labour') labTotal += amt;
      else miscTotal += amt;
    }
  });

  document.getElementById('summary-stats').innerHTML = `
    <div class="stat-card primary-card">
      <div class="stat-label">Grand Total</div>
      <div class="stat-value" style="font-size:17px">PKR ${fmtPKR(grandTotal)}</div>
      <div class="stat-sub">Complete project estimate</div>
    </div>
    <div class="stat-card info-card">
      <div class="stat-label">Materials Cost</div>
      <div class="stat-value" style="font-size:17px">PKR ${fmtPKR(matTotal)}</div>
      <div class="stat-sub">${Math.round(matTotal/grandTotal*100)}% of total</div>
    </div>
    <div class="stat-card accent-card">
      <div class="stat-label">Labour Cost</div>
      <div class="stat-value" style="font-size:17px">PKR ${fmtPKR(labTotal)}</div>
      <div class="stat-sub">${Math.round(labTotal/grandTotal*100)}% of total</div>
    </div>
    <div class="stat-card success-card">
      <div class="stat-label">Cost / Sqft</div>
      <div class="stat-value" style="font-size:17px">PKR ${fmtPKR(Math.round(grandTotal/totalFloorArea))}</div>
      <div class="stat-sub">Based on ${fmt(totalFloorArea)} sqft</div>
    </div>`;

  // Table rows
  const tbody = document.getElementById('boq-tbody');
  let html = '';
  let rowIdx = 0;
  boq.forEach(r => {
    if (r.cat) {
      html += `<tr class="category-row"><td colspan="7">${r.desc}</td></tr>`;
    } else if (r.subcat) {
      html += `<tr class="subtotal-row"><td colspan="5"></td><td>${r.desc}</td><td>PKR ${fmtPKR(r.amount)}</td></tr>`;
    } else {
      rowIdx++;
      const typeBadge = r.type === 'material' ? '<span class="badge badge-material">Material</span>' :
                        r.type === 'labour'   ? '<span class="badge badge-labour">Labour</span>' :
                        '<span class="badge badge-misc">Misc</span>';
      html += `<tr>
        <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${r.no}</td>
        <td>${r.desc}</td>
        <td>${typeBadge}</td>
        <td style="font-family:var(--font-mono)">${typeof r.qty === 'number' ? fmt(r.qty) : r.qty}</td>
        <td style="color:var(--text-muted);font-size:12px">${r.unit}</td>
        <td style="font-family:var(--font-mono);text-align:right">${r.rate}</td>
        <td style="font-family:var(--font-mono)">PKR ${fmtPKR(r.amount)}</td>
      </tr>`;
    }
  });
  html += `<tr class="total-row"><td colspan="5"></td><td>🏗️ GRAND TOTAL</td><td>PKR ${fmtPKR(grandTotal)}</td></tr>`;
  tbody.innerHTML = html;

  // Charts
  renderPieChart(matTotal, labTotal, miscTotal);
  renderBarChart(boq, grandTotal);
}

// ═══════════════════════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════════════════════
function renderPieChart(mat, lab, misc) {
  if (pieChartInst) pieChartInst.destroy();
  const ctx = document.getElementById('pieChart').getContext('2d');
  pieChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Materials', 'Labour', 'Misc/Overhead'],
      datasets: [{
        data: [Math.round(mat), Math.round(lab), Math.round(misc)],
        backgroundColor: ['#1a472a', '#f4a261', '#1971c2'],
        borderWidth: 2, borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` PKR ${fmtPKR(ctx.raw)} (${Math.round(ctx.raw/(mat+lab+misc)*100)}%)` } }
      }
    }
  });
  const total = mat + lab + misc;
  document.getElementById('pie-legend').innerHTML = [
    ['#1a472a', 'Materials', mat],
    ['#f4a261', 'Labour', lab],
    ['#1971c2', 'Misc', misc]
  ].map(([c,n,v]) => `<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:${c}"></span>${n} ${Math.round(v/total*100)}%</span>`).join('');
}

function renderBarChart(boq, grandTotal) {
  if (barChartInst) barChartInst.destroy();
  const labels = [], data = [];
  boq.forEach(r => {
    if (r.subcat && r.desc.startsWith('Sub-total')) {
      const letter = r.desc.replace('Sub-total ','');
      labels.push('Cat ' + letter);
      data.push(Math.round(r.amount));
    }
  });
  const ctx = document.getElementById('barChart').getContext('2d');
  barChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cost (PKR)',
        data,
        backgroundColor: '#1a472a',
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` PKR ${fmtPKR(ctx.raw)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { callback: v => 'PKR ' + (v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v), font: { size: 10 } } }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════
// SAVE TO HISTORY (MongoDB: calculations collection)
// ═══════════════════════════════════════════════════════
function saveToHistory() {
  if (!lastResult) { toast('No result to save.', 'error'); return; }
  const data = {
    projectName: lastResult.projectName,
    buildingType: lastResult.buildingType,
    dimensions: { L: lastResult.L, W: lastResult.W, H: lastResult.H, floors: lastResult.floors },
    floorArea: lastResult.floorArea,
    totalFloorArea: lastResult.totalFloorArea,
    grandTotal: lastResult.grandTotal,
    options: { foundationType: lastResult.foundationType, wallType: lastResult.wallType, roofType: lastResult.roofType, finishingLevel: lastResult.finishingLevel },
    boq: lastResult.boq,
    calculatedAt: lastResult.calculatedAt
  };
  DB.collection('calculations').insertOne(data);
  toast('Saved to history database!', 'success');
}

// ═══════════════════════════════════════════════════════
// HISTORY PAGE
// ═══════════════════════════════════════════════════════
function renderHistoryPage() {
  const records = DB.collection('calculations').find().reverse();
  const grid = document.getElementById('history-grid');
  if (records.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No estimates saved yet</div><div class="empty-desc">Generate a BOQ and click "Save to History".</div></div>`;
    return;
  }
  const icons = { residential:'🏠', commercial:'🏢', industrial:'🏭', custom:'📐' };
  grid.innerHTML = records.map(r => `
    <div class="history-card" onclick="viewHistory('${r._id}')">
      <div class="history-icon">${icons[r.buildingType] || '🏗️'}</div>
      <div class="history-info">
        <div class="history-title">${r.projectName}</div>
        <div class="history-meta">${r.buildingType.charAt(0).toUpperCase()+r.buildingType.slice(1)} · ${r.dimensions.floors} floor(s) · ${r.options.finishingLevel} finish</div>
        <div class="history-dims">${r.dimensions.L}ft × ${r.dimensions.W}ft × ${r.dimensions.H}ft | ${fmt(r.totalFloorArea)} sqft</div>
      </div>
      <div class="history-amount">
        <div class="history-total">PKR ${fmtPKR(r.grandTotal)}</div>
        <div class="history-date">${new Date(r.createdAt).toLocaleDateString('en-PK', {day:'numeric',month:'short',year:'numeric'})}</div>
        <div class="history-actions" onclick="event.stopPropagation()">
          <button class="btn btn-outline btn-sm" onclick="deleteHistory('${r._id}')">Delete</button>
        </div>
      </div>
    </div>`).join('');
}

function viewHistory(id) {
  const r = DB.collection('calculations').findOne({ _id: id });
  if (!r) return;
  selectedHistoryId = id;
  document.getElementById('historyModal-title').textContent = r.projectName;
  document.getElementById('historyModal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div class="stat-card primary-card"><div class="stat-label">Grand Total</div><div class="stat-value" style="font-size:16px">PKR ${fmtPKR(r.grandTotal)}</div></div>
      <div class="stat-card info-card"><div class="stat-label">Area</div><div class="stat-value" style="font-size:16px">${fmt(r.totalFloorArea)} sqft</div></div>
    </div>
    <table style="width:100%;font-size:12px;border-collapse:collapse;">
      <tr><td style="padding:5px;color:var(--text-muted);width:40%">Project</td><td style="font-weight:600">${r.projectName}</td></tr>
      <tr style="background:var(--surface-2)"><td style="padding:5px;color:var(--text-muted)">Type</td><td style="font-weight:600">${r.buildingType}</td></tr>
      <tr><td style="padding:5px;color:var(--text-muted)">Dimensions</td><td style="font-weight:600;font-family:var(--font-mono)">${r.dimensions.L}×${r.dimensions.W}×${r.dimensions.H} ft, ${r.dimensions.floors} floor(s)</td></tr>
      <tr style="background:var(--surface-2)"><td style="padding:5px;color:var(--text-muted)">Foundation</td><td style="font-weight:600">${r.options.foundationType}</td></tr>
      <tr><td style="padding:5px;color:var(--text-muted)">Wall Type</td><td style="font-weight:600">${r.options.wallType}</td></tr>
      <tr style="background:var(--surface-2)"><td style="padding:5px;color:var(--text-muted)">Finishing</td><td style="font-weight:600">${r.options.finishingLevel}</td></tr>
      <tr><td style="padding:5px;color:var(--text-muted)">Cost/sqft</td><td style="font-weight:600">PKR ${fmtPKR(Math.round(r.grandTotal/r.totalFloorArea))}</td></tr>
      <tr style="background:var(--surface-2)"><td style="padding:5px;color:var(--text-muted)">Saved on</td><td style="font-weight:600">${new Date(r.createdAt).toLocaleString()}</td></tr>
      <tr><td style="padding:5px;color:var(--text-muted)">MongoDB _id</td><td style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${r._id}</td></tr>
    </table>`;
  document.getElementById('historyModal').classList.add('open');
}

function loadFromHistory() {
  const r = DB.collection('calculations').findOne({ _id: selectedHistoryId });
  if (!r) return;
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
  document.querySelectorAll('.type-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.type === r.buildingType);
  });
  closeModal('historyModal');
  showPage('calculator');
  updateAreaPreview();
  calculateBOQ();
}

function deleteHistory(id) {
  if (!confirm('Delete this estimate?')) return;
  DB.collection('calculations').deleteOne({ _id: id });
  renderHistoryPage();
  toast('Deleted.', 'success');
}

function clearHistory() {
  if (!confirm('Delete ALL calculation history? This cannot be undone.')) return;
  DB.collection('calculations').deleteMany();
  renderHistoryPage();
  toast('History cleared.', 'success');
}

// ═══════════════════════════════════════════════════════
// RATES PAGE
// ═══════════════════════════════════════════════════════
const RATE_SECTIONS = [
  {
    title: 'Structural Materials', icon: '🏗️', sub: 'Concrete & Steel',
    fields: [
      { key: 'cement_per_bag', label: 'Cement (OPC 43/53)', unit: '/bag' },
      { key: 'sand_per_cft', label: 'Fine Sand', unit: '/cft' },
      { key: 'stone_crush_per_cft', label: 'Stone Crush (Bajri)', unit: '/cft' },
      { key: 'steel_per_kg', label: 'Steel Rebar (T-Iron)', unit: '/kg' },
      { key: 'binding_wire_per_kg', label: 'Binding Wire', unit: '/kg' },
    ]
  },
  {
    title: 'Masonry & Finishing', icon: '🧱', sub: 'Bricks, Tiles & Paint',
    fields: [
      { key: 'brick_per_unit', label: 'Brick (Class-A)', unit: '/unit' },
      { key: 'tile_per_sqft', label: 'Floor Tiles (Standard)', unit: '/sqft' },
      { key: 'paint_per_liter', label: 'Emulsion Paint', unit: '/ltr' },
      { key: 'plaster_per_sqft', label: 'Cement Plaster', unit: '/sqft' },
      { key: 'formwork_per_sqft', label: 'Shuttering/Formwork', unit: '/sqft' },
    ]
  },
  {
    title: 'Labour Rates', icon: '👷', sub: 'Daily wages (per day)',
    fields: [
      { key: 'mason_per_day', label: 'Mason (Mistri)', unit: '/day' },
      { key: 'helper_per_day', label: 'Helper (Beldar)', unit: '/day' },
      { key: 'steel_fixer_per_day', label: 'Steel Fixer', unit: '/day' },
      { key: 'carpenter_per_day', label: 'Carpenter', unit: '/day' },
      { key: 'painter_per_day', label: 'Painter', unit: '/day' },
    ]
  },
  {
    title: 'Earthwork', icon: '⛏️', sub: 'Excavation & site prep',
    fields: [
      { key: 'excavation_per_cubic_meter', label: 'Excavation (manual)', unit: '/m³' },
    ]
  },
  {
    title: 'Services', icon: '⚡', sub: 'Electrical, Plumbing & WP',
    fields: [
      { key: 'electrical_per_sqft', label: 'Electrical Works', unit: '/sqft' },
      { key: 'plumbing_per_sqft', label: 'Plumbing Works', unit: '/sqft' },
      { key: 'waterproofing_per_sqft', label: 'Waterproofing', unit: '/sqft' },
    ]
  },
  {
    title: 'Fixtures', icon: '🚪', sub: 'Doors & Windows',
    fields: [
      { key: 'doors_per_unit', label: 'Door (Standard)', unit: '/unit' },
      { key: 'windows_per_unit', label: 'Window (Aluminium)', unit: '/unit' },
    ]
  }
];

function renderRatesPage() {
  const rates = getRates();
  document.getElementById('rates-last-updated').textContent = rates.last_updated ? new Date(rates.last_updated).toLocaleString() : 'Never';
  document.getElementById('rates-grid').innerHTML = RATE_SECTIONS.map(sec => `
    <div class="rate-card">
      <div class="rate-card-header">
        <div class="rate-card-icon">${sec.icon}</div>
        <div>
          <div class="rate-card-title">${sec.title}</div>
          <div class="rate-card-sub">${sec.sub}</div>
        </div>
      </div>
      ${sec.fields.map(f => `
        <div class="rate-row">
          <div class="rate-name">${f.label}</div>
          <div class="rate-input-wrap">
            <input type="number" class="rate-field" data-key="${f.key}" value="${rates[f.key] || ''}" min="0" step="1">
            <span class="rate-unit">PKR${f.unit}</span>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

function saveRates() {
  const inputs = document.querySelectorAll('.rate-field');
  const updates = {};
  inputs.forEach(inp => { updates[inp.dataset.key] = parseFloat(inp.value) || 0; });
  updates.last_updated = new Date().toISOString();
  updates.updated_by = 'admin';
  const exists = DB.collection('rates').findOne({ updated_by: 'admin' });
  if (exists) {
    DB.collection('rates').updateOne({ updated_by: 'admin' }, { $set: updates });
  } else {
    DB.collection('rates').insertOne(updates);
  }
  document.getElementById('rates-last-updated').textContent = new Date().toLocaleString();
  toast('Rates saved successfully!', 'success');
}

function resetRates() {
  if (!confirm('Reset all rates to default values?')) return;
  DB.collection('rates').updateOne({ updated_by: 'admin' }, { $set: { ...DEFAULT_RATES, last_updated: new Date().toISOString() } });
  renderRatesPage();
  toast('Rates reset to defaults.', 'success');
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════
function renderDashboard() {
  const records = DB.collection('calculations').find();
  const total = records.length;

  if (total === 0) {
    document.getElementById('dashboard-stats').innerHTML = `<div class="stat-card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">No data yet</div><div class="empty-desc">Save some BOQ estimates to see analytics.</div></div></div>`;
    document.getElementById('dashboard-tbody').innerHTML = '';
    return;
  }

  const totalCost = records.reduce((a, r) => a + r.grandTotal, 0);
  const avgCost = totalCost / total;
  const avgCostPerSqft = records.reduce((a, r) => a + (r.grandTotal / r.totalFloorArea), 0) / total;

  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card primary-card">
      <div class="stat-label">Total Projects</div>
      <div class="stat-value">${total}</div>
      <div class="stat-sub">Saved estimates</div>
    </div>
    <div class="stat-card info-card">
      <div class="stat-label">Total Portfolio Value</div>
      <div class="stat-value" style="font-size:17px">PKR ${fmtPKR(totalCost)}</div>
      <div class="stat-sub">Sum of all estimates</div>
    </div>
    <div class="stat-card accent-card">
      <div class="stat-label">Average Project Cost</div>
      <div class="stat-value" style="font-size:17px">PKR ${fmtPKR(Math.round(avgCost))}</div>
      <div class="stat-sub">Per project</div>
    </div>
    <div class="stat-card success-card">
      <div class="stat-label">Avg Cost / Sqft</div>
      <div class="stat-value" style="font-size:17px">PKR ${fmtPKR(Math.round(avgCostPerSqft))}</div>
      <div class="stat-sub">Across all projects</div>
    </div>`;

  // Trend chart
  const last10 = records.slice(-10);
  if (trendChartInst) trendChartInst.destroy();
  const tCtx = document.getElementById('trendChart').getContext('2d');
  trendChartInst = new Chart(tCtx, {
    type: 'line',
    data: {
      labels: last10.map((r, i) => r.projectName.length > 12 ? r.projectName.substring(0,12)+'...' : r.projectName),
      datasets: [{
        label: 'Total Cost (PKR)',
        data: last10.map(r => Math.round(r.grandTotal)),
        borderColor: '#1a472a', backgroundColor: 'rgba(26,71,42,0.08)',
        fill: true, tension: 0.35, pointRadius: 5, pointBackgroundColor: '#1a472a', borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' PKR ' + fmtPKR(ctx.raw) } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 30 } },
        y: { grid: { color: '#f0f0f0' }, ticks: { callback: v => 'PKR ' + (v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v), font: { size: 10 } } }
      }
    }
  });

  // Type donut
  const typeCounts = {};
  records.forEach(r => { typeCounts[r.buildingType] = (typeCounts[r.buildingType] || 0) + 1; });
  const typeLabels = Object.keys(typeCounts);
  const typeData = typeLabels.map(t => typeCounts[t]);
  const typeColors = ['#1a472a','#f4a261','#1971c2','#2b9348'];
  if (typeChartInst) typeChartInst.destroy();
  const tyCtx = document.getElementById('typeChart').getContext('2d');
  typeChartInst = new Chart(tyCtx, {
    type: 'doughnut',
    data: {
      labels: typeLabels,
      datasets: [{ data: typeData, backgroundColor: typeColors, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} project(s)` } } }
    }
  });
  document.getElementById('type-legend').innerHTML = typeLabels.map((t, i) =>
    `<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:${typeColors[i]}"></span>${t} (${typeCounts[t]})</span>`
  ).join('');

  // Dashboard table
  const sorted = [...records].sort((a, b) => b.grandTotal - a.grandTotal);
  document.getElementById('dashboard-tbody').innerHTML = sorted.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:600">${r.projectName}</td>
      <td>${r.buildingType}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${r.dimensions.L}×${r.dimensions.W}×${r.dimensions.H} (${r.dimensions.floors}F)</td>
      <td style="font-family:var(--font-mono)">${fmt(r.totalFloorArea)}</td>
      <td style="font-weight:700;color:var(--primary)">PKR ${fmtPKR(r.grandTotal)}</td>
      <td style="font-family:var(--font-mono)">PKR ${fmtPKR(Math.round(r.grandTotal / r.totalFloorArea))}</td>
      <td style="font-size:12px;color:var(--text-muted)">${new Date(r.createdAt).toLocaleDateString()}</td>
    </tr>`).join('');
}

// ═══════════════════════════════════════════════════════
// EXPORT & SHARE
// ═══════════════════════════════════════════════════════
function exportCSV() {
  if (!lastResult) { toast('No data to export.', 'error'); return; }
  const rows = [['No','Description','Type','Qty','Unit','Rate PKR','Amount PKR']];
  lastResult.boq.forEach(r => {
    if (r.cat) rows.push(['','=== '+r.desc+' ===','','','','','']);
    else if (r.subcat) rows.push(['','','','','',r.desc, Math.round(r.amount)]);
    else rows.push([r.no, r.desc, r.type, r.qty, r.unit, r.rate.replace(/,/g,''), Math.round(r.amount)]);
  });
  rows.push(['','','','','','GRAND TOTAL', Math.round(lastResult.grandTotal)]);
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `BOQ_${lastResult.projectName.replace(/\s+/g,'_')}_${Date.now()}.csv`;
  a.click();
  toast('CSV exported!', 'success');
}

function shareResult() {
  if (!lastResult) return;
  const text = `🏗️ BOQ Estimate — ${lastResult.projectName}\n📐 ${lastResult.L}ft × ${lastResult.W}ft × ${lastResult.H}ft (${lastResult.floors} floor)\n📏 Total Area: ${fmt(lastResult.totalFloorArea)} sqft\n💰 Grand Total: PKR ${fmtPKR(lastResult.grandTotal)}\n💵 Cost/sqft: PKR ${fmtPKR(Math.round(lastResult.grandTotal/lastResult.totalFloorArea))}\n\nGenerated by Building Material Calculator (Pakistan)`;
  if (navigator.share) { navigator.share({ title: 'BOQ Estimate', text }); }
  else { navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard!', 'success')); }
}

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════
function fmt(n) { return Math.round(n).toLocaleString(); }
function fmtPKR(n) { return Math.round(n).toLocaleString(); }
function showLoading(show) { document.getElementById('loadingOverlay').classList.toggle('show', show); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.innerHTML = (type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : 'ℹ️ ') + msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Close modals on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
});

// Keyboard shortcut
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) calculateBOQ();
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
});

// ── INIT ──
document.getElementById('projectName').value = '';
renderRatesPage(); // preload rates