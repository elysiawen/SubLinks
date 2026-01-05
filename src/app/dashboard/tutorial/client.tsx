'use client';

import { useState } from 'react';

export default function TutorialClient() {
    const [activeSection, setActiveSection] = useState('getting-started');

    const sections = [
        { id: 'getting-started', title: '🚀 快速开始' },
        { id: 'subscription', title: '📝 创建订阅' },
        { id: 'clients', title: '📱 客户端配置' },
        { id: 'advanced', title: '⚙️ 高级功能' },
        { id: 'troubleshooting', title: '🔧 故障排查' },
        { id: 'faq', title: '❓ 常见问题' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4">
                        <span className="text-3xl">📚</span>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-3">SubLinks 使用教程</h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        从零开始，快速掌握 SubLinks 订阅管理系统的所有功能
                    </p>
                </div>

                {/* Top Navigation Tabs */}
                <div className="sticky top-0 z-30 mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-4 backdrop-blur-md bg-gradient-to-br from-blue-50/95 via-white/95 to-purple-50/95">
                    <div className="max-w-7xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2">
                            <div className="flex flex-wrap gap-2">
                                {sections.map((section) => (
                                    <button
                                        key={section.id}
                                        onClick={() => setActiveSection(section.id)}
                                        className={`flex-1 min-w-[140px] px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeSection === section.id
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md transform scale-105'
                                            : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        {section.title}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 lg:p-12">
                    {activeSection === 'getting-started' && <GettingStarted />}
                    {activeSection === 'subscription' && <SubscriptionGuide />}
                    {activeSection === 'clients' && <ClientsGuide />}
                    {activeSection === 'advanced' && <AdvancedFeatures />}
                    {activeSection === 'troubleshooting' && <Troubleshooting />}
                    {activeSection === 'faq' && <FAQ />}
                </div>
            </div>
        </div>
    );
}

function GettingStarted() {
    return (
        <div className="prose prose-blue max-w-none">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <span className="text-4xl">🚀</span>
                快速开始
            </h2>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 p-6 rounded-r-xl mb-8">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">👋</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-blue-900 mb-2">欢迎使用 SubLinks！</h3>
                        <p className="text-blue-800 leading-relaxed">
                            SubLinks 是一个功能强大的订阅管理系统，专为简化代理订阅的管理和分发而设计。
                            无论您是个人用户还是团队管理员，都能轻松上手。
                        </p>
                    </div>
                </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mt-8 mb-4 flex items-center gap-2">
                <span className="text-2xl">✨</span>
                核心功能
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                            <span className="text-xl">📋</span>
                        </div>
                        <h4 className="font-bold text-gray-900">订阅管理</h4>
                    </div>
                    <p className="text-sm text-gray-700">创建和管理多个订阅链接，每个订阅可独立配置上游源和规则</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                            <span className="text-xl">📡</span>
                        </div>
                        <h4 className="font-bold text-gray-900">上游源选择</h4>
                    </div>
                    <p className="text-sm text-gray-700">灵活选择不同的上游订阅源，支持多源合并和独立配置</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border border-green-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                            <span className="text-xl">⚙️</span>
                        </div>
                        <h4 className="font-bold text-gray-900">自定义规则</h4>
                    </div>
                    <p className="text-sm text-gray-700">支持自定义分流规则和策略组，满足个性化需求</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-xl border border-orange-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                            <span className="text-xl">📱</span>
                        </div>
                        <h4 className="font-bold text-gray-900">多客户端支持</h4>
                    </div>
                    <p className="text-sm text-gray-700">兼容 Clash、Shadowrocket、Surge 等主流代理客户端</p>
                </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mt-8 mb-4 flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                三步上手
            </h3>
            <div className="space-y-6">
                <div className="flex gap-4">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            1
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-900 mb-2">创建订阅</h4>
                        <p className="text-gray-600 mb-3">前往"订阅中心"页面，点击"创建新订阅"按钮，填写订阅备注名称</p>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <p className="text-sm text-gray-600">💡 <strong>提示：</strong>建议使用有意义的名称，如"工作用"、"家庭用"等，方便后续管理</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            2
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-900 mb-2">配置订阅</h4>
                        <p className="text-gray-600 mb-3">选择上游源、自定义规则和策略组（可选）</p>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <p className="text-sm text-gray-600">💡 <strong>提示：</strong>可以选择多个上游源，系统会自动合并所有节点</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            3
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-900 mb-2">获取链接</h4>
                        <p className="text-gray-600 mb-3">复制生成的订阅链接，导入到您的客户端</p>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <p className="text-sm text-gray-600">💡 <strong>提示：</strong>订阅链接会自动更新，无需手动刷新</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SubscriptionGuide() {
    return (
        <div className="prose prose-blue max-w-none">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <span className="text-4xl">📝</span>
                创建订阅详解
            </h2>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-xl mb-8">
                <div className="flex items-start gap-4">
                    <span className="text-3xl">⚡</span>
                    <div>
                        <h3 className="text-lg font-bold text-yellow-900 mb-2">开始之前</h3>
                        <p className="text-yellow-800">
                            确保您已经登录系统，并且管理员已经配置了至少一个上游源。
                            如果没有可用的上游源，请联系管理员添加。
                        </p>
                    </div>
                </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mt-8 mb-6">📋 创建步骤</h3>

            <div className="space-y-8">
                {/* Step 1 */}
                <div className="border-l-4 border-blue-500 pl-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">1</div>
                        <h4 className="text-xl font-bold text-gray-900">进入订阅管理</h4>
                    </div>
                    <p className="text-gray-700 mb-4">在左侧导航栏点击"订阅中心"，进入订阅管理页面</p>
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                        <p className="text-sm text-blue-800 mb-2"><strong>页面功能：</strong></p>
                        <ul className="text-sm text-blue-700 space-y-1 ml-4">
                            <li>• 查看所有已创建的订阅</li>
                            <li>• 查看订阅使用情况和限额</li>
                            <li>• 管理现有订阅（编辑、删除、复制链接）</li>
                        </ul>
                    </div>
                </div>

                {/* Step 2 */}
                <div className="border-l-4 border-purple-500 pl-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">2</div>
                        <h4 className="text-xl font-bold text-gray-900">填写基本信息</h4>
                    </div>
                    <p className="text-gray-700 mb-4">点击"创建新订阅"按钮，在弹出的对话框中填写以下信息：</p>
                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📌</span>
                                <strong className="text-gray-900">订阅备注</strong>
                                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">必填</span>
                            </div>
                            <p className="text-sm text-gray-600 ml-7">为订阅起一个容易识别的名称，如"办公室"、"家用"、"移动设备"等</p>
                        </div>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="border-l-4 border-green-500 pl-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">3</div>
                        <h4 className="text-xl font-bold text-gray-900">选择上游源</h4>
                    </div>
                    <p className="text-gray-700 mb-4">从可用的上游源列表中选择一个或多个源：</p>
                    <div className="bg-green-50 rounded-xl p-5 border border-green-200 space-y-3">
                        <div className="flex items-start gap-3">
                            <span className="text-xl">✅</span>
                            <div>
                                <strong className="text-green-900">单源模式</strong>
                                <p className="text-sm text-green-700 mt-1">只选择一个上游源，使用该源的所有节点和配置</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-xl">🔗</span>
                            <div>
                                <strong className="text-green-900">多源合并</strong>
                                <p className="text-sm text-green-700 mt-1">选择多个上游源，系统会自动合并所有节点，去重后生成统一配置</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 4 */}
                <div className="border-l-4 border-orange-500 pl-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">4</div>
                        <h4 className="text-xl font-bold text-gray-900">高级配置（可选）</h4>
                    </div>
                    <p className="text-gray-700 mb-4">根据需要配置以下高级选项：</p>
                    <div className="space-y-4">
                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🤖</span>
                                <strong className="text-orange-900">自定义策略组</strong>
                            </div>
                            <p className="text-sm text-orange-700">选择预设的策略组配置，或使用默认配置</p>
                        </div>
                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">⚡</span>
                                <strong className="text-orange-900">自定义规则集</strong>
                            </div>
                            <p className="text-sm text-orange-700">选择预设的分流规则，或使用默认规则</p>
                        </div>
                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">✍️</span>
                                <strong className="text-orange-900">自定义规则</strong>
                            </div>
                            <p className="text-sm text-orange-700 mb-2">直接输入自定义规则，每行一条，优先级最高</p>
                            <div className="bg-white rounded-lg p-3 font-mono text-xs text-gray-600 border border-orange-100">
                                <div>DOMAIN-SUFFIX,example.com,DIRECT</div>
                                <div>IP-CIDR,192.168.0.0/16,DIRECT</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 5 */}
                <div className="border-l-4 border-indigo-500 pl-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">5</div>
                        <h4 className="text-xl font-bold text-gray-900">使用订阅链接</h4>
                    </div>
                    <p className="text-gray-700 mb-4">创建成功后，您会获得一个唯一的订阅链接：</p>
                    <div className="bg-white rounded-lg p-4 border-2 border-dashed border-indigo-200 mb-4">
                        <p className="font-mono text-sm text-gray-700 break-all">
                            https://your-domain.com/api/s/abc123def456
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔒</span>
                                <strong className="text-indigo-900">安全提示</strong>
                            </div>
                            <p className="text-sm text-indigo-700">链接包含唯一 Token，请勿分享给他人</p>
                        </div>
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔄</span>
                                <strong className="text-indigo-900">自动更新</strong>
                            </div>
                            <p className="text-sm text-indigo-700">链接内容会自动更新，无需重新导入</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


function ClientsGuide() {
    return (
        <div className="prose prose-blue max-w-none">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <span className="text-4xl">📱</span>
                客户端配置指南
            </h2>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-xl mb-8">
                <div className="flex items-start gap-4">
                    <span className="text-3xl">💡</span>
                    <div>
                        <h3 className="text-lg font-bold text-blue-900 mb-2">通用步骤</h3>
                        <p className="text-blue-800">
                            所有客户端的基本流程都是：复制订阅链接 → 在客户端中添加订阅 → 更新订阅 → 选择节点 → 开始使用
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {/* Clash */}
                <div className="border-2 border-blue-200 rounded-2xl p-6 bg-gradient-to-br from-blue-50 to-white">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <span className="text-3xl">⚔️</span>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">Clash / Clash Verge</h3>
                            <p className="text-sm text-gray-600">Windows / macOS / Linux</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">1</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>打开 Clash 客户端</strong></p>
                                <p className="text-sm text-gray-600 mt-1">启动 Clash for Windows 或 Clash Verge</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">2</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>进入配置页面</strong></p>
                                <p className="text-sm text-gray-600 mt-1">点击左侧"配置"或"Profiles"选项卡</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">3</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>添加订阅</strong></p>
                                <p className="text-sm text-gray-600 mt-1">点击"新建配置"→"从 URL 导入"</p>
                                <div className="bg-white rounded-lg p-3 mt-2 border border-blue-100">
                                    <p className="text-xs text-gray-600 mb-1">在弹出的对话框中:</p>
                                    <ul className="text-xs text-gray-600 space-y-1 ml-4">
                                        <li>• 粘贴订阅链接到 URL 栏</li>
                                        <li>• 设置配置名称（可选）</li>
                                        <li>• 点击"下载"按钮</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">4</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>启用配置</strong></p>
                                <p className="text-sm text-gray-600 mt-1">在配置列表中选中新下载的配置，点击"启用"</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">5</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>选择节点</strong></p>
                                <p className="text-sm text-gray-600 mt-1">切换到"代理"页面，选择合适的节点或策略组</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 bg-blue-100 rounded-xl p-4">
                        <p className="text-sm text-blue-800">
                            <strong>💡 提示：</strong>建议开启"自动更新订阅"功能，设置更新间隔为 24 小时
                        </p>
                    </div>
                </div>

                {/* Shadowrocket */}
                <div className="border-2 border-orange-200 rounded-2xl p-6 bg-gradient-to-br from-orange-50 to-white">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <span className="text-3xl">🚀</span>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">Shadowrocket</h3>
                            <p className="text-sm text-gray-600">iOS (iPhone / iPad)</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">1</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>打开 Shadowrocket</strong></p>
                                <p className="text-sm text-gray-600 mt-1">在 iOS 设备上启动 Shadowrocket 应用</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">2</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>添加订阅</strong></p>
                                <p className="text-sm text-gray-600 mt-1">点击右上角"+"号 → 选择"类型" → "Subscribe"</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">3</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>填写信息</strong></p>
                                <div className="bg-white rounded-lg p-3 mt-2 border border-orange-100">
                                    <ul className="text-xs text-gray-600 space-y-1">
                                        <li>• <strong>URL:</strong> 粘贴订阅链接</li>
                                        <li>• <strong>备注:</strong> 输入订阅名称（可选）</li>
                                        <li>• 点击右上角"完成"</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">4</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>更新订阅</strong></p>
                                <p className="text-sm text-gray-600 mt-1">在订阅列表中，点击订阅右侧的刷新图标</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">5</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>连接节点</strong></p>
                                <p className="text-sm text-gray-600 mt-1">选择节点，打开顶部开关，允许 VPN 配置</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 bg-orange-100 rounded-xl p-4">
                        <p className="text-sm text-orange-800">
                            <strong>⚠️ 注意：</strong>首次使用需要允许 VPN 配置，请在系统弹窗中点击"允许"
                        </p>
                    </div>
                </div>

                {/* Surge */}
                <div className="border-2 border-purple-200 rounded-2xl p-6 bg-gradient-to-br from-purple-50 to-white">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <span className="text-3xl">🌊</span>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">Surge</h3>
                            <p className="text-sm text-gray-600">iOS / macOS</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">1</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>打开 Surge</strong></p>
                                <p className="text-sm text-gray-600 mt-1">启动 Surge 应用</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">2</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>进入配置页面</strong></p>
                                <p className="text-sm text-gray-600 mt-1">点击底部"配置"选项卡</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">3</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>下载配置</strong></p>
                                <p className="text-sm text-gray-600 mt-1">点击"从 URL 下载配置" → 粘贴订阅链接 → 点击"下载"</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">4</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>启用配置</strong></p>
                                <p className="text-sm text-gray-600 mt-1">在配置列表中选中新配置，打开主开关</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* V2rayN */}
                <div className="border-2 border-green-200 rounded-2xl p-6 bg-gradient-to-br from-green-50 to-white">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <span className="text-3xl">🔷</span>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">V2rayN</h3>
                            <p className="text-sm text-gray-600">Windows</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">1</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>打开 V2rayN</strong></p>
                                <p className="text-sm text-gray-600 mt-1">启动 V2rayN 客户端</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">2</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>订阅设置</strong></p>
                                <p className="text-sm text-gray-600 mt-1">点击菜单栏"订阅" → "订阅设置"</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">3</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>添加订阅</strong></p>
                                <div className="bg-white rounded-lg p-3 mt-2 border border-green-100">
                                    <ul className="text-xs text-gray-600 space-y-1">
                                        <li>• 点击"添加"按钮</li>
                                        <li>• 粘贴订阅链接到"地址"栏</li>
                                        <li>• 填写"备注"（可选）</li>
                                        <li>• 点击"确定"</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">4</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>更新订阅</strong></p>
                                <p className="text-sm text-gray-600 mt-1">点击"订阅" → "更新订阅"</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">5</div>
                            <div className="flex-1">
                                <p className="text-gray-700"><strong>启用系统代理</strong></p>
                                <p className="text-sm text-gray-600 mt-1">选择节点，右键点击托盘图标 → "系统代理" → "自动配置系统代理"</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                    <span className="text-3xl">📖</span>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3">通用提示</h3>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>大部分客户端支持自动更新订阅，建议开启此功能</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>订阅更新后，节点列表会自动刷新，无需手动操作</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>如果节点无法连接，尝试切换其他节点或更新订阅</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>建议定期检查客户端更新，保持最新版本</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AdvancedFeatures() {
    return (
        <div className="prose prose-blue max-w-none">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <span className="text-4xl">⚙️</span>
                高级功能
            </h2>

            <div className="space-y-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border-2 border-blue-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                            <span className="text-2xl">🤖</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">自定义策略组</h3>
                    </div>
                    <p className="text-gray-700 mb-4">
                        策略组允许您自定义节点选择逻辑，实现智能分流和负载均衡。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl p-4 border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">👆</span>
                                <strong className="text-gray-900">select</strong>
                            </div>
                            <p className="text-sm text-gray-600">手动选择模式，由用户自行选择使用哪个节点</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">⚡</span>
                                <strong className="text-gray-900">url-test</strong>
                            </div>
                            <p className="text-sm text-gray-600">自动测速模式，自动选择延迟最低的节点</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔄</span>
                                <strong className="text-gray-900">fallback</strong>
                            </div>
                            <p className="text-sm text-gray-600">故障转移模式，按顺序尝试节点直到可用</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">⚖️</span>
                                <strong className="text-gray-900">load-balance</strong>
                            </div>
                            <p className="text-sm text-gray-600">负载均衡模式，在多个节点间分配流量</p>
                        </div>
                    </div>
                    <div className="mt-4 bg-blue-200 rounded-xl p-4">
                        <p className="text-sm text-blue-900">
                            <strong>💡 使用方法：</strong>在"自定义配置" → "自定义分组"中创建策略组配置，然后在创建订阅时选择使用
                        </p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border-2 border-purple-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                            <span className="text-2xl">⚡</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">自定义分流规则</h3>
                    </div>
                    <p className="text-gray-700 mb-4">
                        分流规则决定不同流量的走向，实现精准控制。
                    </p>
                    <div className="bg-white rounded-xl p-5 border border-purple-200 mb-4">
                        <h4 className="font-bold text-gray-900 mb-3">常见规则类型：</h4>
                        <div className="space-y-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-purple-500 font-bold">•</span>
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">DOMAIN-SUFFIX</code>
                                    <span className="text-sm text-gray-600">域名后缀匹配</span>
                                </div>
                                <div className="ml-6 bg-gray-50 rounded-lg p-2 font-mono text-xs text-gray-600">
                                    DOMAIN-SUFFIX,google.com,Proxy
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-purple-500 font-bold">•</span>
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">DOMAIN-KEYWORD</code>
                                    <span className="text-sm text-gray-600">域名关键词匹配</span>
                                </div>
                                <div className="ml-6 bg-gray-50 rounded-lg p-2 font-mono text-xs text-gray-600">
                                    DOMAIN-KEYWORD,youtube,Proxy
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-purple-500 font-bold">•</span>
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">IP-CIDR</code>
                                    <span className="text-sm text-gray-600">IP 地址段匹配</span>
                                </div>
                                <div className="ml-6 bg-gray-50 rounded-lg p-2 font-mono text-xs text-gray-600">
                                    IP-CIDR,192.168.0.0/16,DIRECT
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-purple-500 font-bold">•</span>
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">GEOIP</code>
                                    <span className="text-sm text-gray-600">地理位置匹配</span>
                                </div>
                                <div className="ml-6 bg-gray-50 rounded-lg p-2 font-mono text-xs text-gray-600">
                                    GEOIP,CN,DIRECT
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-purple-200 rounded-xl p-4">
                        <p className="text-sm text-purple-900">
                            <strong>💡 优先级：</strong>自定义规则 {'>'} 规则集 {'>'} 上游规则，规则按从上到下的顺序匹配
                        </p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border-2 border-green-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                            <span className="text-2xl">🔄</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">订阅刷新机制</h3>
                    </div>
                    <p className="text-gray-700 mb-4">
                        系统会根据上游源的缓存时长自动刷新订阅内容。
                    </p>
                    <div className="space-y-3">
                        <div className="bg-white rounded-xl p-4 border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">⏰</span>
                                <strong className="text-gray-900">自动刷新</strong>
                            </div>
                            <p className="text-sm text-gray-600">系统会在上游源缓存过期时自动刷新，默认 24 小时</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">👆</span>
                                <strong className="text-gray-900">手动刷新</strong>
                            </div>
                            <p className="text-sm text-gray-600">在订阅管理页面点击刷新按钮，立即更新订阅内容</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📱</span>
                                <strong className="text-gray-900">客户端更新</strong>
                            </div>
                            <p className="text-sm text-gray-600">在客户端中点击"更新订阅"获取最新配置</p>
                        </div>
                    </div>
                    <div className="mt-4 bg-yellow-100 rounded-xl p-4 border border-yellow-300">
                        <p className="text-sm text-yellow-900">
                            <strong>⚠️ 注意：</strong>频繁刷新可能导致上游源限流，建议使用默认缓存时长
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Troubleshooting() {
    return (
        <div className="prose prose-blue max-w-none">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <span className="text-4xl">🔧</span>
                故障排查
            </h2>

            <div className="space-y-6">
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl">
                    <div className="flex items-start gap-4">
                        <span className="text-3xl">🚨</span>
                        <div>
                            <h3 className="text-lg font-bold text-red-900 mb-2">订阅链接无法导入</h3>
                            <div className="space-y-3 text-sm text-red-800">
                                <div>
                                    <strong>可能原因：</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                        <li>• 订阅链接复制不完整</li>
                                        <li>• 客户端不支持 Clash 格式</li>
                                        <li>• 网络连接问题</li>
                                        <li>• 订阅已被禁用或删除</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong>解决方法：</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                        <li>✓ 重新复制完整的订阅链接</li>
                                        <li>✓ 确认客户端版本支持 Clash 配置</li>
                                        <li>✓ 检查网络连接是否正常</li>
                                        <li>✓ 在订阅管理页面确认订阅状态</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-xl">
                    <div className="flex items-start gap-4">
                        <span className="text-3xl">📭</span>
                        <div>
                            <h3 className="text-lg font-bold text-orange-900 mb-2">节点列表为空</h3>
                            <div className="space-y-3 text-sm text-orange-800">
                                <div>
                                    <strong>可能原因：</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                        <li>• 上游源未刷新或刷新失败</li>
                                        <li>• 上游源本身没有可用节点</li>
                                        <li>• 选择的上游源配置有误</li>
                                        <li>• 订阅创建时未选择上游源</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong>解决方法：</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                        <li>✓ 联系管理员检查上游源状态</li>
                                        <li>✓ 在订阅管理页面手动刷新订阅</li>
                                        <li>✓ 尝试选择其他上游源</li>
                                        <li>✓ 重新创建订阅并正确选择上游源</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-xl">
                    <div className="flex items-start gap-4">
                        <span className="text-3xl">🔌</span>
                        <div>
                            <h3 className="text-lg font-bold text-yellow-900 mb-2">节点无法连接</h3>
                            <div className="space-y-3 text-sm text-yellow-800">
                                <div>
                                    <strong>可能原因：</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                        <li>• 节点服务器故障或维护</li>
                                        <li>• 本地网络限制</li>
                                        <li>• 客户端配置错误</li>
                                        <li>• 节点信息已过期</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong>解决方法：</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                        <li>✓ 尝试切换其他节点</li>
                                        <li>✓ 更新订阅获取最新节点信息</li>
                                        <li>✓ 检查本地防火墙设置</li>
                                        <li>✓ 重启客户端或设备</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-purple-50 border-l-4 border-purple-500 p-6 rounded-r-xl">
                    <div className="flex items-start gap-4">
                        <span className="text-3xl">🐌</span>
                        <div>
                            <h3 className="text-lg font-bold text-purple-900 mb-2">连接速度慢</h3>
                            <div className="space-y-3 text-sm text-purple-800">
                                <div>
                                    <strong>可能原因：</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                        <li>• 节点负载过高</li>
                                        <li>• 选择的节点距离较远</li>
                                        <li>• 网络高峰期</li>
                                        <li>• 节点带宽限制</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong>解决方法：</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                        <li>✓ 切换到其他节点</li>
                                        <li>✓ 选择地理位置更近的节点</li>
                                        <li>✓ 避开网络高峰时段</li>
                                        <li>✓ 使用 url-test 策略组自动选择最快节点</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-xl">
                    <div className="flex items-start gap-4">
                        <span className="text-3xl">❌</span>
                        <div>
                            <h3 className="text-lg font-bold text-blue-900 mb-2">规则不生效</h3>
                            <div className="space-y-3 text-sm text-blue-800">
                                <div>
                                    <strong>可能原因：</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                        <li>• 规则语法错误</li>
                                        <li>• 规则优先级问题</li>
                                        <li>• 客户端未更新订阅</li>
                                        <li>• 策略组配置错误</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong>解决方法：</strong>
                                    <ul className="ml-4 mt-1 space-y-1">
                                        <li>✓ 检查规则语法是否正确</li>
                                        <li>✓ 确认规则顺序（自定义规则优先级最高）</li>
                                        <li>✓ 在客户端中更新订阅</li>
                                        <li>✓ 查看客户端日志排查问题</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                    <span className="text-3xl">💬</span>
                    <div>
                        <h3 className="text-lg font-bold text-green-900 mb-2">仍然无法解决？</h3>
                        <p className="text-green-800 mb-3">
                            如果以上方法都无法解决您的问题，请联系系统管理员获取技术支持。
                        </p>
                        <div className="bg-white rounded-xl p-4 border border-green-200">
                            <p className="text-sm text-gray-700">
                                <strong>联系时请提供：</strong>
                            </p>
                            <ul className="text-sm text-gray-600 mt-2 space-y-1 ml-4">
                                <li>• 详细的问题描述</li>
                                <li>• 使用的客户端名称和版本</li>
                                <li>• 订阅名称或 Token</li>
                                <li>• 错误截图或日志（如有）</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FAQ() {
    return (
        <div className="prose prose-blue max-w-none">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <span className="text-4xl">❓</span>
                常见问题
            </h2>

            <div className="space-y-4">
                {[
                    {
                        q: "可以创建多少个订阅？",
                        a: '订阅数量限制由管理员设置。您可以在"订阅中心"页面顶部查看当前已使用数量和总限额。如需增加限额，请联系管理员。',
                        icon: "📊"
                    },
                    {
                        q: "订阅链接可以分享给他人吗？",
                        a: "不建议分享。订阅链接包含唯一的 Token，相当于您的专属密钥。如果泄露，他人可以使用您的订阅配额。如果不慎泄露，建议立即删除该订阅并重新创建。",
                        icon: "🔒"
                    },
                    {
                        q: "如何更新订阅内容？",
                        a: '有两种方式：1) 在客户端中点击"更新订阅"按钮；2) 系统会根据上游源的缓存时长自动更新。大部分客户端支持设置自动更新间隔，建议设置为 24 小时。',
                        icon: "🔄"
                    },
                    {
                        q: "自定义规则如何生效？",
                        a: "自定义规则会添加到订阅配置的规则列表顶部，拥有最高优先级。修改规则后，需要在客户端中更新订阅才能生效。规则匹配顺序：自定义规则 {'>'} 规则集 {'>'} 上游规则。",
                        icon: "⚡"
                    },
                    {
                        q: "可以同时选择多个上游源吗？",
                        a: "可以。选择多个上游源时，系统会自动合并所有节点，去除重复项后生成统一的配置文件。这样可以获得更多的节点选择。",
                        icon: "🔗"
                    },
                    {
                        q: "订阅链接失效了怎么办？",
                        a: "订阅链接通常不会失效，除非：1) 订阅被删除；2) 账号被禁用；3) 系统域名变更。如果确认链接失效，请联系管理员检查账号状态。",
                        icon: "⚠️"
                    },
                    {
                        q: "为什么有些节点无法使用？",
                        a: "可能原因：1) 节点服务器故障或维护；2) 节点已过期；3) 本地网络限制；4) 客户端配置问题。建议尝试其他节点或联系管理员检查上游源状态。",
                        icon: "🔌"
                    },
                    {
                        q: "如何选择合适的策略组类型？",
                        a: "根据需求选择：select（手动选择，适合精确控制）、url-test（自动测速，适合追求速度）、fallback（故障转移，适合稳定性优先）、load-balance（负载均衡，适合分散流量）。",
                        icon: "🤖"
                    },
                    {
                        q: "订阅更新后节点变少了？",
                        a: "这是正常现象。上游源的节点数量会动态变化，过期或故障的节点会被移除。如果节点数量大幅减少，建议联系管理员检查上游源状态。",
                        icon: "📉"
                    },
                    {
                        q: "可以在多个设备上使用同一个订阅吗？",
                        a: "可以。同一个订阅链接可以在多个设备上使用，没有设备数量限制。但请注意不要分享给他人，以免造成配额滥用。",
                        icon: "📱"
                    }
                ].map((item, index) => (
                    <div key={index} className="bg-gradient-to-r from-gray-50 to-white border-l-4 border-blue-500 rounded-r-xl p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                            <span className="text-2xl flex-shrink-0">{item.icon}</span>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.q}</h3>
                                <p className="text-gray-700 text-sm leading-relaxed">{item.a}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 text-white">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
                        <span className="text-4xl">🎓</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-3">恭喜！您已完成教程学习</h3>
                    <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                        现在您已经掌握了 SubLinks 的所有核心功能。
                        开始创建您的第一个订阅，体验便捷的订阅管理服务吧！
                    </p>
                    <div className="flex justify-center gap-4">
                        <a
                            href="/dashboard/subscriptions"
                            className="inline-flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg"
                        >
                            <span>📋</span>
                            <span>前往订阅中心</span>
                        </a>
                        <a
                            href="/dashboard"
                            className="inline-flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors border-2 border-white/30"
                        >
                            <span>🏠</span>
                            <span>返回首页</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
