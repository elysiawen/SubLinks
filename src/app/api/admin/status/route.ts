import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import os from 'os';

// Store previous CPU measurements for calculating usage
let previousCpuInfo: { idle: number; total: number; timestamp: number } | null = null;

function getCpuUsage(): number {
    const cpus = os.cpus();

    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
        for (const type in cpu.times) {
            totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
    });

    const currentTime = Date.now();

    if (previousCpuInfo) {
        const idleDiff = totalIdle - previousCpuInfo.idle;
        const totalDiff = totalTick - previousCpuInfo.total;
        const usage = totalDiff > 0 ? 100 - (100 * idleDiff / totalDiff) : 0;

        previousCpuInfo = { idle: totalIdle, total: totalTick, timestamp: currentTime };
        return usage;
    }

    previousCpuInfo = { idle: totalIdle, total: totalTick, timestamp: currentTime };
    return 0; // First call, no previous data
}

export async function GET(req: NextRequest) {
    // Check authentication
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get database type
        const dbType = process.env.DATABASE_TYPE || 'postgres';

        // Measure database latency
        let dbLatency: number | null = null;
        try {
            const start = Date.now();
            await db.getGlobalConfig(); // Simple query to test connection
            dbLatency = Date.now() - start;
        } catch (err) {
            console.error('Database latency check failed:', err);
            dbLatency = null;
        }

        // Get memory usage
        const memUsage = process.memoryUsage();
        const totalMemory = memUsage.heapTotal;
        const usedMemory = memUsage.heapUsed;

        // Get system info
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedSystemMem = totalMem - freeMem;

        // Calculate CPU usage percentage
        const cpuUsage = getCpuUsage();

        // Get load average (Unix-like systems only)
        const loadAvg = os.loadavg();

        // Get network interfaces
        const networkInterfaces = os.networkInterfaces();
        const networkInfo = Object.entries(networkInterfaces)
            .filter(([name]) => !name.includes('lo') && !name.includes('Loopback'))
            .map(([name, addrs]) => ({
                name,
                addresses: addrs?.filter(addr => !addr.internal).map(addr => ({
                    address: addr.address,
                    family: addr.family,
                    mac: addr.mac
                })) || []
            }))
            .filter(iface => iface.addresses.length > 0);

        const status = {
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            hostname: os.hostname(),
            database: dbType === 'redis' ? 'Redis' : 'PostgreSQL',
            dbLatency,
            uptime: process.uptime(),
            systemUptime: os.uptime(),
            memory: {
                process: {
                    used: usedMemory,
                    total: totalMemory,
                    percentage: (usedMemory / totalMemory) * 100,
                    rss: memUsage.rss,
                    external: memUsage.external
                },
                system: {
                    used: usedSystemMem,
                    total: totalMem,
                    free: freeMem,
                    percentage: (usedSystemMem / totalMem) * 100
                }
            },
            cpu: {
                model: cpus[0]?.model || 'Unknown',
                cores: cpus.length,
                speed: cpus[0]?.speed || 0,
                usage: cpuUsage,
                loadAverage: {
                    '1min': loadAvg[0],
                    '5min': loadAvg[1],
                    '15min': loadAvg[2]
                }
            },
            network: networkInfo,
            timestamp: Date.now()
        };

        return NextResponse.json(status);
    } catch (error) {
        console.error('Error fetching server status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch server status' },
            { status: 500 }
        );
    }
}
