import { useState, useEffect, useCallback } from "react";
import { requestNotificationPermission, onForegroundMessage, saveReservaRemota, deleteReservaRemota } from "./firebase.js";

// ─── DEFAULTS ────────────────────────────────────────────────────────────────
const DEFAULT_FLATS = [
  { id: "alphaville", name: "Alphaville", icon: "🏡" },
  { id: "butanta",    name: "Butantã",    icon: "🏢" },
];

const defState = () => ({
  flats:    DEFAULT_FLATS,
  flatData: {
    alphaville: { diarista: "Diarista A", rate: 150, diarias: [] },
    butanta:    { diarista: "Diarista B", rate: 150, diarias: [] },
  },
  reservas: [],
  auth: { flatId: "alphaville", paxList: [""], checkin: "", checkout: "" },
  notificationsEnabled: false,
});

// ─── UTILS ───────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const daysUntil = iso => Math.round((new Date(iso) - new Date(todayStr())) / 86400000);
const fmt  = iso => { if (!iso) return ""; const [,m,d] = iso.split("-"); return `${d}/${m}`; };
const buildAuthMsg = (flatName, paxList, checkin, checkout) => {
  const lines = paxList.filter(p => p.trim()).map((p,i) => `PAX ${i+1}: ${p.trim()}`).join("\n");
  if (!lines) return "";
  return `Segue a autorização de hospedagem conforme os detalhes da reserva abaixo:\n${lines}\nCheck-in: ${fmt(checkin)||"__/__"}\nCheck-out: ${fmt(checkout)||"__/__"}`;
};
const buildPayMsg = (flat, diarias) => {
  const pending = diarias.filter(d => !d.paid);
  const total   = pending.reduce((a,d) => a + d.value, 0);
  const lines   = pending.map(d => `• ${fmt(d.date)} — R$ ${d.value.toFixed(2)}`).join("\n");
  return `Oi Pai! Segue o pagamento da diarista do flat ${flat.name}:\n\n${lines}\n\nTotal: R$ ${total.toFixed(2)}\n\nPode transferir para ela quando puder. Obrigado!`;
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────

function Badge({ color, children }) {
  const colorMap = {
    green: "badge-success",
    yellow: "badge-warning",
    red: "badge-danger",
    blue: "badge-info",
    gray: "badge-slate",
    ok: "badge-success"
  };
  return <span className={`badge ${colorMap[color] || colorMap.gray}`}>{children}</span>;
}

function Btn({ onClick, disabled, variant = "ghost", children, full, small }) {
  const variantMap = {
    ghost: "btn-ghost",
    primary: "btn-primary",
    green: "btn-success",
    blue: "btn-info",
    red: "btn-danger",
    purple: "btn-primary",
    teal: "btn-success",
    secondary: "btn-secondary",
  };
  const btnClass = variantMap[variant] || variantMap.ghost;
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={`${btnClass} ${full ? "w-full" : "flex-1"} ${small ? "px-2.5 py-1 text-xs" : ""}`}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div 
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4 text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function FlatSelector({ flats, value, onChange }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {flats.map(f => (
        <button 
          key={f.id} 
          onClick={() => onChange(f.id)} 
          className={`flex-1 min-w-[100px] px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
            value === f.id
              ? "bg-violet-100 text-violet-700 border border-violet-300"
              : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
          }`}
        >
          {f.icon} {f.name}
        </button>
      ))}
    </div>
  );
}

function PaxList({ paxList, onChange }) {
  const update = (i, v) => { const l = [...paxList]; l[i] = v; onChange(l); };
  const remove = (i) => { const l = [...paxList]; l.splice(i, 1); onChange(l); };
  const add = () => onChange([...paxList, ""]);
  return (
    <div className="space-y-3">
      {paxList.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium min-w-[40px]">PAX {i + 1}</span>
          <input 
            value={p} 
            onChange={e => update(i, e.target.value)} 
            placeholder="Nome completo" 
            className="input flex-1"
          />
          {paxList.length > 1 && (
            <button 
              onClick={() => remove(i)} 
              className="text-slate-300 hover:text-slate-400 text-lg transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button 
        onClick={add} 
        className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
      >
        + Adicionar hóspede
      </button>
    </div>
  );
}

function Toast({ show }) {
  return (
    <div className={`fixed bottom-7 left-1/2 -translate-x-1/2 bg-emerald-700 text-emerald-100 px-6 py-2.5 rounded-full text-sm font-medium z-100 pointer-events-none transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}>
      Copiado ✓
    </div>
  );
}

// ─── TAB RESERVAS ─────────────────────────────────────────────────────────────
function TabReservas({ state, setState, setTab, copy }) {
  const [modal, setModal] = useState(null);
  const today = todayStr();

  const addReserva = async ({ flatId, guests, checkin, checkout }) => {
    const flat = state.flats.find(f => f.id === flatId);
    const res = { id: Date.now(), flatId, flatName: flat.name, guests, checkin, checkout, authorized: false };
    setState(s => ({ ...s, reservas: [...s.reservas, res].sort((a, b) => a.checkin.localeCompare(b.checkin)) }));
    try { await saveReservaRemota(res); } catch (e) { }
    setModal(null);
  };

  const toggleAuth = async id => {
    setState(s => ({ ...s, reservas: s.reservas.map(r => r.id === id ? { ...r, authorized: !r.authorized } : r) }));
    const r = state.reservas.find(r => r.id === id);
    try { await saveReservaRemota({ ...r, authorized: !r.authorized }); } catch (e) { }
  };

  const deleteRes = async id => {
    setState(s => ({ ...s, reservas: s.reservas.filter(r => r.id !== id) }));
    try { await deleteReservaRemota(id); } catch (e) { }
  };

  const loadToAuth = r => {
    setState(s => ({ ...s, auth: { flatId: r.flatId, paxList: [...r.guests], checkin: r.checkin, checkout: r.checkout } } ));
    setTab("auth");
  };

  const todayCI = state.reservas.filter(r => r.checkin === today && !r.authorized);
  const soonCI = state.reservas.filter(r => { const d = daysUntil(r.checkin); return d > 0 && d <= 2 && !r.authorized; });
  const active = state.reservas.filter(r => r.checkin >= today && !r.authorized);
  const past = state.reservas.filter(r => r.checkin < today || r.authorized);

  const ReservaCard = ({ r }) => {
    const d = daysUntil(r.checkin);
    const isToday = r.checkin === today;
    const alert = isToday && !r.authorized ? "red" : d >= 0 && d <= 2 && !r.authorized ? "yellow" : null;
    let bc = "blue", bt = `em ${d} dia${d !== 1 ? "s" : ""}`;
    if (r.authorized) { bc = "green"; bt = "Autorizado ✓"; }
    else if (isToday) { bc = "red"; bt = "Hoje!"; }
    else if (d < 0) { bc = "gray"; bt = "Passou"; }
    else if (d <= 2) { bc = "yellow"; }
    const flat = state.flats.find(f => f.id === r.flatId) || { name: r.flatName || r.flatId, icon: "🏠" };
    
    return (
      <div className={`card animate-slide-up ${alert === "red" ? "border-red-200 bg-red-50" : alert === "yellow" ? "border-amber-200 bg-amber-50" : ""}`}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-slate-500 font-medium">{flat.icon} {flat.name}</span>
          <Badge color={bc}>{bt}</Badge>
        </div>
        <div className="text-sm mb-3 space-y-1">
          {r.guests.map((g, i) => <div key={i}><span className="text-xs text-slate-400">PAX {i + 1} </span>{g}</div>)}
        </div>
        <div className="text-xs text-slate-400 mb-4">📅 {fmt(r.checkin)} → {fmt(r.checkout)}</div>
        <div className="flex gap-2">
          <Btn variant="blue" small onClick={() => loadToAuth(r)}>📋 Auth</Btn>
          <Btn variant={r.authorized ? "ghost" : "success"} small onClick={() => toggleAuth(r.id)}>
            {r.authorized ? "↩ Desmarcar" : "✓ Autorizado"}
          </Btn>
          <button 
            onClick={() => deleteRes(r.id)} 
            className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white text-slate-300 hover:text-slate-400 transition-colors"
          >
            🗑
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {todayCI.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 leading-relaxed animate-slide-up">
          🚨 <strong>Check-in hoje</strong> em {todayCI.map(r => state.flats.find(f => f.id === r.flatId)?.name || r.flatName).join(" e ")} — autorização pendente!
        </div>
      )}
      {!todayCI.length && soonCI.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 leading-relaxed animate-slide-up">
          ⏰ <strong>{soonCI.length} check-in{soonCI.length > 1 ? "s" : ""} nos próximos 2 dias</strong> — lembre de enviar a autorização.
        </div>
      )}

      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Próximas reservas</span>
        <Btn variant="primary" small onClick={() => setModal({ paxList: [""], flatId: state.flats[0]?.id, checkin: "", checkout: "" })}>+ Nova</Btn>
      </div>

      {active.length === 0 && <div className="text-sm text-slate-400 text-center py-8">Nenhuma reserva pendente.</div>}
      {active.map(r => <ReservaCard key={r.id} r={r} />)}

      {past.length > 0 && <>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6">Histórico</div>
        {past.map(r => <ReservaCard key={r.id} r={r} />)}
      </>}

      {modal && (
        <Modal title="📅 Nova reserva" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Flat</label>
              <FlatSelector flats={state.flats} value={modal.flatId} onChange={v => setModal(m => ({ ...m, flatId: v }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Hóspedes</label>
              <PaxList paxList={modal.paxList} onChange={v => setModal(m => ({ ...m, paxList: v }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Datas</label>
              <div className="grid grid-cols-2 gap-3">
                {[["Check-in", "checkin"], ["Check-out", "checkout"]].map(([label, field]) => (
                  <div key={field}>
                    <div className="text-xs text-slate-500 mb-1">{label}</div>
                    <input type="date" value={modal[field]} onChange={e => setModal(m => ({ ...m, [field]: e.target.value }))} className="input" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn variant="primary" onClick={() => {
                const guests = modal.paxList.filter(p => p.trim());
                if (!guests.length || !modal.checkin || !modal.checkout) return;
                addReserva({ ...modal, guests });
              }}>Salvar reserva</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TAB FLATS ────────────────────────────────────────────────────────────────
function TabFlats({ state, setState, copy }) {
  const [modal, setModal] = useState(null);

  const mutateFlat = (id, fn) =>
    setState(s => ({ ...s, flatData: { ...s.flatData, [id]: fn(s.flatData[id] || { diarista: "Diarista", rate: 150, diarias: [] }) } }));

  const addDiaria = (id, date, value) => mutateFlat(id, f => ({ ...f, diarias: [{ id: Date.now(), date, value: parseFloat(value), paid: false }, ...f.diarias] }));
  const deleteDiaria = (id, did) => mutateFlat(id, f => ({ ...f, diarias: f.diarias.filter(d => d.id !== did) }));
  const markPaid = id => mutateFlat(id, f => ({ ...f, diarias: f.diarias.map(d => ({ ...d, paid: true })) }));
  const editFlat = (id, name, rate) => mutateFlat(id, f => ({ ...f, diarista: name || f.diarista, rate: rate > 0 ? rate : f.rate }));
  const addNewFlat = (name, icon) => {
    const id = name.toLowerCase().replace(/\s+/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    setState(s => ({
      ...s,
      flats: [...s.flats, { id, name, icon: icon || "🏠" }],
      flatData: { ...s.flatData, [id]: { diarista: "Diarista", rate: 150, diarias: [] } },
    }));
  };
  const removeFlat = id => setState(s => ({
    ...s,
    flats: s.flats.filter(f => f.id !== id),
    flatData: Object.fromEntries(Object.entries(s.flatData).filter(([k]) => k !== id)),
    reservas: s.reservas.filter(r => r.flatId !== id),
    auth: s.auth.flatId === id ? { ...s.auth, flatId: s.flats.filter(f => f.id !== id)[0]?.id || "" } : s.auth,
  }));

  return (
    <div className="space-y-4">
      {state.flats.map(flat => {
        const fd = state.flatData[flat.id] || { diarista: "Diarista", rate: 150, diarias: [] };
        const pend = fd.diarias.filter(d => !d.paid);
        const total = pend.reduce((a, d) => a + d.value, 0);
        const nc = pend.length === 0 ? "green" : pend.length >= 3 ? "red" : "yellow";
        const nt = pend.length === 0 ? "Em dia" : pend.length >= 3 ? `${pend.length} pendentes ⚡` : `${pend.length} pendente${pend.length > 1 ? "s" : ""}`;
        return (
          <div key={flat.id} className="card">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center text-xl">{flat.icon}</div>
                <div>
                  <div className="font-semibold text-slate-900">{flat.name}</div>
                  <div className="text-xs text-slate-500">Flat</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={nc}>{nt}</Badge>
                <button 
                  onClick={() => setModal({ type: "remove", flatId: flat.id, name: flat.name })} 
                  className="text-slate-300 hover:text-slate-400 text-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[["Pendentes", pend.length], ["A pagar", `R$ ${total.toFixed(2)}`]].map(([label, val]) => (
                <div key={label} className="bg-slate-100 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className="text-xl font-semibold text-slate-900">{val}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between py-3 border-t border-slate-200 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-semibold text-violet-700">
                  {fd.diarista.split(" ").map(w => w[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">{fd.diarista}</div>
                  <div className="text-xs text-slate-500">R$ {fd.rate.toFixed(2)} / diária</div>
                </div>
              </div>
              <button 
                onClick={() => setModal({ type: "edit", flatId: flat.id, name: fd.diarista, rate: String(fd.rate) })} 
                className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
              >
                editar
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <Btn variant="primary" small onClick={() => setModal({ type: "add", flatId: flat.id, date: todayStr(), value: String(fd.rate) })}>+ Diária</Btn>
              <Btn variant="success" small disabled={pend.length === 0} onClick={() => setModal({ type: "send", flatId: flat.id, flat, diarias: fd.diarias })}>📤 Msg</Btn>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Histórico</div>
              {fd.diarias.length === 0
                ? <div className="text-xs text-slate-400 text-center py-3">Nenhuma diária registrada</div>
                : <div className="space-y-2">
                  {fd.diarias.map(d => (
                    <div key={d.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                      <span className="text-xs text-slate-400 min-w-[35px]">{fmt(d.date)}</span>
                      <span className="text-sm font-medium text-slate-900 flex-1">R$ {d.value.toFixed(2)}</span>
                      <Badge color={d.paid ? "green" : "yellow"}>{d.paid ? "Pago" : "Pendente"}</Badge>
                      <button 
                        onClick={() => deleteDiaria(flat.id, d.id)} 
                        className="text-slate-300 hover:text-slate-400 text-sm transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        );
      })}

      <Btn variant="primary" full onClick={() => setModal({ type: "newflat", name: "", icon: "🏠" })}>+ Novo flat</Btn>

      {modal?.type === "add" && (
        <Modal title={`+ Nova diária — ${state.flats.find(f => f.id === modal.flatId)?.name}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-2 font-medium">Data da limpeza</label>
              <input type="date" value={modal.date} onChange={e => setModal(m => ({ ...m, date: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-2 font-medium">Valor (R$)</label>
              <input type="number" value={modal.value} onChange={e => setModal(m => ({ ...m, value: e.target.value }))} min="0" step="10" className="input" />
            </div>
            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn variant="primary" onClick={() => { addDiaria(modal.flatId, modal.date, modal.value); setModal(null); }}>Adicionar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal?.type === "send" && (
        <Modal title="📤 Mensagem pro Pai" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <pre className="bg-slate-100 rounded-lg p-3 text-xs whitespace-pre-wrap leading-relaxed border border-slate-200 font-mono">
              {buildPayMsg(modal.flat, modal.diarias)}
            </pre>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => setModal(null)}>Fechar</Btn>
              <Btn variant="success" onClick={() => { copy(buildPayMsg(modal.flat, modal.diarias)); markPaid(modal.flatId); setModal(null); }}>📋 Copiar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal?.type === "edit" && (
        <Modal title={`✏️ Editar — ${state.flats.find(f => f.id === modal.flatId)?.name}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-2 font-medium">Nome da diarista</label>
              <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-2 font-medium">Valor padrão (R$)</label>
              <input type="number" value={modal.rate} onChange={e => setModal(m => ({ ...m, rate: e.target.value }))} min="0" step="10" className="input" />
            </div>
            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn variant="primary" onClick={() => { editFlat(modal.flatId, modal.name, parseFloat(modal.rate)); setModal(null); }}>Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal?.type === "newflat" && (
        <Modal title="🏠 Novo flat" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-2 font-medium">Nome do flat</label>
              <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} placeholder="Ex: Moema" className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-2 font-medium">Emoji (opcional)</label>
              <input value={modal.icon} onChange={e => setModal(m => ({ ...m, icon: e.target.value }))} placeholder="🏠" className="input w-20" />
            </div>
            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn variant="primary" onClick={() => { if (!modal.name.trim()) return; addNewFlat(modal.name.trim(), modal.icon); setModal(null); }}>Adicionar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal?.type === "remove" && (
        <Modal title="Remover flat" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Tem certeza que quer remover <strong>{modal.name}</strong>? Todas as diárias e reservas deste flat serão excluídas.</p>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn variant="red" onClick={() => { removeFlat(modal.flatId); setModal(null); }}>Remover</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TAB AUTH ─────────────────────────────────────────────────────────────────
function TabAuth({ state, setState, copy }) {
  const a = state.auth;
  const flat = state.flats.find(f => f.id === a.flatId);
  const preview = buildAuthMsg(flat?.name || "", a.paxList, a.checkin, a.checkout);
  const set = obj => setState(s => ({ ...s, auth: { ...s.auth, ...obj } }));

  return (
    <div className="card">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Flat</label>
          <FlatSelector flats={state.flats} value={a.flatId} onChange={v => set({ flatId: v })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Hóspedes</label>
          <PaxList paxList={a.paxList} onChange={v => set({ paxList: v })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Datas</label>
          <div className="grid grid-cols-2 gap-3">
            {[["Check-in", "checkin"], ["Check-out", "checkout"]].map(([label, field]) => (
              <div key={field}>
                <div className="text-xs text-slate-500 mb-1">{label}</div>
                <input type="date" value={a[field]} onChange={e => set({ [field]: e.target.value })} className="input" />
              </div>
            ))}
          </div>
        </div>
        {preview
          ? <>
            <pre className="bg-slate-100 rounded-lg p-3 text-xs whitespace-pre-wrap leading-relaxed border border-slate-200 font-mono">
              {preview}
            </pre>
            <Btn variant="blue" full onClick={() => copy(preview)}>📋 Copiar autorização</Btn>
          </>
          : <div className="text-sm text-slate-400 text-center py-6">Preencha os hóspedes e as datas para gerar a autorização.</div>
        }
      </div>
    </div>
  );
}

// ─── TAB CONFIG ───────────────────────────────────────────────────────────────
function TabConfig({ state, setState }) {
  const [status, setStatus] = useState("");

  const enableNotifications = async () => {
    setStatus("Solicitando permissão...");
    const token = await requestNotificationPermission();
    if (token) {
      setState(s => ({ ...s, notificationsEnabled: true }));
      setStatus("✅ Notificações ativadas!");
    } else {
      setStatus("❌ Permissão negada. Verifique as configurações do iPhone.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notificações push</div>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          Ative para receber um alerta às <strong>10h30</strong> no dia do check-in de cada reserva. Funciona mesmo com o app fechado.
        </p>
        {state.notificationsEnabled
          ? <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 border border-emerald-200">✅ Notificações ativadas neste dispositivo</div>
          : <Btn variant="blue" full onClick={enableNotifications}>🔔 Ativar notificações</Btn>
        }
        {status && <div className="text-xs text-slate-500 mt-3 text-center">{status}</div>}
      </div>

      <div className="card">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Dados</div>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          Os dados ficam salvos no seu dispositivo. Exportar cria um backup em JSON.
        </p>
        <div className="flex gap-2">
          <Btn variant="primary" onClick={() => {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = "backup-flats.json"; a.click();
          }}>📦 Exportar</Btn>
          <Btn variant="secondary" onClick={() => {
            const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
            input.onchange = e => {
              const file = e.target.files[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => { try { setState(JSON.parse(ev.target.result)); } catch (err) { alert("Arquivo inválido"); } };
              reader.readAsText(file);
            };
            input.click();
          }}>📥 Importar</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "reservas", label: "📅 Reservas" },
  { id: "flats", label: "🏠 Flats" },
  { id: "auth", label: "📋 Auth" },
  { id: "config", label: "⚙️ Config" },
];

export default function App() {
  const [state, setStateRaw] = useState(null);
  const [tab, setTab] = useState("reservas");
  const [toast, setToast] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem("airbnb_v4"); setStateRaw(raw ? Object.assign(defState(), JSON.parse(raw)) : defState()); }
    catch (e) { setStateRaw(defState()); }
  }, []);

  const setState = useCallback(updater => {
    setStateRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("airbnb_v4", JSON.stringify(next)); } catch (e) { }
      return next;
    });
  }, []);

  useEffect(() => {
    onForegroundMessage(payload => {
      setToast(true); setTimeout(() => setToast(false), 3000);
    });
  }, []);

  const copy = text => { navigator.clipboard.writeText(text).catch(() => { }); setToast(true); setTimeout(() => setToast(false), 2000); };

  if (!state) return <div className="flex items-center justify-center h-screen text-sm text-slate-400">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 max-w-md mx-auto px-4 pt-4 pb-28">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">🏠 Meus Flats</h1>
        <p className="text-xs text-slate-500">Gerencie reservas e diárias</p>
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 mb-6 shadow-sm border border-slate-200">
        {TABS.map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id)} 
            className={`flex-1 py-2.5 px-2 text-xs font-medium rounded-lg transition-all duration-200 ${
              tab === t.id
                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "reservas" && <TabReservas state={state} setState={setState} setTab={setTab} copy={copy} />}
      {tab === "flats" && <TabFlats state={state} setState={setState} copy={copy} />}
      {tab === "auth" && <TabAuth state={state} setState={setState} copy={copy} />}
      {tab === "config" && <TabConfig state={state} setState={setState} />}

      <Toast show={toast} />
    </div>
  );
}