export const LOCALES = [
    { code: 'zh', label: '中文', flag: '🇨🇳', timezone: 'Asia/Shanghai' },
    { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼', timezone: 'Asia/Taipei' },
    { code: 'en', label: 'English', flag: '🇺🇸', timezone: 'America/New_York' },
    { code: 'ja', label: '日本語', flag: '🇯🇵', timezone: 'Asia/Tokyo' },
    { code: 'ko', label: '한국어', flag: '🇰🇷', timezone: 'Asia/Seoul' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];
export const DEFAULT_LOCALE: Locale = 'zh';
export const localeCodes = LOCALES.map(l => l.code) as readonly Locale[];

export function isLocale(value: string): value is Locale {
    return localeCodes.some(code => code.toLowerCase() === value.toLowerCase());
}

export function normalizeLocale(value: string): Locale | undefined {
    return localeCodes.find(code => code.toLowerCase() === value.toLowerCase());
}

export function getTimezone(locale: Locale): string {
    return LOCALES.find(l => l.code === locale)?.timezone ?? 'Asia/Shanghai';
}
