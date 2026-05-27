"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";

// ─── Canvas dimensions: 11 × 8.5 in landscape at 200 dpi ─────────────────────
const CW = 2200;
const CH = 1700;

// ─── Color palettes ───────────────────────────────────────────────────────────
const STROKE_PALETTE = [
  "#1e1e1e", "#868e96", "#e03131", "#e8590c",
  "#f59f00", "#2f9e44", "#0c8599", "#1971c2",
  "#7048e8", "#c2255c",
];

// Background / fill quick palette (no "none" — that comes from fill-style selection)
const BG_PALETTE = [
  "#ffffff", "#d0ebff", "#ffe3e3", "#ffe8cc",
  "#fff3bf", "#d3f9d8", "#e5dbff", "#ffc9c9",
];

// Extended colour grid for the popout picker
const EXT_COLORS = [
  "#ffffff", "#f8f9fa", "#dee2e6", "#868e96", "#495057", "#212529",
  "#fff5f5", "#ffa8a8", "#ff6b6b", "#e03131", "#c92a2a", "#a61e4d",
  "#fff4e6", "#ffd8a8", "#ffd43b", "#f59f00", "#e8590c", "#d9480f",
  "#ebfbee", "#8ce99a", "#2f9e44", "#1e7e34", "#0c8599", "#0b7285",
  "#e7f5ff", "#74c0fc", "#1971c2", "#1864ab", "#7048e8", "#5f3dc4",
];

// ─── Types ────────────────────────────────────────────────────────────────────
type Tool = "select" | "pencil" | "line" | "arrow" | "rect" | "diamond" | "ellipse" | "text" | "eraser";
type FillStyle = "none" | "hachure" | "cross-hatch" | "solid";
type StrokeDash = "solid" | "dashed" | "dotted";
type EdgeStyle = "sharp" | "round";
type ArrowCurve = "straight" | "curved" | "elbow";
type HandleId = "TL" | "TR" | "BL" | "BR";

interface Pt { x: number; y: number }
interface BBox { x: number; y: number; w: number; h: number }
interface ElBase { id: number; color: string; sw: number; opacity: number }

type El =
  | (ElBase & { type: "pencil"; pts: Pt[] })
  | (ElBase & { type: "line";   x1: number; y1: number; x2: number; y2: number; roughness: number; dash: StrokeDash })
  | (ElBase & { type: "arrow";  x1: number; y1: number; x2: number; y2: number; roughness: number; dash: StrokeDash; curve: ArrowCurve })
  | (ElBase & { type: "rect";   x: number; y: number; w: number; h: number; roughness: number; dash: StrokeDash; fillStyle: FillStyle; fillColor: string; edges: EdgeStyle })
  | (ElBase & { type: "diamond";x: number; y: number; w: number; h: number; roughness: number; dash: StrokeDash; fillStyle: FillStyle; fillColor: string; edges: EdgeStyle })
  | (ElBase & { type: "ellipse";cx: number; cy: number; rx: number; ry: number; roughness: number; dash: StrokeDash; fillStyle: FillStyle; fillColor: string })
  | (ElBase & { type: "text";   x: number; y: number; text: string; fs: number })
  | (ElBase & { type: "image";  x: number; y: number; w: number; h: number; src: string });

interface SelAction { mode: "moving" | "resizing"; handle?: HandleId; startPt: Pt; origEl: El }

let _eid = 1;
const newId = () => _eid++;

// ─── Rough.js types (CDN) ─────────────────────────────────────────────────────
interface RoughOpts {
  stroke?: string; strokeWidth?: number; roughness?: number; seed?: number;
  fill?: string; fillStyle?: string; strokeLineDash?: number[];
}
interface RoughCanvas {
  line(x1: number, y1: number, x2: number, y2: number, opts?: RoughOpts): void;
  rectangle(x: number, y: number, w: number, h: number, opts?: RoughOpts): void;
  ellipse(cx: number, cy: number, w: number, h: number, opts?: RoughOpts): void;
  polygon(pts: number[][], opts?: RoughOpts): void;
  path(d: string, opts?: RoughOpts): void;
}
interface RoughLib { canvas(el: HTMLCanvasElement): RoughCanvas }
interface WindowWithRough extends Window { rough?: RoughLib }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cvtPos(canvas: HTMLCanvasElement, e: React.MouseEvent): Pt {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH };
}

function strokePath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  if (pts.length < 2) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); }
  else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x)/2, my = (pts[i].y + pts[i+1].y)/2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
  }
  ctx.stroke();
}

function getBBox(el: El): BBox {
  switch (el.type) {
    case "rect":    return { x: el.x, y: el.y, w: el.w, h: el.h };
    case "diamond": return { x: el.x, y: el.y, w: el.w, h: el.h };
    case "image":   return { x: el.x, y: el.y, w: el.w, h: el.h };
    case "ellipse": return { x: el.cx-Math.abs(el.rx), y: el.cy-Math.abs(el.ry), w: Math.abs(el.rx)*2, h: Math.abs(el.ry)*2 };
    case "line":
    case "arrow":   return { x: Math.min(el.x1,el.x2), y: Math.min(el.y1,el.y2), w: Math.abs(el.x2-el.x1)||4, h: Math.abs(el.y2-el.y1)||4 };
    case "pencil":  { const xs=el.pts.map(p=>p.x),ys=el.pts.map(p=>p.y); const x=Math.min(...xs),y=Math.min(...ys); return {x,y,w:(Math.max(...xs)-x)||4,h:(Math.max(...ys)-y)||4}; }
    case "text":    return { x: el.x, y: el.y, w: 500, h: el.fs*1.4 };
  }
}

const SEL_PAD = 10;
const HANDLE_R = 20;
const HSIZE = 20;

function getHandles(bb: BBox): Record<HandleId, Pt> {
  return { TL:{x:bb.x,y:bb.y}, TR:{x:bb.x+bb.w,y:bb.y}, BL:{x:bb.x,y:bb.y+bb.h}, BR:{x:bb.x+bb.w,y:bb.y+bb.h} };
}
function hitHandle(pt: Pt, bb: BBox): HandleId | null {
  const handles = getHandles(bb);
  for (const [k,h] of Object.entries(handles)) if (Math.abs(pt.x-h.x)<HANDLE_R && Math.abs(pt.y-h.y)<HANDLE_R) return k as HandleId;
  return null;
}

function hitEl(pt: Pt, el: El): boolean {
  const P = 22;
  switch (el.type) {
    case "rect":    return pt.x>=el.x-P && pt.x<=el.x+el.w+P && pt.y>=el.y-P && pt.y<=el.y+el.h+P;
    case "diamond": { const cx=el.x+el.w/2,cy=el.y+el.h/2; return Math.abs(pt.x-cx)/(el.w/2+P)+Math.abs(pt.y-cy)/(el.h/2+P)<=1; }
    case "image":   return pt.x>=el.x-P && pt.x<=el.x+el.w+P && pt.y>=el.y-P && pt.y<=el.y+el.h+P;
    case "ellipse": { const dx=(pt.x-el.cx)/(Math.abs(el.rx)+P),dy=(pt.y-el.cy)/(Math.abs(el.ry)+P); return dx*dx+dy*dy<=1; }
    case "line":
    case "arrow":   { const dx=el.x2-el.x1,dy=el.y2-el.y1,len2=dx*dx+dy*dy; if(!len2) return Math.hypot(pt.x-el.x1,pt.y-el.y1)<P*2; const t=Math.max(0,Math.min(1,((pt.x-el.x1)*dx+(pt.y-el.y1)*dy)/len2)); return Math.hypot(pt.x-(el.x1+t*dx),pt.y-(el.y1+t*dy))<P*2; }
    case "pencil":  return el.pts.some(p=>Math.hypot(pt.x-p.x,pt.y-p.y)<P*2);
    case "text":    return pt.x>=el.x-P && pt.x<=el.x+600 && pt.y>=el.y-P && pt.y<=el.y+el.fs*1.6;
  }
}

