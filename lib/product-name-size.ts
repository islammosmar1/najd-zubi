import type { Localized } from './catalog';

const number = '[0-9٠-٩۰-۹]+(?:[.,٫][0-9٠-٩۰-۹]+)?';
const arabicSize = new RegExp(`(?:ب?حجم|ب?طول)\\s*(?:ال)?قاعدة\\s*[:：]?\\s*(${number})?\\s*(?:سم|سنتيمتر|cm)?`, 'gi');
const englishSize = /(?:[—–-]\s*)?(?:with\s+)?base\s+(?:size|length)\s*:?\s*\d*(?:[.,]\d+)?\s*(?:cm)?/gi;
const hebrewSize = /(?:[—–-]\s*)?(?:גודל|אורך)\s+(?:ה)?בסיס\s*:?\s*\d*(?:[.,]\d+)?\s*(?:ס[״"]מ)?/gi;
export function normalizeBaseSize(value: string | number | undefined): string {
  if (value === undefined || String(value).trim() === '') return '';
  const text = String(value).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[٫,]/g, '.');
  const n = Number(text);
  if (!/^\d+(?:\.\d+)?$/.test(text) || !Number.isFinite(n) || n <= 0 || n > 1000) throw new Error('أدخلي حجم قاعدة صحيحًا أكبر من صفر / Enter a valid base size');
  return String(n);
}
export function readBaseSize(names: Localized, stored?: number): string {
  if (stored !== undefined) return normalizeBaseSize(stored);
  const match = new RegExp(arabicSize.source, 'i').exec(names.ar);
  return match?.[1] ? normalizeBaseSize(match[1]) : '';
}
export function productNameWithSize(names: Localized, value: string | number | undefined): Localized {
  const size = normalizeBaseSize(value);
  const clean = (text: string, pattern: RegExp) => text.replace(pattern, '').replace(/\s+/g, ' ').replace(/\s*[—–-]\s*$/, '').trim();
  const ar = clean(names.ar, arabicSize), en = clean(names.en, englishSize), he = clean(names.he, hebrewSize);
  return {ar: ar && size ? `${ar} بحجم قاعدة ${size} سم` : ar, en: en && size ? `${en} — Base size ${size} cm` : en, he: he && size ? `${he} — גודל בסיס ${size} ס״מ` : he};
}
