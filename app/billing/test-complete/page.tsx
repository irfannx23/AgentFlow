import { BillingResult } from '@/components/billing-result'

export default async function Page({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { result } = await searchParams
  return <BillingResult status={result === 'success' ? 'success' : 'failure'}/>
}
