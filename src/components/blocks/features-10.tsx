'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BarChart3, Sparkles, LayoutGrid, LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { useTranslations, useLocale } from 'next-intl'

export function FeaturesHow() {
    const t = useTranslations()
    const locale = useLocale()

    return (
        <section className="bg-zinc-50 py-16 md:py-32 dark:bg-transparent">
            <div className="mx-auto max-w-2xl px-6 lg:max-w-5xl">
                <div className="text-center mb-16">
                    <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 mb-5">{t('landing.platformTitle')}</h2>
                    <p className="text-gray-500 text-lg max-w-xl mx-auto">{t('landing.platformSubtitle')}</p>
                </div>

                <div className="mx-auto grid gap-4 lg:grid-cols-2">
                    <FeatureCard>
                        <CardHeader className="pb-3">
                            <CardHeading
                                icon={BarChart3}
                                title={locale === 'de' ? 'KI-Analyseberichte' : 'AI Insight Reports'}
                                description={t('landing.prod1Desc')}
                            />
                        </CardHeader>

                        <div className="relative mb-6 border-t border-dashed sm:mb-0">
                            <div className="absolute inset-0 [background:radial-gradient(125%_125%_at_50%_0%,transparent_40%,hsl(var(--muted)),white_125%)]"></div>
                            <div className="aspect-[76/59] p-1 px-6">
                                {/* Dashboard mockup */}
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mt-4">
                                    <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-100">
                                        <div className="w-2 h-2 rounded-full bg-red-400" />
                                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                        <div className="w-2 h-2 rounded-full bg-green-400" />
                                        <span className="ml-2 text-[8px] text-gray-400">app.datalaser.ai/insights</span>
                                    </div>
                                    <div className="p-3 grid grid-cols-3 gap-2">
                                        {[
                                            { label: 'Revenue', val: '€284K', delta: '+18%' },
                                            { label: 'Orders', val: '2,640', delta: '+12%' },
                                            { label: 'Churn', val: '2.3%', delta: '-0.1%' },
                                        ].map(k => (
                                            <div key={k.label} className="bg-gray-50 rounded-md p-2">
                                                <p className="text-[7px] text-gray-400 uppercase">{k.label}</p>
                                                <p className="text-sm font-bold text-gray-900">{k.val}</p>
                                                <p className="text-[8px] text-emerald-500 font-semibold">{k.delta}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="px-3 pb-3">
                                        <div className="h-16 flex items-end gap-[2px]">
                                            {Array.from({ length: 20 }, (_, i) => (
                                                <div key={i} className="flex-1 bg-gradient-to-t from-violet-500 to-violet-300 rounded-[1px] opacity-70"
                                                    style={{ height: `${30 + Math.sin(i * 0.5) * 20 + (i % 3) * 8}%` }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </FeatureCard>

                    <FeatureCard>
                        <CardHeader className="pb-3">
                            <CardHeading
                                icon={Sparkles}
                                title={locale === 'de' ? 'Daten fragen' : 'Ask Data'}
                                description={t('landing.prod2Desc')}
                            />
                        </CardHeader>

                        <CardContent>
                            <div className="relative mb-6 sm:mb-0">
                                <div className="absolute -inset-6 [background:radial-gradient(50%_50%_at_75%_50%,transparent,hsl(var(--background))_100%)]"></div>
                                {/* Chat mockup */}
                                <div className="border rounded-lg overflow-hidden bg-white">
                                    <div className="p-3 space-y-2">
                                        <div className="flex justify-end">
                                            <div className="bg-violet-600 text-white text-[10px] px-3 py-1.5 rounded-lg max-w-[70%]">
                                                {locale === 'de' ? 'Welches Produkt hat die höchste Marge?' : 'Which product has the highest margin?'}
                                            </div>
                                        </div>
                                        <div className="flex justify-start">
                                            <div className="bg-gray-50 border text-gray-700 text-[10px] px-3 py-1.5 rounded-lg max-w-[80%]">
                                                {locale === 'de'
                                                    ? 'Getriebe hat mit 68,6% die höchste Marge, gefolgt von Welle (65,2%) und Kolben (56,9%).'
                                                    : 'Premium Plan has the highest margin at 68.6%, followed by Business (65.2%) and Starter (56.9%).'}
                                            </div>
                                        </div>
                                        <div className="flex justify-start">
                                            <div className="bg-gray-50 border rounded-lg p-2 w-full">
                                                <div className="flex items-end gap-1 h-12">
                                                    {[68, 65, 57, 42, 38].map((h, i) => (
                                                        <div key={i} className="flex-1 bg-violet-400 rounded-[1px] opacity-70" style={{ height: `${h}%` }} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-t px-3 py-2">
                                        <div className="bg-gray-50 rounded-md px-2 py-1.5 text-[9px] text-gray-400">
                                            {locale === 'de' ? 'Stellen Sie eine Frage...' : 'Ask a question...'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </FeatureCard>

                    <FeatureCard className="p-6 lg:col-span-2">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <LayoutGrid className="size-5 text-violet-600" />
                            <span className="text-sm text-gray-500 font-medium">
                                {locale === 'de' ? 'Live-Dashboard' : 'Live Dashboard'}
                            </span>
                        </div>
                        <p className="mx-auto my-4 max-w-lg text-balance text-center text-2xl font-semibold text-gray-900">
                            {t('landing.prod3Desc')}
                        </p>

                        <div className="flex justify-center gap-6 overflow-hidden mt-8">
                            <CircularUI
                                label={locale === 'de' ? 'Analysen' : 'Insights'}
                                circles={[{ pattern: 'border' }, { pattern: 'border' }]}
                            />
                            <CircularUI
                                label={locale === 'de' ? 'Anomalien' : 'Anomalies'}
                                circles={[{ pattern: 'none' }, { pattern: 'primary' }]}
                            />
                            <CircularUI
                                label={locale === 'de' ? 'Prognosen' : 'Forecasts'}
                                circles={[{ pattern: 'blue' }, { pattern: 'none' }]}
                            />
                            <CircularUI
                                label={locale === 'de' ? 'Echtzeit' : 'Real-time'}
                                circles={[{ pattern: 'primary' }, { pattern: 'none' }]}
                                className="hidden sm:block"
                            />
                        </div>
                    </FeatureCard>
                </div>
            </div>
        </section>
    )
}

interface FeatureCardProps {
    children: ReactNode
    className?: string
}

const FeatureCard = ({ children, className }: FeatureCardProps) => (
    <Card className={cn('group relative rounded-none shadow-zinc-950/5', className)}>
        <CardDecorator />
        {children}
    </Card>
)

const CardDecorator = () => (
    <>
        <span className="border-primary absolute -left-px -top-px block size-2 border-l-2 border-t-2"></span>
        <span className="border-primary absolute -right-px -top-px block size-2 border-r-2 border-t-2"></span>
        <span className="border-primary absolute -bottom-px -left-px block size-2 border-b-2 border-l-2"></span>
        <span className="border-primary absolute -bottom-px -right-px block size-2 border-b-2 border-r-2"></span>
    </>
)

interface CardHeadingProps {
    icon: LucideIcon
    title: string
    description: string
}

const CardHeading = ({ icon: Icon, title, description }: CardHeadingProps) => (
    <div className="p-6">
        <span className="text-muted-foreground flex items-center gap-2">
            <Icon className="size-4 text-violet-600" />
            {title}
        </span>
        <p className="mt-8 text-2xl font-semibold text-gray-900">{description}</p>
    </div>
)

interface CircleConfig {
    pattern: 'none' | 'border' | 'primary' | 'blue'
}

interface CircularUIProps {
    label: string
    circles: CircleConfig[]
    className?: string
}

const CircularUI = ({ label, circles, className }: CircularUIProps) => (
    <div className={className}>
        <div className="bg-gradient-to-b from-border size-fit rounded-2xl to-transparent p-px">
            <div className="bg-gradient-to-b from-background to-muted/25 relative flex aspect-square w-fit items-center -space-x-4 rounded-[15px] p-4">
                {circles.map((circle, i) => (
                    <div
                        key={i}
                        className={cn('size-7 rounded-full border sm:size-8', {
                            'border-primary': circle.pattern === 'none',
                            'border-primary bg-[repeating-linear-gradient(-45deg,hsl(var(--border)),hsl(var(--border))_1px,transparent_1px,transparent_4px)]': circle.pattern === 'border',
                            'border-primary bg-background bg-[repeating-linear-gradient(-45deg,hsl(var(--primary)),hsl(var(--primary))_1px,transparent_1px,transparent_4px)]': circle.pattern === 'primary',
                            'bg-background z-1 border-blue-500 bg-[repeating-linear-gradient(-45deg,theme(colors.blue.500),theme(colors.blue.500)_1px,transparent_1px,transparent_4px)]': circle.pattern === 'blue',
                        })}></div>
                ))}
            </div>
        </div>
        <span className="text-muted-foreground mt-1.5 block text-center text-sm">{label}</span>
    </div>
)
