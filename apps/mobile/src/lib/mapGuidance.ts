import type { LineType } from '../types/index'

export interface EnergyTier {
  id: 'low' | 'medium' | 'high' | 'peak'
  label: string
  min: number
  max: number
  rangeLabel: string
  color: string
}

export const ENERGY_TIERS: EnergyTier[] = [
  {
    id: 'low',
    label: 'Low',
    min: 0,
    max: 0.25,
    rangeLabel: '0-24%',
    color: '#B6C3CF',
  },
  {
    id: 'medium',
    label: 'Medium',
    min: 0.25,
    max: 0.5,
    rangeLabel: '25-49%',
    color: '#86B8AF',
  },
  {
    id: 'high',
    label: 'High',
    min: 0.5,
    max: 0.75,
    rangeLabel: '50-74%',
    color: '#E3B06E',
  },
  {
    id: 'peak',
    label: 'Peak',
    min: 0.75,
    max: 1.01,
    rangeLabel: '75-100%',
    color: '#E87663',
  },
]

export interface LineTypeStyle {
  lineType: LineType
  label: string
  context: string
  dasharray?: number[]
  legendDasharray?: string
}

export const LINE_TYPE_STYLES: LineTypeStyle[] = [
  {
    lineType: 'MC',
    label: 'Midheaven',
    context: 'Career and visibility',
  },
  {
    lineType: 'IC',
    label: 'Imum Coeli',
    context: 'Home and roots',
    dasharray: [3, 2],
    legendDasharray: '7 5',
  },
  {
    lineType: 'ASC',
    label: 'Ascendant',
    context: 'Identity and momentum',
    dasharray: [1, 2],
    legendDasharray: '2 4',
  },
  {
    lineType: 'DSC',
    label: 'Descendant',
    context: 'Partnerships and mirrors',
    dasharray: [4, 2, 1, 2],
    legendDasharray: '8 4 2 4',
  },
]
