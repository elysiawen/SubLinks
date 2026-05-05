export const LOCALES = [
    { code: 'zh', label: '中文', flag: '🇨🇳', timezone: 'Asia/Shanghai' },
    { code: 'en', label: 'English', flag: '🇺🇸', timezone: 'America/New_York' },
    { code: 'ja', label: '日本語', flag: '🇯🇵', timezone: 'Asia/Tokyo' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];
export const DEFAULT_LOCALE: Locale = 'zh';
export const localeCodes = LOCALES.map(l => l.code) as readonly Locale[];

export function isLocale(value: string): value is Locale {
    return localeCodes.includes(value as Locale);
}

export function getTimezone(locale: Locale): string {
    return LOCALES.find(l => l.code === locale)?.timezone ?? 'Asia/Shanghai';
}
