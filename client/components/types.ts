// =============================================================
// File: components/elements/types.ts
// =============================================================
import type { ReactNode } from 'react';

export interface PermisSaveResponse { id: number; [key: string]: any; }

export type LanguageCode = 'ar' | 'fr' | 'en' | string;
export interface PermisElement {
  id: string;
  type: 'text' | 'rectangle' | 'image' | 'line' | 'qrcode' | 'table';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  draggable?: boolean;
  rotation?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cornerRadius?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'bevel' | 'round' | 'miter';
  textAlign?: 'left' | 'center' | 'right' | string;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  padding?: number;
  letterSpacing?: number;
  lineHeight?: number;
  wrap?: 'word' | 'char' | 'none' | string;
  ellipsis?: boolean;
  qrData?: string;
  src?: string;
  // RTL / language support
  language?: LanguageCode;
  direction?: 'rtl' | 'ltr' | string;
  scaleX?: any;
  scaleY?: any;
  // Rich text styling ranges
  styledRanges?: Array<{
    start: number;
    end: number; // exclusive
    fontWeight?: 'bold' | 'normal';
    fontSize?: number;
    underline?: boolean;
    color?: string;
  }>;
  // Articles linkage
  isArticle?: boolean;
  articleId?: string;
  className?: string;
  dash?: number[];
  points?: number[];  // Fixed: use lowercase 'number[]'
  pageIndex?: any;
  meta?: any;
  align?: 'left' | 'center' | 'right';
  fontWeight?: string;

  // Table-specific (when type === 'table')
  rowsPerCol?: number;
  blockCols?: number;
  colWidths?: number[];
  rowHeight?: number;
  headerText?: string;
  headerHeight?: number;
  headerFill?: string;
  altRowFill?: string;
  showHeader?: boolean;
  tableFontFamily?: string;
  tableFontSize?: number;
  tableTextAlign?: 'left' | 'center' | 'right';
  showCellBorders?: boolean;
  tableGridColor?: string;
  tableGridWidth?: number;
  outerBorderColor?: string;
  outerBorderWidth?: number;
  headerTextAlign?: 'left' | 'center' | 'right';
  cellPadding?: number;
  canvasWidth?: number;
  pageLeftMargin?: number;
  pageRightMargin?: number;
  pageTopMargin?: number;
  pageBottomMargin?: number;
  tableData?: Array<Record<string, string | number>>;
  tableColumns?: Array<{ key: string; title: string; width?: number; align?: 'left' | 'center' | 'right' }>;
}

export interface PermisDesignerProps {
  procedureId?: number | null;
  initialData: any;
  onSaveTemplate?: (design: any) => Promise<void>;
  permisSaved?: boolean;
  permisId?: number | null;
  onSave: (design: any) => Promise<void>;
  onGeneratePdf: (design: any) => Promise<Blob>;
  onSavePermis: (permisData: any) => Promise<PermisSaveResponse>;
  extraActions?: PermisDesignerAction[];
  dataEditor?: PermisDesignerDataEditor;
  taxPreviewHideDueDate?: boolean;
  hideSavePermis?: boolean;
}

export type TaxDraftObligation = {
  tempId: string;
  permisId?: number | null;
  typePaiementId: number;
  typePaiementLabel: string;
  amount: number;
  fiscalYear: number | null;
  dueDate: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  detailsCalcul: string | null;
};

export type TaxPreviewResult = {
  obligations: TaxDraftObligation[];
  typeOptions?: Array<{ value: number; label: string }>;
  message?: string;
  skippedObligations?: TaxDraftObligation[];
  allowPaidDuplicates?: boolean;
};

export type PermisDesignerAction = {
  key: string;
  label: string;
  title?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  onClick: () => void | Promise<void>;
  onPreview?: () => Promise<TaxPreviewResult>;
  onConfirm?: (payload: TaxPreviewResult) => Promise<void>;
};

export type PermisDesignerDataOption = { value: string | number; label: string };
export type PermisDesignerDataField = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'textarea';
  dir?: 'rtl' | 'ltr';
  options?: PermisDesignerDataOption[];
  placeholder?: string;
  disabled?: boolean;
};
export type PermisDesignerDataSection = {
  title: string;
  fields: PermisDesignerDataField[];
};
export type PermisDesignerDataEditor = {
  enabled?: boolean;
  sections: PermisDesignerDataSection[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onSave?: () => void | Promise<void>;
  saving?: boolean;
  onApply?: () => void | Promise<void>;
  saveLabel?: string;
  applyLabel?: string;
};

export type CommonKonvaProps = {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  draggable?: boolean;
  onClick?: (e: any) => void;
  onTap?: (e: any) => void;
  onDragEnd?: (e: any) => void;
  onTransformEnd?: (e: any) => void;
  stroke?: string;
  strokeWidth?: number;
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  cornerRadius?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'bevel' | 'round' | 'miter';
  opacity?: number;
};

export interface TextEditOverlay {
  id: string;
  value: string;
  left: number;
  top: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  direction?: 'rtl' | 'ltr' | string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  height?: number;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface ArticleItem {
  id: string;
  title: string;       // e.g., "المادة 1"
  content: string;     // Arabic text
  preselected?: boolean;
}

export interface QRCodeData {
  typePermis: string;
  codeDemande: string;
  detenteur: string;
  superficie: number;
  duree: string;
  localisation: string;
  dateCreation: string;
  coordinates?: any[];
}