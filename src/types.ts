export type Role = 'inspector' | 'admin'
export type PhotoKind = 'label' | 'pallet' | 'cut' | 'defect'

export const GENERAL_PHOTO_LABELS: Record<Exclude<PhotoKind, 'defect'>, string> = {
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
}

export interface ReceptionSummary {
  id: string
  received_at: string
  product: string
  supplier_name: string
  lot: string
  status: 'draft' | 'closed'
  inspector_id: string
  profiles: { full_name: string } | null
}

/** Foto en edición: puede ser ya guardada (path) o nueva (file). */
export interface PhotoDraft {
  id: string
  kind: PhotoKind
  defectId: string | null
  path: string | null
  file: Blob | null
  url: string
}

export interface DefectDraft {
  id: string
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
  pallets: PalletDraft[]
  defects: DefectDraft[]
  photos: PhotoDraft[]
}
