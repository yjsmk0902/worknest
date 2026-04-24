import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@worknest/ui';
import { Download, Loader2, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { apiClient } from '../../lib/api-client';

// ── Minimal CSV parser (RFC 4180-ish) ─────────────────────────────────

/** Parse a CSV string into rows of strings. Handles quoted fields and
 *  doubled quotes within fields. Ignores CR.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // skip
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

interface ImportRow {
  title: string;
  descriptionText?: string;
  priority?: string;
  statusName?: string;
  typeName?: string;
  assigneeEmails?: string[];
  labelNames?: string[];
  startDate?: string;
  dueDate?: string;
}

/** Map a header string to a canonical field name. */
function headerKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

function mapHeader(header: string): keyof ImportRow | null {
  const k = headerKey(header);
  if (['title', 'summary', 'name'].includes(k)) return 'title';
  if (['description', 'description_text'].includes(k)) return 'descriptionText';
  if (['priority'].includes(k)) return 'priority';
  if (['status', 'status_name'].includes(k)) return 'statusName';
  if (['type', 'issue_type', 'type_name'].includes(k)) return 'typeName';
  if (['assignee', 'assignees', 'assignee_email', 'assignee_emails'].includes(k))
    return 'assigneeEmails';
  if (['label', 'labels'].includes(k)) return 'labelNames';
  if (['start_date', 'startdate', 'start'].includes(k)) return 'startDate';
  if (['due_date', 'duedate', 'due', 'deadline'].includes(k)) return 'dueDate';
  return null;
}

interface CsvModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CsvModal({ projectId, open, onOpenChange }: CsvModalProps) {
  const queryClient = useQueryClient();
  const [parsedRows, setParsedRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/issues/export.csv`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `issues-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('CSV를 다운로드했습니다.');
    } catch {
      toast('내보내기에 실패했습니다.');
    }
  }, [projectId]);

  const handleFileSelect = useCallback(async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      toast('CSV에 데이터 행이 없습니다.');
      return;
    }
    const header = rows[0]!.map(mapHeader);
    const dataRows = rows.slice(1).filter((r) => r.some((v) => v.trim().length > 0));
    const parsed: ImportRow[] = dataRows.map((cols) => {
      const row: ImportRow = { title: '' };
      header.forEach((key, idx) => {
        if (!key) return;
        const raw = cols[idx]?.trim() ?? '';
        if (!raw) return;
        if (key === 'assigneeEmails' || key === 'labelNames') {
          row[key] = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        } else {
          (row as Record<string, unknown>)[key] = raw;
        }
      });
      return row;
    });
    const valid = parsed.filter((r) => r.title && r.title.length > 0);
    if (valid.length === 0) {
      toast('제목(title) 열이 필요합니다.');
      return;
    }
    setParsedRows(valid);
    setFileName(file.name);
  }, []);

  const importMutation = useMutation({
    mutationFn: (rows: ImportRow[]) =>
      apiClient.post<{ imported: number; skipped: number; errors: { row: number; message: string }[] }>(
        `/projects/${projectId}/issues/import`,
        { rows },
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'issues'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'board-issues'] });
      toast(`가져오기 완료 — 성공 ${result.imported}건 / 건너뜀 ${result.skipped}건`);
      setParsedRows(null);
      setFileName(null);
      onOpenChange(false);
    },
    onError: () => toast('가져오기에 실패했습니다.'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>CSV 가져오기/내보내기</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <section className="rounded-md border border-[color:var(--border-subtle)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">내보내기</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  현재 프로젝트의 모든 이슈를 CSV로 다운로드합니다.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="mr-1.5 h-4 w-4" />
                CSV 다운로드
              </Button>
            </div>
          </section>

          <section className="rounded-md border border-[color:var(--border-subtle)] p-4">
            <h3 className="text-sm font-medium">가져오기</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              헤더 행이 필요합니다. 인식되는 필드: title, description, priority, status, type,
              assignees, labels, start_date, due_date
            </p>
            <div className="mt-3 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-3 py-1.5 text-xs hover:bg-[color:var(--bg-hover)]">
                <Upload className="h-3.5 w-3.5" />
                파일 선택
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {fileName && (
                <span className="truncate text-xs text-muted-foreground">
                  {fileName} · {parsedRows?.length ?? 0}행
                </span>
              )}
            </div>

            {parsedRows && parsedRows.length > 0 && (
              <div className="mt-3 max-h-[200px] overflow-auto rounded-sm border border-[color:var(--border-subtle)]">
                <table className="w-full text-xs">
                  <thead className="bg-[color:var(--bg-elev)] text-left">
                    <tr>
                      <th className="px-2 py-1">제목</th>
                      <th className="px-2 py-1">우선순위</th>
                      <th className="px-2 py-1">상태</th>
                      <th className="px-2 py-1">라벨</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t border-[color:var(--border-subtle)]">
                        <td className="max-w-[220px] truncate px-2 py-1">{r.title}</td>
                        <td className="px-2 py-1">{r.priority ?? '-'}</td>
                        <td className="px-2 py-1">{r.statusName ?? '-'}</td>
                        <td className="px-2 py-1">{(r.labelNames ?? []).join(', ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 10 && (
                  <div className="px-2 py-1 text-right text-[11px] text-muted-foreground">
                    +{parsedRows.length - 10}행 더
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button
            disabled={!parsedRows || parsedRows.length === 0 || importMutation.isPending}
            onClick={() => parsedRows && importMutation.mutate(parsedRows)}
          >
            {importMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            가져오기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
