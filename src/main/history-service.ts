import { randomUUID } from 'crypto';
import { getSupabaseClient } from './supabase-client';
import { LocalHistoryService } from './local-history-service';
import type { HistoryListResult, HistoryDeleteResult, TranscriptionStatsResult } from '../shared/types';

const localHistory = new LocalHistoryService();

export class HistoryService {
  getHistoryDir(): string {
    return localHistory.getHistoryDir();
  }

  setHistoryDir(dir: string): void {
    localHistory.setHistoryDir(dir);
  }

  async save(record: {
    original_text: string;
    optimized_text: string | null;
    app_context: string | null;
    duration_seconds: number | null;
  }): Promise<void> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    // 1. Save full content locally
    const saved = localHistory.save({
      id,
      original_text: record.original_text,
      optimized_text: record.optimized_text,
      app_context: record.app_context,
      duration_seconds: record.duration_seconds,
      created_at: createdAt,
    });

    // 2. Increment cumulative stats in Supabase (single row per user)
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.rpc('increment_user_stats', {
      p_user_id: session.user.id,
      p_word_count: saved.word_count,
      p_duration_seconds: record.duration_seconds ?? 0,
    });
    if (error) {
      console.error('[Stats] Failed to increment:', error.message);
    }
  }

  async list(page: number, pageSize: number): Promise<HistoryListResult> {
    const result = localHistory.list(page, pageSize);
    return {
      data: result.data.map(r => ({
        id: r.id,
        original_text: r.original_text,
        optimized_text: r.optimized_text,
        app_context: r.app_context,
        language: null,
        duration_seconds: r.duration_seconds,
        created_at: r.created_at,
      })),
      total: result.total,
    };
  }

  async delete(id: string): Promise<HistoryDeleteResult> {
    // Read local record first to get stats for decrement
    const record = localHistory.getById(id);

    // Delete local file
    localHistory.delete(id);

    // Decrement cumulative stats in Supabase
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session && record) {
      await supabase.rpc('decrement_user_stats', {
        p_user_id: session.user.id,
        p_word_count: record.word_count,
        p_duration_seconds: record.duration_seconds ?? 0,
      });
    }

    return { success: true };
  }

  async getStats(): Promise<TranscriptionStatsResult> {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { totalWords: 0, totalCount: 0, totalDurationSeconds: 0 };
    }

    // Single row read — no aggregation needed
    const { data } = await supabase
      .from('user_stats')
      .select('total_word_count, total_count, total_duration_seconds')
      .eq('user_id', session.user.id)
      .single();

    if (!data) {
      return { totalWords: 0, totalCount: 0, totalDurationSeconds: 0 };
    }

    return {
      totalWords: data.total_word_count,
      totalCount: data.total_count,
      totalDurationSeconds: data.total_duration_seconds,
    };
  }
}
