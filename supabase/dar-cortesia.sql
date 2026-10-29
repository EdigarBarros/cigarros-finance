-- Dá (ou tira) a cortesia de contas específicas: acesso liberado para sempre, sem cobrança.
-- Supabase > SQL Editor > New query > troque os e-mails > Run. Seguro para rodar de novo.
-- Quem tem cortesia nunca é alterado pelos avisos do Stripe (o webhook ignora essas contas).

-- Dar cortesia:
insert into public.assinaturas (user_id, status)
select id, 'cortesia' from auth.users
where lower(email) in (
  'seu-email@exemplo.com',
  'amigo@exemplo.com'
)
on conflict (user_id) do update set status = 'cortesia', atualizado_em = now();

-- Tirar a cortesia de alguém (a pessoa volta à tela de assinatura):
-- update public.assinaturas set status = 'sem_assinatura', atualizado_em = now()
-- where user_id = (select id from auth.users where lower(email) = 'amigo@exemplo.com') and status = 'cortesia';
