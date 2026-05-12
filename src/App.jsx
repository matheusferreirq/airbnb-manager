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
const s = {
  card: { background:"#fff", border:"1px solid #e5e5e5", borderRadius:14, padding:"14px 16px", marginBottom:12 },
  cardAlert: (color) => ({ ...s.card, borderColor: color==="red"?"#F09595":color==="yellow"?"#FAC775":"#e5e5e5" }),
  label: { fontSize:11, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:600, marginBottom:6 },
  input: { width:"100%", padding:"9px 11px", fontSize:14, borderRadius:9, border:"1px solid #ddd", background:"#f9f9f9", boxSizing:"border-box", fontFamily:"inherit" },
};

function Badge({ color, children }) {
  const map = { green:"#EAF3DE:#3B6D11", yellow:"#FAEEDA:#854F0B", red:"#FCEBEB:#A32D2D", blue:"#E6F1FB:#185FA5", gray:"#F1EFE8:#5F5E5A", ok:"#EAF3DE:#3B6D11" };
  const [bg, fg] = (map[color]||map.gray).split(":");
  return <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20, background:bg, color:fg, whiteSpace:"nowrap" }}>{children}</span>;
}

function Btn({ onClick, disabled, variant="ghost", children, full, small }) {
  const v = {
    ghost:  "transparent:#333:#ccc", primary:"#f5f5f5:#111:#ddd",
    green:  "#EAF3DE:#3B6D11:#C0DD97", blue:"#E6F1FB:#185FA5:#B5D4F4",
    red:    "#FCEBEB:#A32D2D:#F7C1C1", purple:"#EEEDFE:#3C3489:#AFA9EC",
    teal:   "#E1F5EE:#085041:#5DCAA5",
  };
  const [bg,fg,bd] = (v[variant]||v.ghost).split(":");
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: full?undefined:1, width:full?"100%":undefined,
      padding: small?"6px 10px":"9px 12px", fontSize: small?12:13, fontWeight:500,
      borderRadius:9, cursor:disabled?"default":"pointer", opacity:disabled?0.4:1,
      border:`1px solid ${bd}`, background:bg, color:fg, fontFamily:"inherit",
    }}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:14, padding:20, width:"100%", maxWidth:380, maxHeight:"90vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function FlatSelector({ flats, value, onChange }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
      {flats.map(f => (
        <button key={f.id} onClick={() => onChange(f.id)} style={{
          flex:"1 1 calc(50% - 4px)", minWidth:100, padding:"10px 0", fontSize:13, fontWeight:500,
          borderRadius:9, cursor:"pointer", border:"1px solid",
          background: value===f.id?"#EEEDFE":"transparent",
          color: value===f.id?"#3C3489":"#666",
          borderColor: value===f.id?"#AFA9EC":"#ddd",
          fontFamily:"inherit",
        }}>{f.icon} {f.name}</button>
      ))}
    </div>
  );
}

function PaxList({ paxList, onChange }) {
  const update = (i,v) => { const l=[...paxList]; l[i]=v; onChange(l); };
  const remove = (i)  => { const l=[...paxList]; l.splice(i,1); onChange(l); };
  const add    = ()   => onChange([...paxList,""]);
  return (
    <div>
      {paxList.map((p,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
          <span style={{ fontSize:12, color:"#888", minWidth:40 }}>PAX {i+1}</span>
          <input value={p} onChange={e=>update(i,e.target.value)} placeholder="Nome completo" style={{ ...s.input, flex:1 }} />
          {paxList.length>1 && <button onClick={()=>remove(i)} style={{ border:"none", background:"none", cursor:"pointer", color:"#bbb", fontSize:18, lineHeight:1 }}>✕</button>}
        </div>
      ))}
      <button onClick={add} style={{ fontSize:12, color:"#aaa", border:"none", background:"none", cursor:"pointer", textDecoration:"underline", padding:"4px 0", display:"block", marginBottom:4, fontFamily:"inherit" }}>+ Adicionar hóspede</button>
    </div>
  );
}

function Toast({ show }) {
  return (
    <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", background:"#27500A", color:"#C0DD97", padding:"9px 22px", borderRadius:20, fontSize:13, fontWeight:500, zIndex:100, pointerEvents:"none", opacity:show?1:0, transition:"opacity 0.25s", whiteSpace:"nowrap" }}>
      Copiado ✓
    </div>
  );
}

