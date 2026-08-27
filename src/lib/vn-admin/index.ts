import { foldForSearch } from "@/lib/vietnamese-text";
import provincesJson from "./provinces.json";
import wardsJson from "./wards.json";

/**
 * Vietnam's administrative units as of the 1 July 2025 reorganisation.
 *
 * Vendored rather than taken from a package. Every Vietnamese-provinces package
 * on npm was last published in 2022 or 2023 — before the reform that abolished
 * the district tier nationwide and cut 63 provinces to 34. Installing one would
 * have reproduced the exact bug this replaces, only with several hundred
 * defunct districts instead of twelve.
 *
 * The data was checked against an independent figure before being trusted: it
 * carries 34 provinces, no district tier at all, no Bình Dương or Bà Rịa–Vũng
 * Tàu (both merged into Ho Chi Minh City), and exactly 168 ward-level units for
 * Ho Chi Minh City — which is the number the reorganisation actually produced.
 *
 * Source: github.com/zuydd/vn-geo
 *
 * On sizes: provinces is ~5KB and safe to send to a browser. Wards is ~600KB
 * and is not — it stays behind the search function below, which runs on the
 * server and returns only what was asked for.
 */

export type Province = {
  code: string;
  name: string;
  fullName: string;
  slug: string;
  type: "province" | "city";
  isCentral: boolean;
};

export type Ward = {
  code: string;
  name: string;
  fullName: string;
  slug: string;
  type: "ward" | "commune";
  provinceCode: string;
};

export const PROVINCES = provincesJson as Province[];
const WARDS = wardsJson as Ward[];

const PROVINCE_BY_CODE = new Map(PROVINCES.map((p) => [p.code, p]));

/**
 * Pre-folded index, built once per process.
 *
 * Folding 3,320 names on every keystroke would be wasteful, and this module is
 * loaded once per server instance. The label shown is the unit's fullName,
 * which already carries its province — needed, because a bare ward name is
 * ambiguous: "Tân Bình" exists in both Ho Chi Minh City and Cần Thơ.
 */
type IndexedWard = { ward: Ward; label: string; haystack: string };

let index: IndexedWard[] | null = null;

function getIndex(): IndexedWard[] {
  if (index) return index;
  index = WARDS.map((ward) => {
    // fullName already reads "Phường Sài Gòn, Thành phố Hồ Chí Minh" — it
    // carries the province, so appending the province name again produced
    // "…, Thành phố Hồ Chí Minh, Hồ Chí Minh".
    const label = ward.fullName;
    return { ward, label, haystack: foldForSearch(label) };
  });
  return index;
}

export type AreaOption = { value: string; label: string; provinceCode: string };

/**
 * Search ward-level units by name, accent-insensitively, so typing "sai gon"
 * finds "Phường Sài Gòn".
 *
 * Results are capped: a picker cannot usefully show hundreds of rows, and an
 * empty query would otherwise return all 3,320. An empty query returns the
 * central cities first instead, which is what someone opening the field with no
 * idea what to type is most likely to want.
 */
export function searchAreas(query: string, limit = 25): AreaOption[] {
  const all = getIndex();
  const needle = foldForSearch(query);

  if (!needle) {
    return all
      .filter((entry) => PROVINCE_BY_CODE.get(entry.ward.provinceCode)?.isCentral)
      .slice(0, limit)
      .map(toOption);
  }

  const starts: IndexedWard[] = [];
  const contains: IndexedWard[] = [];
  for (const entry of all) {
    if (entry.haystack.startsWith(needle)) starts.push(entry);
    else if (entry.haystack.includes(needle)) contains.push(entry);
    if (starts.length >= limit) break;
  }
  // Prefix matches first: typing "tan b" should surface "Tân Bình" above a ward
  // that merely contains those letters somewhere in the middle.
  return [...starts, ...contains].slice(0, limit).map(toOption);
}

function toOption(entry: IndexedWard): AreaOption {
  return {
    value: entry.label,
    label: entry.label,
    provinceCode: entry.ward.provinceCode,
  };
}
