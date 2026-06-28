// app.js — Logika interaksi: identitas -> 26 perbandingan -> tinjau CR -> kirim.

const state = {
  nama: "", instansi: "", tipologi: "",
  comparisons: buildComparisons(),   // 26 item
  values: {},                         // index -> nilai slider (-9..9), default 0
  current: 0,
};
state.comparisons.forEach((_, idx) => { state.values[idx] = 0; });

const $ = (id) => document.getElementById(id);

// ---------- Layar 1: identitas ----------
function renderTipologi() {
  const wrap = $("tipologi-options");
  wrap.innerHTML = "";
  TIPOLOGI.forEach((t) => {
    const btn = document.createElement("button");
    btn.textContent = t.label;
    btn.className = "tipologi-btn text-sm rounded-xl border border-canopy-800/20 px-3 py-2.5 text-left hover:border-canopy-600 transition-colors";
    btn.onclick = () => {
      state.tipologi = t.value;
      document.querySelectorAll(".tipologi-btn").forEach((b) => {
        b.classList.remove("bg-canopy-700", "text-white", "border-canopy-700");
      });
      btn.classList.add("bg-canopy-700", "text-white", "border-canopy-700");
      updateStartBtn();
    };
    wrap.appendChild(btn);
  });
}

function updateStartBtn() {
  state.nama = $("in-nama").value.trim();
  state.instansi = $("in-instansi").value.trim();
  $("btn-start").disabled = !(state.nama && state.tipologi);
}

// ---------- Layar 2: perbandingan ----------
function sliderToVerbal(v) {
  if (v === 0) return "Sama penting";
  const mag = Math.abs(v);
  const side = v < 0 ? "kiri" : "kanan";
  const cap = side.charAt(0).toUpperCase() + side.slice(1);
  return `${cap} ${SAATY_VERBAL[mag]}`;
}

function renderComparison() {
  const c = state.comparisons[state.current];
  $("block-title").textContent = c.blockTitle;
  $("progress-count").textContent = `${state.current + 1} / ${state.comparisons.length}`;
  $("progress-bar").style.width = `${((state.current + 1) / state.comparisons.length) * 100}%`;
  $("label-left").textContent = c.left;
  $("label-right").textContent = c.right;

  const slider = $("slider");
  slider.value = state.values[state.current];
  updateSliderVisual();

  $("btn-prev").disabled = state.current === 0;
  $("btn-next").textContent = state.current === state.comparisons.length - 1 ? "Selesai" : "Lanjut";
}

function updateSliderVisual() {
  const v = parseInt($("slider").value, 10);
  state.values[state.current] = v;
  $("slider-verbal").textContent = sliderToVerbal(v);

  const left = $("card-left"), right = $("card-right");
  left.className = "flex-1 text-center rounded-xl border-2 p-4 transition-all";
  right.className = "flex-1 text-center rounded-xl border-2 p-4 transition-all";
  if (v < 0) {
    left.classList.add("border-clay-500", "bg-clay-400/10");
    right.classList.add("border-canopy-800/12");
  } else if (v > 0) {
    right.classList.add("border-canopy-600", "bg-canopy-50");
    left.classList.add("border-canopy-800/12");
  } else {
    left.classList.add("border-canopy-800/12");
    right.classList.add("border-canopy-800/12");
  }
}

// ---------- Konversi nilai slider -> payload pairwise bertanda ----------
// slider -9..-1 = kiri (elemen-i) lebih penting -> nilai POSITIF (skala |v|)
// slider +1..+9 = kanan (elemen-j) lebih penting -> nilai NEGATIF
// slider 0 = sama penting -> 1
function buildPairwisePayload() {
  return state.comparisons.map((c, idx) => {
    const v = state.values[idx];
    let signed;
    if (v === 0) signed = 1;
    else if (v < 0) signed = Math.abs(v);   // elemen-i (kiri) lebih penting
    else signed = -v;                         // elemen-j (kanan) lebih penting
    return { block: c.block, i: c.i, j: c.j, value: signed };
  });
}

