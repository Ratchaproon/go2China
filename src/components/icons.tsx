import {
  BedDouble, Coffee, Earth, GraduationCap, Hotel, House, Landmark, LayoutGrid, type LucideIcon,
  ShieldAlert, ShoppingCart, Smartphone, Stamp, Stethoscope, TrainFront, UtensilsCrossed,
} from "lucide-react";
import type { Topic } from "@/lib/guide";
import type { PlaceCategory } from "@/lib/places";

// Single place for icon choices so topics and categories look the same everywhere.

export const TOPIC_ICON: Record<Topic, LucideIcon> = {
  paperwork: Stamp, phone: Smartphone, banking: Landmark, housing: House, health: Stethoscope,
  transport: TrainFront, apps: LayoutGrid, safety: ShieldAlert, academics: GraduationCap, daily: Earth,
};

export const PLACE_ICON: Record<PlaceCategory, LucideIcon> = {
  food: UtensilsCrossed, cafe: Coffee, grocery: ShoppingCart, hotel: Hotel, hostel: BedDouble,
};

/** Inline icon sized to sit on a line of text. */
export function Ic({ icon: Icon, className = "" }: { icon: LucideIcon; className?: string }) {
  return <Icon aria-hidden className={`inline-block h-[1.1em] w-[1.1em] shrink-0 align-[-0.18em] ${className}`} strokeWidth={2} />;
}
