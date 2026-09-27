import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/account-state'
import { AIProvider } from '@/components/ai-provider'
import { ConversationsProvider } from '@/components/conversations-provider'
import { KnowledgeProvider } from '@/components/knowledge-provider'
import { WorkspaceProvider } from '@/components/workspace-state'
import { ConnectionsProvider } from '@/components/connections-provider'
import { BillingProvider } from '@/components/billing-provider'
import { AgentFlowEventBridge } from '@/components/event-bridge'
import './globals.css'
import './app-styles.css'
import './auth-styles.css'

export const metadata: Metadata = {
  title: 'AgentFlow — AI Automation Engineer',
  description: 'Design, generate, review, optimize, and export production-ready automation workflows with AgentFlow.',
  applicationName: 'AgentFlow',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'AgentFlow — AI Automation Engineer',
    description: 'Design, generate, review, optimize, and export production-ready automation workflows.',
    siteName: 'AgentFlow',
    type: 'website',
  },
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/agentflow-logo.svg?v=badge-2', type: 'image/svg+xml' }],
    shortcut: '/agentflow-logo.svg?v=badge-2',
    apple: '/agentflow-logo.svg?v=badge-2',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f4f5f1',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider><BillingProvider><WorkspaceProvider><ConnectionsProvider><KnowledgeProvider><ConversationsProvider><AIProvider><AgentFlowEventBridge/>{children}</AIProvider></ConversationsProvider></KnowledgeProvider></ConnectionsProvider></WorkspaceProvider></BillingProvider></AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