// ─── TAB RESERVAS ─────────────────────────────────────────────────────────────
function TabReservas({ state, setState, setTab, copy }) {
  const [modal, setModal] = useState(null);
  const today = todayStr();

  const addReserva = async ({ flatId, guests, checkin, checkout }) => {
    const flat = state.flats.find(f=>f.id===flatId);
    const res = { id:Date.now(), flatId, flatName:flat.name, guests, checkin, checkout, authorized:false };
    setState(s => ({ ...s, reservas:[...s.reservas, res].sort((a,b)=>a.checkin.localeCompare(b.checkin)) }));
    try { await saveReservaRemota(res); } catch(e){}
    setModal(null);
  };

  const toggleAuth = async id => {
    setState(s => ({ ...s, reservas: s.reservas.map(r => r.id===id ? {...r, authorized:!r.authorized} : r) }));
    const r = state.reservas.find(r=>r.id===id);
    try { await saveReservaRemota({...r, authorized:!r.authorized}); } catch(e){}
  };

  const deleteRes = async id => {
    setState(s => ({ ...s, reservas: s.reservas.filter(r=>r.id!==id) }));
    try { await deleteReservaRemota(id); } catch(e){}
  };

  const loadToAuth = r => {
    setState(s => ({ ...s, auth:{ flatId:r.flatId, paxList:[...r.guests], checkin:r.checkin, checkout:r.checkout } }));
    setTab("auth");
  };

  const todayCI = state.reservas.filter(r=>r.checkin===today&&!r.authorized);
  const soonCI  = state.reservas.filter(r=>{ const d=daysUntil(r.checkin); return d>0&&d<=2&&!r.authorized; });
  const active  = state.reservas.filter(r=>r.checkin>=today&&!r.authorized);
  const past    = state.reservas.filter(r=>r.checkin<today||r.authorized);

  const ReservaCard = ({ r }) => {
    const d = daysUntil(r.checkin);
    const isToday = r.checkin===today;
    const alert   = isToday&&!r.authorized?"red": d>=0&&d<=2&&!r.authorized?"yellow":null;
    let bc="blue", bt=`em ${d} dia${d!==1?"s":""}`;
    if (r.authorized) { bc="green"; bt="Autorizado ✓"; }
    else if (isToday) { bc="red";   bt="Hoje!"; }
    else if (d<0)     { bc="gray";  bt="Passou"; }
    else if (d<=2)    { bc="yellow"; }
    const flat = state.flats.find(f=>f.id===r.flatId)||{ name:r.flatName||r.flatId, icon:"🏠" };
    return (
      <div style={alert?s.cardAlert(alert):s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
          <span style={{ fontSize:12, color:"#888" }}>{flat.icon} {flat.name}</span>
          <Badge color={bc}>{bt}</Badge>
        </div>
        <div style={{ fontSize:13, lineHeight:1.6, marginBottom:7 }}>
          {r.guests.map((g,i)=><div key={i}><span style={{ fontSize:11, color:"#bbb" }}>PAX {i+1} </span>{g}</div>)}
        </div>
        <div style={{ fontSize:12, color:"#aaa", marginBottom:10 }}>📅 {fmt(r.checkin)} → {fmt(r.checkout)}</div>
        <div style={{ display:"flex", gap:6 }}>
          <Btn variant="blue" small onClick={()=>loadToAuth(r)}>📋 Gerar auth</Btn>
          <Btn variant={r.authorized?"ghost":"green"} small onClick={()=>toggleAuth(r.id)}>{r.authorized?"↩ Desmarcar":"✓ Autorizado"}</Btn>
          <button onClick={()=>deleteRes(r.id)} style={{ padding:"6px 10px", fontSize:13, border:"1px solid #eee", borderRadius:8, background:"transparent", cursor:"pointer", color:"#bbb" }}>🗑</button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {todayCI.length>0 && (
        <div style={{ background:"#FCEBEB", border:"1px solid #F09595", borderRadius:11, padding:"11px 14px", marginBottom:12, fontSize:13, color:"#A32D2D", lineHeight:1.5 }}>
          🚨 <strong>Check-in hoje</strong> em {todayCI.map(r=>state.flats.find(f=>f.id===r.flatId)?.name||r.flatName).join(" e ")} — autorização pendente!
        </div>
      )}
      {!todayCI.length&&soonCI.length>0 && (
        <div style={{ background:"#FAEEDA", border:"1px solid #FAC775", borderRadius:11, padding:"11px 14px", marginBottom:12, fontSize:13, color:"#854F0B", lineHeight:1.5 }}>
          ⏰ <strong>{soonCI.length} check-in{soonCI.length>1?"s":""} nos próximos 2 dias</strong> — lembre de enviar a autorização.
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={s.label}>Próximas reservas</span>
        <Btn variant="primary" small full={false} onClick={()=>setModal({ paxList:[""], flatId:state.flats[0]?.id, checkin:"", checkout:"" })}>+ Nova</Btn>
      </div>

      {active.length===0&&<div style={{ fontSize:13, color:"#bbb", textAlign:"center", padding:"24px 0" }}>Nenhuma reserva pendente.</div>}
      {active.map(r=><ReservaCard key={r.id} r={r}/>)}

      {past.length>0&&<>
        <div style={{ ...s.label, marginTop:8 }}>Histórico</div>
        {past.map(r=><ReservaCard key={r.id} r={r}/>)}
      </>}

      {modal&&(
        <Modal title="📅 Nova reserva" onClose={()=>setModal(null)}>
          <div style={s.label}>Flat</div>
          <FlatSelector flats={state.flats} value={modal.flatId} onChange={v=>setModal(m=>({...m,flatId:v}))} />
          <div style={s.label}>Hóspedes</div>
          <PaxList paxList={modal.paxList} onChange={v=>setModal(m=>({...m,paxList:v}))} />
          <div style={{ ...s.label, marginTop:12 }}>Datas</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
            {[["Check-in","checkin"],["Check-out","checkout"]].map(([label,field])=>(
              <div key={field}>
                <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>{label}</div>
                <input type="date" value={modal[field]} onChange={e=>setModal(m=>({...m,[field]:e.target.value}))} style={s.input}/>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn variant="ghost" onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={()=>{
              const guests=modal.paxList.filter(p=>p.trim());
              if(!guests.length||!modal.checkin||!modal.checkout) return;
              addReserva({...modal, guests});
            }}>Salvar reserva</Btn>
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
    setState(s => ({ ...s, flatData:{ ...s.flatData, [id]: fn(s.flatData[id]||{diarista:"Diarista",rate:150,diarias:[]}) } }));

  const addDiaria    = (id,date,value) => mutateFlat(id, f => ({ ...f, diarias:[{id:Date.now(),date,value:parseFloat(value),paid:false},...f.diarias] }));
  const deleteDiaria = (id,did)        => mutateFlat(id, f => ({ ...f, diarias:f.diarias.filter(d=>d.id!==did) }));
  const markPaid     = id              => mutateFlat(id, f => ({ ...f, diarias:f.diarias.map(d=>({...d,paid:true})) }));
  const editFlat     = (id,name,rate)  => mutateFlat(id, f => ({ ...f, diarista:name||f.diarista, rate:rate>0?rate:f.rate }));
  const addNewFlat   = (name,icon)     => {
    const id = name.toLowerCase().replace(/\s+/g,"-").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    setState(s => ({
      ...s,
      flats:[...s.flats,{id,name,icon:icon||"🏠"}],
      flatData:{ ...s.flatData, [id]:{ diarista:"Diarista", rate:150, diarias:[] } },
    }));
  };
  const removeFlat   = id => setState(s => ({
    ...s,
    flats: s.flats.filter(f=>f.id!==id),
    flatData: Object.fromEntries(Object.entries(s.flatData).filter(([k])=>k!==id)),
    reservas: s.reservas.filter(r=>r.flatId!==id),
    auth: s.auth.flatId===id ? { ...s.auth, flatId: s.flats.filter(f=>f.id!==id)[0]?.id||"" } : s.auth,
  }));

  return (
    <div>
      {state.flats.map(flat => {
        const fd    = state.flatData[flat.id]||{diarista:"Diarista",rate:150,diarias:[]};
        const pend  = fd.diarias.filter(d=>!d.paid);
        const total = pend.reduce((a,d)=>a+d.value,0);
        const nc    = pend.length===0?"green":pend.length>=3?"red":"yellow";
        const nt    = pend.length===0?"Em dia":pend.length>=3?`${pend.length} pendentes ⚡`:`${pend.length} pendente${pend.length>1?"s":""}`;
        return (
          <div key={flat.id} style={s.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{flat.icon}</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:600 }}>{flat.name}</div>
                  <div style={{ fontSize:12, color:"#aaa" }}>Flat</div>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Badge color={nc}>{nt}</Badge>
                <button onClick={()=>setModal({type:"remove",flatId:flat.id,name:flat.name})} style={{ border:"none", background:"none", cursor:"pointer", color:"#ddd", fontSize:16 }}>✕</button>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              {[["Pendentes",pend.length],["A pagar",`R$ ${total.toFixed(2)}`]].map(([label,val])=>(
                <div key={label} style={{ background:"#f9f9f9", borderRadius:9, padding:"10px 12px" }}>
                  <div style={{ fontSize:11, color:"#aaa", marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:18, fontWeight:600 }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderTop:"1px solid #f0f0f0", marginBottom:9 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"#EEEDFE", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600, color:"#3C3489" }}>
                  {fd.diarista.split(" ").map(w=>w[0]).slice(0,2).join("")}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{fd.diarista}</div>
                  <div style={{ fontSize:12, color:"#aaa" }}>R$ {fd.rate.toFixed(2)} / diária</div>
                </div>
              </div>
              <button onClick={()=>setModal({type:"edit",flatId:flat.id,name:fd.diarista,rate:String(fd.rate)})} style={{ fontSize:11, color:"#aaa", border:"none", background:"none", cursor:"pointer", textDecoration:"underline", fontFamily:"inherit" }}>editar</button>
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <Btn variant="primary" onClick={()=>setModal({type:"add",flatId:flat.id,date:todayStr(),value:String(fd.rate)})}>+ Diária</Btn>
              <Btn variant="green" disabled={pend.length===0} onClick={()=>setModal({type:"send",flatId:flat.id,flat,diarias:fd.diarias})}>📤 Msg pro Pai</Btn>
            </div>

            <div style={{ borderTop:"1px solid #f5f5f5", paddingTop:8 }}>
              <div style={s.label}>Histórico</div>
              {fd.diarias.length===0
                ? <div style={{ fontSize:12, color:"#bbb", textAlign:"center", padding:"10px 0" }}>Nenhuma diária registrada</div>
                : fd.diarias.map(d=>(
                  <div key={d.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 0", borderBottom:"1px solid #f8f8f8" }}>
                    <span style={{ fontSize:12, color:"#aaa", minWidth:40 }}>{fmt(d.date)}</span>
                    <span style={{ fontSize:13, fontWeight:500, flex:1 }}>R$ {d.value.toFixed(2)}</span>
                    <Badge color={d.paid?"green":"yellow"}>{d.paid?"Pago":"Pendente"}</Badge>
                    <button onClick={()=>deleteDiaria(flat.id,d.id)} style={{ border:"none", background:"none", cursor:"pointer", color:"#ccc", fontSize:14, padding:"2px 4px" }}>✕</button>
                  </div>
                ))
              }
            </div>
          </div>
        );
      })}

      <Btn variant="primary" full onClick={()=>setModal({type:"newflat",name:"",icon:"🏠"})}>+ Novo flat</Btn>

      {modal?.type==="add"&&(
        <Modal title={`+ Nova diária — ${state.flats.find(f=>f.id===modal.flatId)?.name}`} onClose={()=>setModal(null)}>
          <div style={{ marginTop:4 }}>
            <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>Data da limpeza</div>
            <input type="date" value={modal.date} onChange={e=>setModal(m=>({...m,date:e.target.value}))} style={s.input}/>
          </div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>Valor (R$)</div>
            <input type="number" value={modal.value} onChange={e=>setModal(m=>({...m,value:e.target.value}))} min="0" step="10" style={s.input}/>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <Btn variant="ghost" onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={()=>{ addDiaria(modal.flatId,modal.date,modal.value); setModal(null); }}>Adicionar</Btn>
          </div>
        </Modal>
      )}

      {modal?.type==="send"&&(
        <Modal title="📤 Mensagem pro Pai" onClose={()=>setModal(null)}>
          <pre style={{ background:"#f9f9f9", borderRadius:9, padding:13, fontSize:13, whiteSpace:"pre-wrap", lineHeight:1.6, border:"1px solid #eee", marginBottom:12, fontFamily:"inherit" }}>
            {buildPayMsg(modal.flat, modal.diarias)}
          </pre>
          <div style={{ display:"flex", gap:8 }}>
            <Btn variant="ghost" onClick={()=>setModal(null)}>Fechar</Btn>
            <Btn variant="green" onClick={()=>{ copy(buildPayMsg(modal.flat,modal.diarias)); markPaid(modal.flatId); setModal(null); }}>📋 Copiar e marcar pago</Btn>
          </div>
        </Modal>
      )}

      {modal?.type==="edit"&&(
        <Modal title={`✏️ Editar — ${state.flats.find(f=>f.id===modal.flatId)?.name}`} onClose={()=>setModal(null)}>
          <div style={{ marginTop:4 }}>
            <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>Nome da diarista</div>
            <input value={modal.name} onChange={e=>setModal(m=>({...m,name:e.target.value}))} style={s.input}/>
          </div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>Valor padrão (R$)</div>
            <input type="number" value={modal.rate} onChange={e=>setModal(m=>({...m,rate:e.target.value}))} min="0" step="10" style={s.input}/>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <Btn variant="ghost" onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={()=>{ editFlat(modal.flatId,modal.name,parseFloat(modal.rate)); setModal(null); }}>Salvar</Btn>
          </div>
        </Modal>
      )}

      {modal?.type==="newflat"&&(
        <Modal title="🏠 Novo flat" onClose={()=>setModal(null)}>
          <div style={{ marginTop:4 }}>
            <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>Nome do flat</div>
            <input value={modal.name} onChange={e=>setModal(m=>({...m,name:e.target.value}))} placeholder="Ex: Moema" style={s.input}/>
          </div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>Emoji (opcional)</div>
            <input value={modal.icon} onChange={e=>setModal(m=>({...m,icon:e.target.value}))} placeholder="🏠" style={{ ...s.input, width:80 }}/>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <Btn variant="ghost" onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={()=>{ if(!modal.name.trim()) return; addNewFlat(modal.name.trim(),modal.icon); setModal(null); }}>Adicionar</Btn>
          </div>
        </Modal>
      )}

      {modal?.type==="remove"&&(
        <Modal title="Remover flat" onClose={()=>setModal(null)}>
          <p style={{ fontSize:14, color:"#555", marginBottom:16 }}>Tem certeza que quer remover <strong>{modal.name}</strong>? Todas as diárias e reservas deste flat serão excluídas.</p>
          <div style={{ display:"flex", gap:8 }}>
            <Btn variant="ghost" onClick={()=>setModal(null)}>Cancelar</Btn>
            <Btn variant="red" onClick={()=>{ removeFlat(modal.flatId); setModal(null); }}>Remover</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TAB AUTH ─────────────────────────────────────────────────────────────────
function TabAuth({ state, setState, copy }) {
  const a = state.auth;
  const flat = state.flats.find(f=>f.id===a.flatId);
  const preview = buildAuthMsg(flat?.name||"", a.paxList, a.checkin, a.checkout);
  const set = obj => setState(s => ({ ...s, auth:{ ...s.auth, ...obj } }));

  return (
    <div style={s.card}>
      <div style={s.label}>Flat</div>
      <FlatSelector flats={state.flats} value={a.flatId} onChange={v=>set({flatId:v})} />
      <div style={s.label}>Hóspedes</div>
      <PaxList paxList={a.paxList} onChange={v=>set({paxList:v})} />
      <div style={{ ...s.label, marginTop:14 }}>Datas</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {[["Check-in","checkin"],["Check-out","checkout"]].map(([label,field])=>(
          <div key={field}>
            <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>{label}</div>
            <input type="date" value={a[field]} onChange={e=>set({[field]:e.target.value})} style={s.input}/>
          </div>
        ))}
      </div>
      {preview
        ? <>
            <div style={{ background:"#f9f9f9", borderRadius:9, padding:13, fontSize:13, whiteSpace:"pre-wrap", lineHeight:1.6, border:"1px solid #eee", marginBottom:11, fontFamily:"inherit" }}>{preview}</div>
            <Btn variant="blue" full onClick={()=>copy(preview)}>📋 Copiar autorização</Btn>
          </>
        : <div style={{ fontSize:13, color:"#bbb", textAlign:"center", padding:"18px 0" }}>Preencha os hóspedes e as datas para gerar a autorização.</div>
      }
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
      setState(s => ({ ...s, notificationsEnabled:true }));
      setStatus("✅ Notificações ativadas!");
    } else {
      setStatus("❌ Permissão negada. Verifique as configurações do iPhone.");
    }
  };

  return (
    <div>
      <div style={s.card}>
        <div style={s.label}>Notificações push</div>
        <p style={{ fontSize:13, color:"#666", lineHeight:1.6, marginBottom:14 }}>
          Ative para receber um alerta às <strong>10h30</strong> no dia do check-in de cada reserva.
          {"\n"}Funciona mesmo com o app fechado.
        </p>
        {state.notificationsEnabled
          ? <div style={{ fontSize:13, color:"#3B6D11", background:"#EAF3DE", borderRadius:9, padding:"10px 14px" }}>✅ Notificações ativadas neste dispositivo</div>
          : <Btn variant="blue" full onClick={enableNotifications}>🔔 Ativar notificações</Btn>
        }
        {status && <div style={{ fontSize:12, color:"#888", marginTop:10, textAlign:"center" }}>{status}</div>}
      </div>

      <div style={s.card}>
        <div style={s.label}>Dados</div>
        <p style={{ fontSize:13, color:"#666", lineHeight:1.6, marginBottom:14 }}>
          Os dados ficam salvos no seu dispositivo. Exportar cria um backup em JSON.
        </p>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="primary" onClick={()=>{
            const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
            const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
            a.download="backup-flats.json"; a.click();
          }}>📦 Exportar backup</Btn>
          <Btn variant="ghost" onClick={()=>{
            const input = document.createElement("input"); input.type="file"; input.accept=".json";
            input.onchange = e => {
              const file = e.target.files[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => { try { setState(JSON.parse(ev.target.result)); } catch(err){ alert("Arquivo inválido"); } };
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
  { id:"reservas", label:"📅 Reservas" },
  { id:"flats",    label:"🏠 Flats" },
  { id:"auth",     label:"📋 Auth" },
  { id:"config",   label:"⚙️ Config" },
];

export default function App() {
  const [state, setStateRaw] = useState(null);
  const [tab, setTab]         = useState("reservas");
  const [toast, setToast]     = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem("airbnb_v4"); setStateRaw(raw ? Object.assign(defState(), JSON.parse(raw)) : defState()); }
    catch(e) { setStateRaw(defState()); }
  }, []);

  const setState = useCallback(updater => {
    setStateRaw(prev => {
      const next = typeof updater==="function" ? updater(prev) : updater;
      try { localStorage.setItem("airbnb_v4", JSON.stringify(next)); } catch(e){}
      return next;
    });
  }, []);

  useEffect(() => {
    onForegroundMessage(payload => {
      setToast(true); setTimeout(()=>setToast(false), 3000);
    });
  }, []);

  const copy = text => { navigator.clipboard.writeText(text).catch(()=>{}); setToast(true); setTimeout(()=>setToast(false),2000); };

  if (!state) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontSize:14, color:"#aaa" }}>Carregando...</div>;

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", maxWidth:440, margin:"0 auto", padding:"14px 14px 90px", minHeight:"100vh", background:"#fafafa" }}>
      <div style={{ display:"flex", gap:4, background:"#f0f0f0", borderRadius:11, padding:4, marginBottom:18 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1, padding:"7px 0", fontSize:11, fontWeight:500, borderRadius:8,
            border: tab===t.id?"1px solid #ddd":"none",
            background: tab===t.id?"#fff":"transparent",
            color: tab===t.id?"#111":"#888",
            cursor:"pointer", fontFamily:"inherit",
          }}>{t.label}</button>
        ))}
      </div>

      {tab==="reservas" && <TabReservas state={state} setState={setState} setTab={setTab} copy={copy}/>}
      {tab==="flats"    && <TabFlats    state={state} setState={setState} copy={copy}/>}
      {tab==="auth"     && <TabAuth     state={state} setState={setState} copy={copy}/>}
      {tab==="config"   && <TabConfig   state={state} setState={setState}/>}

      <Toast show={toast}/>
    </div>
  );
}