function moveEl(el: El, dx: number, dy: number): El {
  switch (el.type) {
    case "rect":    return {...el,x:el.x+dx,y:el.y+dy};
    case "diamond": return {...el,x:el.x+dx,y:el.y+dy};
    case "image":   return {...el,x:el.x+dx,y:el.y+dy};
    case "ellipse": return {...el,cx:el.cx+dx,cy:el.cy+dy};
    case "line":
    case "arrow":   return {...el,x1:el.x1+dx,y1:el.y1+dy,x2:el.x2+dx,y2:el.y2+dy};
    case "pencil":  return {...el,pts:el.pts.map(p=>({x:p.x+dx,y:p.y+dy}))};
    case "text":    return {...el,x:el.x+dx,y:el.y+dy};
  }
}

function resizeEl(el: El, handle: HandleId, pt: Pt): El {
  const orig = getBBox(el);
  let {x,y,w,h} = orig;
  if (handle==="TL"){ w+=x-pt.x; h+=y-pt.y; x=pt.x; y=pt.y; }
  if (handle==="TR"){ w=pt.x-x;  h+=y-pt.y; y=pt.y; }
  if (handle==="BL"){ w+=x-pt.x; h=pt.y-y;  x=pt.x; }
  if (handle==="BR"){ w=pt.x-x;  h=pt.y-y; }
  w=Math.max(10,w); h=Math.max(10,h);
  switch(el.type){
    case "rect":    return {...el,x,y,w,h};
    case "diamond": return {...el,x,y,w,h};
    case "image":   return {...el,x,y,w,h};
    case "ellipse": return {...el,cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2};
    default:        return el;
  }
}

function dashArr(d: StrokeDash): number[] {
  if (d==="dashed") return [24,12];
  if (d==="dotted") return [6,10];
  return [];
}

function drawArrowhead(ctx: CanvasRenderingContext2D, x1:number,y1:number,x2:number,y2:number,sw:number,color:string){
  const angle=Math.atan2(y2-y1,x2-x1);
  const size=Math.max(28,sw*9);
  ctx.save();
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-size*Math.cos(angle-Math.PI/6),y2-size*Math.sin(angle-Math.PI/6));
  ctx.lineTo(x2-size*Math.cos(angle+Math.PI/6),y2-size*Math.sin(angle+Math.PI/6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─── Hachure fill for rounded shapes (canvas clipping) ───────────────────────
function drawHachure(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, cross: boolean) {
  const step = 10;
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([]);
  for (let d = -h; d < w + 1; d += step) {
    ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d + h, y + h); ctx.stroke();
  }
  if (cross) {
    for (let d = 0; d < w + h + 1; d += step) {
      ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d - h, y + h); ctx.stroke();
    }
  }
}

