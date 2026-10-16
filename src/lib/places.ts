import { type CurrencyCode, getCountry, roundTo } from "./countries";

// "Places near campus": budget-aware food, café, grocery and short-stay
// suggestions. Ratings, reviews and places are DEMO DATA generated
// deterministically per destination; map links point at the generated
// coordinates. Swap generatePlaces() for a real places API later.

export type PlaceCategory = "food" | "cafe" | "grocery" | "hotel" | "hostel";
export const PLACE_CATEGORIES: PlaceCategory[] = ["food", "cafe", "grocery", "hotel", "hostel"];

export interface Review {
  stars: number;
  text: string;
  author: string;
}

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  cuisine?: string;
  lat: number;
  lng: number;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  /** Typical spend per person per meal, or per night for hotels/hostels, in local currency. */
  price: number;
  currency: CurrencyCode;
  priceLevel: 1 | 2 | 3 | 4;
  studentDiscount: boolean;
  reviews: Review[];
}

interface Campus {
  name: string;
  lat: number;
  lng: number;
}

/** Default campus area per destination, used for the demo map. */
const CAMPUS: Record<string, Campus> = {
  CN: { name: "Haidian university district, Beijing", lat: 39.9997, lng: 116.3264 },
  JP: { name: "Hongo campus area, Tokyo", lat: 35.7126, lng: 139.762 },
  KR: { name: "Sinchon university area, Seoul", lat: 37.5596, lng: 126.937 },
  SG: { name: "Kent Ridge, Singapore", lat: 1.2966, lng: 103.7764 },
  MY: { name: "Pantai Dalam, Kuala Lumpur", lat: 3.1209, lng: 101.6538 },
  TH: { name: "Pathum Wan, Bangkok", lat: 13.7384, lng: 100.532 },
  GB: { name: "Bloomsbury, London", lat: 51.5246, lng: -0.134 },
  US: { name: "Cambridge, Massachusetts", lat: 42.3601, lng: -71.0942 },
  AU: { name: "Camperdown, Sydney", lat: -33.8888, lng: 151.1872 },
  DE: { name: "Mitte, Berlin", lat: 52.518, lng: 13.3936 },
};

interface Template {
  name: string;
  cuisine?: string;
  /** Price as a multiple of the destination's "typical cheap meal". */
  priceX: number;
}

/** Cheap student meal per destination, local currency. Everything else scales from it. */
const CHEAP_MEAL: Record<string, number> = {
  CN: 18, JP: 700, KR: 8000, SG: 6, MY: 10, TH: 60, GB: 8, US: 13, AU: 15, DE: 8,
};

