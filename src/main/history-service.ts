import { getSupabaseClient } from './supabase-client';
import type { HistoryListResult, HistoryDeleteResult } from '../shared/types';

export class HistoryService {
  async save(record: {
    original_text: string;
    optimized_text: string | null;
    app_context: string | null;
    duration_seconds: number | null;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // Not logged in, don't save

    await supabase.from('transcription_history').insert({
      user_id: session.user.id,
      ...record,
    });
  }

  async list(page: number, pageSize: number): Promise<HistoryListResult> {
    const supabase = getSupabaseClient();
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, count } = await supabase
      .from('transcription_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    return { data: data || [], total: count || 0 };
  }

  async delete(id: string): Promise<HistoryDeleteResult> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('transcription_history').delete().eq('id', id);
    return { success: !error, error: error?.message };
  }
}
