-- ============================================================================
-- ParkSales · Esquema de base de datos para Supabase (PostgreSQL)
-- ============================================================================
-- Instrucciones:
-- 1. Entra en tu proyecto de Supabase → SQL Editor → New query
-- 2. Pega este archivo completo y pulsa "Run"
-- 3. Comprueba en Table Editor que se han creado "parques" y "ventas"
-- ============================================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tabla: parques
-- ----------------------------------------------------------------------------
create table if not exists public.parques (
    id                  uuid primary key default gen_random_uuid(),
    nombre              text not null unique,
    activo              boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.parques is 'Parques de ocio sobre los que se venden entradas';

-- ----------------------------------------------------------------------------
-- Tabla: ventas
-- ----------------------------------------------------------------------------
create table if not exists public.ventas (
    id              uuid primary key default gen_random_uuid(),
    fecha           timestamptz not null default now(),
    parque_id       uuid not null references public.parques(id) on delete restrict,
    cliente_nombre  text not null,
    importe_total   numeric(10,2) not null check (importe_total >= 0),
    created_at      timestamptz not null default now()
);

comment on table public.ventas is 'Registro individual de ventas de entradas';

alter table public.ventas add column if not exists cliente_nombre text;
update public.ventas set cliente_nombre = coalesce(cliente_nombre, 'Cliente') where cliente_nombre is null;

drop view if exists public.vw_ventas_resumen;

alter table public.ventas drop column if exists tipo_entrada;
alter table public.ventas drop column if exists cantidad;
alter table public.ventas drop column if exists precio_unitario;
alter table public.ventas drop column if exists comision;
alter table public.ventas drop column if exists observaciones;
alter table public.ventas drop column if exists user_id;

-- ----------------------------------------------------------------------------
-- Índices para que las consultas sigan siendo rápidas con miles de registros
-- ----------------------------------------------------------------------------
create index if not exists idx_ventas_fecha        on public.ventas (fecha desc);
create index if not exists idx_ventas_parque_id     on public.ventas (parque_id);
create index if not exists idx_ventas_cliente_nombre on public.ventas (cliente_nombre);
create index if not exists idx_ventas_importe_total  on public.ventas (importe_total desc);
create index if not exists idx_ventas_created_at    on public.ventas (created_at desc);
create index if not exists idx_parques_activo       on public.parques (activo);

-- ----------------------------------------------------------------------------
-- Trigger: mantener updated_at en parques
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_parques_updated_at on public.parques;
create trigger trg_parques_updated_at
    before update on public.parques
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Vista de estadísticas pre-agregadas (acelera el dashboard)
-- ----------------------------------------------------------------------------
create or replace view public.vw_ventas_resumen as
select
    v.id,
    v.fecha,
    date_trunc('day', v.fecha)   as dia,
    date_trunc('week', v.fecha)  as semana,
    date_trunc('month', v.fecha) as mes,
    p.nombre as parque,
    v.cliente_nombre,
    v.importe_total,
    v.created_at
from public.ventas v
join public.parques p on p.id = v.parque_id;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.parques enable row level security;
alter table public.ventas  enable row level security;

-- Lectura y escritura para cualquier usuario autenticado.
-- Ajusta estas políticas si en el futuro quieres separar datos por usuario
-- (por ejemplo añadiendo "user_id = auth.uid()" a cada política).

drop policy if exists "parques_select" on public.parques;
create policy "parques_select" on public.parques
    for select using (auth.role() = 'authenticated');

drop policy if exists "parques_insert" on public.parques;
create policy "parques_insert" on public.parques
    for insert with check (auth.role() = 'authenticated');

drop policy if exists "parques_update" on public.parques;
create policy "parques_update" on public.parques
    for update using (auth.role() = 'authenticated');

drop policy if exists "parques_delete" on public.parques;
create policy "parques_delete" on public.parques
    for delete using (auth.role() = 'authenticated');

drop policy if exists "ventas_select" on public.ventas;
create policy "ventas_select" on public.ventas
    for select using (auth.role() = 'authenticated');

drop policy if exists "ventas_insert" on public.ventas;
create policy "ventas_insert" on public.ventas
    for insert with check (auth.role() = 'authenticated');

drop policy if exists "ventas_update" on public.ventas;
create policy "ventas_update" on public.ventas
    for update using (auth.role() = 'authenticated');

drop policy if exists "ventas_delete" on public.ventas;
create policy "ventas_delete" on public.ventas
    for delete using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- Datos de ejemplo (opcional, comenta este bloque si no los quieres)
-- ----------------------------------------------------------------------------
insert into public.parques (nombre, activo)
values
    ('PortAventura', true),
    ('Isla Mágica', true),
    ('Terra Mítica', true)
on conflict (nombre) do nothing;