const FOOD: Record<string, Template[]> = {
  CN: [
    { name: "Lanzhou Beef Noodle Bar", cuisine: "Noodles", priceX: 1 },
    { name: "Campus Canteen No. 3", cuisine: "Canteen", priceX: 0.6 },
    { name: "Jianbing Morning Stall", cuisine: "Street food", priceX: 0.4 },
    { name: "Sichuan Spice Kitchen", cuisine: "Sichuan", priceX: 2.5 },
    { name: "Little Sheep Hotpot", cuisine: "Hotpot", priceX: 5 },
    { name: "Xinjiang Lamb Skewers", cuisine: "Xinjiang", priceX: 2 },
  ],
  JP: [
    { name: "Ramen Ichiban", cuisine: "Ramen", priceX: 1.3 },
    { name: "Gyudon Corner", cuisine: "Rice bowls", priceX: 0.8 },
    { name: "University Co-op Cafeteria", cuisine: "Canteen", priceX: 0.7 },
    { name: "Izakaya Hanabi", cuisine: "Izakaya", priceX: 4 },
    { name: "Curry House Hongo", cuisine: "Curry", priceX: 1.2 },
    { name: "Onigiri Kitchen", cuisine: "Onigiri", priceX: 0.5 },
  ],
  KR: [
    { name: "Kimbap Heaven Sinchon", cuisine: "Snack bar", priceX: 0.8 },
    { name: "Student Union Cafeteria", cuisine: "Canteen", priceX: 0.6 },
    { name: "Dakgalbi Alley", cuisine: "Korean BBQ", priceX: 2 },
    { name: "Gukbap House", cuisine: "Soup", priceX: 1.1 },
    { name: "Samgyeopsal Corner", cuisine: "Korean BBQ", priceX: 2.6 },
    { name: "Tteokbokki Stand", cuisine: "Street food", priceX: 0.5 },
  ],
  SG: [
    { name: "Clementi Hawker Centre", cuisine: "Hawker", priceX: 0.9 },
    { name: "Campus Food Court", cuisine: "Food court", priceX: 0.8 },
    { name: "Chicken Rice Stall", cuisine: "Chicken rice", priceX: 0.8 },
    { name: "Laksa Corner", cuisine: "Laksa", priceX: 1 },
    { name: "Dim Sum Garden", cuisine: "Dim sum", priceX: 3 },
    { name: "Prata House", cuisine: "Indian", priceX: 0.7 },
  ],
  MY: [
    { name: "Mamak Corner 24h", cuisine: "Mamak", priceX: 0.8 },
    { name: "Nasi Lemak Express", cuisine: "Malay", priceX: 0.7 },
    { name: "Faculty Cafeteria", cuisine: "Canteen", priceX: 0.6 },
    { name: "Char Kway Teow Stall", cuisine: "Street food", priceX: 1 },
    { name: "Banana Leaf House", cuisine: "Indian", priceX: 1.6 },
    { name: "Steamboat Village", cuisine: "Steamboat", priceX: 4 },
  ],
  TH: [
    { name: "Chula Canteen", cuisine: "Canteen", priceX: 0.8 },
    { name: "Boat Noodle Corner", cuisine: "Noodles", priceX: 0.7 },
    { name: "Khao Man Gai Stall", cuisine: "Street food", priceX: 0.8 },
    { name: "Som Tam Isan Kitchen", cuisine: "Isan", priceX: 1.3 },
    { name: "Mookata Night Grill", cuisine: "Grill", priceX: 4 },
    { name: "Jok Morning Shop", cuisine: "Congee", priceX: 0.7 },
  ],
  GB: [
    { name: "Student Union Kitchen", cuisine: "Canteen", priceX: 0.8 },
    { name: "Bloomsbury Noodle Bar", cuisine: "Asian", priceX: 1.4 },
    { name: "Market Falafel", cuisine: "Street food", priceX: 0.9 },
    { name: "The Corner Pub", cuisine: "Pub", priceX: 2.2 },
    { name: "Curry Mile Express", cuisine: "Indian", priceX: 1.6 },
    { name: "Meal Deal Express", cuisine: "Quick bites", priceX: 0.5 },
  ],
  US: [
    { name: "Dining Hall Commons", cuisine: "Canteen", priceX: 1 },
    { name: "Burrito Bros", cuisine: "Mexican", priceX: 1 },
    { name: "Slice Pizza Co.", cuisine: "Pizza", priceX: 0.6 },
    { name: "Pho Saigon", cuisine: "Vietnamese", priceX: 1.3 },
    { name: "Campus Diner", cuisine: "American", priceX: 1.6 },
    { name: "Ramen Lab", cuisine: "Ramen", priceX: 1.5 },
  ],
  AU: [
    { name: "Uni Food Hall", cuisine: "Food court", priceX: 0.9 },
    { name: "Glebe Thai", cuisine: "Thai", priceX: 1.2 },
    { name: "Dumpling Republic", cuisine: "Dumplings", priceX: 1.1 },
    { name: "Pie Shop on King St", cuisine: "Bakery", priceX: 0.6 },
    { name: "Newtown Burger Bar", cuisine: "Burgers", priceX: 1.4 },
    { name: "Laksa King", cuisine: "Malaysian", priceX: 1.2 },
  ],
  DE: [
    { name: "Mensa Süd", cuisine: "Canteen", priceX: 0.5 },
    { name: "Döner Express", cuisine: "Döner", priceX: 0.8 },
    { name: "Currywurst am Bahnhof", cuisine: "Street food", priceX: 0.6 },
    { name: "Vietnam Kitchen Mitte", cuisine: "Vietnamese", priceX: 1.3 },
    { name: "Biergarten Spree", cuisine: "German", priceX: 2.5 },
    { name: "Falafel Haus", cuisine: "Middle Eastern", priceX: 0.8 },
  ],
};

