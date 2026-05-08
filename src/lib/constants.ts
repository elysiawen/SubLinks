/**
 * Shared proxy protocol definitions used across the application.
 */

export const PROTOCOLS = [
    { value: 'vmess', label: 'VMess' },
    { value: 'vless', label: 'VLESS' },
    { value: 'trojan', label: 'Trojan' },
    { value: 'ss', label: 'Shadowsocks' },
    { value: 'hysteria2', label: 'Hysteria2' },
    { value: 'anytls', label: 'AnyTLS' },
    { value: 'tuic', label: 'TUIC' },
    { value: 'wireguard', label: 'WireGuard' },
] as const;

export const PROTOCOL_COLORS: Record<string, string> = {
    vmess: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    vless: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    trojan: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    ss: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
    hysteria2: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    anytls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
    tuic: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
    wireguard: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
};

/** UUID-based protocols */
export const UUID_PROTOCOLS = ['vmess', 'vless', 'tuic'];

/**
 * Get password field label translation key based on protocol.
 * Returns a translation key like 'constants.password' for use with useTranslations.
 */
export function getPasswordLabel(protocol: string): string {
    if (protocol === 'wireguard') return 'Private Key';
    if (UUID_PROTOCOLS.includes(protocol)) return 'UUID';
    return 'constants.password';
}

/**
 * Get password field placeholder translation key based on protocol.
 * Returns a translation key like 'constants.password' for use with useTranslations.
 */
export function getPasswordPlaceholder(protocol: string): string {
    if (UUID_PROTOCOLS.includes(protocol)) return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
    if (protocol === 'wireguard') return 'PrivateKey (Base64)';
    return 'constants.password';
}

/** Build a node config object from manual form values */
export function buildNodeConfig(
    protocol: string,
    name: string,
    server: string,
    port: number,
    password: string,
    extraJson?: string,
): { config: any; error?: string } {
    const config: any = {
        name,
        type: protocol,
        server,
        port,
    };

    if (UUID_PROTOCOLS.includes(protocol)) {
        config.uuid = password;
    } else if (protocol === 'wireguard') {
        config['private-key'] = password;
    } else {
        config.password = password;
    }

    if (extraJson?.trim()) {
        try {
            const extra = JSON.parse(extraJson);
            Object.assign(config, extra);
        } catch {
            return { config, error: 'constants.invalidJson' };
        }
    }

    return { config };
}
