import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { byCaliberName, useMasters } from '../../lib/masters'

type Tab = 'suppliers' | 'products' | 'calibers'
type Table = 'suppliers' | 'products' | 'calibers'

const TABS: { id: Tab; label: string }[] = [
  { id: 'suppliers', label: 'Proveedores' },
  { id: 'products', label: 'Productos' },
  { id: 'calibers', label: 'Calibres' },
]

function explain(err: { code?: string; message: string }): string {
  if (err.code === '23505') return 'Ya existe un registro con ese nombre.'
  if (err.code === '23503') return 'Está en uso (recepciones o acuerdos). No se puede eliminar: desactívalo para que no se pueda elegir.'
  return err.message
}

export function MastersPage() {
  const { suppliers, products, calibers, loaded, error: loadError, refresh } = useMasters()
  const [tab, setTab] = useState<Tab>('suppliers')
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newDryMatter, setNewDryMatter] = useState(false)
  const [caliberProduct, setCaliberProduct] = useState('')

  async function run(op: PromiseLike<{ error: { code?: string; message: string } | null }>) {
    const { error: err } = await op
    setError(err ? explain(err) : null)
    refresh()
    return !err
  }

  const update = (table: Table, id: string, patch: Record<string, unknown>) => run(supabase.from(table).update(patch).eq('id', id))

  async function remove(table: Table, id: string, name: string, extra = '') {
    if (!confirm(`¿Eliminar "${name}"?${extra}`)) return
    await run(supabase.from(table).delete().eq('id', id))
  }

  async function addSupplier() {
    const name = newName.trim()
    if (!name) return
    if (await run(supabase.from('suppliers').insert({ name }))) setNewName('')
  }

  async function addProduct() {
    const name = newName.trim()
    if (!name) return
    if (await run(supabase.from('products').insert({ name, has_dry_matter: newDryMatter }))) {
      setNewName('')
      setNewDryMatter(false)
    }
  }

  async function addCalibers() {
    const productId = caliberProduct || products[0]?.id
    const names = [...new Set(newName.split(/[,;\n]+/).map((n) => n.trim()).filter(Boolean))]
    if (!productId || !names.length) return
    if (await run(supabase.from('calibers').insert(names.map((name) => ({ product_id: productId, name }))))) setNewName('')
  }

  const selectedProduct = caliberProduct || products[0]?.id || ''
  const productCalibers = calibers.filter((c) => c.product_id === selectedProduct).sort(byCaliberName)

  return (
    <div>
      <div className="steps">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => {
              setTab(t.id)
              setNewName('')
              setError(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(error || loadError) && <div className="result bad">{error ?? loadError}</div>}
      {!loaded && !loadError && <p className="muted">Cargando…</p>}

      {tab === 'suppliers' && (
        <div className="card">
          <h2>Proveedores</h2>
          <div className="add-row">
            <input
              placeholder="Nombre del proveedor"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSupplier()}
            />
            <button className="btn ok" onClick={addSupplier}>
              + Añadir
            </button>
          </div>
          <div className="list">
            {suppliers.map((s) => (
              <div className="list-item" key={s.id}>
                <input
                  className="inline"
                  defaultValue={s.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== s.name && update('suppliers', s.id, { name: e.target.value.trim() })}
                />
                <label className="check">
                  <input type="checkbox" checked={s.active} onChange={(e) => update('suppliers', s.id, { active: e.target.checked })} />
                  Activo
                </label>
                <button
                  className="btn danger"
                  onClick={() => remove('suppliers', s.id, s.name, '\n\nTambién se eliminarán sus acuerdos.')}
                >
                  Eliminar
                </button>
              </div>
            ))}
            {loaded && !suppliers.length && <p className="muted">No hay proveedores todavía.</p>}
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="card">
          <h2>Productos</h2>
          <div className="add-row">
            <input
              placeholder="Nombre del producto"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProduct()}
            />
            <label className="check">
              <input type="checkbox" checked={newDryMatter} onChange={(e) => setNewDryMatter(e.target.checked)} />
              Pide materia seca
            </label>
            <button className="btn ok" onClick={addProduct}>
              + Añadir
            </button>
          </div>
          <div className="list">
            {products.map((p) => (
              <div className="list-item" key={p.id}>
                <input
                  className="inline"
                  defaultValue={p.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== p.name && update('products', p.id, { name: e.target.value.trim() })}
                />
                <label className="check">
                  <input type="checkbox" checked={p.has_dry_matter} onChange={(e) => update('products', p.id, { has_dry_matter: e.target.checked })} />
                  Materia seca
                </label>
                <label className="check">
                  <input type="checkbox" checked={p.active} onChange={(e) => update('products', p.id, { active: e.target.checked })} />
                  Activo
                </label>
                <button
                  className="btn danger"
                  onClick={() => remove('products', p.id, p.name, '\n\nTambién se eliminarán sus calibres y acuerdos.')}
                >
                  Eliminar
                </button>
              </div>
            ))}
            {loaded && !products.length && <p className="muted">No hay productos todavía.</p>}
          </div>
        </div>
      )}

      {tab === 'calibers' && (
        <div className="card">
          <h2>Calibres</h2>
          <label>
            Producto
            <select value={selectedProduct} onChange={(e) => setCaliberProduct(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.active ? '' : ' (inactivo)'}
                </option>
              ))}
            </select>
          </label>
          <div className="add-row">
            <input
              placeholder="Calibre (varios separados por coma: 12, 14, 16)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCalibers()}
            />
            <button className="btn ok" onClick={addCalibers} disabled={!selectedProduct}>
              + Añadir
            </button>
          </div>
          <div className="list">
            {productCalibers.map((c) => (
              <div className="list-item" key={c.id}>
                <input
                  className="inline"
                  defaultValue={c.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && update('calibers', c.id, { name: e.target.value.trim() })}
                />
                <label className="check">
                  <input type="checkbox" checked={c.active} onChange={(e) => update('calibers', c.id, { active: e.target.checked })} />
                  Activo
                </label>
                <button className="btn danger" onClick={() => remove('calibers', c.id, c.name)}>
                  Eliminar
                </button>
              </div>
            ))}
            {loaded && !productCalibers.length && <p className="muted">Este producto no tiene calibres todavía.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
