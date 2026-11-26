-- Migração 46: nenhuma sessão de login dura mais de 30 dias.
--
-- "Manter conectado" (src/lib/sessaoDaAba.ts) guarda a sessão no aparelho por até 30 dias e depois pede a senha. Esse prazo
-- vale no aparelho; esta migração faz valer também no servidor: se alguém copiar a sessão de um aparelho, ela para de
-- funcionar quando faz 30 dias do login com a senha (a renovação é recusada; o acesso que já estava emitido vence em até 1 h).
-- Vale para o site, o app Android e o painel de suporte (mesmo Supabase).
--
-- Rodável de novo. Precisa da extensão pg_cron (Database → Extensions no Supabase; o "create extension" abaixo liga).

create extension if not exists pg_cron;

create or replace function public.encerrar_sessoes_vencidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  -- apagar a sessão apaga junto os refresh tokens dela (o próprio Supabase faz assim ao sair)
  delete from auth.sessions where created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.encerrar_sessoes_vencidas() from public, anon, authenticated;
grant execute on function public.encerrar_sessoes_vencidas() to service_role;

-- de hora em hora (o agendamento com o mesmo nome é trocado, não duplicado)
select cron.unschedule(jobid) from cron.job where jobname = 'encerrar-sessoes-vencidas';
select cron.schedule('encerrar-sessoes-vencidas', '17 * * * *', 'select public.encerrar_sessoes_vencidas()');