// ─── Draw element ─────────────────────────────────────────────────────────────
function drawEl(ctx: CanvasRenderingContext2D, el: El, rc: RoughCanvas|null, imgs: Map<string,HTMLImageElement>) {
  ctx.save();
  ctx.globalAlpha = el.opacity/100;
  ctx.lineCap="round"; ctx.lineJoin="round";

  switch(el.type){
    case "pencil":
      ctx.strokeStyle=el.color; ctx.lineWidth=el.sw;
      strokePath(ctx,el.pts);
      break;

    case "line": {
      const da=dashArr(el.dash);
      if(rc){
        rc.line(el.x1,el.y1,el.x2,el.y2,{stroke:el.color,strokeWidth:el.sw,roughness:el.roughness,seed:el.id,...(da.length?{strokeLineDash:da}:{})});
      } else {
        ctx.strokeStyle=el.color; ctx.lineWidth=el.sw;
        if(da.length) ctx.setLineDash(da);
        ctx.beginPath(); ctx.moveTo(el.x1,el.y1); ctx.lineTo(el.x2,el.y2); ctx.stroke();
      }
      break;
    }

    case "arrow": {
      const da=dashArr(el.dash);
      const opts:RoughOpts={stroke:el.color,strokeWidth:el.sw,roughness:el.roughness,seed:el.id,...(da.length?{strokeLineDash:da}:{})};
      if(el.curve==="curved"){
        const mx=(el.x1+el.x2)/2,my=(el.y1+el.y2)/2;
        const dx=el.x2-el.x1,dy=el.y2-el.y1,len=Math.hypot(dx,dy)||1;
        const cpx=mx-(dy/len)*len*0.25,cpy=my+(dx/len)*len*0.25;
        if(rc) rc.path(`M ${el.x1} ${el.y1} Q ${cpx} ${cpy} ${el.x2} ${el.y2}`,opts);
        else {
          ctx.strokeStyle=el.color;ctx.lineWidth=el.sw;if(da.length)ctx.setLineDash(da);
          ctx.beginPath();ctx.moveTo(el.x1,el.y1);ctx.quadraticCurveTo(cpx,cpy,el.x2,el.y2);ctx.stroke();
        }
        drawArrowhead(ctx,cpx,cpy,el.x2,el.y2,el.sw,el.color);
      } else if(el.curve==="elbow"){
        if(rc) rc.path(`M ${el.x1} ${el.y1} L ${el.x2} ${el.y1} L ${el.x2} ${el.y2}`,opts);
        else {
          ctx.strokeStyle=el.color;ctx.lineWidth=el.sw;if(da.length)ctx.setLineDash(da);
          ctx.beginPath();ctx.moveTo(el.x1,el.y1);ctx.lineTo(el.x2,el.y1);ctx.lineTo(el.x2,el.y2);ctx.stroke();
        }
        drawArrowhead(ctx,el.x2,el.y1,el.x2,el.y2,el.sw,el.color);
      } else {
        if(rc) rc.line(el.x1,el.y1,el.x2,el.y2,opts);
        else {
          ctx.strokeStyle=el.color;ctx.lineWidth=el.sw;if(da.length)ctx.setLineDash(da);
          ctx.beginPath();ctx.moveTo(el.x1,el.y1);ctx.lineTo(el.x2,el.y2);ctx.stroke();
        }
        drawArrowhead(ctx,el.x1,el.y1,el.x2,el.y2,el.sw,el.color);
      }
      break;
    }

    case "rect": {
      const da=dashArr(el.dash);
      if(el.edges==="round"){
        const r=Math.min(el.w,el.h)*0.15;
        const roundPath=()=>{ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(el.x,el.y,el.w,el.h,r); else ctx.rect(el.x,el.y,el.w,el.h); };
        if(el.fillStyle!=="none"){
          if(el.fillStyle==="solid"){ ctx.fillStyle=el.fillColor; roundPath(); ctx.fill(); }
          else { ctx.save(); roundPath(); ctx.clip(); drawHachure(ctx,el.x,el.y,el.w,el.h,el.fillColor,el.fillStyle==="cross-hatch"); ctx.restore(); }
        }
        ctx.strokeStyle=el.color; ctx.lineWidth=el.sw;
        if(da.length) ctx.setLineDash(da);
        roundPath(); ctx.stroke();
      } else if(rc){
        const pts:number[][]=[[el.x,el.y],[el.x+el.w,el.y],[el.x+el.w,el.y+el.h],[el.x,el.y+el.h]];
        const opts:RoughOpts={stroke:el.color,strokeWidth:el.sw,roughness:el.roughness,seed:el.id,...(da.length?{strokeLineDash:da}:{})};
        if(el.fillStyle!=="none"){ opts.fill=el.fillColor; opts.fillStyle=el.fillStyle; }
        rc.polygon(pts,opts);
      } else {
        ctx.strokeStyle=el.color; ctx.lineWidth=el.sw;
        if(da.length) ctx.setLineDash(da);
        if(el.fillStyle!=="none"){ ctx.fillStyle=el.fillColor; ctx.fillRect(el.x,el.y,el.w,el.h); }
        ctx.strokeRect(el.x,el.y,el.w,el.h);
      }
      break;
    }

    case "diamond": {
      const cx=el.x+el.w/2, cy=el.y+el.h/2;
      const da=dashArr(el.dash);
      const corners:number[][]=[[cx,el.y],[el.x+el.w,cy],[cx,el.y+el.h],[el.x,cy]];
      if(el.edges==="round"){
        const r=Math.min(el.w,el.h)*0.15;
        const n=corners.length;
        const buildPath=()=>{
          ctx.beginPath();
          for(let i=0;i<n;i++){
            const [px,py]=corners[i];
            const [nx,ny]=corners[(i+1)%n];
            const [ppx,ppy]=corners[(i-1+n)%n];
            const dx1=px-ppx,dy1=py-ppy,len1=Math.hypot(dx1,dy1);
            const ux1=dx1/len1,uy1=dy1/len1;
            const dx2=nx-px,dy2=ny-py,len2=Math.hypot(dx2,dy2);
            const ux2=dx2/len2,uy2=dy2/len2;
            const cr=Math.min(r,len1/2,len2/2);
            if(i===0) ctx.moveTo(px-ux1*cr,py-uy1*cr);
            else ctx.lineTo(px-ux1*cr,py-uy1*cr);
            ctx.quadraticCurveTo(px,py,px+ux2*cr,py+uy2*cr);
          }
          ctx.closePath();
        };
        if(el.fillStyle!=="none"){
          if(el.fillStyle==="solid"){ ctx.fillStyle=el.fillColor; buildPath(); ctx.fill(); }
          else { ctx.save(); buildPath(); ctx.clip(); drawHachure(ctx,el.x,el.y,el.w,el.h,el.fillColor,el.fillStyle==="cross-hatch"); ctx.restore(); }
        }
        ctx.strokeStyle=el.color; ctx.lineWidth=el.sw;
        if(da.length) ctx.setLineDash(da);
        buildPath(); ctx.stroke();
      } else if(rc){
        const opts:RoughOpts={stroke:el.color,strokeWidth:el.sw,roughness:el.roughness,seed:el.id,...(da.length?{strokeLineDash:da}:{})};
        if(el.fillStyle!=="none"){opts.fill=el.fillColor;opts.fillStyle=el.fillStyle;}
        rc.polygon(corners,opts);
      } else {
        ctx.strokeStyle=el.color; ctx.lineWidth=el.sw;
        if(da.length) ctx.setLineDash(da);
        ctx.beginPath(); ctx.moveTo(cx,el.y); ctx.lineTo(el.x+el.w,cy); ctx.lineTo(cx,el.y+el.h); ctx.lineTo(el.x,cy); ctx.closePath();
        if(el.fillStyle!=="none"){ctx.fillStyle=el.fillColor;ctx.fill();}
        ctx.stroke();
      }
      break;
    }

    case "ellipse": {
      const da=dashArr(el.dash);
      if(rc){
        const opts:RoughOpts={stroke:el.color,strokeWidth:el.sw,roughness:el.roughness,seed:el.id,...(da.length?{strokeLineDash:da}:{})};
        if(el.fillStyle!=="none"){ opts.fill=el.fillColor; opts.fillStyle=el.fillStyle; }
        rc.ellipse(el.cx,el.cy,Math.abs(el.rx)*2,Math.abs(el.ry)*2,opts);
      } else {
        ctx.strokeStyle=el.color; ctx.lineWidth=el.sw;
        if(da.length) ctx.setLineDash(da);
        if(el.fillStyle!=="none"){
          ctx.fillStyle=el.fillColor;
          ctx.beginPath(); ctx.ellipse(el.cx,el.cy,Math.abs(el.rx),Math.abs(el.ry),0,0,Math.PI*2); ctx.fill();
        }
        ctx.beginPath(); ctx.ellipse(el.cx,el.cy,Math.abs(el.rx),Math.abs(el.ry),0,0,Math.PI*2); ctx.stroke();
      }
      break;
    }

    case "text":
      ctx.fillStyle=el.color; ctx.font=`${el.fs}px sans-serif`; ctx.textBaseline="top";
      el.text.split("\n").forEach((line,i)=>ctx.fillText(line,el.x,el.y+i*el.fs*1.2));
      break;

    case "image": {
      const img=imgs.get(el.src);
      if(img) ctx.drawImage(img,el.x,el.y,el.w,el.h);
      break;
    }
  }
  ctx.restore();
}

// ─── Selection handles ────────────────────────────────────────────────────────
function drawSelection(ctx: CanvasRenderingContext2D, el: El) {
  const bb=getBBox(el);
  const x=bb.x-SEL_PAD,y=bb.y-SEL_PAD,w=bb.w+SEL_PAD*2,h=bb.h+SEL_PAD*2;
  ctx.save();
  ctx.strokeStyle="#65CBF1"; ctx.lineWidth=2; ctx.setLineDash([10,5]);
  ctx.strokeRect(x,y,w,h);
  ctx.setLineDash([]);
  const handles=getHandles({x,y,w,h});
  for(const hp of Object.values(handles)){
    ctx.fillStyle="#fff"; ctx.fillRect(hp.x-HSIZE/2,hp.y-HSIZE/2,HSIZE,HSIZE);
    ctx.strokeRect(hp.x-HSIZE/2,hp.y-HSIZE/2,HSIZE,HSIZE);
  }
  ctx.restore();
}

