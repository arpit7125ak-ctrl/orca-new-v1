/**
 * ============================================================================
 * ORCA Official Advisory Report Modal (src/components/ReportModal.jsx)
 * ============================================================================
 * Modal dialog for inspecting, copying, and printing official maritime safety bulletins.
 * 
 * Capabilities (Architecture Spec §103):
 * 1. Multi-Format Retrieval: Fetches formatted advisory reports via /api/v1/report/:id
 *    in Markdown, JSON, and printable plain text.
 * 2. Markdown Parser & Table Formatter: Lightweight markdown parser that renders
 *    bulleted warnings, section headings, and structured data tables without external libraries.
 * 3. Clipboard & Print Integration: 1-click clipboard export and browser window.print()
 *    formatted with clean CSS print media styles.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  FileText, 
  ShieldAlert, 
  RefreshCw, 
  AlertTriangle,
  Database,
  Calendar,
  Layers
} from 'lucide-react';
import { orcaApi } from '../api/client';

/**
 * Lightweight faithful markdown renderer for advisory bulletins.
 * Renders headers, tables, lists, bold text, and metadata without fabrication.
 */
function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let tableBuffer = [];

  const flushTable = (key) => {
    if (tableBuffer.length === 0) return null;
    const rows = [...tableBuffer];
    tableBuffer = [];

    // Filter out markdown table separator rows (e.g. |---|---|, |:---:|---:|).
    // IMPORTANT: hyphen must be at the END of the character class so it is
    // treated as a literal character, not as a range operator.
    //
    // The original bug: [\s:-|] created a Unicode range from ':' (U+003A) to
    // '|' (U+007C), which encompasses ALL uppercase and lowercase English
    // letters (A-Z are U+0041-U+005A, a-z are U+0061-U+007A). This caused
    // real header rows like "| Point | Lat | Lon |" to MATCH the separator
    // pattern and be filtered OUT, while actual "| --- | --- |" rows did NOT
    // match and survived to become the table header — exactly the visible bug.
    //
    // Fix: [\s:|-] — hyphen is now last, unambiguously literal.
    const filteredRows = rows.filter((r) => !r.trim().match(/^\|[\s:|-]+\|$/));
    if (filteredRows.length === 0) return null;

    const [headerRow, ...bodyRows] = filteredRows;
    const parseCells = (row) =>
      row
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

    const headers = parseCells(headerRow);

    return (
      <div key={`table-${key}`} className="overflow-x-auto my-4 rounded-xl border border-[var(--border-base)]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[var(--bg-base)] border-b border-[var(--border-base)]">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="p-2.5 font-bold text-[var(--text-secondary)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-[var(--bg-surface)]">
            {bodyRows.map((row, rIdx) => {
              const cells = parseCells(row);
              return (
                <tr key={rIdx} className="hover:bg-slate-800/30">
                  {cells.map((c, cIdx) => (
                    <td key={cIdx} className="p-2.5 text-[var(--text-secondary)] font-mono">
                      {c}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table rows
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      tableBuffer.push(line);
      continue;
    } else if (tableBuffer.length > 0) {
      const tableElem = flushTable(i);
      if (tableElem) elements.push(tableElem);
    }

    // Horizontal rule
    if (line.trim().match(/^---+$|^\*\*\*+$/)) {
      elements.push(<hr key={i} className="border-[var(--border-base)] my-4" />);
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight mt-4 mb-2">
          {line.replace('# ', '')}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-base sm:text-lg font-bold text-[var(--accent-primary)] tracking-wide mt-5 mb-2 border-b border-[var(--border-base)] pb-1">
          {line.replace('## ', '')}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-[var(--text-primary)] mt-3 mb-1">
          {line.replace('### ', '')}
        </h3>
      );
      continue;
    }

    // List items
    if (line.trim().startsWith('- ')) {
      const itemText = line.trim().replace(/^- /, '');
      elements.push(
        <li key={i} className="ml-4 list-disc text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed py-0.5">
          {renderInlineMarkdown(itemText)}
        </li>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      continue;
    }

    // Paragraph
    elements.push(
      <p key={i} className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed my-1.5">
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  if (tableBuffer.length > 0) {
    const tableElem = flushTable('end');
    if (tableElem) elements.push(tableElem);
  }

  return <div className="space-y-1">{elements}</div>;
}

function renderInlineMarkdown(text) {
  // Replace **bold** and _italic_
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    const codeMatch = remaining.match(/`(.*?)`/);
    const italicMatch = remaining.match(/_(.*?)_/);

    const matches = [
      boldMatch ? { type: 'bold', index: boldMatch.index, len: boldMatch[0].length, content: boldMatch[1] } : null,
      codeMatch ? { type: 'code', index: codeMatch.index, len: codeMatch[0].length, content: codeMatch[1] } : null,
      italicMatch ? { type: 'italic', index: italicMatch.index, len: italicMatch[0].length, content: italicMatch[1] } : null,
    ].filter(Boolean);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    matches.sort((a, b) => a.index - b.index);
    const first = matches[0];

    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    if (first.type === 'bold') {
      parts.push(<strong key={key++} className="font-bold text-[var(--text-primary)]">{first.content}</strong>);
    } else if (first.type === 'code') {
      parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-[var(--bg-base)] text-[var(--accent-primary)] font-mono text-[11px] border border-[var(--border-base)]">{first.content}</code>);
    } else if (first.type === 'italic') {
      parts.push(<em key={key++} className="italic text-[var(--text-secondary)]">{first.content}</em>);
    }

    remaining = remaining.slice(first.index + first.len);
  }

  return parts;
}

export default function ReportModal({ analysis, isOpen, onClose }) {
  const { t } = useTranslation('ui');
  const [copied, setCopied] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawView, setRawView] = useState(false);

  const analysisId = analysis?.analysis_id;

  const fetchReport = async () => {
    if (!analysisId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await orcaApi.getReport(analysisId, 'markdown');
      setReportData(res?.data || res);
    } catch (err) {
      console.error('Error fetching authoritative report:', err);
      setError(err.message || t('report.errorFetchFailed', { defaultValue: 'Failed to fetch authoritative advisory report from server.' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && analysisId) {
      fetchReport();
    } else if (!isOpen) {
      setReportData(null);
      setError(null);
    }
  }, [isOpen, analysisId]);

  if (!isOpen || !analysis) return null;

  const content = reportData?.content || '';

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[var(--bg-base)] border-b border-[var(--border-base)] flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-[var(--accent-dim)] text-[var(--accent-primary)] border border-[var(--accent-primary)] flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
                {t('report.bulletinTitle', { defaultValue: 'Authoritative Maritime Advisory Bulletin' })}
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)] font-mono truncate">
                {t('report.analysisReference', { defaultValue: 'Analysis Reference' })}: {analysisId || t('report.unrecorded', { defaultValue: 'Unrecorded' })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {content && (
              <>
                <button
                  type="button"
                  onClick={() => setRawView(!rawView)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] text-xs hidden sm:inline-block border border-[var(--border-base)] cursor-pointer"
                >
                  {rawView ? t('report.formatted', { defaultValue: 'Formatted' }) : t('report.rawMarkdown', { defaultValue: 'Raw Markdown' })}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2 rounded-lg bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-base)] text-xs flex items-center space-x-1 cursor-pointer"
                  title={t('report.copyMarkdown', { defaultValue: 'Copy Markdown' })}
                >
                  {copied ? <Check className="w-4 h-4 text-[var(--safe-bright)]" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden md:inline">{copied ? t('report.copied', { defaultValue: 'Copied' }) : t('report.copy', { defaultValue: 'Copy' })}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-bold text-xs flex items-center space-x-1 cursor-pointer"
                  title={t('report.printBulletin', { defaultValue: 'Print Bulletin' })}
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden md:inline">{t('report.print', { defaultValue: 'Print' })}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-[var(--bg-surface-2)] hover:bg-rose-900/60 text-[var(--text-secondary)] hover:text-rose-200 border border-[var(--border-base)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto font-sans text-[var(--text-primary)] space-y-4 bg-slate-900/95">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-[var(--text-secondary)] text-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
              <span>{t('report.retrievingRecord', { defaultValue: 'Retrieving immutable advisory record from server...' })}</span>
            </div>
          )}

          {error && !loading && (
            <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/80 space-y-3">
              <div className="flex items-center space-x-2 text-[var(--dangerous-bright)] font-bold text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-[var(--dangerous-bright)]" />
                <span>{t('report.errorTitle', { defaultValue: 'Unable to generate or retrieve advisory report' })}</span>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed font-mono">
                {error}
              </p>
              <button
                type="button"
                onClick={fetchReport}
                className="px-4 py-2 bg-rose-900 hover:bg-rose-800 text-rose-100 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t('report.retryFetch', { defaultValue: 'Retry Fetch' })}</span>
              </button>
            </div>
          )}

          {!loading && !error && reportData && (
            <div className="space-y-4">
              {/* Metadata Banner */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-base)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                <div className="flex items-center space-x-2">
                  <Database className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{t('report.reportId', { defaultValue: 'Report ID' })}: <code className="font-mono text-[var(--accent-primary)]">{reportData.report_id}</code></span>
                  {reportData.cached && (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--safe)]/20 text-[var(--safe-bright)] border border-[var(--safe)] font-bold text-[10px]">
                      {t('report.cachedRecord', { defaultValue: 'Cached Immutable Record' })}
                    </span>
                  )}
                </div>
                {reportData.generated_at && (
                  <div className="flex items-center space-x-1.5 font-mono text-[var(--text-secondary)]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(reportData.generated_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Main Report Body */}
              {rawView ? (
                <pre className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border-base)] text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap overflow-x-auto">
                  {content}
                </pre>
              ) : (
                <div className="p-4 sm:p-6 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-base)]">
                  <MarkdownRenderer content={content} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[var(--bg-base)] border-t border-[var(--border-base)] text-center text-[11px] text-[var(--text-muted)]">
          {t('report.footerProvenance', { defaultValue: 'Generated exclusively from persisted metocean evidence & official boundary verification (§103).' })}
        </div>

      </div>
    </div>
  );
}
