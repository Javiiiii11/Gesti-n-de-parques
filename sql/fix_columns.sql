-- ============================================================================
-- ParkSales · Arreglo de columnas faltantes (ventas + contactos)
-- ============================================================================
-- Pega esto en Supabase → SQL Editor → Run.
-- Es seguro ejecutarlo varias veces.
-- ============================================================================

-- VENTAS
alter table public.ventas add column if not exists localizador text;
alter table public.ventas add column if not exists via text;
alter table public.ventas add column if not exists tipo text;
alter table public.ventas add column if not exists bono_id uuid references public.tipos_bono(id) on delete restrict;

-- CONTACTOS
alter table public.contactos add column if not exists via text;
alter table public.contactos add column if not exists localizador text;
alter table public.contactos add column if not exists localizador_bono text;

-- Ampliar el check de estado_pago por si falta "Apunte rápido"
do $$
begin
  alter table public.contactos drop constraint if exists contactos_estado_pago_check;
  alter table public.contactos drop constraint if exists chk_contactos_estado_pago;
  alter table public.contactos
    add constraint chk_contactos_estado_pago
    check (estado_pago in ('pendiente', 'pagado', 'Apunte rápido'));
exception
  when others then
    raise notice 'No se pudo actualizar el check de estado_pago: %', SQLERRM;
end $$;
