import { useRef, useState } from 'react'
import { PhotoPicker } from '../../components/PhotoPicker'
import { Sparkline } from '../../components/charts'
import { readThermoFile, statsForColumn, type ThermoStats } from '../../lib/thermo'
import { toNumber } from '../../lib/calculations'
import type { PhotoDraft, ThermoDraft } from '../../types'

const MAX_BYTES = 10 * 1024 * 1024

interface Props {
  thermos: ThermoDraft[]
  photos: PhotoDraft[]
  /** Límite de temperatura del transporte de la especificación ('' = sin límite). */
  limit: string
  onChange: (t: ThermoDraft[]) => void
  onAddPhotos: (p: PhotoDraft[]) => void
  onRemovePhoto: (id: string) => void
  onBusy: (b: boolean) => void
}

export function StatsTable({ s }: { s: ThermoStats }) {
  const t = (n: number) => `${n.toFixed(1)} °C`
  return (
    <table className="thermo-table">
      <tbody>
        <tr>
          <th>Lecturas</th>
          <td>{s.n}</td>
          <th>Mínima</th>
          <td>{t(s.min)}</td>
          <th>Máxima</th>
          <td>{t(s.max)}</td>
          <th>Media</th>
          <td>{t(s.avg)}</td>
        </tr>
        {(s.first || s.last) && (
          <tr>
            <th>Inicio</th>
            <td colSpan={3}>{s.first || '—'}</td>
            <th>Fin</th>
            <td colSpan={3}>{s.last || '—'}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

/** Termógrafo del transporte: archivo (CSV, TXT, Excel, PDF) y/o fotos. */
export function ThermoSection({ thermos, photos, limit, onChange, onAddPhotos, onRemovePhoto, onBusy }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const limitNum = toNumber(limit)

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    onBusy(true)
    setNotice(null)
    const added: ThermoDraft[] = []
    for (const f of Array.from(files)) {
      if (f.size > MAX_BYTES) {
        setNotice(`«${f.name}» supera los 10 MB y no se ha añadido.`)
        continue
      }
      let parsed = null
      try {
        parsed = await readThermoFile(f)
      } catch {
        /* formato ilegible: se guarda igualmente sin lecturas */
      }
      const best = parsed?.candidates[0]
      added.push({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        path: null,
        file: f,
        url: '',
        stats: parsed && best ? statsForColumn(parsed.rows, best.index, parsed.delimiter) : null,
        columnLabel: best?.label ?? '',
        candidates: parsed?.candidates,
        colIndex: best?.index,
        rows: parsed?.rows,
        delimiter: parsed?.delimiter,
      })
    }
    onChange([...thermos, ...added])
    setBusy(false)
    onBusy(false)
    if (input.current) input.current.value = ''
  }

  function changeColumn(t: ThermoDraft, index: number) {
    const c = t.candidates?.find((x) => x.index === index)
    if (!c || !t.rows) return
    onChange(thermos.map((x) => (x.id === t.id ? { ...x, colIndex: index, columnLabel: c.label, stats: statsForColumn(t.rows!, index, t.delimiter) } : x)))
  }

  return (
    <div className="photo-box thermo-box">
      <b>Termógrafo del transporte</b>
      <p className="muted" style={{ margin: '4px 0 8px' }}>
        Sube el archivo del termógrafo (CSV, TXT o Excel: se calculan mínima, máxima y media; PDF se guarda sin leer) y/o haz una foto de su pantalla o
        ticket.
      </p>
      <div className="photo-actions">
        <button type="button" className="btn secondary" disabled={busy} onClick={() => input.current?.click()}>
          📎 Subir archivo
        </button>
      </div>
      <input ref={input} type="file" multiple hidden accept=".csv,.txt,.tsv,.xlsx,.xls,.pdf" onChange={(e) => void addFiles(e.target.files)} />
      {notice && <div className="result bad">{notice}</div>}
      {busy && <div className="photo-count">Leyendo archivo…</div>}

      {thermos.map((t) => (
        <div className="thermo-item" key={t.id}>
          <div className="row-between" style={{ marginBottom: 4 }}>
            <span>
              <b>{t.name}</b> <span className="muted">({Math.max(1, Math.round(t.size / 1024))} KB)</span>
            </span>
            <button type="button" className="btn secondary thermo-x" onClick={() => onChange(thermos.filter((x) => x.id !== t.id))}>
              Quitar
            </button>
          </div>
          {t.stats ? (
            <>
              {t.candidates && t.candidates.length > 1 && (
                <label>
                  Columna de temperatura
                  <select value={t.colIndex} onChange={(e) => changeColumn(t, Number(e.target.value))}>
                    {t.candidates.map((c) => (
                      <option key={c.index} value={c.index}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {t.candidates && t.candidates.length === 1 && t.columnLabel && <p className="muted">Columna leída: {t.columnLabel}</p>}
              <StatsTable s={t.stats} />
              <Sparkline series={t.stats.series} limit={limitNum} />
              {limitNum !== null && t.stats.max > limitNum && (
                <div className="result bad">⚠ La máxima ({t.stats.max.toFixed(1)} °C) supera el límite de transporte de {limitNum} °C</div>
              )}
            </>
          ) : (
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {t.candidates && t.candidates.length === 0
                ? 'No se encontró ninguna columna de temperatura en el archivo. Se guarda igualmente junto a la recepción.'
                : 'No se han podido leer las lecturas (PDF u otro formato). El archivo se guarda junto a la recepción.'}
            </p>
          )}
        </div>
      ))}

      <h4 style={{ margin: '14px 0 4px' }}>Fotos del termógrafo</h4>
      <PhotoPicker kind="thermo" photos={photos} onAdd={onAddPhotos} onRemove={onRemovePhoto} onBusy={onBusy} />
    </div>
  )
}