const GENERIC_FOOD: Template[] = [
  { name: "University Canteen", cuisine: "Canteen", priceX: 0.6 },
  { name: "Noodle Corner", cuisine: "Noodles", priceX: 1 },
  { name: "Street Food Market", cuisine: "Street food", priceX: 0.7 },
  { name: "Family Kitchen", cuisine: "Local", priceX: 1.5 },
  { name: "Grill House", cuisine: "Grill", priceX: 3 },
];

const OTHER: Record<Exclude<PlaceCategory, "food">, Template[]> = {
  cafe: [
    { name: "Study Hall Coffee", priceX: 0.6 },
    { name: "Library Café", priceX: 0.5 },
    { name: "Bean & Book", priceX: 0.8 },
  ],
  grocery: [
    { name: "Campus Mini Mart", priceX: 0.4 },
    { name: "FreshMart Supermarket", priceX: 1 },
    { name: "Wet Market", priceX: 0.7 },
  ],
  hotel: [
    { name: "Campus Inn", priceX: 12 },
    { name: "University Guest House", priceX: 9 },
    { name: "City Business Hotel", priceX: 20 },
  ],
  hostel: [
    { name: "Backpackers Hostel", priceX: 4 },
    { name: "Student Pod Hostel", priceX: 5 },
  ],
};

const REVIEW_TEXT: Record<PlaceCategory, [number, string][]> = {
  food: [
    [5, "Huge portions for the price. My go-to after class."],
    [4, "Tasty and quick, gets busy at lunch so come early."],
    [4, "Good value, staff were patient with my ordering."],
    [3, "Food is fine but the queue is long at peak times."],
    [5, "Best value meal near campus, very student-friendly."],
    [4, "Pay by mobile app was easy. Menu has pictures."],
  ],
  cafe: [
    [5, "Quiet, fast Wi-Fi and lots of sockets. Great for studying."],
    [4, "Nice coffee, a bit crowded during exams."],
    [4, "Student discount with ID card."],
  ],
  grocery: [
    [4, "Cheap basics and open late."],
    [5, "Best prices for fruit and vegetables around here."],
    [3, "Small selection but very convenient."],
  ],
  hotel: [
    [4, "Clean room, walking distance to campus. Good for the first nights."],
    [5, "Staff helped me with the police registration form."],
    [3, "Room was small but fine for a short stay."],
  ],
  hostel: [
    [4, "Friendly, met other exchange students here."],
    [3, "Cheap, a bit noisy at night. Bring earplugs."],
    [4, "Lockers and kitchen available, good value."],
  ],
};

const AUTHORS = ["Mai", "Lucas", "Aiko", "Minh", "Sara", "Daniel", "Putri", "Jin", "Ana", "Omar", "Lena", "Kenji"];

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967295;
  };
}

export function campusFor(destCountry: string, university?: string): Campus {
  const c = CAMPUS[destCountry];
  if (c) return { ...c, name: university ? `${university} (${c.name})` : c.name };
  return { ...CAMPUS.CN, name: university || "Campus" };
}

export function cheapMeal(destCountry: string): number {
  return CHEAP_MEAL[destCountry] ?? 10;
}

function priceLevel(priceX: number, cat: PlaceCategory): 1 | 2 | 3 | 4 {
  const x = cat === "hotel" || cat === "hostel" ? priceX / 6 : priceX;
  return x <= 0.8 ? 1 : x <= 1.6 ? 2 : x <= 3 ? 3 : 4;
}

