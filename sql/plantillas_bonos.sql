-- ============================================================================
-- Tabla: plantillas_bonos (ParkSite -> Extensión Chrome)
-- ============================================================================
-- Permite guardar plantillas de bonos con abreviaturas (/1, /2, etc.)
-- para sincronizarlas con la extensión de Chrome y reutilizarlas en bonoparques.es
-- ============================================================================

create table if not exists public.plantillas_bonos (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid references auth.users (id) on delete cascade,
    abreviatura         text not null,
    descripcion         text,
    datos               jsonb not null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- Índices para búsquedas rápidas por usuario y abreviatura
create index if not exists idx_plantillas_bonos_user_id on public.plantillas_bonos (user_id);
create index if not exists idx_plantillas_bonos_abrev on public.plantillas_bonos (abreviatura);

-- RLS (Row Level Security): cada usuario solo lee y modifica sus plantillas
alter table public.plantillas_bonos enable row level security;

drop policy if exists "Los usuarios pueden ver sus propias plantillas" on public.plantillas_bonos;
create policy "Los usuarios pueden ver sus propias plantillas"
    on public.plantillas_bonos for select
    using (auth.uid() = user_id or user_id is null);

drop policy if exists "Los usuarios pueden insertar sus propias plantillas" on public.plantillas_bonos;
create policy "Los usuarios pueden insertar sus propias plantillas"
    on public.plantillas_bonos for insert
    with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Los usuarios pueden actualizar sus propias plantillas" on public.plantillas_bonos;
create policy "Los usuarios pueden actualizar sus propias plantillas"
    on public.plantillas_bonos for update
    using (auth.uid() = user_id or user_id is null);

drop policy if exists "Los usuarios pueden eliminar sus propias plantillas" on public.plantillas_bonos;
create policy "Los usuarios pueden eliminar sus propias plantillas"
    on public.plantillas_bonos for delete
    using (auth.uid() = user_id or user_id is null);

-- Trigger para updated_at automático
drop trigger if exists trg_plantillas_bonos_updated_at on public.plantillas_bonos;
create trigger trg_plantillas_bonos_updated_at
    before update on public.plantillas_bonos
    for each row execute function public.set_updated_at();