// ─── Color picker popout ─────────────────────────────────────────────────────
function ColorPickerPopout({ anchor, value, onChange, onClose }: {
  anchor: {x:number;y:number}; value:string; onChange:(c:string)=>void; onClose:()=>void;
}) {
  const ref=useRef<HTMLDivElement>(null);
  const [hex,setHex]=useState(value.replace("#",""));
  useEffect(()=>{ setHex(value.replace("#","")); },[value]);
  useEffect(()=>{
    function handler(e:MouseEvent){ if(ref.current&&!ref.current.contains(e.target as Node)) onClose(); }
    const t=setTimeout(()=>window.addEventListener("mousedown",handler),0);
    return ()=>{ clearTimeout(t); window.removeEventListener("mousedown",handler); };
  },[onClose]);

  return (
    <div ref={ref} style={{position:"fixed",left:anchor.x,top:anchor.y,zIndex:1000}}
      className="w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-2xl">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Colors</p>
      <div className="grid grid-cols-6 gap-1 mb-3">
        {EXT_COLORS.map(c=>(
          <button key={c} type="button" title={c}
            onClick={()=>{ onChange(c); setHex(c.replace("#","")); }}
            className={clsx("h-5 w-5 rounded border transition hover:scale-110",
              c==="#ffffff"?"border-gray-300":"border-transparent",
              value===c?"ring-2 ring-[#65CBF1] ring-offset-1":"")}
            style={{backgroundColor:c}} />
        ))}
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5">
        <div className="h-4 w-4 flex-shrink-0 rounded border border-gray-200" style={{backgroundColor:value}} />
        <span className="text-xs text-gray-400">#</span>
        <input className="min-w-0 flex-1 font-mono text-xs outline-none"
          value={hex} maxLength={6}
          onChange={e=>{ const v=e.target.value.replace(/[^0-9a-fA-F]/g,""); setHex(v); if(v.length===6) onChange("#"+v); }}
          onKeyDown={e=>{ if(e.key==="Enter"&&hex.length===6){ onChange("#"+hex); onClose(); } }}
        />
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><path d={d} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  { id:"select",  label:"Select",    key:"V", icon:<Icon d="M4.5 3l11 7.5-5.5 1.5L8.5 17 4.5 3z" /> },
  { id:"pencil",  label:"Draw",      key:"P", icon:<Icon d="M14 3a1.5 1.5 0 012.12 2.12L6.5 14.62l-3.5 1 1-3.5L14 3z" /> },
  { id:"eraser",  label:"Eraser",    key:"X",
    icon:<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><path d="M3 17h8" strokeLinecap="round"/><path d="M12.5 4.5l3 3-7 7-4-1 1-4 7-5z" strokeLinejoin="round"/><path d="M9.5 7.5l3 3"/></svg> },
  { id:"line",    label:"Line",      key:"L",
    icon:<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><line x1="3.5" y1="16.5" x2="16.5" y2="3.5" strokeLinecap="round"/></svg> },
  { id:"arrow",   label:"Arrow",     key:"A",
    icon:<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><path d="M4 16L16 4" strokeLinecap="round"/><path d="M16 4h-7M16 4v7" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id:"rect",    label:"Rectangle", key:"R",
    icon:<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><rect x="3" y="5" width="14" height="10" rx="1.5"/></svg> },
  { id:"diamond", label:"Diamond",   key:"D",
    icon:<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><polygon points="10,2 18,10 10,18 2,10"/></svg> },
  { id:"ellipse", label:"Ellipse",   key:"E",
    icon:<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><ellipse cx="10" cy="10" rx="7" ry="5"/></svg> },
  { id:"text",    label:"Text",      key:"T",
    icon:<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><path d="M3 5h14M10 5v12M7 17h6" strokeLinecap="round" strokeLinejoin="round"/></svg> },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ZineCanvas({ format = "mini" }: { format?: "mini" | "half_letter" }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drawing style state
  const [tool,      setTool]      = useState<Tool>("pencil");
  const [color,     setColor]     = useState("#1e1e1e");
  const [fillColor, setFillColor] = useState("#d0ebff");
  const [fillStyle, setFillStyle] = useState<FillStyle>("none");
  const [sw,        setSw]        = useState(2);
  const [sloppiness,setSloppiness]= useState(1.2);
  const [dash,      setDash]      = useState<StrokeDash>("solid");
  const [opacity,   setOpacity]   = useState(100);
  const [edgeStyle,  setEdgeStyle]  = useState<EdgeStyle>("sharp");
  const [arrowCurve, setArrowCurve] = useState<ArrowCurve>("straight");
  const [fontSize,   setFontSize]   = useState<number>(72);

  // Canvas state
  const [els,       setEls]       = useState<El[]>([]);
  const [history,   setHistory]   = useState<El[][]>([]);
  const [redoStack, setRedoStack] = useState<El[][]>([]);
  const [selId,     setSelId]     = useState<number|null>(null);

  // Stable refs (for useCallback / event handlers with [] deps)
  const elsRef    = useRef<El[]>([]);
  const selIdRef  = useRef<number|null>(null);
  const colorRef  = useRef(color);
  const swRef     = useRef(sw);
  const opacityRef= useRef(opacity);
  const roughLib  = useRef<RoughLib|null>(null);
  const imgs      = useRef<Map<string,HTMLImageElement>>(new Map());
  const sidebarRef    = useRef<HTMLDivElement>(null);
  const prevCursorRef = useRef<string>("crosshair");
  const fontSizeRef   = useRef<number>(72);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);

  // Drawing refs
  const isDrawing  = useRef(false);
  const origin     = useRef<Pt>({x:0,y:0});
  const live       = useRef<El|null>(null);
  const selAction  = useRef<SelAction|null>(null);
  const selLive    = useRef<El|null>(null);
  const committing = useRef(false);

  // Sync colour/size refs
  useEffect(()=>{ colorRef.current=color; },[color]);
  useEffect(()=>{ swRef.current=sw; },[sw]);
  useEffect(()=>{ opacityRef.current=opacity; },[opacity]);
  useEffect(()=>{ fontSizeRef.current=fontSize; },[fontSize]);

  // Reset canvas cursor when tool changes
  useEffect(()=>{
    const c=tool==="select"?"default":cursors[tool];
    prevCursorRef.current=c; setCanvasCursor(c);
  },[tool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Text overlay
  const [txt,setTxt]=useState({visible:false,cx:0,cy:0,left:0,top:0,scale:1,val:""});

  // Focus textarea when it appears (must be after txt declaration)
  useEffect(()=>{ if(txt.visible) setTimeout(()=>textareaRef.current?.focus(),0); },[txt.visible]);

  // Save modal
  const [modal,    setModal]    = useState({open:false,title:""});
  const [saving,   setSaving]   = useState(false);
  const [saveError,setSaveError]= useState("");

  // Colour picker popouts
  const [strokePicker,setStrokePicker]=useState<{x:number;y:number}|null>(null);
  const [bgPicker,    setBgPicker]    =useState<{x:number;y:number}|null>(null);

  // Canvas cursor
  const [canvasCursor, setCanvasCursor] = useState<string>("crosshair");
  const setCursor = (c: string) => { if(prevCursorRef.current!==c){ prevCursorRef.current=c; setCanvasCursor(c); } };

  // ── Load rough.js ──────────────────────────────────────────────────────────
  useEffect(()=>{
    if((window as WindowWithRough).rough){ roughLib.current=(window as WindowWithRough).rough??null; return; }
    const s=document.createElement("script");
    s.src="https://unpkg.com/roughjs@4.6.4/bundled/rough.js";
    s.onload=()=>{ roughLib.current=(window as WindowWithRough).rough??null; redraw(); };
    document.head.appendChild(s);
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redraw ─────────────────────────────────────────────────────────────────
  const redraw = useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d"); if(!ctx) return;
    ctx.clearRect(0,0,CW,CH); ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,CW,CH);
    const rc=roughLib.current?roughLib.current.canvas(canvas):null;
    const display=selLive.current
      ? elsRef.current.map(e=>e.id===selLive.current!.id?selLive.current!:e)
      : elsRef.current;
    [...display,...(live.current?[live.current]:[])].forEach(e=>drawEl(ctx,e,rc,imgs.current));
    if(selIdRef.current!==null){ const sel=display.find(e=>e.id===selIdRef.current); if(sel) drawSelection(ctx,sel); }
  },[]);

  useEffect(()=>{
    elsRef.current=els;
    els.forEach(el=>{ if(el.type==="image"&&!imgs.current.has(el.src)){ const img=new Image(); img.onload=()=>{imgs.current.set(el.src,img);redraw();}; img.src=el.src; } });
    redraw();
  },[els,redraw]);

  useEffect(()=>{ selIdRef.current=selId; redraw(); },[selId,redraw]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(()=>{
    const tmap:Record<string,Tool>={v:"select",p:"pencil",l:"line",a:"arrow",r:"rect",d:"diamond",e:"ellipse",t:"text",x:"eraser"};
    function onKey(ev:KeyboardEvent){
      if(ev.target instanceof HTMLInputElement||ev.target instanceof HTMLTextAreaElement) return;
      const k=ev.key.toLowerCase();
      if(tmap[k]){ setTool(tmap[k] as Tool); return; }
      if((ev.metaKey||ev.ctrlKey)&&ev.shiftKey&&k==="z"){ ev.preventDefault(); redo(); return; }
      if((ev.metaKey||ev.ctrlKey)&&!ev.shiftKey&&k==="z"){ ev.preventDefault(); undo(); return; }
      if((ev.key==="Backspace"||ev.key==="Delete")&&selIdRef.current!==null){
        const id=selIdRef.current; selIdRef.current=null; setSelId(null);
        setEls(prev=>{ setHistory(h=>[...h,prev]); setRedoStack([]); return prev.filter(e=>e.id!==id); });
      }
    }
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Patch selected element ──────────────────────────────────────────────────
  function patchSel(patch:Record<string,unknown>){
    if(selIdRef.current===null) return;
    setEls(prev=>prev.map(e=>e.id===selIdRef.current?{...e,...patch} as El:e));
  }

  // ── Layer order ─────────────────────────────────────────────────────────────
  function layerOrder(dir:"front"|"back"|"forward"|"backward"){
    if(selIdRef.current===null) return;
    const id=selIdRef.current;
    setEls(prev=>{
      const idx=prev.findIndex(e=>e.id===id); if(idx===-1) return prev;
      const next=[...prev]; const [el]=next.splice(idx,1);
      if(dir==="front") next.push(el);
      else if(dir==="back") next.unshift(el);
      else if(dir==="forward") next.splice(Math.min(idx+1,next.length),0,el);
      else next.splice(Math.max(idx-1,0),0,el);
      return next;
    });
  }

  // ── Text commit ─────────────────────────────────────────────────────────────
  const commitTxt=useCallback(()=>{
    if(committing.current) return; committing.current=true;
    setTxt(s=>{
      committing.current=false;
      if(!s.visible) return s;
      if(!s.val.trim()) return{...s,visible:false,val:""};
      const el:El={id:newId(),type:"text",x:s.cx,y:s.cy,text:s.val,color:colorRef.current,fs:fontSizeRef.current,sw:swRef.current,opacity:opacityRef.current};
      setEls(prev=>{setHistory(h=>[...h,prev]);setRedoStack([]);return[...prev,el];});
      return{...s,visible:false,val:""};
    });
  },[]);

  // ── Mouse down ─────────────────────────────────────────────────────────────
  function onDown(e:React.MouseEvent<HTMLCanvasElement>){
    const canvas=canvasRef.current!;
    const pt=cvtPos(canvas,e);

    if(tool==="select"){
      if(selIdRef.current!==null){
        const selEl=elsRef.current.find(el=>el.id===selIdRef.current);
        if(selEl){
          const bb=getBBox(selEl);
          const padBB={x:bb.x-SEL_PAD,y:bb.y-SEL_PAD,w:bb.w+SEL_PAD*2,h:bb.h+SEL_PAD*2};
          const handle=hitHandle(pt,padBB);
          if(handle){ selAction.current={mode:"resizing",handle,startPt:pt,origEl:selEl}; return; }
        }
      }
      const hit=[...elsRef.current].reverse().find(el=>hitEl(pt,el));
      if(hit){
        selIdRef.current=hit.id; setSelId(hit.id);
        setColor(hit.color); setSw(hit.sw); setOpacity(hit.opacity);
        if("roughness" in hit) setSloppiness(hit.roughness);
        if("dash"      in hit) setDash(hit.dash);
        if("fillStyle" in hit) setFillStyle(hit.fillStyle);
        if("fillColor" in hit) setFillColor(hit.fillColor);
        if("edges"     in hit) setEdgeStyle(hit.edges);
        if(hit.type==="arrow") setArrowCurve(hit.curve);
        if(hit.type==="text")  setFontSize(hit.fs);
        setCursor("move");
        selAction.current={mode:"moving",startPt:pt,origEl:hit};
      } else { selIdRef.current=null; setSelId(null); selAction.current=null; setCursor("default"); }
      return;
    }

    if(tool==="text"){
      const r=canvas.getBoundingClientRect();
      setTxt({visible:true,cx:pt.x,cy:pt.y,left:e.clientX-r.left,top:e.clientY-r.top,scale:r.width/CW,val:""});
      return;
    }

    isDrawing.current=true; origin.current=pt;
    if(tool==="pencil"||tool==="eraser"){
      live.current={id:newId(),type:"pencil",pts:[pt],color:tool==="eraser"?"#ffffff":color,sw:tool==="eraser"?Math.max(sw*6,40):sw,opacity};
    }
  }

  // ── Mouse move ──────────────────────────────────────────────────────────────
  function onMove(e:React.MouseEvent<HTMLCanvasElement>){
    const canvas=canvasRef.current!; const pt=cvtPos(canvas,e);

    if(tool==="select"&&selAction.current){
      const{mode,startPt,origEl,handle}=selAction.current;
      if(mode==="moving") selLive.current=moveEl(origEl,pt.x-startPt.x,pt.y-startPt.y);
      else if(mode==="resizing"&&handle) selLive.current=resizeEl(origEl,handle,pt);
      redraw(); return;
    }

    // Handle hover cursor for select tool
    if(tool==="select"&&!isDrawing.current){
      const HANDLE_CURSORS:Record<HandleId,string>={TL:"nw-resize",TR:"ne-resize",BL:"sw-resize",BR:"se-resize"};
      if(selIdRef.current!==null){
        const selEl=elsRef.current.find(el=>el.id===selIdRef.current);
        if(selEl){
          const bb=getBBox(selEl);
          const padBB={x:bb.x-SEL_PAD,y:bb.y-SEL_PAD,w:bb.w+SEL_PAD*2,h:bb.h+SEL_PAD*2};
          const handle=hitHandle(pt,padBB);
          setCursor(handle?HANDLE_CURSORS[handle]:hitEl(pt,selEl)?"move":"default");
        }
      } else { setCursor("default"); }
    }

    if(!isDrawing.current) return;
    const o=origin.current;

    if(tool==="pencil"||tool==="eraser"){
      const el=live.current as Extract<El,{type:"pencil"}>|null;
      if(el) live.current={...el,pts:[...el.pts,pt]};
    } else if(tool==="line"){
      live.current={id:newId(),type:"line",x1:o.x,y1:o.y,x2:pt.x,y2:pt.y,color,sw,opacity,roughness:sloppiness,dash};
    } else if(tool==="arrow"){
      live.current={id:newId(),type:"arrow",x1:o.x,y1:o.y,x2:pt.x,y2:pt.y,color,sw,opacity,roughness:sloppiness,dash,curve:arrowCurve};
    } else if(tool==="rect"){
      live.current={id:newId(),type:"rect",x:Math.min(o.x,pt.x),y:Math.min(o.y,pt.y),w:Math.abs(pt.x-o.x),h:Math.abs(pt.y-o.y),color,sw,opacity,roughness:sloppiness,dash,fillStyle,fillColor,edges:edgeStyle};
    } else if(tool==="diamond"){
      live.current={id:newId(),type:"diamond",x:Math.min(o.x,pt.x),y:Math.min(o.y,pt.y),w:Math.abs(pt.x-o.x),h:Math.abs(pt.y-o.y),color,sw,opacity,roughness:sloppiness,dash,fillStyle,fillColor,edges:edgeStyle};
    } else if(tool==="ellipse"){
      live.current={id:newId(),type:"ellipse",cx:(o.x+pt.x)/2,cy:(o.y+pt.y)/2,rx:Math.abs(pt.x-o.x)/2,ry:Math.abs(pt.y-o.y)/2,color,sw,opacity,roughness:sloppiness,dash,fillStyle,fillColor};
    }
    redraw();
  }

  // ── Mouse up ────────────────────────────────────────────────────────────────
  function onUp(){
    if(tool==="select"&&selAction.current&&selLive.current){
      const committed=selLive.current; selLive.current=null; selAction.current=null;
      setEls(prev=>{setHistory(h=>[...h,prev]);setRedoStack([]);return prev.map(e=>e.id===committed.id?committed:e);});
      setCursor("move");
      return;
    }
    selAction.current=null;
    if(!isDrawing.current) return;
    isDrawing.current=false;
    if(live.current){ const c=live.current; live.current=null; setEls(prev=>{setHistory(h=>[...h,prev]);setRedoStack([]);return[...prev,c];}); }
  }

  // ── Image helpers ───────────────────────────────────────────────────────────
  function placeImage(src:string,dropPx?:Pt){
    const img=new Image();
    img.onload=()=>{
      const maxW=CW*0.45,ratio=img.width>maxW?maxW/img.width:1;
      const w=img.width*ratio,h=img.height*ratio;
      const x=dropPx?dropPx.x-w/2:(CW-w)/2,y=dropPx?dropPx.y-h/2:(CH-h)/2;
      imgs.current.set(src,img);
      const el:El={id:newId(),type:"image",x,y,w,h,src,color:"#000000",sw:0,opacity:100};
      setEls(prev=>{setHistory(h=>[...h,prev]);return[...prev,el];});
    };
    img.src=src;
  }
  function onDrop(ev:React.DragEvent<HTMLDivElement>){
    ev.preventDefault();
    const file=Array.from(ev.dataTransfer.files).find(f=>f.type.startsWith("image/")); if(!file) return;
    const canvas=canvasRef.current!; const r=canvas.getBoundingClientRect();
    const dropPx={x:((ev.clientX-r.left)/r.width)*CW,y:((ev.clientY-r.top)/r.height)*CH};
    const reader=new FileReader(); reader.onload=ev2=>placeImage(ev2.target!.result as string,dropPx); reader.readAsDataURL(file);
  }
  function onImagePick(ev:React.ChangeEvent<HTMLInputElement>){
    const file=ev.target.files?.[0]; if(!file) return;
    const reader=new FileReader(); reader.onload=ev2=>placeImage(ev2.target!.result as string); reader.readAsDataURL(file); ev.target.value="";
  }

  // ── Undo / Redo / Clear ────────────────────────────────────────────────────
  function undo(){ setHistory(prev=>{ if(!prev.length) return prev; const next=[...prev]; const snap=next.pop()!; setRedoStack(r=>[...r,elsRef.current]); setEls(snap); return next; }); }
  function redo(){ setRedoStack(prev=>{ if(!prev.length) return prev; const next=[...prev]; const snap=next.pop()!; setHistory(h=>[...h,elsRef.current]); setEls(snap); return next; }); }
  function clearAll(){ setEls(prev=>{setHistory(h=>[...h,prev]);setRedoStack([]);return[];}); selIdRef.current=null; setSelId(null); }

  // ── Save & Export ──────────────────────────────────────────────────────────
  async function saveAndExport(title:string){
    const canvas=canvasRef.current; if(!canvas) return;
    setSaving(true); setSaveError("");
    try{
      const{PDFDocument}=await import("pdf-lib");
      const dataUrl=canvas.toDataURL("image/png");
      const pngBytes=Uint8Array.from(atob(dataUrl.split(",")[1]),c=>c.charCodeAt(0));
      const pdf=await PDFDocument.create();
      const pdfImg=await pdf.embedPng(pngBytes);
      const page=pdf.addPage([792,612]);
      page.drawImage(pdfImg,{x:0,y:0,width:792,height:612});
      const bytes=await pdf.save();

      const slug=(title.trim()||"untitled").replace(/\s+/g,"-");
      const fd=new FormData();
      fd.append("title",title.trim()||"Untitled");
      fd.append("zine_format",format);
      fd.append("pdf",new File([bytes],`${slug}.pdf`,{type:"application/pdf"}));
      const res=await fetch("/api/canvas/save",{method:"POST",body:fd});
      const json=await res.json() as{issueId?:string;slug?:string;error?:string};
      if(!res.ok||json.error) throw new Error(json.error??"Save failed");

      // Download locally
      const blob=new Blob([bytes],{type:"application/pdf"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${slug}.pdf`; a.click();

      // Success: close modal, clear, navigate
      setModal({open:false,title:""});
      clearAll();
      window.location.href="/dashboard/library";
    } catch(err){
      setSaveError(err instanceof Error?err.message:"Something went wrong.");
    } finally{ setSaving(false); }
  }

  // ── Sidebar visibility logic ────────────────────────────────────────────────
  const selEl=selId!==null?els.find(e=>e.id===selId):null;
  const selType=selEl?.type;
  const FILL_TYPES=["rect","ellipse","diamond"] as const;
  const ROUGH_TYPES=["line","arrow","rect","diamond","ellipse"] as const;
  const showFill  = (FILL_TYPES as readonly string[]).includes(tool)||(selType!==undefined&&(FILL_TYPES as readonly string[]).includes(selType));
  const showRough = (ROUGH_TYPES as readonly string[]).includes(tool)||(selType!==undefined&&(ROUGH_TYPES as readonly string[]).includes(selType));
  const showArrowType = tool==="arrow"||selType==="arrow";
  const showEdges = tool==="rect"||tool==="diamond"||selType==="rect"||selType==="diamond";
  const showText  = tool==="text"||selType==="text";
  const showLayers= selId!==null;

  const cursors:Record<Tool,string>={select:"default",pencil:"crosshair",eraser:"crosshair",line:"crosshair",arrow:"crosshair",rect:"crosshair",diamond:"crosshair",ellipse:"crosshair",text:"text"};

  // ─────────────────────────────────────────────────────────────────────────
  return(
    <div className="flex flex-col gap-3">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-0.5 flex-wrap">
          {TOOLS.map(t=>(
            <button key={t.id} type="button" title={`${t.label} (${t.key})`} onClick={()=>setTool(t.id)}
              className={clsx("flex h-8 w-8 items-center justify-center rounded-lg transition",
                tool===t.id?"bg-[#65CBF1] text-white":"text-gray-600 hover:bg-gray-100")}>
              {t.icon}
            </button>
          ))}
          <button type="button" title="Insert image" onClick={()=>fileInputRef.current?.click()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
              <rect x="2" y="4" width="16" height="12" rx="1.5"/><circle cx="7" cy="8.5" r="1.5"/>
              <path d="M2 14l4.5-4.5 3 3 2.5-2.5L18 14" strokeLinejoin="round"/>
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImagePick}/>
        </div>
        <div className="h-5 w-px bg-gray-200"/>
        <button type="button" title="Undo (⌘Z)" onClick={undo} disabled={!history.length}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:opacity-30">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16">
            <path d="M4.5 8H12a5 5 0 010 10H6.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7.5 5L4.5 8l3 3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button type="button" title="Redo (⌘⇧Z)" onClick={redo} disabled={!redoStack.length}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:opacity-30">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16">
            <path d="M15.5 8H8a5 5 0 000 10h5.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.5 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button type="button" onClick={clearAll}
          className="flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600">
          Clear
        </button>
        <button type="button" onClick={()=>{setModal({open:true,title:""});setSaveError("");}}
          className="ml-auto flex h-8 items-center rounded-lg bg-gray-900 px-4 text-xs font-semibold text-white transition hover:bg-gray-700">
          Save &amp; Export
        </button>
      </div>

      {/* ── Sidebar + Canvas ── */}
      <div className="flex items-start gap-3">

        {/* ─ Sidebar ─ */}
        <div ref={sidebarRef} className="w-44 flex-shrink-0 space-y-3.5 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">

          {/* Stroke */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Stroke</p>
              <button type="button"
                onClick={e=>{const s=sidebarRef.current!.getBoundingClientRect();setStrokePicker({x:s.right+4,y:e.clientY-10});setBgPicker(null);}}
                className="flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-mono text-gray-500 hover:bg-gray-100">
                <span className="h-3 w-3 rounded-sm border border-gray-300" style={{backgroundColor:color}}/>
                {color}
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {STROKE_PALETTE.map(c=>(
                <button key={c} type="button" title={c}
                  onClick={()=>{setColor(c);patchSel({color:c});setStrokePicker(null);}}
                  className={clsx("h-5 w-5 rounded-full border transition hover:scale-110",
                    color===c?"ring-2 ring-[#65CBF1] ring-offset-1":"border-transparent")}
                  style={{backgroundColor:c}}/>
              ))}
            </div>
          </div>

          {/* Background / fill colour */}
          {showFill&&(
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Background</p>
                <button type="button"
                  onClick={e=>{const s=sidebarRef.current!.getBoundingClientRect();setBgPicker({x:s.right+4,y:e.clientY-10});setStrokePicker(null);}}
                  className="flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-mono text-gray-500 hover:bg-gray-100">
                  <span className="h-3 w-3 rounded-sm border border-gray-300" style={{backgroundColor:fillColor}}/>
                  {fillColor.slice(0,7)}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {BG_PALETTE.map(c=>(
                  <button key={c} type="button" title={c}
                    onClick={()=>{setFillColor(c);patchSel({fillColor:c});setBgPicker(null);}}
                    className={clsx("h-5 w-5 rounded border transition hover:scale-110",
                      c==="none"?"border-gray-300":"border-transparent",
                      fillColor===c?"ring-2 ring-[#65CBF1] ring-offset-1":"")}
                    style={{backgroundColor:c}}/>
                ))}
              </div>
            </div>
          )}

          {/* Fill style */}
          {showFill&&(
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Fill</p>
              <div className="grid grid-cols-4 gap-1">
                {([
                  {v:"none",     icon:<svg viewBox="0 0 14 14" width="11" height="11"><rect x="1" y="1" width="12" height="12" rx="1" stroke="#374151" strokeWidth="1.5" fill="none"/><line x1="1" y1="13" x2="13" y2="1" stroke="#e03131" strokeWidth="1"/></svg>},
                  {v:"hachure",  icon:<svg viewBox="0 0 14 14" width="11" height="11"><rect x="1" y="1" width="12" height="12" rx="1" stroke="#374151" strokeWidth="1.5" fill="none"/>{[4,7,10,13].map(x=><line key={x} x1={x-5} y1="13" x2={x} y2="1" stroke="#374151" strokeWidth="1"/>)}</svg>},
                  {v:"cross-hatch",icon:<svg viewBox="0 0 14 14" width="11" height="11"><rect x="1" y="1" width="12" height="12" rx="1" stroke="#374151" strokeWidth="1.5" fill="none"/>{[4,8,12].map(x=><line key={`h${x}`} x1={x-5} y1="13" x2={x} y2="1" stroke="#374151" strokeWidth="0.8"/>)}{[4,8,12].map(x=><line key={`v${x}`} x1="1" y1={x-2} x2="13" y2={x+2} stroke="#374151" strokeWidth="0.8"/>)}</svg>},
                  {v:"solid",    icon:<svg viewBox="0 0 14 14" width="11" height="11"><rect x="1" y="1" width="12" height="12" rx="1" stroke="#374151" strokeWidth="1.5" fill="#374151"/></svg>},
                ] as {v:FillStyle;icon:React.ReactNode}[]).map(({v,icon})=>(
                  <button key={v} type="button" title={v}
                    onClick={()=>{setFillStyle(v);patchSel({fillStyle:v});}}
                    className={clsx("flex h-7 items-center justify-center rounded border transition",
                      fillStyle===v?"border-[#65CBF1] bg-[#e8f8fd]":"border-gray-200 hover:border-gray-300")}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stroke width */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Stroke width</p>
            <div className="flex gap-1">
              {[{v:2,dot:4},{v:5,dot:6},{v:10,dot:9}].map(s=>(
                <button key={s.v} type="button" title={`${s.v}px`}
                  onClick={()=>{setSw(s.v);patchSel({sw:s.v});}}
                  className={clsx("flex h-7 flex-1 items-center justify-center rounded border transition",
                    sw===s.v?"border-[#65CBF1] bg-[#e8f8fd]":"border-gray-200 hover:border-gray-300")}>
                  <span className="rounded-full bg-gray-700" style={{width:s.dot,height:s.dot}}/>
                </button>
              ))}
            </div>
          </div>

          {/* Stroke style */}
          {showRough&&(
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Stroke style</p>
              <div className="flex gap-1">
                {(["solid","dashed","dotted"] as StrokeDash[]).map(d=>(
                  <button key={d} type="button" title={d}
                    onClick={()=>{setDash(d);patchSel({dash:d});}}
                    className={clsx("flex h-7 flex-1 items-center justify-center rounded border transition",
                      dash===d?"border-[#65CBF1] bg-[#e8f8fd]":"border-gray-200 hover:border-gray-300")}>
                    <svg viewBox="0 0 20 4" width="16" height="4">
                      <line x1="0" y1="2" x2="20" y2="2" stroke="#374151" strokeWidth="1.5"
                        strokeDasharray={d==="solid"?undefined:d==="dashed"?"5,3":"1.5,3"} strokeLinecap="round"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sloppiness (formerly roughness) */}
          {showRough&&(
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Sloppiness</p>
              <div className="flex gap-1">
                {[{v:0,label:"A"},{v:1.2,label:"~"},{v:2.8,label:"≋"}].map(r=>(
                  <button key={r.v} type="button" title={r.label}
                    onClick={()=>{setSloppiness(r.v);patchSel({roughness:r.v});}}
                    className={clsx("flex h-7 flex-1 items-center justify-center rounded border font-mono text-xs transition",
                      sloppiness===r.v?"border-[#65CBF1] bg-[#e8f8fd]":"border-gray-200 hover:border-gray-300")}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Arrow type */}
          {showArrowType&&(
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Arrow type</p>
              <div className="flex gap-1">
                {([
                  {v:"straight",icon:(
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                      <path d="M3 13L13 3" strokeLinecap="round"/>
                      <path d="M13 3h-5M13 3v5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )},
                  {v:"curved",icon:(
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                      <path d="M3 13 Q3 3 13 3" strokeLinecap="round"/>
                      <path d="M13 3h-5M13 3v5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )},
                  {v:"elbow",icon:(
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                      <path d="M3 13L13 13L13 3" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M13 3h-5M13 3v5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )},
                ] as {v:ArrowCurve;icon:React.ReactNode}[]).map(({v,icon})=>(
                  <button key={v} type="button" title={v}
                    onClick={()=>{setArrowCurve(v);patchSel({curve:v});}}
                    className={clsx("flex h-7 flex-1 items-center justify-center rounded border transition",
                      arrowCurve===v?"border-[#65CBF1] bg-[#e8f8fd]":"border-gray-200 hover:border-gray-300")}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Edges (rect only) */}
          {showEdges&&(
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Edges</p>
              <div className="flex gap-1">
                {([
                  {v:"sharp",icon:<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="10" height="10"/></svg>},
                  {v:"round",icon:<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="10" height="10" rx="3"/></svg>},
                ] as {v:EdgeStyle;icon:React.ReactNode}[]).map(({v,icon})=>(
                  <button key={v} type="button" title={v}
                    onClick={()=>{setEdgeStyle(v);patchSel({edges:v});}}
                    className={clsx("flex h-7 flex-1 items-center justify-center rounded border transition",
                      edgeStyle===v?"border-[#65CBF1] bg-[#e8f8fd]":"border-gray-200 hover:border-gray-300")}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Font size (text tool only) */}
          {showText&&(
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Font size</p>
              <div className="flex gap-1">
                {[{v:36,label:"S"},{v:72,label:"M"},{v:108,label:"L"},{v:144,label:"XL"}].map(s=>(
                  <button key={s.v} type="button" title={`${s.v}px`}
                    onClick={()=>{setFontSize(s.v);patchSel({fs:s.v});}}
                    className={clsx("flex h-7 flex-1 items-center justify-center rounded border font-medium text-xs transition",
                      fontSize===s.v?"border-[#65CBF1] bg-[#e8f8fd]":"border-gray-200 hover:border-gray-300")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opacity */}
          <div>
            <p className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              <span>Opacity</span><span className="font-normal normal-case tabular-nums">{opacity}%</span>
            </p>
            <input type="range" min={10} max={100} step={5} value={opacity}
              onChange={e=>{const v=Number(e.target.value);setOpacity(v);patchSel({opacity:v});}}
              className="w-full accent-[#65CBF1]"/>
          </div>

          {/* Layers */}
          {showLayers&&(
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Layers</p>
              <div className="grid grid-cols-2 gap-1">
                {([
                  {dir:"back",    label:"To back"},
                  {dir:"backward",label:"Backward"},
                  {dir:"forward", label:"Forward"},
                  {dir:"front",   label:"To front"},
                ] as {dir:"front"|"back"|"forward"|"backward";label:string}[]).map(({dir,label})=>(
                  <button key={dir} type="button" title={label}
                    onClick={()=>layerOrder(dir)}
                    className="flex h-7 items-center justify-center rounded border border-gray-200 px-1 text-[10px] font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delete selected */}
          {showLayers&&(
            <button type="button"
              onClick={()=>{ const id=selIdRef.current; if(!id) return; selIdRef.current=null; setSelId(null); setEls(prev=>{setHistory(h=>[...h,prev]);setRedoStack([]);return prev.filter(e=>e.id!==id);}); }}
              className="w-full rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100">
              Delete selected
            </button>
          )}
        </div>

        {/* ─ Canvas ─ */}
        <div className="min-w-0 flex-1">
          <div ref={containerRef} className="relative rounded-sm shadow-[0_4px_28px_rgba(0,0,0,0.12)]"
            onDrop={onDrop} onDragOver={ev=>ev.preventDefault()}>
            <canvas ref={canvasRef} width={CW} height={CH}
              style={{cursor:canvasCursor,width:"100%",height:"auto",display:"block"}}
              className="rounded-sm"
              onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}/>
            {txt.visible&&(
              <textarea ref={textareaRef} autoFocus rows={1} value={txt.val}
                onChange={ev=>{ev.target.style.height="auto";ev.target.style.height=ev.target.scrollHeight+"px";setTxt(s=>({...s,val:ev.target.value}));}}
                onKeyDown={ev=>{
                  if(ev.key==="Escape"){ ev.preventDefault(); commitTxt(); }
                  if((ev.metaKey||ev.ctrlKey)&&ev.key==="Enter"){ ev.preventDefault(); commitTxt(); }
                }}
                onBlur={commitTxt}
                style={{position:"absolute",left:txt.left,top:txt.top,fontSize:`${Math.round(fontSize*txt.scale)}px`,fontFamily:"sans-serif",lineHeight:1.2,color,background:"rgba(255,255,255,0.92)",border:"2px solid #65CBF1",borderRadius:4,outline:"none",padding:"3px 8px",minWidth:80,resize:"none",overflow:"hidden",zIndex:10,boxShadow:"0 0 0 3px rgba(101,203,241,0.25)"}}/>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            V·P·L·A·R·D·E·T·X — shortcuts &nbsp;·&nbsp; ⌘Z undo &nbsp;·&nbsp; ⌘⇧Z redo &nbsp;·&nbsp; Del removes selected &nbsp;·&nbsp; drag images onto canvas
          </p>
        </div>
      </div>

      {/* ── Colour picker popouts ── */}
      {strokePicker&&(
        <ColorPickerPopout anchor={strokePicker} value={color}
          onChange={c=>{setColor(c);patchSel({color:c});}} onClose={()=>setStrokePicker(null)}/>
      )}
      {bgPicker&&(
        <ColorPickerPopout anchor={bgPicker} value={fillColor}
          onChange={c=>{setFillColor(c);patchSel({fillColor:c});}} onClose={()=>setBgPicker(null)}/>
      )}

      {/* ── Save & Export modal ── */}
      {modal.open&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">Save &amp; Export</h3>
            <p className="mb-4 text-sm text-gray-500">Give your zine a title — it will be saved to your library and downloaded as a PDF.</p>
            <input autoFocus value={modal.title}
              onChange={ev=>setModal(s=>({...s,title:ev.target.value}))}
              onKeyDown={ev=>{if(ev.key==="Enter"&&!saving&&modal.title.trim()) saveAndExport(modal.title);}}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#65CBF1] focus:ring-2 focus:ring-[#65CBF1]/30"
              placeholder="My zine title" disabled={saving}/>
            {saveError&&(
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={()=>setModal(s=>({...s,open:false}))} disabled={saving}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button type="button" onClick={()=>saveAndExport(modal.title)}
                disabled={saving||!modal.title.trim()}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
                {saving&&<svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>}
                {saving?"Saving…":"Save & Export PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
