import { FileText, Search, Users, Settings, FolderOpen, Plus, Database, Calculator, Download, Filter, BarChart3, PieChart, AlertTriangle, CheckCircle, XCircle, Clock, Cpu, Globe, BookOpen, Microscope, Heart, Activity, Zap, Target, Layers, GitBranch, Clipboard, FileSpreadsheet, Upload, DownloadCloud, RefreshCw, Eye, Trash, Edit, ChevronRight } from 'lucide-react';

export function EmptyState({ children, icon, title }: { children: React.ReactNode; icon?: 'search' | 'users' | 'settings' | 'folder' | 'plus' | 'database' | 'calculator' | 'download' | 'filter' | 'chart' | 'pie' | 'warning' | 'check' | 'x' | 'clock' | 'cpu' | 'globe' | 'book' | 'microscope' | 'heart' | 'activity' | 'zap' | 'target' | 'layers' | 'git' | 'clipboard' | 'spreadsheet' | 'upload' | 'cloud' | 'refresh' | 'eye' | 'trash' | 'edit' | 'chevron'; title?: string }) {
  const iconMap = {
    search: Search, users: Users, settings: Settings, folder: FolderOpen, plus: Plus,
    database: Database, calculator: Calculator, download: Download, filter: Filter,
    chart: BarChart3, pie: PieChart, warning: AlertTriangle, check: CheckCircle, x: XCircle,
    clock: Clock, cpu: Cpu, globe: Globe, book: BookOpen, microscope: Microscope,
    heart: Heart, activity: Activity, zap: Zap, target: Target, layers: Layers,
    git: GitBranch, clipboard: Clipboard, spreadsheet: FileSpreadsheet, upload: Upload,
    cloud: DownloadCloud, refresh: RefreshCw, eye: Eye, trash: Trash, edit: Edit, chevron: ChevronRight,
  };
  const Icon = icon ? iconMap[icon] : FileText;
  
  return (
    <div className="rounded-[5px] border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
      <div className="flex justify-center mb-3">
        <Icon className="h-8 w-8 text-[var(--color-text-muted)] opacity-50" />
      </div>
      {title && <div className="text-[12.5px] font-medium text-[var(--color-text-muted)] mb-1">{title}</div>}
      <div className="text-[12px] text-[var(--color-text-muted)]/70">{children}</div>
    </div>
  );
}
