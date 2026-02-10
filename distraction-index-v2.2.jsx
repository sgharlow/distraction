import { useState, useEffect, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// WEEK UTILITIES — Sunday-start calendar weeks from Jan 2025
// ═══════════════════════════════════════════════════════════════
function getWeekStart(d) {
  const dt = new Date(d); dt.setHours(0,0,0,0);
  const day = dt.getDay(); dt.setDate(dt.getDate() - day);
  return dt;
}
function fmtDate(d) { return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function fmtShort(d) { return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
function weekId(d) { return d.toISOString().slice(0,10); }
function addDays(d,n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }

const FIRST_WEEK = getWeekStart(new Date(2025,0,1)); // Sun Dec 29, 2024
const NOW = new Date(2026,1,8); // Feb 8, 2026 (for demo)
const CURRENT_WEEK_START = getWeekStart(NOW);

function getWeekLabel(start) {
  const end = addDays(start,6);
  return `${fmtShort(start)} – ${fmtDate(end)}`;
}
function getWeekNumber(start) {
  const diff = Math.round((start - FIRST_WEEK)/(7*86400000));
  return diff + 1;
}
function isCurrentWeek(start) { return weekId(start) === weekId(CURRENT_WEEK_START); }
function isFutureWeek(start) { return start > CURRENT_WEEK_START; }

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA — Two weeks of data to demonstrate navigation
// ═══════════════════════════════════════════════════════════════
const driverLabels={election:"Election Integrity",rule_of_law:"Rule of Law",separation:"Separation of Powers",civil_rights:"Civil Rights",capture:"Institutional Capture",corruption:"Corruption",violence:"Violence/Intimidation"};
const driverWeights={election:0.22,rule_of_law:0.18,separation:0.16,civil_rights:0.14,capture:0.14,corruption:0.10,violence:0.06};
const l1Labels={outrage:"Outrage-bait",meme:"Meme-ability",novelty:"Novelty Spike",media:"Media Friendliness"};
const l2Labels={mismatch:"Volume Mismatch",timing:"Timing Overlap",pivot:"Narrative Pivot",pattern:"Pattern Match"};
const mechLabels={election_admin_change:"Election Admin Change",enforcement_action:"Enforcement Action",judicial_legal_action:"Judicial/Legal",personnel_capture:"Personnel Capture",policy_change:"Policy Change",norm_erosion_only:"Norm Erosion Only",information_operation:"Info Operation"};
const noiseLabels={vanity:"Vanity/Ego","credit-grab":"Credit Grab","stale-reshare":"Stale Reshare",spectacle:"Spectacle",feud:"Personal Feud"};

const WEEKS_DATA = {
  // ── CURRENT WEEK: Feb 2-8, 2026 ──
  "2026-02-01": {
    status:"live", weekNum:58,
    summary: null, // live week, no summary yet
    stats:{total:14,a:5,b:4,c:5,avgA:68.4,avgB:71.2,maxSI:94.4,topPair:"Obama Video → Nationalize Elections",sources:147,docs:12},
    events:{
      A:[
        {id:"a1",title:"Call to Nationalize Elections in 15+ States",a:100,b:22,date:"2026-02-03",sources:14,confidence:0.95,mechanism:"election_admin_change",scope:"multi_state",pop:"broad",version:3,frozen:true,mixed:false,
          aDrivers:{election:5,rule_of_law:4,separation:4,civil_rights:3,capture:4,corruption:2,violence:2},severity:{durability:1.2,reversibility:1.1,precedent:1.3},mechMod:1.15,scopeMod:1.05,
          summary:"Trump called for Republicans to 'take over' and 'nationalize the voting' in at least 15 states.",
          rationale:"Coordinated assault on Article I Elections Clause. Combines rhetoric, enforcement (FBI raid), and legal action (24-state lawsuits). Maximum severity.",
          actionItem:"Watch the MEGA Act and SAVE Act in Congress.",
          history:[{v:1,date:"Feb 3",score:92.1,by:"auto"},{v:2,date:"Feb 4",score:95.0,by:"editor",note:"FBI warrant added"},{v:3,date:"Feb 5",score:100,by:"editor",note:"Multi-state scope confirmed"}],
          smokescreenedBy:["b1","b2"]},
        {id:"a2",title:"FBI Seizure of Fulton County 2020 Ballots",a:81.2,b:35,date:"2026-01-28",sources:11,confidence:0.92,mechanism:"enforcement_action",scope:"single_state",pop:"broad",version:2,frozen:true,mixed:false,
          aDrivers:{election:5,rule_of_law:4,separation:3,civil_rights:3,capture:4,corruption:2,violence:3},severity:{durability:1.1,reversibility:1.2,precedent:1.2},mechMod:1.10,scopeMod:0.95,
          summary:"FBI seized election materials from Fulton County, GA. DNI Gabbard personally present.",
          rationale:"Active enforcement seizure of certified election materials with intelligence chief directing.",
          actionItem:"Track the warrant affidavit — it may reveal broader scope.",
          history:[{v:1,date:"Jan 28",score:78.0,by:"auto"},{v:2,date:"Jan 30",score:81.2,by:"editor",note:"Gabbard call confirmed"}],
          smokescreenedBy:["b1"]},
        {id:"a3",title:"DOJ Sues 24 States for Voter Roll Data",a:76.8,b:18,date:"2026-02-04",sources:9,confidence:0.90,mechanism:"judicial_legal_action",scope:"multi_state",pop:"broad",version:1,frozen:false,mixed:false,
          aDrivers:{election:4,rule_of_law:4,separation:3,civil_rights:3,capture:3,corruption:2,violence:2},severity:{durability:1.0,reversibility:1.0,precedent:1.1},mechMod:1.10,scopeMod:1.05,
          summary:"DOJ filed lawsuits against nearly half of all states demanding voter registration data.",
          rationale:"DOJ weaponized to demand private voter data from 24 states.",
          actionItem:"Check if your state is being sued.",
          history:[{v:1,date:"Feb 4",score:76.8,by:"auto"}],smokescreenedBy:["b3"]},
        {id:"a4",title:"Efforts to Jail Political Opponents",a:73.4,b:28,date:"2026-02-04",sources:8,confidence:0.85,mechanism:"norm_erosion_only",scope:"federal",pop:"narrow",version:1,frozen:false,mixed:false,
          aDrivers:{election:2,rule_of_law:5,separation:4,civil_rights:3,capture:3,corruption:2,violence:2},severity:{durability:1.0,reversibility:0.9,precedent:1.2},mechMod:0.90,scopeMod:1.0,
          summary:"Renewed calls to imprison Fed Chair Powell, Jack Smith, and Comey.",
          rationale:"Currently rhetoric only, but normalizes political imprisonment. Reduced by 0.90× mechanism.",
          actionItem:"Watch for actual DOJ actions or grand jury empanelments.",
          history:[{v:1,date:"Feb 4",score:73.4,by:"auto"}],smokescreenedBy:["b1","b2"]},
        {id:"a5",title:"Mid-Decade Redistricting Campaign",a:71.0,b:12,date:"2026-02-02",sources:7,confidence:0.88,mechanism:"policy_change",scope:"multi_state",pop:"broad",version:1,frozen:true,mixed:false,
          aDrivers:{election:5,rule_of_law:3,separation:3,civil_rights:3,capture:2,corruption:2,violence:1},severity:{durability:1.2,reversibility:1.1,precedent:1.1},mechMod:1.05,scopeMod:1.05,
          summary:"Unprecedented mid-decade redistricting targeting multiple states.",
          rationale:"Policy-level election manipulation at multi-state scope.",
          actionItem:"Track redistricting lawsuits in TX, GA, and FL.",
          history:[{v:1,date:"Feb 2",score:71.0,by:"auto"}],smokescreenedBy:[]},
      ],
      B:[
        {id:"b1",title:"AI-Generated Racist Obama Video",a:38,b:97.3,date:"2026-02-06",sources:18,confidence:0.98,mechanism:"information_operation",scope:"federal",pop:"broad",version:2,frozen:true,mixed:false,
          bL1:{outrage:5,meme:5,novelty:4,media:5},bL2:{mismatch:5,timing:5,pivot:5,pattern:5},intent:14,
          summary:"AI-generated video depicting first Black president as apes, posted during Black History Month.",
          rationale:"A=38: Real norm-erosion. B=97.3: Maximum hype × maximum strategic deployment. Textbook distraction.",
          actionItem:"This is the distraction. Redirect to election seizure efforts.",
          history:[{v:1,date:"Feb 6",score:97.3,by:"auto"},{v:2,date:"Feb 7",score:97.3,by:"editor",note:"A=38 confirmed"}],
          smokescreenFor:["a1","a2","a4"],si:[{target:"a1",raw:97.3,disp:0.9,final:94.4},{target:"a2",raw:79.0,disp:0.8,final:75.5},{target:"a4",raw:71.4,disp:0.5,final:53.6}]},
        {id:"b2",title:"Armed Arrest of Journalist Don Lemon",a:52,b:58.5,date:"2026-02-05",sources:9,confidence:0.90,mechanism:"enforcement_action",scope:"federal",pop:"narrow",version:1,frozen:false,mixed:true,
          bL1:{outrage:4,meme:3,novelty:4,media:5},bL2:{mismatch:3,timing:4,pivot:4,pattern:3},intent:10,
          summary:"Armed federal agents arrested unarmed Black journalist. Real press freedom harm AND distraction.",
          rationale:"A=52: Real enforcement against press. B=58.5: Moderate distraction. MIXED event.",
          actionItem:"Track both the legal case AND what's being buried.",
          history:[{v:1,date:"Feb 5",score:58.5,by:"auto"}],
          smokescreenFor:["a1","a4"],si:[{target:"a1",raw:58.5,disp:0.6,final:51.5},{target:"a4",raw:42.9,disp:0.4,final:33.6}]},
        {id:"b3",title:"Demand to Name Tunnel After Himself",a:8,b:62,date:"2026-02-04",sources:7,confidence:0.85,mechanism:"norm_erosion_only",scope:"local",pop:"narrow",version:1,frozen:true,mixed:false,
          bL1:{outrage:3,meme:4,novelty:3,media:4},bL2:{mismatch:4,timing:3,pivot:3,pattern:3},intent:8,
          summary:"Demanded tunnel be named after him or withhold funding. Classic vanity play.",
          rationale:"A=8: Negligible. B=62: Moderate distraction.",
          actionItem:"Ignore this.",
          history:[{v:1,date:"Feb 4",score:62,by:"auto"}],
          smokescreenFor:["a3"],si:[{target:"a3",raw:47.6,disp:0.4,final:39.1}]},
        {id:"b4",title:"66-Post Late-Night Truth Social Rampage",a:15,b:55.3,date:"2026-02-06",sources:5,confidence:0.80,mechanism:"information_operation",scope:"federal",pop:"broad",version:1,frozen:false,mixed:false,
          bL1:{outrage:3,meme:2,novelty:2,media:3},bL2:{mismatch:4,timing:4,pivot:3,pattern:4},intent:11,
          summary:"66 posts including conspiracies, dog videos, attacks. Flood-the-zone strategy.",
          rationale:"A=15: Low. B=55.3: Volume-as-weapon tactic.",
          actionItem:"Don't drink from the firehose.",
          history:[{v:1,date:"Feb 6",score:55.3,by:"auto"}],
          smokescreenFor:["a1","a2"],si:[{target:"a1",raw:55.3,disp:0.3,final:44.7},{target:"a2",raw:44.9,disp:0.3,final:36.3}]},
      ],
      C:[
        {id:"c1",title:"Nobel Peace Prize Complaints",noise:95.2,date:"2026-02-03",sources:3,codes:["vanity"],mechanism:null,summary:"Ongoing grievances about not receiving Nobel."},
        {id:"c2",title:"Re-sharing Year-Old Mount Rushmore Bill",noise:88.4,date:"2026-02-06",sources:2,codes:["stale-reshare","vanity"],mechanism:null,summary:"Reposted 2025 bill as new."},
        {id:"c3",title:"Claiming Credit for Guthrie Kidnapping",noise:86.1,date:"2026-02-02",sources:2,codes:["credit-grab"],mechanism:null,summary:"Taking credit for local law enforcement."},
        {id:"c4",title:"Reposting TikTok Dog Videos",noise:93.0,date:"2026-02-06",sources:1,codes:["spectacle"],mechanism:null,summary:"Cute dog videos."},
        {id:"c5",title:"Laura Loomer / Tapper Clip (May 2025)",noise:90.5,date:"2026-02-06",sources:2,codes:["stale-reshare","feud"],mechanism:null,summary:"9-month-old footage."},
      ]
    }
  },
  // ── PREVIOUS WEEK: Jan 26 – Feb 1, 2026 (FROZEN) ──
  "2026-01-25": {
    status:"frozen", weekNum:57, frozenAt:"2026-02-01T05:00:00Z",
    summary:"A week dominated by the Fulton County ballot seizure and escalating DOJ lawsuits against states. The administration's legal offensive against election infrastructure intensified while media attention was split between legitimate enforcement stories and manufactured social media controversies.",
    stats:{total:11,a:4,b:3,c:4,avgA:64.2,avgB:58.7,maxSI:62.3,topPair:"Celebrity Feud → Fulton Ballot Seizure",sources:89,docs:8},
    events:{
      A:[
        {id:"pa1",title:"FBI Raids Fulton County Elections Office",a:78.5,b:32,date:"2026-01-28",sources:10,confidence:0.91,mechanism:"enforcement_action",scope:"single_state",pop:"broad",version:2,frozen:true,mixed:false,
          aDrivers:{election:5,rule_of_law:4,separation:3,civil_rights:3,capture:3,corruption:2,violence:3},severity:{durability:1.1,reversibility:1.1,precedent:1.2},mechMod:1.10,scopeMod:0.95,
          summary:"FBI agents entered Fulton County elections office, began seizing ballot boxes and voting records from the 2020 election.",
          rationale:"First enforcement action against state election materials since 2020. Single-state but with clear nationwide precedent implications.",
          actionItem:"Watch for similar actions in other contested counties.",
          history:[{v:1,date:"Jan 28",score:74.2,by:"auto"},{v:2,date:"Jan 29",score:78.5,by:"editor",note:"Scope expanded: DNI involvement confirmed"}],
          smokescreenedBy:["pb1"]},
        {id:"pa2",title:"DOJ Files Voter Roll Lawsuits in 6 New States",a:72.1,b:15,date:"2026-01-27",sources:8,confidence:0.88,mechanism:"judicial_legal_action",scope:"multi_state",pop:"broad",version:1,frozen:true,mixed:false,
          aDrivers:{election:4,rule_of_law:4,separation:3,civil_rights:3,capture:3,corruption:1,violence:1},severity:{durability:1.0,reversibility:1.0,precedent:1.1},mechMod:1.10,scopeMod:1.05,
          summary:"DOJ expanded voter roll lawsuit campaign to 6 additional states, bringing total to 18 states.",
          rationale:"Escalation of systematic DOJ campaign to seize voter data from states.",
          actionItem:"Total now 18 states. Check if yours is included.",
          history:[{v:1,date:"Jan 27",score:72.1,by:"auto"}],smokescreenedBy:[]},
        {id:"pa3",title:"Schedule F Reinstatement Begins at EPA",a:65.0,b:20,date:"2026-01-26",sources:6,confidence:0.85,mechanism:"personnel_capture",scope:"federal",pop:"moderate",version:1,frozen:true,mixed:false,
          aDrivers:{election:1,rule_of_law:3,separation:3,civil_rights:2,capture:5,corruption:2,violence:1},severity:{durability:1.2,reversibility:1.0,precedent:1.1},mechMod:1.05,scopeMod:1.0,
          summary:"EPA begins reclassifying career scientists under Schedule F, enabling political termination.",
          rationale:"Institutional capture via personnel mechanism. EPA is first agency; others expected to follow.",
          actionItem:"Track which agencies follow EPA's lead on Schedule F.",
          history:[{v:1,date:"Jan 26",score:65.0,by:"auto"}],smokescreenedBy:["pb2"]},
        {id:"pa4",title:"Pardon of Jan 6 Defendant Convicted of Assault",a:58.3,b:25,date:"2026-01-30",sources:7,confidence:0.87,mechanism:"norm_erosion_only",scope:"federal",pop:"narrow",version:1,frozen:true,mixed:false,
          aDrivers:{election:2,rule_of_law:5,separation:3,civil_rights:2,capture:2,corruption:2,violence:3},severity:{durability:0.9,reversibility:0.8,precedent:1.1},mechMod:0.90,scopeMod:1.0,
          summary:"Presidential pardon for defendant convicted of assaulting Capitol Police officer.",
          rationale:"Norm erosion around accountability for political violence.",
          actionItem:"Track total J6 pardons and whether they correlate with escalating rhetoric.",
          history:[{v:1,date:"Jan 30",score:58.3,by:"auto"}],smokescreenedBy:["pb1"]},
      ],
      B:[
        {id:"pb1",title:"Viral Feud with Late-Night Host",a:5,b:72.4,date:"2026-01-28",sources:8,confidence:0.92,mechanism:"norm_erosion_only",scope:"federal",pop:"broad",version:1,frozen:true,mixed:false,
          bL1:{outrage:4,meme:4,novelty:3,media:5},bL2:{mismatch:4,timing:4,pivot:3,pattern:4},intent:10,
          summary:"Multiday social media feud with late-night host over inauguration ratings. Dominated 2 news cycles.",
          rationale:"A=5: Zero governance impact. B=72.4: High hype + strategic timing during Fulton seizure.",
          actionItem:"This is a distraction. Look at what happened in Fulton County.",
          history:[{v:1,date:"Jan 28",score:72.4,by:"auto"}],
          smokescreenFor:["pa1","pa4"],si:[{target:"pa1",raw:56.8,disp:0.7,final:52.2},{target:"pa4",raw:42.2,disp:0.4,final:34.1}]},
        {id:"pb2",title:"'Gold Star' Social Media Badge Campaign",a:3,b:58.1,date:"2026-01-26",sources:5,confidence:0.82,mechanism:"norm_erosion_only",scope:"federal",pop:"narrow",version:1,frozen:true,mixed:false,
          bL1:{outrage:3,meme:3,novelty:3,media:3},bL2:{mismatch:3,timing:3,pivot:3,pattern:3},intent:7,
          summary:"Announced 'Gold Star Patriot' verification badges on Truth Social. No governance impact.",
          rationale:"A=3: Pure vanity. B=58.1: Moderate distraction from Schedule F rollout.",
          actionItem:"Ignore. Focus on Schedule F at EPA.",
          history:[{v:1,date:"Jan 26",score:58.1,by:"auto"}],
          smokescreenFor:["pa3"],si:[{target:"pa3",raw:37.8,disp:0.3,final:30.3}]},
        {id:"pb3",title:"Conspiracy Claims About Weather Control",a:10,b:48.5,date:"2026-01-31",sources:4,confidence:0.78,mechanism:"information_operation",scope:"federal",pop:"broad",version:1,frozen:true,mixed:false,
          bL1:{outrage:2,meme:3,novelty:2,media:3},bL2:{mismatch:3,timing:2,pivot:2,pattern:3},intent:6,
          summary:"Social media posts claiming political opponents control the weather. Recycled from 2024.",
          rationale:"A=10: Info operation with no mechanism. B=48.5: Moderate rehash.",
          actionItem:"Old playbook. Not worth your attention.",
          history:[{v:1,date:"Jan 31",score:48.5,by:"auto"}],smokescreenFor:[],si:[]},
      ],
      C:[
        {id:"pc1",title:"Self-Congratulatory Economy Posts",noise:91.0,date:"2026-01-27",sources:2,codes:["vanity"],mechanism:null,summary:"Claiming sole credit for stock market."},
        {id:"pc2",title:"Insulting Foreign Leader's Height",noise:87.3,date:"2026-01-29",sources:3,codes:["spectacle","feud"],mechanism:null,summary:"Personal insults at diplomatic event."},
        {id:"pc3",title:"Resharing Supporter Fan Art",noise:94.5,date:"2026-01-31",sources:1,codes:["spectacle"],mechanism:null,summary:"Hero-worship fan art reposted."},
        {id:"pc4",title:"Complaining About Magazine Cover",noise:82.0,date:"2026-01-26",sources:2,codes:["vanity"],mechanism:null,summary:"Grievance about unflattering photo."},
      ]
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════
function Bar({value,max=5,color,label,weight}){
  return(<div style={{marginBottom:4}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
      <span style={{fontSize:11,color:"#D1D5DB"}}>{label}</span>
      {weight&&<span style={{fontSize:9.5,color:"#6B7280",fontFamily:"monospace"}}>×{weight}</span>}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <div style={{flex:1,height:4,background:"#1f1f3a",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${(value/max)*100}%`,height:"100%",background:color,borderRadius:3,transition:"width 0.3s"}}/>
      </div>
      <span style={{fontSize:10,fontWeight:700,color,minWidth:24,textAlign:"right",fontFamily:"monospace"}}>{value}/{max}</span>
    </div>
  </div>);
}

function DualScore({a,b,size="sm"}){
  const aUp=a>b;const s=size==="lg"?{f:26,l:12,p:"6px 11px",w:68}:{f:13,l:9.5,p:"2px 5px",w:40};
  return(<div style={{display:"flex",gap:3,alignItems:"center"}}>
    <div style={{background:aUp?"#DC262620":"#DC262608",border:`1px solid ${aUp?"#DC262655":"#DC262620"}`,borderRadius:4,padding:s.p,textAlign:"center",minWidth:s.w}}>
      <div style={{fontSize:s.l,color:"#DC2626",fontWeight:600,opacity:0.7}}>A</div>
      <div style={{fontSize:s.f,fontWeight:aUp?900:500,color:"#DC2626",fontFamily:"monospace",opacity:aUp?1:0.4}}>{a?.toFixed?.(1)}</div>
    </div>
    <div style={{background:!aUp?"#D9770620":"#D9770608",border:`1px solid ${!aUp?"#D9770655":"#D9770620"}`,borderRadius:4,padding:s.p,textAlign:"center",minWidth:s.w}}>
      <div style={{fontSize:s.l,color:"#D97706",fontWeight:600,opacity:0.7}}>B</div>
      <div style={{fontSize:s.f,fontWeight:!aUp?900:500,color:"#D97706",fontFamily:"monospace",opacity:!aUp?1:0.4}}>{b?.toFixed?.(1)}</div>
    </div>
  </div>);
}

function AttBudget({a,b}){
  const ab=b-a;
  const color=ab>30?"#D97706":ab<-30?"#DC2626":"#818CF8";
  const label=ab>30?"DISTRACTION":ab<-30?"UNDERCOVERED":"MIXED";
  const icon=ab>30?"📢":ab<-30?"📉":"⚡";
  return <span style={{fontSize:9.5,fontWeight:700,color,letterSpacing:0.4}}>{icon} {ab>0?"+":""}{ab.toFixed(0)} {label}</span>;
}

function MixedBadge(){return <span style={{background:"#818CF820",color:"#A78BFA",fontSize:8.5,fontWeight:800,padding:"1px 5px",borderRadius:3,border:"1px solid #818CF833",letterSpacing:0.8}}>⚡ MIXED</span>;}

function MechBadge({mechanism,scope,pop}){
  if(!mechanism)return null;
  return(<div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:2}}>
    <span style={{fontSize:9.5,background:"#374151",color:"#D1D5DB",padding:"1px 5px",borderRadius:3}}>{mechLabels[mechanism]||mechanism}</span>
    {scope&&<span style={{fontSize:9.5,background:"#1f2937",color:"#9CA3AF",padding:"1px 5px",borderRadius:3}}>{scope}{pop?` · ${pop}`:""}</span>}
  </div>);
}

function Modal({ev,list,onClose}){
  if(!ev)return null;
  const isC=list==="C";const color=list==="A"?"#DC2626":list==="B"?"#D97706":"#6B7280";
  const allA=Object.values(WEEKS_DATA).flatMap(w=>w.events.A);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:12,overflowY:"auto"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#08081a",border:`1px solid ${color}44`,borderRadius:12,maxWidth:680,width:"100%",maxHeight:"92vh",overflow:"auto",padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div style={{flex:1,marginRight:10}}>
            <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
              <span style={{fontSize:9.5,color,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5}}>
                {list==="A"?"🔴 Real Damage":list==="B"?"🟡 Distraction":"⚪ Noise"}
              </span>
              {ev.mixed&&<MixedBadge/>}
              {ev.frozen&&<span style={{fontSize:8.5,background:"#374151",color:"#9CA3AF",padding:"1px 4px",borderRadius:3}}>🔒 v{ev.version}</span>}
            </div>
            <h2 style={{fontSize:17,color:"#F3F4F6",fontWeight:800,lineHeight:1.2,fontFamily:"Georgia,serif",margin:0}}>{ev.title}</h2>
            <div style={{fontSize:10.5,color:"#6B7280",marginTop:2}}>{ev.date} · {ev.sources} sources · {Math.round((ev.confidence||0.8)*100)}% conf</div>
            <MechBadge mechanism={ev.mechanism} scope={ev.scope} pop={ev.pop}/>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#6B7280",fontSize:18,cursor:"pointer",padding:0}}>✕</button>
        </div>
        {!isC&&<div style={{marginBottom:12}}><DualScore a={ev.a} b={ev.b} size="lg"/><div style={{marginTop:4}}><AttBudget a={ev.a} b={ev.b}/></div></div>}
        <div style={{background:"#ffffff06",borderRadius:6,padding:10,marginBottom:10}}>
          <div style={{fontSize:9.5,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Summary</div>
          <p style={{fontSize:12.5,color:"#D1D5DB",lineHeight:1.5,margin:0}}>{ev.summary}</p>
        </div>
        {ev.rationale&&<div style={{background:`${color}08`,border:`1px solid ${color}18`,borderRadius:6,padding:10,marginBottom:10}}>
          <div style={{fontSize:9.5,color,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>💬 Why This Score</div>
          <p style={{fontSize:11.5,color:"#D1D5DB",lineHeight:1.5,margin:0,fontStyle:"italic"}}>{ev.rationale}</p>
        </div>}
        {ev.aDrivers&&<div style={{background:"#DC262606",border:"1px solid #DC262618",borderRadius:6,padding:10,marginBottom:8}}>
          <div style={{fontSize:9.5,color:"#DC2626",fontWeight:700,letterSpacing:1,marginBottom:6}}>A-Score Drivers</div>
          {Object.entries(ev.aDrivers).map(([k,v])=><Bar key={k} value={v} color="#DC2626" label={driverLabels[k]} weight={driverWeights[k]}/>)}
          {ev.severity&&<div style={{marginTop:5,padding:"4px 7px",background:"#DC262610",borderRadius:3,fontSize:9.5,color:"#FCA5A5",fontFamily:"monospace"}}>
            Sev: {Object.entries(ev.severity).map(([k,v])=>`${k}=${v}`).join(" · ")} {ev.mechMod&&`· mech=${ev.mechMod}×`}{ev.scopeMod&&` scope=${ev.scopeMod}×`}
          </div>}
        </div>}
        {ev.bL1&&<div style={{background:"#D9770606",border:"1px solid #D9770618",borderRadius:6,padding:10,marginBottom:8}}>
          <div style={{fontSize:9.5,color:"#D97706",fontWeight:700,letterSpacing:1,marginBottom:6}}>B-Score: Layer 1 — Hype (55%)</div>
          {Object.entries(ev.bL1).map(([k,v])=><Bar key={k} value={v} color="#D97706" label={l1Labels[k]}/>)}
          <div style={{fontSize:9.5,color:"#D97706",fontWeight:700,letterSpacing:1,marginBottom:6,marginTop:10}}>Layer 2 — Strategic (45%)</div>
          {Object.entries(ev.bL2).map(([k,v])=><Bar key={k} value={v} color="#D97706" label={l2Labels[k]}/>)}
          {ev.intent!=null&&<div style={{marginTop:5,padding:"4px 7px",background:"#D9770610",borderRadius:3,fontSize:9.5,color:"#FDE68A",fontFamily:"monospace"}}>
            Intentionality: {ev.intent}/15 → {ev.intent>=8?"Full (0.45)":ev.intent>=4?"Reduced (0.25)":"Minimal (0.10)"}
          </div>}
        </div>}
        {ev.smokescreenFor?.length>0&&<div style={{background:"#DC262606",border:"1px solid #DC262628",borderRadius:6,padding:10,marginBottom:8}}>
          <div style={{fontSize:9.5,color:"#DC2626",fontWeight:700,letterSpacing:1,marginBottom:5}}>🔗 Covering For</div>
          {ev.si?.map((s,i)=>{const t=allA.find(a=>a.id===s.target);return t?(<div key={i} style={{padding:"4px 0",borderTop:i>0?"1px solid #DC262615":"none"}}>
            <div style={{fontSize:11.5,color:"#FCA5A5",fontWeight:600}}>🔴 {t.title}</div>
            <div style={{fontSize:9.5,color:"#9CA3AF",fontFamily:"monospace"}}>SI:{s.final.toFixed(1)} {s.final>50?"🔴":"🟡"} · disp:{s.disp>=0.7?"HIGH":s.disp>=0.4?"MED":"LOW"}</div>
          </div>):null;})}
        </div>}
        {ev.history?.length>0&&<div style={{background:"#ffffff04",borderRadius:6,padding:8,marginBottom:8}}>
          <div style={{fontSize:9.5,color:"#6B7280",fontWeight:700,letterSpacing:1,marginBottom:4}}>📝 Score History</div>
          {ev.history.map((h,i)=><div key={i} style={{fontSize:10.5,color:"#9CA3AF",fontFamily:"monospace"}}>v{h.v} {h.date}: {h.score} ({h.by}){h.note&&` — ${h.note}`}</div>)}
        </div>}
        {ev.actionItem&&<div style={{background:"#059669",borderRadius:6,padding:10}}>
          <div style={{fontSize:9.5,fontWeight:800,color:"#ECFDF5",letterSpacing:1.5,marginBottom:2}}>⚡ If You Only Do One Thing</div>
          <p style={{fontSize:11.5,color:"#ECFDF5",lineHeight:1.4,margin:0}}>{ev.actionItem}</p>
        </div>}
      </div>
    </div>
  );
}

function EventRow({ev,list,rank,onClick,hovered,onHover}){
  const isC=list==="C";const color=list==="A"?"#DC2626":list==="B"?"#D97706":"#6B7280";
  const key=`${list}-${ev.id}`;
  return(
    <div onClick={()=>onClick(ev,list)} onMouseEnter={()=>onHover(key)} onMouseLeave={()=>onHover(null)}
      style={{background:hovered===key?color+"12":"#08081a",border:`1px solid ${hovered===key?color+"44":"#12122a"}`,borderRadius:6,padding:"7px 9px",marginBottom:3,cursor:"pointer",transition:"all 0.12s"}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:11.5,fontWeight:800,color,minWidth:18,fontFamily:"monospace"}}>#{rank}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <span style={{fontSize:12,color:"#E5E7EB",fontWeight:600,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.title}</span>
            {ev.mixed&&<MixedBadge/>}
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center",marginTop:1,flexWrap:"wrap"}}>
            <span style={{fontSize:9.5,color:"#6B7280"}}>{ev.date}</span>
            {!isC&&<AttBudget a={ev.a} b={ev.b}/>}
          </div>
        </div>
        {isC?<div style={{fontSize:14,fontWeight:800,color:"#6B7280",fontFamily:"monospace"}}>{ev.noise}</div>:<DualScore a={ev.a} b={ev.b}/>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WEEK SELECTOR
// ═══════════════════════════════════════════════════════════════
function WeekSelector({currentWeekStart, onChange}){
  const [showPicker,setShowPicker]=useState(false);
  const live=isCurrentWeek(currentWeekStart);
  const end=addDays(currentWeekStart,6);
  const wn=getWeekNumber(currentWeekStart);
  const canPrev=currentWeekStart>FIRST_WEEK;
  const canNext=!isFutureWeek(addDays(currentWeekStart,7));

  const prev=()=>{if(canPrev)onChange(addDays(currentWeekStart,-7));};
  const next=()=>{if(canNext)onChange(addDays(currentWeekStart,7));};
  const goTo=(d)=>{onChange(getWeekStart(d));setShowPicker(false);};

  // Generate list of all available weeks for picker
  const allWeeks=useMemo(()=>{
    const weeks=[];let d=new Date(FIRST_WEEK);
    while(d<=CURRENT_WEEK_START){weeks.push(new Date(d));d=addDays(d,7);}
    return weeks.reverse();
  },[]);

  useEffect(()=>{
    const handler=(e)=>{if(e.key==="ArrowLeft")prev();if(e.key==="ArrowRight")next();};
    window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);
  });

  return(
    <div style={{background:"#0a0a1a",borderBottom:"1px solid #151528",padding:"8px 16px"}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
          <button onClick={prev} disabled={!canPrev} style={{background:"none",border:"1px solid #252540",borderRadius:4,color:canPrev?"#E5E7EB":"#333",fontSize:14,cursor:canPrev?"pointer":"default",padding:"4px 10px",fontWeight:700}}>◀</button>
          <div style={{textAlign:"center",minWidth:260}}>
            <div style={{fontSize:16,fontWeight:800,color:"#F3F4F6",fontFamily:"Georgia,serif"}}>
              {fmtShort(currentWeekStart)} – {fmtDate(end)}
            </div>
            <div style={{display:"flex",gap:6,justifyContent:"center",alignItems:"center",marginTop:2}}>
              <span style={{fontSize:10,color:"#6B7280"}}>Week {wn}</span>
              <span style={{fontSize:10,fontWeight:700,color:live?"#22C55E":"#6B7280",background:live?"#22C55E15":"#ffffff08",padding:"1px 7px",borderRadius:10,border:`1px solid ${live?"#22C55E33":"#ffffff10"}`}}>
                {live?"🟢 LIVE":"🔒 FROZEN"}
              </span>
            </div>
          </div>
          <button onClick={next} disabled={!canNext} style={{background:"none",border:"1px solid #252540",borderRadius:4,color:canNext?"#E5E7EB":"#333",fontSize:14,cursor:canNext?"pointer":"default",padding:"4px 10px",fontWeight:700}}>▶</button>
          <button onClick={()=>setShowPicker(!showPicker)} style={{background:"none",border:"1px solid #252540",borderRadius:4,color:"#9CA3AF",fontSize:13,cursor:"pointer",padding:"4px 8px"}}>📅</button>
        </div>
        <div style={{display:"flex",gap:4,justifyContent:"center",marginTop:6,flexWrap:"wrap"}}>
          <button onClick={()=>goTo(NOW)} style={{background:live?"#818CF815":"transparent",border:`1px solid ${live?"#818CF844":"#252540"}`,borderRadius:4,color:live?"#818CF8":"#6B7280",fontSize:10,fontWeight:600,cursor:"pointer",padding:"2px 8px"}}>This Week</button>
          <button onClick={()=>goTo(addDays(NOW,-7))} style={{background:"transparent",border:"1px solid #252540",borderRadius:4,color:"#6B7280",fontSize:10,fontWeight:600,cursor:"pointer",padding:"2px 8px"}}>Last Week</button>
          <button onClick={()=>goTo(new Date(2025,0,20))} style={{background:"transparent",border:"1px solid #252540",borderRadius:4,color:"#6B7280",fontSize:10,fontWeight:600,cursor:"pointer",padding:"2px 8px"}}>Inauguration Week</button>
        </div>
        {showPicker&&<div style={{marginTop:8,background:"#0f0f28",border:"1px solid #252540",borderRadius:6,padding:8,maxHeight:200,overflowY:"auto"}}>
          <div style={{fontSize:10,color:"#6B7280",fontWeight:700,marginBottom:4,letterSpacing:1}}>ALL WEEKS</div>
          {allWeeks.map(w=>{
            const sel=weekId(w)===weekId(currentWeekStart);
            const cur=isCurrentWeek(w);
            return <div key={weekId(w)} onClick={()=>goTo(w)} style={{padding:"4px 8px",borderRadius:4,cursor:"pointer",background:sel?"#818CF815":"transparent",color:sel?"#818CF8":"#D1D5DB",fontSize:11,fontWeight:sel?700:400,marginBottom:1,display:"flex",justifyContent:"space-between"}}>
              <span>Wk {getWeekNumber(w)}: {getWeekLabel(w)}</span>
              {cur&&<span style={{color:"#22C55E",fontSize:9,fontWeight:700}}>LIVE</span>}
            </div>;
          })}
        </div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App(){
  const [weekStart,setWeekStart]=useState(CURRENT_WEEK_START);
  const [tab,setTab]=useState("dash");
  const [modal,setModal]=useState(null);
  const [hover,setHover]=useState(null);
  const [anim,setAnim]=useState(false);
  useEffect(()=>{setAnim(false);setTimeout(()=>setAnim(true),40);},[weekStart]);

  const wk=weekId(weekStart);
  const weekData=WEEKS_DATA[wk];
  const live=isCurrentWeek(weekStart);
  const hasData=!!weekData;

  const evs=hasData?weekData.events:{A:[],B:[],C:[]};
  const stats=hasData?weekData.stats:null;
  const undercovered=evs.A.filter(e=>(e.b-e.a)<-30).sort((a,b)=>(a.b-a.a)-(b.b-b.a));

  const open=(ev,list)=>setModal({ev,list});

  const Col=({list,items,label,icon,color,tag})=>(
    <div style={{flex:1,minWidth:280}}>
      <div style={{background:color+"08",border:`1px solid ${color}18`,borderRadius:8,padding:10}}>
        <div style={{textAlign:"center",marginBottom:10}}>
          <div style={{fontSize:20}}>{icon}</div>
          <div style={{fontSize:12,fontWeight:800,color,textTransform:"uppercase",letterSpacing:2}}>{label}</div>
          <div style={{fontSize:9.5,color:"#6B7280"}}>{tag}{stats&&` · ${list==="A"?stats.a:list==="B"?stats.b:stats.c} events`}</div>
        </div>
        {items.length===0&&<div style={{textAlign:"center",color:"#333",fontSize:12,padding:20}}>No events this week</div>}
        {items.map((e,i)=>(
          <div key={e.id} style={{opacity:anim?1:0,transform:anim?"none":"translateY(5px)",transition:`all 0.2s ${i*25}ms`}}>
            <EventRow ev={e} list={list} rank={i+1} onClick={open} hovered={hover} onHover={setHover}/>
          </div>
        ))}
      </div>
    </div>
  );

  const tabs=[{id:"dash",label:"📊 Dashboard"},{id:"under",label:"📉 Undercovered"},{id:"smoke",label:"🔗 Smokescreen"},{id:"method",label:"📐 Method"}];

  return(
    <div style={{minHeight:"100vh",background:"#050510",color:"#E5E7EB",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* Title bar */}
      <div style={{borderBottom:"1px solid #151528",padding:"10px 16px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:900,color:"#F3F4F6",fontFamily:"Georgia,serif",margin:0}}>The Distraction Index</h1>
            <p style={{fontSize:9.5,color:"#6B7280",margin:0}}>Weekly civic intelligence report · v2.2</p>
          </div>
          <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
            {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"3px 10px",borderRadius:4,border:`1px solid ${tab===t.id?"#818CF8":"#151528"}`,background:tab===t.id?"#818CF812":"transparent",color:tab===t.id?"#818CF8":"#6B7280",fontSize:10.5,fontWeight:600,cursor:"pointer"}}>{t.label}</button>)}
          </div>
        </div>
      </div>

      {/* Week Selector */}
      <WeekSelector currentWeekStart={weekStart} onChange={setWeekStart}/>

      {/* No data state */}
      {!hasData&&(
        <div style={{maxWidth:600,margin:"60px auto",textAlign:"center",padding:20}}>
          <div style={{fontSize:40,marginBottom:12}}>📭</div>
          <h2 style={{fontSize:18,color:"#F3F4F6",fontFamily:"Georgia,serif",marginBottom:6}}>Week {getWeekNumber(weekStart)}: {getWeekLabel(weekStart)}</h2>
          <p style={{fontSize:13,color:"#6B7280",lineHeight:1.5}}>
            {live?"This week is live but no events have been scored yet. Check back as the week progresses.":"No data available for this week in the demo. Use the week selector to navigate to weeks with sample data (Week 57 or 58)."}
          </p>
        </div>
      )}

      {hasData&&<>
        {/* Weekly summary (frozen weeks only) */}
        {weekData.summary&&!live&&(
          <div style={{background:"#818CF808",borderBottom:"1px solid #818CF818",padding:"8px 16px"}}>
            <div style={{maxWidth:1200,margin:"0 auto"}}>
              <div style={{fontSize:10,fontWeight:800,color:"#818CF8",letterSpacing:1.5,marginBottom:2}}>📜 WHAT ACTUALLY MATTERED — WEEK {weekData.weekNum}</div>
              <p style={{fontSize:12,color:"#D1D5DB",lineHeight:1.4,margin:0}}>{weekData.summary}</p>
            </div>
          </div>
        )}

        {/* Alert (current week) */}
        {live&&stats?.maxSI>50&&(
          <div style={{background:"#DC262610",borderBottom:"1px solid #DC262620",padding:"6px 16px"}}>
            <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:11}}>⚠️</span>
              <span style={{fontSize:10.5,color:"#FCA5A5"}}><strong>Smokescreen:</strong> {stats.topPair} · SI: {stats.maxSI} 🔴 CRITICAL</span>
            </div>
          </div>
        )}

        {/* Week stats bar */}
        {stats&&(
          <div style={{background:"#ffffff04",borderBottom:"1px solid #ffffff08",padding:"5px 16px"}}>
            <div style={{maxWidth:1200,margin:"0 auto",display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              {[
                {l:"Events",v:stats.total},{l:"List A",v:stats.a,c:"#DC2626"},{l:"List B",v:stats.b,c:"#D97706"},{l:"Noise",v:stats.c,c:"#6B7280"},
                {l:"Avg A",v:stats.avgA.toFixed(1),c:"#DC2626"},{l:"Avg B",v:stats.avgB.toFixed(1),c:"#D97706"},{l:"Sources",v:stats.sources},{l:"Primary Docs",v:stats.docs}
              ].map((s,i)=><div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:14,fontWeight:800,color:s.c||"#E5E7EB",fontFamily:"monospace"}}>{s.v}</div>
                <div style={{fontSize:8.5,color:"#6B7280",textTransform:"uppercase",letterSpacing:0.5}}>{s.l}</div>
              </div>)}
            </div>
          </div>
        )}

        {/* Narrative strips */}
        {tab==="dash"&&(
          <div style={{maxWidth:1200,margin:"0 auto",padding:"8px 16px 0",display:"flex",gap:8,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:250,background:"#DC262606",border:"1px solid #DC262614",borderRadius:6,padding:"5px 10px"}}>
              <div style={{fontSize:9.5,fontWeight:800,color:"#DC2626",letterSpacing:1.5,marginBottom:1}}>👁️ LOOK AT THIS</div>
              <div style={{fontSize:11.5,color:"#FCA5A5"}}>{evs.A.slice(0,2).map(e=>e.title).join(" · ")}</div>
            </div>
            <div style={{flex:1,minWidth:250,background:"#D9770606",border:"1px solid #D9770614",borderRadius:6,padding:"5px 10px"}}>
              <div style={{fontSize:9.5,fontWeight:800,color:"#D97706",letterSpacing:1.5,marginBottom:1}}>🎭 THEY WANT YOU TO LOOK AT</div>
              <div style={{fontSize:11.5,color:"#FDE68A"}}>{evs.B.slice(0,2).map(e=>e.title).join(" · ")}</div>
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{maxWidth:1200,margin:"0 auto",padding:"10px 16px 50px"}}>
          {tab==="dash"&&(
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-start"}}>
              <Col list="A" items={evs.A} label="Real Damage" icon="🔴" color="#DC2626" tag="Constitutional Threats"/>
              <Col list="B" items={evs.B} label="Distractions" icon="🟡" color="#D97706" tag="Manufactured Outrage"/>
              <Col list="C" items={evs.C} label="Noise Floor" icon="⚪" color="#6B7280" tag="Low Impact"/>
            </div>
          )}

          {tab==="under"&&(
            <div style={{maxWidth:780,margin:"0 auto"}}>
              <h2 style={{fontSize:18,fontWeight:800,color:"#F3F4F6",fontFamily:"Georgia,serif",marginBottom:3}}>📉 Undercovered High-Damage</h2>
              <p style={{fontSize:11.5,color:"#9CA3AF",marginBottom:14,lineHeight:1.4}}>Events with high constitutional damage but low media attention this week (Attention Budget &lt; -30).</p>
              {undercovered.length===0?<p style={{color:"#6B7280",fontSize:12}}>No undercovered events this week.</p>:
              undercovered.map(e=>(
                <div key={e.id} style={{background:"#DC262606",border:"1px solid #DC262618",borderRadius:8,padding:12,marginBottom:6,cursor:"pointer"}} onClick={()=>open(e,"A")}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                    <div><div style={{fontSize:13,color:"#F3F4F6",fontWeight:700}}>{e.title}</div><MechBadge mechanism={e.mechanism} scope={e.scope} pop={e.pop}/></div>
                    <div style={{textAlign:"right",minWidth:90}}><DualScore a={e.a} b={e.b}/><div style={{marginTop:3}}><AttBudget a={e.a} b={e.b}/></div></div>
                  </div>
                  {e.actionItem&&<div style={{background:"#059669",borderRadius:4,padding:"5px 8px",marginTop:6}}><span style={{fontSize:9.5,fontWeight:800,color:"#ECFDF5"}}>⚡ </span><span style={{fontSize:10.5,color:"#ECFDF5"}}>{e.actionItem}</span></div>}
                </div>
              ))}
            </div>
          )}

          {tab==="smoke"&&(
            <div style={{maxWidth:860,margin:"0 auto"}}>
              <h2 style={{fontSize:18,fontWeight:800,color:"#F3F4F6",fontFamily:"Georgia,serif",marginBottom:3}}>🔗 Smokescreen Map — Week {weekData.weekNum}</h2>
              <p style={{fontSize:11.5,color:"#9CA3AF",marginBottom:14,lineHeight:1.4}}>Distraction → Damage pairings with displacement evidence for this week.</p>
              {evs.B.filter(b=>b.si?.length>0).flatMap(b=>b.si.map(s=>({b,s,a:[...evs.A,...(evs.A)].find(a=>a.id===s.target)}))).filter(p=>p.a).sort((x,y)=>y.s.final-x.s.final).map((p,i)=>{
                const dc=p.s.disp>=0.7?"#22C55E":p.s.disp>=0.4?"#D97706":"#6B7280";
                return(<div key={i} style={{background:"#08081a",border:`1px solid ${p.s.final>50?"#DC262628":"#D9770628"}`,borderRadius:8,padding:10,marginBottom:6}}>
                  <div style={{textAlign:"center",marginBottom:6}}>
                    <span style={{fontSize:10.5,fontWeight:800,color:p.s.final>50?"#DC2626":"#D97706",letterSpacing:1}}>{p.s.final>50?"🔴 CRITICAL":"🟡 SIGNIFICANT"} SI:{p.s.final.toFixed(1)}</span>
                    <span style={{fontSize:9.5,marginLeft:6,color:dc,fontWeight:700}}>Disp:{p.s.disp>=0.7?"HIGH":p.s.disp>=0.4?"MED":"LOW"}</span>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <div style={{flex:1,background:"#D9770606",border:"1px solid #D9770616",borderRadius:6,padding:7}}>
                      <div style={{fontSize:8.5,color:"#D97706",fontWeight:700,letterSpacing:1}}>🟡 DISTRACTION</div>
                      <div style={{fontSize:11.5,color:"#E5E7EB",fontWeight:600,marginTop:1}}>{p.b.title}</div>
                      <div style={{marginTop:3}}><DualScore a={p.b.a} b={p.b.b}/></div>
                    </div>
                    <div style={{color:"#DC2626",fontSize:14,fontWeight:700}}>→</div>
                    <div style={{flex:1,background:"#DC262606",border:"1px solid #DC262616",borderRadius:6,padding:7}}>
                      <div style={{fontSize:8.5,color:"#DC2626",fontWeight:700,letterSpacing:1}}>🔴 REAL DAMAGE</div>
                      <div style={{fontSize:11.5,color:"#E5E7EB",fontWeight:600,marginTop:1}}>{p.a.title}</div>
                      <div style={{marginTop:3}}><DualScore a={p.a.a} b={p.a.b}/></div>
                    </div>
                  </div>
                </div>);
              })}
              {evs.B.filter(b=>b.si?.length>0).length===0&&<p style={{color:"#6B7280",fontSize:12}}>No smokescreen pairings this week.</p>}
            </div>
          )}

          {tab==="method"&&(
            <div style={{maxWidth:820,margin:"0 auto"}}>
              <h2 style={{fontSize:18,fontWeight:800,color:"#F3F4F6",fontFamily:"Georgia,serif",marginBottom:3}}>📐 Methodology v2.2</h2>
              <p style={{fontSize:11.5,color:"#9CA3AF",marginBottom:14}}>Full algorithmic transparency.</p>
              <div style={{background:"#22C55E0a",border:"1px solid #22C55E22",borderRadius:8,padding:12,marginBottom:10}}>
                <div style={{fontSize:11.5,fontWeight:700,color:"#22C55E",marginBottom:4}}>🔄 New in v2.2 — Weekly Editions</div>
                <div style={{fontSize:11,color:"#D1D5DB",lineHeight:1.5}}>
                  The Distraction Index now publishes as <strong>weekly editions</strong>. Each week (Sunday–Saturday) gets its own immutable snapshot. The current week updates live; past weeks are frozen permanently. Navigate between weeks using the selector above. This replaces temporal decay — within a week, all events compete on raw scores. No data is ever changed after the week closes.
                </div>
              </div>
              <div style={{display:"grid",gap:8}}>
                <div style={{background:"#DC262606",border:"1px solid #DC262618",borderRadius:8,padding:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#DC2626",marginBottom:4}}>List A — Constitutional Damage</div>
                  <div style={{fontSize:10.5,color:"#D1D5DB",lineHeight:1.5}}>7 drivers scored 0-5 × severity multipliers × mechanism modifier × scope modifier. A = min(100, 100×Σ(w×d/5) × avg(sev) × mech × scope)</div>
                </div>
                <div style={{background:"#D9770606",border:"1px solid #D9770618",borderRadius:8,padding:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#D97706",marginBottom:4}}>List B — Distraction/Hype</div>
                  <div style={{fontSize:10.5,color:"#D1D5DB",lineHeight:1.5}}>Layer 1 hype (55%) + Layer 2 strategic (45%, modulated by intentionality 0-15). B = 100 × (0.55×L1 + intent_weight×L2)</div>
                </div>
                <div style={{background:"#7C3AED06",border:"1px solid #7C3AED18",borderRadius:8,padding:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#A78BFA",marginBottom:4}}>Smokescreen Index</div>
                  <div style={{fontSize:10.5,color:"#D1D5DB",lineHeight:1.5}}>SI = (B×A/100) × (0.7 + 0.3×displacement_confidence). Requires measured displacement evidence.</div>
                </div>
                <div style={{background:"#ffffff04",border:"1px solid #ffffff0a",borderRadius:8,padding:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#9CA3AF",marginBottom:4}}>Weekly Freeze Policy</div>
                  <div style={{fontSize:10.5,color:"#D1D5DB",lineHeight:1.5}}>Weeks freeze Saturday 23:59 ET. Individual events freeze after 48h or at week-end, whichever comes first. Post-freeze corrections are append-only notices — original scores are the permanent record.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </>}

      {modal&&<Modal ev={modal.ev} list={modal.list} onClose={()=>setModal(null)}/>}
    </div>
  );
}