export function generatePlaces(destCountry: string): Place[] {
  const campus = campusFor(destCountry);
  const currency = getCountry(destCountry).currency;
  const meal = cheapMeal(destCountry);
  const rand = rng(`places-${destCountry}`);
  const out: Place[] = [];
  const add = (cat: PlaceCategory, t: Template, i: number) => {
    // Scatter within ~1.5 km of campus.
    const angle = rand() * Math.PI * 2;
    const dist = 0.15 + rand() * 1.4;
    const dLat = (dist / 111) * Math.cos(angle);
    const dLng = (dist / (111 * Math.cos((campus.lat * Math.PI) / 180))) * Math.sin(angle);
    const pool = REVIEW_TEXT[cat];
    const reviews: Review[] = [0, 1].map((k) => {
      const [stars, text] = pool[(i * 2 + k + Math.floor(rand() * pool.length)) % pool.length];
      return { stars, text, author: AUTHORS[Math.floor(rand() * AUTHORS.length)] };
    });
    out.push({
      id: `${destCountry.toLowerCase()}_${cat}_${i}`,
      name: t.name,
      category: cat,
      cuisine: t.cuisine,
      lat: Math.round((campus.lat + dLat) * 1e5) / 1e5,
      lng: Math.round((campus.lng + dLng) * 1e5) / 1e5,
      distanceKm: Math.round(dist * 10) / 10,
      rating: Math.round((3.6 + rand() * 1.3) * 10) / 10,
      reviewCount: Math.floor(40 + rand() * 1800),
      price: roundTo(currency, t.priceX * meal),
      currency,
      priceLevel: priceLevel(t.priceX, cat),
      studentDiscount: rand() < 0.35,
      reviews,
    });
  };
  (FOOD[destCountry] ?? GENERIC_FOOD).forEach((t, i) => add("food", t, i));
  for (const cat of ["cafe", "grocery", "hotel", "hostel"] as const) OTHER[cat].forEach((t, i) => add(cat, t, i));
  return out;
}

export type PlaceSort = "value" | "rating" | "price" | "distance";

export interface PlaceQuery {
  category?: PlaceCategory;
  maxPrice?: number;
  minRating?: number;
  sort?: PlaceSort;
}

/** Rating per unit of price, so cheap-and-good places float to the top. */
function valueScore(p: Place, meal: number) {
  return p.rating / Math.sqrt(Math.max(0.3, p.price / meal));
}

export function searchPlaces(destCountry: string, q: PlaceQuery = {}): Place[] {
  const meal = cheapMeal(destCountry);
  const sort = q.sort ?? "value";
  return generatePlaces(destCountry)
    .filter((p) => (!q.category || p.category === q.category)
      && (q.maxPrice == null || p.price <= q.maxPrice)
      && (q.minRating == null || p.rating >= q.minRating))
    .sort((a, b) => sort === "rating" ? b.rating - a.rating
      : sort === "price" ? a.price - b.price
      : sort === "distance" ? a.distanceKm - b.distanceKm
      : valueScore(b, meal) - valueScore(a, meal));
}

/**
 * Per-meal budget derived from the student's monthly food budget
 * (2 meals a day eaten out over 30 days; breakfast assumed at home).
 */
export function mealBudget(monthlyFoodBudget: number | null | undefined, destCountry: string): number {
  if (!monthlyFoodBudget) return cheapMeal(destCountry) * 1.5;
  return monthlyFoodBudget / 60;
}

// Google Maps URLs (official URL scheme, no API key needed).
export const mapsLinks = (p: { lat: number; lng: number; name: string }) => ({
  view: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`,
  embed: `https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s${p.lat},${p.lng}!6i16`,
});

export function realSearchLink(category: PlaceCategory, cuisine: string | undefined, campus: Campus): string {
  const what = category === "food" ? (cuisine ? `${cuisine} restaurant` : "restaurant") : category;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${what} near ${campus.lat},${campus.lng}`)}`;
}
