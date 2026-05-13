import { useState, useEffect, useCallback } from "react";
import { requestNotificationPermission, getNotificationPermission, onForegroundMessage, saveReservaRemota, deleteReservaRemota } from "./firebase.js";

// ─── CALENDAR STRIP ──────────────────────────────────────────────────────────
function CalendarStrip({ reservas, flats }) {
  const today = todayStr();
  const checkinsByDate = {};

  reservas.forEach(r => {
    if (r.checkin && r.checkin >= today) {
      checkinsByDate[r.checkin] = r.flatId;
    }
  });

  const days = [];
  const startDate = new Date(today);

  for (let i = 0; i < 30; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayNum = d.getDate();
    const hasCheckin = checkinsByDate[dateStr];
    const isToday = dateStr === today;

    days.push({ dateStr, dayNum, hasCheckin, isToday });
  }

  return (
    <div className="px-4 pb-3 overflow-x-auto">
      <div className="flex gap-1.5 min-w-min">
        {days.map(day => {
          const theme = day.hasCheckin ? flatTheme(checkinsByDate[day.dateStr]) : null;
          return (
            <div
              key={day.dateStr}
              className={`flex flex-col items-center justify-center rounded-lg px-2 py-2 min-w-fit text-[11px] font-medium transition-all ${
                day.isToday
                  ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30'
                  : 'bg-slate-900/50 text-slate-400'
              }`}
            >
              <span className="leading-tight">{day.dayNum}</span>
              {day.hasCheckin && (
                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${theme.dot}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ICON COMPONENT ──────────────────────────────────────────────────────────
function Icon({ type, className = "w-5 h-5", animated = false }) {
  const icons = {
    home: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>,
    building: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>,
    calendar: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>,
    clipboard: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>,
    settings: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.62l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.48.1.62l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.62l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.48-.1-.62l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>,
    close: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>,
    checkmark: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>,
    send: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.6563168,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99721575 L3.03521743,10.4382088 C3.03521743,10.5953061 3.19218622,10.7524035 3.50612381,10.7524035 L16.6915026,11.5378905 C16.6915026,11.5378905 17.1624089,11.5378905 17.1624089,12.0091827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/></svg>,
    box: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>,
    download: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>,
    upload: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6v10h6L12 21 3 13h6V3m0-2H9c-1.1 0-2 .9-2 2v10H2l9 9 9-9h-6V3c0-1.1-.9-2-2-2z" transform="rotate(180 12 12)"/></svg>,
    bell: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.96 5.36 6.31 7.92 6.31 11v5l-2 2v1h16v-1l-2-2z"/></svg>,
    plus: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>,
    edit: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>,
    undo: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8h-2c0 5.51 4.49 10 10 10s10-4.49 10-10S17.99 8 12.5 8z"/></svg>,
  };
  
  const classes = animated ? `${className} animate-slide-down` : className;
  
  return (
    <span className={`inline-flex items-center justify-center ${classes} text-current`}>
      {icons[type] || icons.home}
    </span>
  );
}

// ─── DEFAULTS ────────────────────────────────────────────────────────────────
const DEFAULT_FLATS = [
  { id: "alphaville", name: "Alphaville", iconType: "home" },
  { id: "butanta",    name: "Butantã",    iconType: "building" },
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

const flatTheme = flatId => flatId === "alphaville"
  ? {
      accent: "from-sky-400 via-cyan-400 to-blue-500",
      chip: "bg-sky-500/15 text-sky-200 border-sky-500/20",
      dot: "bg-sky-400",
      label: "Alphaville",
      tone: "Residência ampla"
    }
  : {
      accent: "from-amber-400 via-orange-400 to-rose-500",
      chip: "bg-amber-500/15 text-amber-200 border-amber-500/20",
      dot: "bg-amber-400",
      label: "Butantã",
      tone: "Apartamento urbano"
    };

function Badge({ color, children }) {
  const colorMap = {
    green: "badge-success",
    yellow: "badge-warning",
    red: "badge-danger",
    blue: "badge-info",
    gray: "badge-slate",
    ok: "badge-success"
  };
  return <span className={`badge ${colorMap[color] || colorMap.gray} animate-scale-in`}>{children}</span>;
}

function Btn({ onClick, disabled, variant = "ghost", children, full, small, icon }) {
  const variantMap = {
    ghost: "btn-ghost",
    primary: "btn-primary",
    green: "btn-success",
    success: "btn-success",
    secondary: "btn-secondary",
    blue: "btn-info",
    red: "btn-danger",
    white: "bg-white text-violet-700 hover:bg-slate-50 border border-slate-200 shadow-sm",
    dark: "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700"
  };
  const btnClass = variantMap[variant] || variantMap.ghost;
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={`btn ${btnClass} ${full ? "w-full" : ""} ${small ? "text-xs px-2 py-1" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {icon && <span className="mr-2 inline-flex items-center">{icon}</span>}
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, icon }) {
  return (
    <div 
      className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {icon && <div className="mb-4 text-2xl">{icon}</div>}
        <h2 className="text-lg font-semibold mb-4 text-slate-900 flex items-center gap-2">
          {title}
        </h2>
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
          className={`flex-1 min-w-[132px] px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200 btn-hover-lift text-left ${
            value === f.id
              ? `${flatTheme(f.id).chip} shadow-md`
              : "bg-slate-900/70 text-slate-300 border border-slate-700 hover:border-slate-500"
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full inline-block mr-2 ${flatTheme(f.id).dot}`} />
          <span className="block">
            <span className="block text-sm font-semibold leading-tight">{f.name}</span>
            <span className="block text-[11px] text-slate-400 font-medium leading-tight mt-0.5">{flatTheme(f.id).tone}</span>
          </span>
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
        <div key={i} className="flex items-center gap-2 animate-slide-left">
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
              className="text-slate-300 hover:text-red-500 hover:scale-110 transition-all duration-200 p-1.5 rounded-lg hover:bg-red-50"
            >
              <Icon type="close" className="w-5 h-5" />
            </button>
          )}
        </div>
      ))}
      <button 
        onClick={add} 
        className="text-xs text-slate-400 hover:text-violet-600 underline transition-colors font-medium"
      >
        + Adicionar hóspede
      </button>
    </div>
  );
}

function Toast({ show }) {
  return (
    <div className={`fixed bottom-7 left-1/2 -translate-x-1/2 bg-gradient-emerald text-white px-6 py-2.5 rounded-full text-sm font-medium z-100 pointer-events-none transition-all duration-300 shadow-lg ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} animate-bounce-soft`}>
      <span className="flex items-center gap-2 justify-center">
        <Icon type="checkmark" className="w-4 h-4" />
        Copiado
      </span>
    </div>
  );
}

// ─── TAB RESERVAS ─────────────────────────────────────────────────────────────
function TabReservas({ state, setState, setTab }) {
  const [modal, setModal] = useState(null);
  const today = todayStr();

  const addReserva = async ({ flatId, guests, checkin, checkout }) => {
    const flat = state.flats.find(f => f.id === flatId);
    if (!flat) return;
    const res = { id: Date.now(), flatId, flatName: flat.name, guests, checkin, checkout, authorized: false };
    setState(s => ({ ...s, reservas: [...s.reservas, res].sort((a, b) => a.checkin.localeCompare(b.checkin)) }));
    try { await saveReservaRemota(res); } catch (e) { }
    setModal(null);
  };

  const toggleAuth = async id => {
    const current = state.reservas.find(r => r.id === id);
    if (!current) return;
    const updated = { ...current, authorized: !current.authorized };
    setState(s => ({ ...s, reservas: s.reservas.map(r => r.id === id ? updated : r) }));
    try { await saveReservaRemota(updated); } catch (e) { }
  };

  const deleteRes = async id => {
    setState(s => ({ ...s, reservas: s.reservas.filter(r => r.id !== id) }));
    try { await deleteReservaRemota(id); } catch (e) { }
  };

  const loadToAuth = r => {
    setState(s => ({ ...s, auth: { flatId: r.flatId, paxList: [...r.guests], checkin: r.checkin, checkout: r.checkout } }));
    setTab("auth");
  };

  const todayCI = state.reservas.filter(r => r.checkin === today && !r.authorized);
  const soonCI = state.reservas.filter(r => {
    const d = daysUntil(r.checkin);
    return d > 0 && d <= 2 && !r.authorized;
  });
  const active = state.reservas.filter(r => r.checkin >= today && !r.authorized);
  const past = state.reservas.filter(r => r.checkin < today || r.authorized);

  const ReservaCard = ({ r }) => {
    const d = daysUntil(r.checkin);
    const isToday = r.checkin === today;
    const flat = state.flats.find(f => f.id === r.flatId) || { name: r.flatName || r.flatId, iconType: "home" };
    const theme = flatTheme(flat.id || r.flatId);
    const badge = r.authorized ? "green" : isToday ? "red" : d <= 2 ? "yellow" : "blue";
    const label = r.authorized ? "Autorizado" : isToday ? "Hoje!" : d < 0 ? "Passou" : `${d} dia${d === 1 ? "" : "s"}`;

    return (
      <div className="card card-hover animate-slide-up overflow-hidden border-l-4 border-slate-700">
        <div className={`h-1.5 rounded-full bg-gradient-to-r ${theme.accent} -mx-4 -mt-4 mb-4`} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.accent} flex items-center justify-center text-white shadow-md`}>
              <Icon type={flat.iconType || "home"} className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-100 text-lg leading-tight">{flat.name}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${theme.chip}`}>{theme.label}</span>
                <span className="text-xs text-slate-400">{theme.tone}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={badge}>{label}</Badge>
            <button onClick={() => deleteRes(r.id)} className="text-slate-500 hover:text-red-400 hover:scale-110 transition-all duration-200 p-1.5 rounded-lg hover:bg-red-500/10">
              <Icon type="close" className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-200 mb-4">
          {r.guests.map((g, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 min-w-[52px] pt-0.5">PAX {i + 1}</span>
              <span className="break-words">{g}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between py-3 border-t border-slate-700/60 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-xs font-semibold text-white">
              {flat.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-100">{flat.name}</div>
              <div className="text-xs text-slate-500">{fmt(r.checkin)} → {fmt(r.checkout)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={badge}>{label}</Badge>
            <Btn variant="blue" small onClick={() => loadToAuth(r)} icon={<Icon type="clipboard" className="w-4 h-4" />}>Auth</Btn>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Btn variant={r.authorized ? "green" : "ghost"} small onClick={() => toggleAuth(r.id)} icon={<Icon type="checkmark" className="w-4 h-4" />}>
            {r.authorized ? "Autorizado" : "Autorizar"}
          </Btn>
          <Btn variant="primary" small onClick={() => loadToAuth(r)} icon={<Icon type="clipboard" className="w-4 h-4" />}>Autorização</Btn>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reservas</div>
        <Btn variant="primary" small onClick={() => setModal({ paxList: [""], flatId: state.flats[0]?.id || "", checkin: "", checkout: "" })}>+ Nova</Btn>
      </div>

      {todayCI.length > 0 && (
        <div className="bg-red-500/10 border-l-4 border-red-400 rounded-lg p-4 text-sm text-red-200 leading-relaxed animate-slide-up shadow-md">
          <strong className="flex items-center gap-2 mb-1">
            <Icon type="calendar" className="w-5 h-5" />
            Check-in hoje
          </strong>
          <div className="ml-7">Autorização pendente em {todayCI.map(r => state.flats.find(f => f.id === r.flatId)?.name || r.flatName).join(" e ")}</div>
        </div>
      )}

      {!todayCI.length && soonCI.length > 0 && (
        <div className="bg-amber-500/10 border-l-4 border-amber-400 rounded-lg p-4 text-sm text-amber-200 leading-relaxed animate-slide-up shadow-md">
          <strong className="flex items-center gap-2 mb-1">
            <Icon type="calendar" className="w-5 h-5" />
            Próximos check-ins
          </strong>
          <div className="ml-7">{soonCI.map(r => state.flats.find(f => f.id === r.flatId)?.name || r.flatName).join(" e ")}</div>
        </div>
      )}

      {active.map(r => <ReservaCard key={r.id} r={r} />)}

      {past.length > 0 && <>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-6">Histórico</div>
        {past.map(r => <ReservaCard key={r.id} r={r} />)}
      </>}

      {modal && (
        <Modal title="Nova Reserva" icon={<Icon type="calendar" className="w-5 h-5 text-violet-600" />} onClose={() => setModal(null)}>
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
                {[['Check-in', 'checkin'], ['Check-out', 'checkout']].map(([label, field]) => (
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
  const addNewFlat = (name, iconType) => {
    const id = name.toLowerCase().replace(/\s+/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    setState(s => ({
      ...s,
      flats: [...s.flats, { id, name, iconType: iconType || "home" }],
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
        const theme = flatTheme(flat.id);
        return (
          <div key={flat.id} className={`card card-hover animate-slide-up overflow-hidden border-l-4 ${flat.id === "alphaville" ? "border-sky-400 ring-1 ring-sky-500/15" : "border-amber-400 ring-1 ring-amber-500/15"}`}>
            <div className={`h-1.5 rounded-full bg-gradient-to-r ${theme.accent} -mx-4 -mt-4 mb-4`} />
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.accent} flex items-center justify-center text-white shadow-md`}>
                  <Icon type={flat.iconType || "home"} className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100">{flat.name}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${theme.chip}`}>{theme.label}</span>
                    <span className="text-xs text-slate-400">{theme.tone}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={nc}>{nt}</Badge>
                <button 
                  onClick={() => setModal({ type: "remove", flatId: flat.id, name: flat.name })} 
                  className="text-slate-500 hover:text-red-400 hover:scale-110 transition-all duration-200 p-1.5 rounded-lg hover:bg-red-500/10"
                >
                  <Icon type="close" className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[["Pendentes", pend.length], ["A pagar", `R$ ${total.toFixed(2)}`]].map(([label, val]) => (
                <div key={label} className="rounded-xl p-3 bg-slate-950/60 border border-slate-700/60 hover:shadow-md transition-all duration-200">
                  <div className="text-xs text-slate-400 mb-1 font-medium">{label}</div>
                  <div className="text-xl font-semibold text-slate-100">{val}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between py-3 border-t border-slate-700/60 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-xs font-semibold text-white">
                  {fd.diarista.split(" ").map(w => w[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-100">{fd.diarista}</div>
                  <div className="text-xs text-slate-500">R$ {fd.rate.toFixed(2)} / diária</div>
                </div>
              </div>
              <button 
                onClick={() => setModal({ type: "edit", flatId: flat.id, name: fd.diarista, rate: String(fd.rate) })} 
                  className="text-xs text-slate-400 hover:text-violet-300 underline transition-colors font-medium hover:scale-105"
              >
                <Icon type="edit" className="w-4 h-4 inline-block mr-1" />
                editar
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <Btn variant="primary" small onClick={() => setModal({ type: "add", flatId: flat.id, date: todayStr(), value: String(fd.rate) })} icon={<Icon type="plus" className="w-4 h-4" />}>Diária</Btn>
              <Btn variant="success" small disabled={pend.length === 0} onClick={() => setModal({ type: "send", flatId: flat.id, flat, diarias: fd.diarias })} icon={<Icon type="send" className="w-4 h-4" />}>Enviar</Btn>
            </div>

            <div className="border-t border-slate-700/60 pt-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Histórico</div>
              {fd.diarias.length === 0
                ? <div className="text-xs text-slate-500 text-center py-3">Nenhuma diária registrada</div>
                : <div className="space-y-2">
                  {fd.diarias.map(d => (
                    <div key={d.id} className="flex items-center gap-2 py-2 border-b border-slate-800 last:border-0 hover:bg-slate-950/60 px-2 -mx-2 rounded transition-all duration-200 animate-slide-left">
                      <span className="text-xs text-slate-400 min-w-[35px]">{fmt(d.date)}</span>
                      <span className="text-sm font-medium text-slate-100 flex-1">R$ {d.value.toFixed(2)}</span>
                      <Badge color={d.paid ? "green" : "yellow"}>{d.paid ? "Pago" : "Pendente"}</Badge>
                      <button 
                        onClick={() => deleteDiaria(flat.id, d.id)} 
                        className="text-slate-500 hover:text-red-400 hover:scale-110 transition-all duration-200 p-1 rounded hover:bg-red-500/10"
                      >
                        <Icon type="close" className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        );
      })}

      <Btn variant="primary" full onClick={() => setModal({ type: "newflat", name: "", iconType: "home" })} icon={<Icon type="plus" className="w-4 h-4" />}>Novo Flat</Btn>

      {modal?.type === "add" && (
        <Modal title={`Nova diária — ${state.flats.find(f => f.id === modal.flatId)?.name}`} icon={<Icon type="plus" className="w-5 h-5 text-violet-600" />} onClose={() => setModal(null)}>
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
        <Modal title="Enviar Pagamento" icon={<Icon type="send" className="w-5 h-5 text-emerald-600" />} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <pre className="bg-slate-100 rounded-lg p-3 text-xs whitespace-pre-wrap leading-relaxed border border-slate-200 font-mono">
              {buildPayMsg(modal.flat, modal.diarias)}
            </pre>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => setModal(null)}>Fechar</Btn>
              <Btn variant="success" onClick={() => { copy(buildPayMsg(modal.flat, modal.diarias)); markPaid(modal.flatId); setModal(null); }} icon={<Icon type="checkmark" className="w-4 h-4" />}>Copiar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal?.type === "edit" && (
        <Modal title={`Editar — ${state.flats.find(f => f.id === modal.flatId)?.name}`} icon={<Icon type="edit" className="w-5 h-5 text-blue-600" />} onClose={() => setModal(null)}>
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
        <Modal title="Novo Flat" icon={<Icon type="home" className="w-5 h-5 text-violet-600" />} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-2 font-medium">Nome do flat</label>
              <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} placeholder="Ex: Moema" className="input" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-2 font-medium">Tipo de ícone</label>
              <select value={modal.iconType} onChange={e => setModal(m => ({ ...m, iconType: e.target.value }))} className="input">
                <option value="home">Casa</option>
                <option value="building">Prédio</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn variant="primary" onClick={() => { if (!modal.name.trim()) return; addNewFlat(modal.name.trim(), modal.iconType); setModal(null); }}>Adicionar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal?.type === "remove" && (
        <Modal title="Remover Flat" icon={<Icon type="close" className="w-5 h-5 text-red-600" />} onClose={() => setModal(null)}>
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
    <div className="card card-hover animate-slide-up">
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
            <pre className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 text-xs whitespace-pre-wrap leading-relaxed border border-slate-200 font-mono hover:shadow-md transition-all duration-200">
              {preview}
            </pre>
            <Btn variant="blue" full onClick={() => copy(preview)} icon={<Icon type="clipboard" className="w-4 h-4" />}>Copiar Autorização</Btn>
          </>
          : <div className="text-sm text-slate-400 text-center py-6 italic">Preencha os hóspedes e as datas para gerar a autorização.</div>
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
    if (getNotificationPermission() === "granted") {
      setState(s => ({ ...s, notificationsEnabled: true }));
      setStatus(token ? "Notificações ativadas!" : "Permissão concedida neste dispositivo.");
    } else {
      setStatus("Permissão não concedida pelo navegador.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Notificações push</div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Ative para receber um alerta às <strong>10h30</strong> no dia do check-in de cada reserva. Funciona mesmo com o app fechado.
        </p>
        {state.notificationsEnabled
          ? <div className="text-sm text-emerald-200 bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20 flex items-center gap-2">
              <Icon type="checkmark" className="w-5 h-5 flex-shrink-0" />
              Notificações ativadas neste dispositivo
            </div>
          : <Btn variant="blue" full onClick={enableNotifications} icon={<Icon type="bell" className="w-4 h-4" />}>Ativar notificações</Btn>
        }
        {status && <div className="text-xs text-slate-500 mt-3 text-center">{status}</div>}
      </div>

      <div className="card card-hover animate-slide-up">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Dados</div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Os dados ficam salvos no seu dispositivo. Exportar cria um backup em JSON.
        </p>
        <div className="flex gap-2">
          <Btn variant="primary" onClick={() => {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = "backup-flats.json"; a.click();
          }} icon={<Icon type="box" className="w-4 h-4" />}>Exportar</Btn>
          <Btn variant="secondary" onClick={() => {
            const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
            input.onchange = e => {
              const file = e.target.files[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => { try { setState(JSON.parse(ev.target.result)); } catch (err) { alert("Arquivo inválido"); } };
              reader.readAsText(file);
            };
            input.click();
          }} icon={<Icon type="download" className="w-4 h-4" />}>Importar</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "reservas", label: "Reservas", icon: "calendar" },
  { id: "flats", label: "Diárias", icon: "home" },
  { id: "auth", label: "Autorização", icon: "clipboard" },
  { id: "config", label: "Config", icon: "settings" },
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

  useEffect(() => {
    if (getNotificationPermission() === "granted") {
      setState(s => s.notificationsEnabled ? s : { ...s, notificationsEnabled: true });
    }
  }, [setState]);

  const copy = text => { navigator.clipboard.writeText(text).catch(() => { }); setToast(true); setTimeout(() => setToast(false), 2000); };

  if (!state) return <div className="flex items-center justify-center h-screen text-sm text-slate-400">Carregando...</div>;

  return (
    <div className="app-shell min-h-screen max-w-md mx-auto px-4 pt-8 pb-28">
      <div className="mb-7 animate-slide-down">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-300 via-cyan-200 to-white bg-clip-text text-transparent mb-1 flex items-center gap-2">
          <Icon type="home" className="w-8 h-8 text-violet-600" />
          Meus Flats
        </h1>
        <p className="text-xs text-slate-400 ml-10">Gerencie reservas e diárias</p>
      </div>

      <div className="mb-4 animate-slide-down">
        <div className="text-[9px] text-slate-500 uppercase tracking-wider px-4 mb-2">Próximas reservas</div>
        <CalendarStrip reservas={state.reservas} flats={state.flats} />
      </div>

      <div className="flex gap-1 rounded-xl p-1 mb-6 border border-slate-700/60 bg-slate-950/70 shadow-sm animate-slide-down">
        {TABS.map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id)} 
            className={`flex-1 py-2.5 px-2 text-xs font-medium rounded-lg transition-all duration-300 flex items-center justify-center gap-1 ${
              tab === t.id
                ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md scale-105 btn-hover-glow"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/70"
            }`}
          >
            <Icon type={t.icon} className="w-3.5 h-3.5" />
            <span>{t.label}</span>
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