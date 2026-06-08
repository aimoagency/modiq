import { C, btnS } from "../theme";
import { Users, Crown } from "../components/icons";

export default function MembersView({ members, maxMembers, memberPct, setShowMemberForm, handleDeleteMember }: {
  members: any[]; maxMembers: number; memberPct: number;
  setShowMemberForm: (v:boolean)=>void; handleDeleteMember: (id:string)=>void;
}) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}><Users size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 담당자 관리</h1>
        <button onClick={()=>setShowMemberForm(true)} style={btnS(C.purple)}>+ 담당자 추가</button>
      </div>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontWeight:700, color:C.text }}>담당자 한도</span>
          <span style={{ fontWeight:700, color:memberPct>=100?C.red:C.green }}>{members.length}/{maxMembers}명</span>
        </div>
        <div style={{ background:C.border, borderRadius:4, height:6 }}>
          <div style={{ width:`${Math.min(memberPct,100)}%`, height:"100%", background:memberPct>=100?C.red:C.green, borderRadius:4 }} />
        </div>
      </div>
      {members.filter(m=>m.role==="owner").map(m=>(
        <div key={m.id} style={{ background:"#1a2f1a", border:`1px solid ${C.green}40`, borderRadius:10, padding:18, marginBottom:10 }}>
          <p style={{ margin:"0 0 12px", fontWeight:700, color:C.green }}><Crown size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 최초 관리자 (대표)</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[["이름",m.name],["직위",m.position||"-"],["전화번호",m.phone||"-"],["이메일",m.email]].map(([label,val])=>(
              <div key={label}><p style={{ margin:0, fontSize:11, color:C.muted }}>{label}</p><p style={{ margin:"3px 0 0", fontSize:13, color:C.text }}>{val}</p></div>
            ))}
          </div>
        </div>
      ))}
      <p style={{ fontWeight:700, color:C.text, margin:"16px 0 10px" }}>추가 담당자 ({members.filter(m=>m.role!=="owner").length}명)</p>
      {members.filter(m=>m.role!=="owner").length===0 ? <p style={{ color:C.muted, fontSize:13 }}>추가된 담당자가 없습니다.</p> : (
        <div style={{ display:"grid", gap:8 }}>
          {members.filter(m=>m.role!=="owner").map(m=>(
            <div key={m.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, flex:1 }}>
                {[["이름",m.name],["직위",m.position||"-"],["전화번호",m.phone||"-"],["이메일",m.email]].map(([label,val])=>(
                  <div key={label}><p style={{ margin:0, fontSize:11, color:C.muted }}>{label}</p><p style={{ margin:"3px 0 0", fontSize:13, color:C.text }}>{val}</p></div>
                ))}
              </div>
              <button onClick={()=>handleDeleteMember(m.id)} style={{ ...btnS(C.red), padding:"6px 12px", fontSize:12, marginLeft:14 }}>삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
