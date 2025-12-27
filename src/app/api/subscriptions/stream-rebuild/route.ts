import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    // Authenticate
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';
    const batchSizeParam = searchParams.get('batchSize');
    const batchSize = batchSizeParam ? parseInt(batchSizeParam) : 0; // 0 = full concurrency
    const singleToken = searchParams.get('token'); // If provided, rebuild only this subscription

    // Create a streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
                const data = JSON.stringify({ message: msg, type });
                controller.enqueue(encoder.encode(data + '\n'));
            };

            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

                // Handle single subscription rebuild
                if (singleToken) {
                    send('正在获取订阅信息...', 'info');

                    const sub = await db.getSubscription(singleToken);
                    if (!sub) {
                        send('订阅不存在', 'error');
                        controller.close();
                        return;
                    }

                    send(`开始重建 ${sub.username} 的订阅 (${sub.remark})...`, 'info');

                    // Clear cache for this subscription
                    await db.deleteCache(`cache:subscription:${singleToken}`);
                    send('缓存已清除', 'success');

                    try {
                        const response = await fetch(`${baseUrl}/api/s/${singleToken}`, {
                            method: 'HEAD',
                            headers: {
                                'User-Agent': 'SubLinks-Precache/1.0',
                                'x-internal-system-precache': 'true',
                                'x-force-refresh': 'true'
                            }
                        });

                        if (response.ok) {
                            send(`✓ 订阅缓存重建成功`, 'success');
                        } else {
                            send(`✗ 重建失败 (HTTP ${response.status})`, 'error');
                        }
                    } catch (err) {
                        send(`✗ 重建失败: ${String(err)}`, 'error');
                    }

                    controller.close();
                    return;
                }

                // Handle batch rebuild (existing code)
                send('正在获取订阅列表...', 'info');

                // Get all subscriptions
                const { data: allSubs } = await db.getAllSubscriptions(1, 10000);

                if (allSubs.length === 0) {
                    send('没有找到订阅', 'error');
                    controller.close();
                    return;
                }

                send(`找到 ${allSubs.length} 个订阅`, 'info');

                // If forced, clear all caches first
                if (force) {
                    send('正在清除所有订阅缓存...', 'info');
                    await db.clearAllSubscriptionCaches();
                    send('缓存已清除', 'success');
                }

                if (batchSize === 0) {
                    // Full concurrency - process all at once
                    send(`开始并发处理 ${allSubs.length} 个订阅...`, 'info');

                    const results = await Promise.allSettled(
                        allSubs.map(async (sub, idx) => {
                            const progress = `[${idx + 1}/${allSubs.length}]`;

                            try {
                                const response = await fetch(`${baseUrl}/api/s/${sub.token}`, {
                                    method: 'HEAD',
                                    headers: {
                                        'User-Agent': 'SubLinks-Precache/1.0',
                                        'x-internal-system-precache': 'true',
                                        ...(force ? { 'x-force-refresh': 'true' } : {})
                                    }
                                });

                                if (response.ok) {
                                    send(`${progress} ✓ ${sub.username} - ${sub.remark}`, 'success');
                                    return { success: true };
                                } else {
                                    send(`${progress} ✗ ${sub.username} - ${sub.remark} (HTTP ${response.status})`, 'error');
                                    return { success: false };
                                }
                            } catch (err) {
                                send(`${progress} ✗ ${sub.username} - ${sub.remark} (${String(err)})`, 'error');
                                return { success: false };
                            }
                        })
                    );

                    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
                    const failed = allSubs.length - successful;
                    send(`重建完成：成功 ${successful}/${allSubs.length}，失败 ${failed}`, failed > 0 ? 'info' : 'success');

                } else {
                    // Batch processing
                    send(`开始批量处理（每批 ${batchSize} 个）...`, 'info');
                    let successful = 0;
                    let failed = 0;

                    for (let i = 0; i < allSubs.length; i += batchSize) {
                        const batch = allSubs.slice(i, Math.min(i + batchSize, allSubs.length));
                        const batchStart = i + 1;
                        const batchEnd = Math.min(i + batchSize, allSubs.length);

                        send(`正在处理第 ${batchStart}-${batchEnd} 个订阅...`, 'info');

                        const results = await Promise.allSettled(
                            batch.map(async (sub, idx) => {
                                const globalIdx = i + idx;
                                const progress = `[${globalIdx + 1}/${allSubs.length}]`;

                                try {
                                    const response = await fetch(`${baseUrl}/api/s/${sub.token}`, {
                                        method: 'HEAD',
                                        headers: {
                                            'User-Agent': 'SubLinks-Precache/1.0',
                                            'x-internal-system-precache': 'true',
                                            ...(force ? { 'x-force-refresh': 'true' } : {})
                                        }
                                    });

                                    if (response.ok) {
                                        send(`${progress} ✓ ${sub.username} - ${sub.remark}`, 'success');
                                        return { success: true };
                                    } else {
                                        send(`${progress} ✗ ${sub.username} - ${sub.remark} (HTTP ${response.status})`, 'error');
                                        return { success: false };
                                    }
                                } catch (err) {
                                    send(`${progress} ✗ ${sub.username} - ${sub.remark} (${String(err)})`, 'error');
                                    return { success: false };
                                }
                            })
                        );

                        results.forEach(result => {
                            if (result.status === 'fulfilled' && result.value.success) {
                                successful++;
                            } else {
                                failed++;
                            }
                        });
                    }

                    send(`重建完成：成功 ${successful}/${allSubs.length}，失败 ${failed}`, failed > 0 ? 'info' : 'success');
                }

            } catch (error) {
                console.error('Stream rebuild error:', error);
                send(`错误: ${String(error)}`, 'error');
            } finally {
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
