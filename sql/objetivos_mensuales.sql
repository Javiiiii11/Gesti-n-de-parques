-- ============================================================================
-- ParkSales · Metas mensuales por usuario
-- Ejecuta en Supabase → SQL Editor si ya tienes el proyecto creado.
-- ============================================================================

create table if not exists public.objetivos_mensuales (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    mes         text not null check (mes ~ '^\d{4}-\d{2}$'),
    importe     numeric not null default 0 check (importe >= 0),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (user_id, mes)
);

comment on table public.objetivos_mensuales is 'Meta de ventas mensual por usuario (formato mes YYYY-MM)';

create index if not exists idx_objetivos_mensuales_user_mes
    on public.objetivos_mensuales (user_id, mes desc);

drop trigger if exists trg_objetivos_mensuales_updated_at on public.objetivos_mensuales;
create trigger trg_objetivos_mensuales_updated_at
    before update on public.objetivos_mensuales
    for each row execute function public.set_updated_at();

alter table public.objetivos_mensuales enable row level security;

drop policy if exists "objetivos_mensuales_select" on public.objetivos_mensuales;
create policy "objetivos_mensuales_select" on public.objetivos_mensuales
    for select using (auth.uid() = user_id);

drop policy if exists "objetivos_mensuales_insert" on public.objetivos_mensuales;
create policy "objetivos_mensuales_insert" on public.objetivos_mensuales
    for insert with check (auth.uid() = user_id);

drop policy if exists "objetivos_mensuales_update" on public.objetivos_mensuales;
create policy "objetivos_mensuales_update" on public.objetivos_mensuales
    for update using (auth.uid() = user_id);

drop policy if exists "objetivos_mensuales_delete" on public.objetivos_mensuales;
create policy "objetivos_mensuales_delete" on public.objetivos_mensuales
    for delete using (auth.uid() = user_id);
