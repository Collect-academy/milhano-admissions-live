"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {isOpenHouseRefreshWindow,openHouseWindowBoundary} from "@/lib/open-house-refresh";
type Connection="off"|"connecting"|"live"|"manual";
export function useOpenHouseEventRefresh(refresh:()=>Promise<boolean>,blocked:boolean){
 const [connection,setConnection]=useState<Connection>("off");
 const pending=useRef(false),last=useRef(0),running=useRef(false),blockedRef=useRef(blocked),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const drain=useCallback(function schedule(){
  if(timer.current!==undefined||running.current||blockedRef.current||!pending.current||!isOpenHouseRefreshWindow(Date.now())||document.visibilityState!=="visible")return;
  timer.current=setTimeout(async()=>{
   timer.current=undefined;
   if(running.current||blockedRef.current||!pending.current||!isOpenHouseRefreshWindow(Date.now())||document.visibilityState!=="visible")return;
   pending.current=false;running.current=true;last.current=Date.now();
   let ok=false;
   try{ok=await refresh();}finally{running.current=false;if(!ok){pending.current=true;}else schedule();}
  },Math.max(1200,5000-(Date.now()-last.current)));
 },[refresh]);
 const request=useCallback(()=>{
  if(!isOpenHouseRefreshWindow(Date.now()))return;
  pending.current=true;drain();
 },[drain]);
 useEffect(()=>{blockedRef.current=blocked;if(!blocked)drain();},[blocked,drain]);
 useEffect(()=>{
  let disposed=false,active=false,seen:string|null=null,probing=false;
  let boundary:ReturnType<typeof setTimeout>|undefined,probeTimer:ReturnType<typeof setTimeout>|undefined;
  let controller:AbortController|undefined;
  const eligible=()=>!disposed&&isOpenHouseRefreshWindow(Date.now())&&document.visibilityState==="visible";
  function stop(){
   active=false;seen=null;
   if(probeTimer!==undefined){clearTimeout(probeTimer);probeTimer=undefined;}
   controller?.abort();controller=undefined;
   if(timer.current!==undefined){clearTimeout(timer.current);timer.current=undefined;}
  }
  function nextProbe(){if(eligible()&&active&&probeTimer===undefined)probeTimer=setTimeout(()=>{probeTimer=undefined;void probe();},30000);}
  async function probe(){
   if(!eligible()||!active)return;
   if(probing||blockedRef.current){nextProbe();return;}
   probing=true;const own=new AbortController();controller=own;
   const timeout=setTimeout(()=>own.abort(),8000);
   try{
    const r=await fetch("/api/open-house/staff?revision=1",{cache:"no-store",signal:own.signal});
    const data=await r.json();
    if(!r.ok||typeof data.revision!=="string")throw new Error("Revision unavailable");
    if(!eligible()||!active||own.signal.aborted)return;
    setConnection("live");
    if(seen!==data.revision){seen=data.revision;request();}
    else if(pending.current)drain();
   }catch{if(eligible()&&active&&!own.signal.aborted)setConnection("manual");}
   finally{clearTimeout(timeout);probing=false;if(controller===own)controller=undefined;nextProbe();}
  }
  function reconcile(){
   if(disposed)return;
   if(boundary!==undefined)clearTimeout(boundary);
   const now=Date.now(),next=openHouseWindowBoundary(now);
   if(next!==null)boundary=setTimeout(reconcile,Math.min(Math.max(1,next-now),2147483647));
   if(!eligible()){stop();setConnection("off");if(!isOpenHouseRefreshWindow(now))pending.current=false;return;}
   if(!active){active=true;setConnection("connecting");void probe();}
   else drain();
  }
  document.addEventListener("visibilitychange",reconcile);reconcile();
  return()=>{disposed=true;stop();document.removeEventListener("visibilitychange",reconcile);if(boundary!==undefined)clearTimeout(boundary);};
 },[request,drain]);
 return {connection,request};
}
