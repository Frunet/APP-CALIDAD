import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { toNumber } from '../../lib/calculations'
import { useMasters } from '../../lib/masters'
import { listAgreements, type AgreementWithSupplier } from '../receptions/api'

interface Form {
  id: string | null
  supplierId: string
  productId: string
  format: string
  boxes: string
  minKg: string
  tareBox: string
  tarePallet: string
  tareOther: string
}

const blank: Form = {
  id: null, supplierId: '', productId: '', format: '', boxes: '80', minKg: '12', tareBox: '0', tarePallet: '0', tareOther: '0',
}

export function AgreementsPage() {
  const { isAdmin } = useAuth()
  const { suppliers, products } = useMasters()
  const [list, setList] = useState<AgreementWithSupplier[]>([])
  const [form, setForm] = useState<Form>(blank)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    listAgreements().then(setList).catch(() => setError('No se pudieron cargar los acuerdos.'))
  }, [])
  useEffect(refresh, [refresh])

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    if (!form.supplierId) return setError('Selecciona el proveedor.')
    if (!form.productId) return setError('Selecciona el producto.')
    setError(null)
    const row = {
      supplier_id: form.supplierId,
      product_id: form.productId,
      format: form.format.trim(),
      boxes_per_pallet: Math.round(toNumber(form.boxes) ?? 0),
      min_kg_box: toNumber(form.minKg) ?? 0,
      tare_box: toNumber(form.tareBox) ?? 0,
      tare_pallet: toNumber(form.tarePallet) ?? 0,
      tare_other: toNumber(form.tareOther) ?? 0,
    }
    const { error: err } = form.id
      ? await supabase.from('agreements').update(row).eq('id', form.id)
      : await supabase.from('agreements').insert(row)
    if (err) return setError(err.code === '23505' ? 'Ya existe un acuerdo con ese proveedor, producto y formato.' : err.message)
    setForm(blank)
    refresh()
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar este acuerdo?')) return
    const { error: err } = await supabase.from('agreements').delete().eq('id', id)
    if (err) setError(err.message)
    refresh()
  }

  function edit(a: AgreementWithSupplier) {
    setForm({
      id: a.id, supplierId: a.supplier_id, productId: a.product_id, format: a.format,
      boxes: String(a.boxes_per_pallet), minKg: String(a.min_kg_box), tareBox: String(a.tare_box),
      tarePallet: String(a.tare_pallet), tareOther: String(a.tare_other),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const supplierOptions = suppliers.filter((s) => s.active || s.id === form.supplierId)
  const productOptions = products.filter((p) => p.active || p.id === form.productId)

  return (
    <div>
      {isAdmin && (
        <div className="card">
          <h2>Acuerdo con proveedor</h2>
          <p className="muted">
            Al iniciar una recepción con el mismo proveedor, producto y formato, estas condiciones se cargan solas. Los proveedores y
            productos se dan de alta en Maestros.
          </p>
          <div className="grid">
            <label>Proveedor
              <select value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
                <option value="">— Selecciona —</option>
                {supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>Producto
              <select value={form.productId} onChange={(e) => set('productId', e.target.value)}>
                <option value="">— Selecciona —</option>
                {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Formato / referencia<input value={form.format} onChange={(e) => set('format', e.target.value)} placeholder="Ej. Caja 12 kg" /></label>
            <label>Cajas por palet<input type="number" min={0} value={form.boxes} onChange={(e) => set('boxes', e.target.value)} /></label>
            <label>Mínimo kg/caja<input type="number" min={0} step="0.01" value={form.minKg} onChange={(e) => set('minKg', e.target.value)} /></label>
            <label>Tara caja (kg)<input type="number" min={0} step="0.001" value={form.tareBox} onChange={(e) => set('tareBox', e.target.value)} /></label>
            <label>Tara palet (kg)<input type="number" min={0} step="0.001" value={form.tarePallet} onChange={(e) => set('tarePallet', e.target.value)} /></label>
            <label>Otras taras (kg)<input type="number" min={0} step="0.001" value={form.tareOther} onChange={(e) => set('tareOther', e.target.value)} /></label>
          </div>
          {error && <div className="result bad">{error}</div>}
          <div className="actions">
            <button className="btn ok" onClick={save}>{form.id ? 'Guardar cambios' : 'Guardar acuerdo'}</button>
            {form.id && <button className="btn secondary" onClick={() => setForm(blank)}>Cancelar edición</button>}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Acuerdos guardados</h2>
        {!isAdmin && <p className="muted">Solo los administradores pueden modificar los acuerdos.</p>}
        {!isAdmin && error && <div className="result bad">{error}</div>}
        {list.length === 0 && <p className="muted">No hay acuerdos guardados todavía.</p>}
        <div className="list">
          {list.map((a) => (
            <div className="list-item" key={a.id}>
              <div>
                <strong>{a.suppliers?.name}</strong> · {a.products?.name}{a.format ? ` · ${a.format}` : ''}
                <br />
                <span className="muted">
                  {a.boxes_per_pallet} cajas/palet · mínimo {a.min_kg_box} kg/caja · tara caja {a.tare_box} kg · palet {a.tare_pallet} kg · otras {a.tare_other} kg
                </span>
              </div>
              {isAdmin && (
                <div className="list-actions">
                  <button className="btn secondary" onClick={() => edit(a)}>Editar</button>
                  <button className="btn danger" onClick={() => remove(a.id)}>Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
