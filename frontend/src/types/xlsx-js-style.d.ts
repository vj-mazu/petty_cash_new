// Type declarations for xlsx-js-style
declare module 'xlsx-js-style' {
  import * as XLSX from 'xlsx';
  
  // Extend the standard XLSX types with styling capabilities
  interface CellStyle {
    font?: {
      name?: string;
      sz?: number;
      bold?: boolean;
      color?: { rgb?: string };
    };
    alignment?: {
      horizontal?: 'left' | 'center' | 'right';
      vertical?: 'top' | 'middle' | 'bottom';
    };
    border?: {
      top?: { style?: string; color?: { rgb?: string } };
      bottom?: { style?: string; color?: { rgb?: string } };
      left?: { style?: string; color?: { rgb?: string } };
      right?: { style?: string; color?: { rgb?: string } };
    };
    fill?: {
      fgColor?: { rgb?: string };
    };
  }

  interface StyledCell extends XLSX.CellObject {
    s?: CellStyle;
  }

  // Re-export all XLSX functionality
  export * from 'xlsx';
  
  // Override specific interfaces that support styling
  export interface WorkSheet extends XLSX.WorkSheet {
    [address: string]: StyledCell | any;
  }
}