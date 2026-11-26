"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import {isOpenHouseRefreshWindow,openHouseWindowBoundary} from "@/lib/open-house-refresh";
type Connection="off"|"connecting"|"live"|"manual";
const topic="milhano:openhouse:2026-11-27:changes";
export function useOpenHouseEventRefresh(refresh:()=>Promise<boolean>,blocked:boolean){
 const [connection,setConnection]=useState<Connection>("off");
 const pending=useRef(false),last=useRef(0),running=useRef(false),blockedRef=useRef(blocked),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const drain=useCallback(function schedule(){
  if(timer.current!==undefined||running.current||blockedRef.current||!pending.current||!isOpenHouseRefreshWindow(Date.now())||document.visibilityState!=="visible")return;
  timer.current=setTimeout(async()=>{
   timer.current=undefined;
   if(running.current||blockedRef.current||!pending.current||!isOpenHouseRefreshWindow(Date.now())||document.visibilityState!=="visible")return;
   pending.current=false;running.current=true;last.current=Date.now();
   try{await refresh();}finally{running.current=false;schedule();}
  },Math.max(1200,5000-(Date.now()-last.current)));
 },[refresh]);
 const request=useCallback(()=>{
  if(!isOpenHouseRefreshWindow(Date.now()))return;
  pending.current=true;drain();
 },[drain]);
 useEffect(()=>{blockedRef.current=blocked;if(!blocked)drain();},[blocked,drain]);
 useEffect(()=>{
  let disposed=false,generation=0,boundary:ReturnType<typeof setTimeout>|undefined;
  let client:ReturnType<typeof createSupabaseBrowserClient>|undefined;
  let channel:ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]>|undefined;
  function stop(){
   generation++;
   if(channel&&client)void client.removeChannel(channel).catch(()=>{});
   channel=undefined;
  }
  function reconcile(){
   if(disposed)return;
   if(boundary!==undefined)clearTimeout(boundary);
   const now=Date.now(),next=openHouseWindowBoundary(now);
   if(next!==null)boundary=setTimeout(reconcile,Math.min(Math.max(1,next-now),2147483647));
   if(!isOpenHouseRefreshWindow(now)||document.visibilityState!=="visible"){
    stop();setConnection("off");
    if(timer.current!==undefined){clearTimeout(timer.current);timer.current=undefined;}
    if(!isOpenHouseRefreshWindow(now))pending.current=false;
    return;
   }
   if(channel){drain();return;}
   setConnection("connecting");
   const id=++generation;
   try{
    client??=createSupabaseBrowserClient();
    const active=client;
    const ch=active.channel(topic,{config:{private:true}});
    channel=ch;
    ch.on("broadcast",{event:"changed"},()=>{if(!disposed&&id===generation)request();});
    void active.realtime.setAuth().then(()=>{
     if(disposed||id!==generation)return;
     ch.subscribe(status=>{
      if(disposed||id!==generation)return;
      if(status==="SUBSCRIBED"){setConnection("live");request();}
      else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")setConnection("manual");
     });
    }).catch(()=>{if(!disposed&&id===generation)setConnection("manual");});
   }catch{setConnection("manual");}
   drain();
  }
  document.addEventListener("visibilitychange",reconcile);
  reconcile();
  return()=>{disposed=true;stop();document.removeEventListener("visibilitychange",reconcile);if(boundary!==undefined)clearTimeout(boundary);if(timer.current!==undefined){clearTimeout(timer.current);timer.current=undefined;}};
 },[request,drain]);
 return {connection,request};
}
