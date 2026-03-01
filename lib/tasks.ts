export type Frequency = "daily" | "weekly" | "monthly";
export type Zone =
  | "kitchen"
  | "bathroom"
  | "floors"
  | "living"
  | "bedrooms"
  | "laundry"
  | "entry"
  | "general";

export type Task = {
  id: string;
  title: string;
  zone: Zone;
  frequency: Frequency;
  baseMinutes: number;       // baseline effort
  chaosImpact: number;       // 1–10 (higher = reduces chaos more)
  fatigueCost: number;       // 1–10 (higher = more burnout)
  petBoost?: number;         // additional chaosImpact if pets=true
  tags?: string[];           // later: "hardwood","carpet","tile"
  mustDo?: boolean;          // stabilizers
  requiresPets?: boolean;
};

export const TASKS: Task[] = [
  // DAILY STABILIZERS (must-do)
  { id: "d_counter", title: "Kitchen counter reset", zone: "kitchen", frequency: "daily", baseMinutes: 2, chaosImpact: 9, fatigueCost: 1, mustDo: true },
  { id: "d_dishes", title: "Dishes + sink wipe", zone: "kitchen", frequency: "daily", baseMinutes: 6, chaosImpact: 10, fatigueCost: 2, mustDo: true },
  { id: "d_trash", title: "Trash check (take out if needed)", zone: "general", frequency: "daily", baseMinutes: 2, chaosImpact: 7, fatigueCost: 1, mustDo: true },
  { id: "d_floor_spot", title: "Quick floor spot-pickup (main area)", zone: "floors", frequency: "daily", baseMinutes: 3, chaosImpact: 8, fatigueCost: 2, mustDo: true },

  // WEEKLY
  { id: "w_vac_main", title: "Vacuum high-traffic areas", zone: "floors", frequency: "weekly", baseMinutes: 15, chaosImpact: 9, fatigueCost: 4, petBoost: 2 },
  { id: "w_mop_main", title: "Mop hard floors (main areas)", zone: "floors", frequency: "weekly", baseMinutes: 18, chaosImpact: 8, fatigueCost: 5 },
  { id: "w_bath_reset", title: "Bathroom reset (sink, toilet, mirror)", zone: "bathroom", frequency: "weekly", baseMinutes: 20, chaosImpact: 10, fatigueCost: 5 },
  { id: "w_laundry_catch", title: "Laundry catch-up (wash + fold a load)", zone: "laundry", frequency: "weekly", baseMinutes: 25, chaosImpact: 8, fatigueCost: 6 },
  { id: "w_bedding", title: "Change bedding (main bed)", zone: "bedrooms", frequency: "weekly", baseMinutes: 15, chaosImpact: 7, fatigueCost: 5 },

  // PET-RELATED WEEKLY
  { id: "w_pet_bedding", title: "Wash pet bedding/blankets", zone: "living", frequency: "weekly", baseMinutes: 20, chaosImpact: 6, fatigueCost: 5, petBoost: 3, requiresPets: true },
{ id: "w_lint_roll", title: "Lint-roll couch/chairs (pet zones)", zone: "living", frequency: "weekly", baseMinutes: 8, chaosImpact: 6, fatigueCost: 2, petBoost: 3, requiresPets: true },

  // MONTHLY (light set for now)
  { id: "m_baseboards", title: "Wipe baseboards (main rooms)", zone: "general", frequency: "monthly", baseMinutes: 30, chaosImpact: 6, fatigueCost: 7 },
  { id: "m_fridge", title: "Fridge shelf wipe + toss old items", zone: "kitchen", frequency: "monthly", baseMinutes: 25, chaosImpact: 7, fatigueCost: 6 },
];