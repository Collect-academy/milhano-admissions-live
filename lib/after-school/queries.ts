import 'server-only'
import { unstable_cache } from 'next/cache'
import { as26Admin } from './supabase-admin'

export const getSummary = unstable_cache(
  async () => {
    const { data, error } = await as26Admin().rpc('as26_dashboard_summary')
    if (error) throw error
    return data
  },
  ['as26-summary-v19'],
  { revalidate: 15, tags: ['as26-summary'] }
)

export const getSessions = unstable_cache(
  async () => {
    const { data, error } = await as26Admin()
      .from('as26_session_overview')
      .select('*')
      .eq('active', true)
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw error
    return data ?? []
  },
  ['as26-sessions-v19'],
  { revalidate: 15, tags: ['as26-sessions'] }
)

export async function getParticipants(search = '', page = 1, pageSize = 50) {
  const offset = Math.max(0, (page - 1) * pageSize)
  const { data, error } = await as26Admin().rpc('as26_participants_page', {
    p_search: search || null,
    p_limit: pageSize,
    p_offset: offset
  })
  if (error) throw error
  return data ?? []
}

export async function getSession(id: string) {
  const { data, error } = await as26Admin()
    .from('as26_session_overview')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getRoster(id: string) {
  const { data, error } = await as26Admin().rpc('as26_session_roster', { p_session_id: id })
  if (error) throw error
  return data ?? []
}

export async function getWorkshops() {
  const { data, error } = await as26Admin()
    .from('as26_workshops')
    .select('id,name,code')
    .eq('active', true)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}
