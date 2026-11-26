import type {Metadata} from "next";
import TrialBooking from "@/components/open-house-trial-booking";
export const metadata:Metadata={title:"Agenda tu pasadía | Milhano International School",robots:{index:false,follow:false}};
export default function Page(){return <TrialBooking/>;}
