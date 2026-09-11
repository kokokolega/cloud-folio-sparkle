// Runs every minute (pg_cron). Finds alarms due right now and pushes a
// notification to every device the owner has registered, so alarms alert even
// when the app is fully closed.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/firebase_messaging';

interface AlarmRow {
  id: string;
  user_id: string;
  label: string;
  alarm_time: string;
  repeat_days: number[];
  enabled: boolean;
  sound_mode: string;
  notif_title: string;
  notif_message: string;
  last_pushed_at: string | null;
}

function isDue(alarm: AlarmRow, now: Date): boolean {
  const [h, m] = (alarm.alarm_time || '').split(':').map((n) => parseInt(n, 10));
  if (isNaN(h) || isNaN(m)) return false;
  const due = new Date(now);
  due.setUTCSeconds(0, 0);
  // alarm_time is stored in the user's wall clock (device local time). The
  // scheduler runs in UTC, so compare against the same minute in UTC offsets
  // is impossible without a tz; we treat stored time as UTC+5:30 (app default).
  const local = new Date(now.getTime() + 5.5 * 3600_000);
  if (local.getUTCHours() !== h || local.getUTCMinutes() !== m) return false;
  if (alarm.repeat_days?.length && !alarm.repeat_days.includes(local.getUTCDay())) return false;
  if (alarm.last_pushed_at && now.getTime() - new Date(alarm.last_pushed_at).getTime() < 90_000) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const connectionApiKey = Deno.env.get('FIREBASE_MESSAGING_API_KEY');
  if (!LOVABLE_API_KEY || !connectionApiKey) {
    return new Response(JSON.stringify({ error: 'Push credentials are not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = new Date();
  const { data: alarms, error } = await supabase
    .from('alarms')
    .select('id,user_id,label,alarm_time,repeat_days,enabled,sound_mode,notif_title,notif_message,last_pushed_at')
    .eq('enabled', true);
  if (error) {
    console.error('Failed to read alarms:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const due = (alarms as AlarmRow[]).filter((a) => isDue(a, now));
  if (!due.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': connectionApiKey,
    'Content-Type': 'application/json',
  };

  let sent = 0;
  const staleTokens: string[] = [];

  for (const alarm of due) {
    const { data: tokens } = await supabase
      .from('device_push_tokens')
      .select('token,platform')
      .eq('user_id', alarm.user_id);
    if (!tokens?.length) continue;

    const silent = alarm.sound_mode === 'silent' || alarm.sound_mode === 'vibration_only';

    for (const t of tokens) {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: {
            token: t.token,
            notification: {
              title: alarm.notif_title || 'Oltrid Alarm',
              body: alarm.notif_message || alarm.label || 'Alarm',
            },
            data: { alarmId: alarm.id, path: '/alarm' },
            android: {
              priority: 'HIGH',
              notification: {
                channel_id: silent ? 'oltrid-alarms-silent' : 'oltrid-alarms',
                sound: silent ? undefined : 'beep.wav',
              },
            },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: { aps: { sound: silent ? undefined : 'default', 'interruption-level': 'time-sensitive' } },
            },
          },
        }),
      });

      if (res.ok) {
        sent++;
      } else {
        const body = await res.text();
        console.error(`FCM send failed [${res.status}]: ${body}`);
        if (res.status === 404 || res.status === 400) staleTokens.push(t.token);
      }
    }

    await supabase.from('alarms').update({ last_pushed_at: now.toISOString() }).eq('id', alarm.id);
  }

  if (staleTokens.length) {
    await supabase.from('device_push_tokens').delete().in('token', staleTokens);
  }

  return new Response(JSON.stringify({ sent, alarms: due.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
