-- ============================================================================
-- ParkSales · Tabla de Permisos de Usuarios (Control de Localizadores)
-- ============================================================================
-- Instrucciones:
-- 1. Entra en tu panel de Supabase: https://supabase.com/dashboard
-- 2. Ve a SQL Editor → New Query
-- 3. Pega este código y pulsa "Run"
-- ============================================================================

create table if not exists public.usuarios_permisos (
    email               text primary key,
    ver_localizador     boolean not null default false,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.usuarios_permisos is 'Control de permisos por usuario para ver o no el campo localizador';

-- Habilitar RLS y permitir lectura/escritura para clientes autenticados y anónimos
alter table public.usuarios_permisos enable row level security;

drop policy if exists "Permitir lectura publica usuarios_permisos" on public.usuarios_permisos;
create policy "Permitir lectura publica usuarios_permisos"
    on public.usuarios_permisos for select
    using (true);

drop policy if exists "Permitir insercion usuarios_permisos" on public.usuarios_permisos;
create policy "Permitir insercion usuarios_permisos"
    on public.usuarios_permisos for insert
    with check (true);

drop policy if exists "Permitir actualizacion usuarios_permisos" on public.usuarios_permisos;
create policy "Permitir actualizacion usuarios_permisos"
    on public.usuarios_permisos for update
    using (true);

drop policy if exists "Permitir borrado usuarios_permisos" on public.usuarios_permisos;
create policy "Permitir borrado usuarios_permisos"
    on public.usuarios_permisos for delete
    using (true);

-- Trigger para updated_at automático si existe set_updated_at()
do $$
begin
    if exists (select 1 from pg_proc where proname = 'set_updated_at') then
        drop trigger if exists trg_usuarios_permisos_updated_at on public.usuarios_permisos;
        create trigger trg_usuarios_permisos_updated_at
            before update on public.usuarios_permisos
            for each row execute function public.set_updated_at();
    end if;
end $$;
