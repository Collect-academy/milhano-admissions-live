import type { Metadata } from "next";
import OpenHouseCheckin from "@/components/open-house-checkin";
export const metadata: Metadata = {title:"Registro de asistencia | Milhano Open House",robots:{index:false,follow:false}};
export default function CheckinPage(){return <OpenHouseCheckin/>;}