// ---------- Layar 3: tinjau CR (panggil /validate/) ----------
async function renderReview() {
  show("screen-review");
  const wrap = $("review-blocks");
  wrap.innerHTML = `<p class="text-sm text-canopy-700/60 font-mono">Menghitung konsistensi…</p>`;
  try {
    const res = await fetch(`${API_BASE}/validate/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairwise: buildPairwisePayload() }),
    });
    const data = await res.json();
    wrap.innerHTML = "";
    const blockLabel = { konstruk: "Antar Kriteria Utama", k1: "Kesesuaian Lahan",
      k2: "Daya Dukung Lingkungan", k3: "Risiko Iklim & Bencana",
      k4: "Nilai Konservasi", k5: "Faktor Sosial-Ekonomi" };
    let allOk = true;
    for (const [block, r] of Object.entries(data.per_block)) {
      if (!r.consistent) allOk = false;
      const ok = r.consistent;
      const row = document.createElement("div");
      row.className = `flex items-center justify-between rounded-xl border px-4 py-3 ${ok ? "border-canopy-600/30 bg-canopy-50/50" : "border-clay-500/40 bg-clay-400/10"}`;
      row.innerHTML = `
        <span class="text-sm font-medium text-canopy-800">${blockLabel[block] || block}</span>
        <span class="font-mono text-xs ${ok ? "text-canopy-700" : "text-clay-600"}">
          CR ${r.CR.toFixed(3)} ${ok ? "· baik" : "· tinggi"}
        </span>`;
      wrap.appendChild(row);
    }
    const note = document.createElement("p");
    note.className = "text-xs text-canopy-700/60 pt-1";
    note.textContent = allOk
      ? "Semua kelompok konsisten. Penilaian siap dikirim."
      : "Beberapa kelompok kurang konsisten — Anda tetap bisa mengirim, tetapi menyesuaikan akan memperkuat hasil.";
    wrap.appendChild(note);
  } catch (e) {
    wrap.innerHTML = `<p class="text-sm text-clay-600">Tidak dapat menghubungi server validasi. Periksa koneksi lalu coba lagi.</p>`;
  }
}

// ---------- Kirim ----------
async function submitAll() {
  const btn = $("btn-submit");
  btn.disabled = true; btn.textContent = "Mengirim…";
  const expertId = `${state.tipologi}-${Date.now()}`;
  try {
    const res = await fetch(`${API_BASE}/submit/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expert_id: expertId, nama: state.nama, instansi: state.instansi,
        tipologi: state.tipologi, pairwise: buildPairwisePayload(),
      }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Gagal mengirim");
    const data = await res.json();
    $("done-msg").textContent = data.is_valid
      ? "Penilaian Anda tersimpan dan dinilai konsisten. Terima kasih atas kontribusinya."
      : "Penilaian Anda tersimpan. Sebagian kelompok kurang konsisten, namun tetap tercatat.";
    show("screen-done");
  } catch (e) {
    btn.disabled = false; btn.textContent = "Kirim penilaian";
    alert("Gagal mengirim: " + e.message);
  }
}

// ---------- Navigasi layar ----------
function show(screenId) {
  ["screen-intro", "screen-compare", "screen-review", "screen-done"].forEach((s) => {
    $(s).classList.toggle("hidden", s !== screenId);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Wiring ----------
function init() {
  renderTipologi();
  $("in-nama").addEventListener("input", updateStartBtn);
  $("in-instansi").addEventListener("input", updateStartBtn);

  $("btn-start").onclick = () => { show("screen-compare"); renderComparison(); };
  $("slider").addEventListener("input", updateSliderVisual);

  $("btn-prev").onclick = () => {
    if (state.current > 0) { state.current--; renderComparison(); }
  };
  $("btn-next").onclick = () => {
    if (state.current < state.comparisons.length - 1) {
      state.current++; renderComparison();
    } else {
      renderReview();
    }
  };
  $("btn-back-edit").onclick = () => { show("screen-compare"); renderComparison(); };
  $("btn-submit").onclick = submitAll;
}

document.addEventListener("DOMContentLoaded", init);
