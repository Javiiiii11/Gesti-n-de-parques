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
    horario_url         text,
    horario_texto       text,
    activo              boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- Add horario_url column if it doesn't exist yet
alter table public.parques add column if not exists horario_url text;
-- Add horario_texto column if it doesn't exist yet
alter table public.parques add column if not exists horario_texto text;

comment on table public.parques is 'Parques de ocio sobre los que se venden entradas';

-- ----------------------------------------------------------------------------
-- Tabla: tipos_bono
-- ----------------------------------------------------------------------------
create table if not exists public.tipos_bono (
    id                  uuid primary key default gen_random_uuid(),
    nombre              text not null unique,
    activo              boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.tipos_bono is 'Tipos de bonos que se venden';

-- ----------------------------------------------------------------------------
-- Tabla: ventas
-- ----------------------------------------------------------------------------
create table if not exists public.ventas (
  id              uuid primary key default gen_random_uuid(),
  fecha           timestamptz not null default now(),
  tipo            text not null check (tipo in ('entrada', 'bono')) default 'entrada',
  parque_id       uuid references public.parques(id) on delete restrict,
  bono_id         uuid references public.tipos_bono(id) on delete restrict,
  cliente_nombre  text not null,
  importe_total   numeric(10,2) not null check (importe_total >= 0),
  localizador     text,
  created_at      timestamptz not null default now(),
  -- At least one of parque_id or bono_id must be set
  constraint chk_parque_or_bono check (
    (tipo = 'entrada' and parque_id is not null) or 
    (tipo = 'bono' and bono_id is not null)
  )
);

-- ----------------------------------------------------------------------------
-- Tabla: contactos
-- ----------------------------------------------------------------------------
create table if not exists public.contactos (
  id uuid default gen_random_uuid() primary key,
  tipo text not null check (tipo in ('entrada', 'bono')),
  estado_pago text not null check (estado_pago in ('pendiente', 'pagado', 'Apunte rápido')),
  nombre_apellidos text not null,
  correo text,
  importe_total numeric default 0,
  anotaciones text,
  
  -- Campos para entradas
  telefono text,
  parque_id uuid references public.parques(id),
  cantidad_entradas integer,
  extras text,
  localizador text,
  
  -- Campos para bonos
  num_bono text,
  dni text,
  fecha_nacimiento date,
  bono_id uuid references public.tipos_bono(id),
  cantidad_bonos integer,
  localizador_bono text,
  
  created_at timestamptz not null default now()
);

comment on table public.ventas is 'Registro individual de ventas de entradas y bonos';

-- Add missing columns to existing ventas table and make parque_id nullable
alter table public.ventas add column if not exists tipo text check (tipo in ('entrada', 'bono')) default 'entrada';
alter table public.ventas add column if not exists bono_id uuid references public.tipos_bono(id) on delete restrict;

-- Make parque_id nullable (if it's not already)
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_name = 'ventas' 
    and column_name = 'parque_id' 
    and is_nullable = 'NO'
  ) then
    alter table public.ventas alter column parque_id drop not null;
  end if;
end $$;

-- Add check constraint if not exists
do $$ 
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where table_name = 'ventas' and constraint_name = 'chk_parque_or_bono'
  ) then
    alter table public.ventas 
    add constraint chk_parque_or_bono 
    check (
      (tipo = 'entrada' and parque_id is not null) or 
      (tipo = 'bono' and bono_id is not null)
    );
  end if;
end $$;

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
create index if not exists idx_ventas_tipo         on public.ventas (tipo);
create index if not exists idx_ventas_parque_id     on public.ventas (parque_id);
create index if not exists idx_ventas_bono_id       on public.ventas (bono_id);
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
    v.tipo,
    date_trunc('day', v.fecha)   as dia,
    date_trunc('week', v.fecha)  as semana,
    date_trunc('month', v.fecha) as mes,
    p.nombre as parque,
    tb.nombre as tipo_bono,
    v.cliente_nombre,
    v.importe_total,
    v.created_at
from public.ventas v
left join public.parques p on p.id = v.parque_id
left join public.tipos_bono tb on tb.id = v.bono_id;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.parques enable row level security;
alter table public.ventas  enable row level security;
alter table public.tipos_bono enable row level security;
alter table public.contactos enable row level security;

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

-- RLS policies for tipos_bono
drop policy if exists "tipos_bono_select" on public.tipos_bono;
create policy "tipos_bono_select" on public.tipos_bono
    for select using (auth.role() = 'authenticated');

drop policy if exists "tipos_bono_insert" on public.tipos_bono;
create policy "tipos_bono_insert" on public.tipos_bono
    for insert with check (auth.role() = 'authenticated');

drop policy if exists "tipos_bono_update" on public.tipos_bono;
create policy "tipos_bono_update" on public.tipos_bono
    for update using (auth.role() = 'authenticated');

drop policy if exists "tipos_bono_delete" on public.tipos_bono;
create policy "tipos_bono_delete" on public.tipos_bono
    for delete using (auth.role() = 'authenticated');

-- RLS policies for contactos
drop policy if exists "contactos_select" on public.contactos;
create policy "contactos_select" on public.contactos
    for select using (auth.role() = 'authenticated');

drop policy if exists "contactos_insert" on public.contactos;
create policy "contactos_insert" on public.contactos
    for insert with check (auth.role() = 'authenticated');

drop policy if exists "contactos_update" on public.contactos;
create policy "contactos_update" on public.contactos
    for update using (auth.role() = 'authenticated');

drop policy if exists "contactos_delete" on public.contactos;
create policy "contactos_delete" on public.contactos
    for delete using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- Actualización del check constraint para estado_pago en contactos
-- ----------------------------------------------------------------------------
do $$
begin
  -- Intentar eliminar la restricción por defecto de Supabase (suele llamarse contactos_estado_pago_check)
  alter table public.contactos drop constraint if exists contactos_estado_pago_check;
  
  -- Intentar eliminar chk_contactos_estado_pago si ya se creó antes
  alter table public.contactos drop constraint if exists chk_contactos_estado_pago;

  -- Crear la nueva restricción que incluye 'Apunte rápido'
  alter table public.contactos add constraint chk_contactos_estado_pago check (estado_pago in ('pendiente', 'pagado', 'Apunte rápido'));
end $$;
