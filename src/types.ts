import type { Result } from './lib/evaluation'
import type { Candidate, ThermoStats } from './lib/thermo'

export type Role = 'inspector' | 'calidad' | 'admin'

export const ROLE_LABELS: Record<Role, string> = {
  inspector: 'Inspector',
  calidad: 'Calidad',
  admin: 'Administrador',
}
export type PhotoKind = 'label' | 'pallet' | 'cut' | 'defect' | 'origin' | 'thermo'

export const GENERAL_PHOTO_LABELS: Record<'label' | 'pallet' | 'cut', string> = {
  label: 'Albarán / etiqueta',
  pallet: 'Palet',
  cut: 'Corte / maduración',
}

export interface Profile {
  id: string
  full_name: string
  role: Role
  active: boolean
}

export interface Supplier {
  id: string
  name: string
  active: boolean
}

export interface Product {
  id: string
  name: string
  has_dry_matter: boolean
  active: boolean
}

export interface Origin {
  id: string
  name: string
  active: boolean
}

export interface DefectType {
  id: string
  name: string
  active: boolean
}

export interface Caliber {
  id: string
  product_id: string
  name: string
  active: boolean
}

export interface Agreement {
  id: string
  supplier_id: string
  product_id: string
  format: string
  boxes_per_pallet: number
  min_kg_box: number
  tare_box: number
  tare_pallet: number
  tare_other: number
  max_temperature: number | null
  min_brix: number | null
  max_defect_pct: number | null
  min_dry_matter: number | null
  max_transport_temp: number | null
}

export interface ReceptionSummary {
  id: string
  received_at: string
  product: string
  supplier_name: string
  lot: string
  status: 'draft' | 'closed'
  inspector_id: string
  breaches: number
  auto_result: Result | null
  decision: Result | null
  profiles: { full_name: string } | null
}

/** Foto en edición: puede ser ya guardada (path) o nueva (file). */
export interface PhotoDraft {
  id: string
  kind: PhotoKind
  defectId: string | null
  /** Solo fotos de origen: índice (0, 1, …) del palet al que pertenecen. */
  palletIndex: number | null
  path: string | null
  file: Blob | null
  url: string
}

/** Archivo de termógrafo en edición: ya guardado (path) o nuevo (file). */
export interface ThermoDraft {
  id: string
  name: string
  size: number
  path: string | null
  file: Blob | null
  /** Enlace para descargar el archivo guardado. */
  url: string
  stats: ThermoStats | null
  columnLabel: string
  /** Solo mientras se edita un archivo nuevo: columnas candidatas y filas leídas (para cambiar de columna). */
  candidates?: Candidate[]
  colIndex?: number
  rows?: string[][]
  delimiter?: string
}

export interface DefectDraft {
  id: string
  defectTypeId: string | null
  name: string
  percent: string
}

export interface PalletDraft {
  boxes: string
  gross: string
}

/** Todos los números son strings mientras se editan (campos de formulario). */
export interface ReceptionDraft {
  id: string | null
  received_at: string // valor de <input type="datetime-local">
  product_id: string | null
  product: string
  caliber_id: string | null
  caliber: string
  supplier_id: string | null
  supplier_name: string
  lot: string
  origin_id: string | null
  origin: string
  truck: string
  format: string
  boxes_per_pallet: string
  min_kg_box: string
  tare_box: string
  tare_pallet: string
  tare_other: string
  temperature: string
  firmness: string
  brix: string
  lab_ref: string
  dry_matter: string
  notes: string
  status: 'draft' | 'closed'
  /** Límites de la especificación con que se evalúa ('' = no se comprueba). */
  limit_max_temperature: string
  limit_min_brix: string
  limit_max_defect_pct: string
  limit_min_dry_matter: string
  limit_max_transport_temp: string
  /** Evaluación calculada al guardar. */
  breaches: number
  auto_result: Result | null
  /** Decisión final de Calidad (opcional) y su comentario. */
  decision: Result | null
  decision_note: string
  decided_by: string | null
  decided_at: string | null
  inspector_name?: string // solo lectura
  thermos: ThermoDraft[]
  pallets: PalletDraft[]
  defects: DefectDraft[]
  photos: PhotoDraft[]
}
