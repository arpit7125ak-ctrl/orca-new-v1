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
      <div key={`table-${key}`} className="overflow-x-auto my-4 rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-950 border-b border-slate-800">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="p-2.5 font-bold text-slate-300">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {bodyRows.map((row, rIdx) => {
              const cells = parseCells(row);
              return (
                <tr key={rIdx} className="hover:bg-slate-800/30">
                  {cells.map((c, cIdx) => (
                    <td key={cIdx} className="p-2.5 text-slate-300 font-mono">
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
      elements.push(<hr key={i} className="border-slate-800 my-4" />);
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-xl sm:text-2xl font-black text-white tracking-tight mt-4 mb-2">
          {line.replace('# ', '')}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-base sm:text-lg font-bold text-cyan-300 tracking-wide mt-5 mb-2 border-b border-slate-800/80 pb-1">
          {line.replace('## ', '')}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-slate-200 mt-3 mb-1">
          {line.replace('### ', '')}
        </h3>
      );
      continue;
    }

    // List items
    if (line.trim().startsWith('- ')) {
      const itemText = line.trim().replace(/^- /, '');
      elements.push(
        <li key={i} className="ml-4 list-disc text-xs sm:text-sm text-slate-300 leading-relaxed py-0.5">
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
      <p key={i} className="text-xs sm:text-sm text-slate-300 leading-relaxed my-1.5">
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
      parts.push(<strong key={key++} className="font-bold text-white">{first.content}</strong>);
    } else if (first.type === 'code') {
      parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-slate-950 text-cyan-400 font-mono text-[11px] border border-slate-800">{first.content}</code>);
    } else if (first.type === 'italic') {
      parts.push(<em key={key++} className="italic text-slate-400">{first.content}</em>);
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
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {t('report.bulletinTitle', { defaultValue: 'Authoritative Maritime Advisory Bulletin' })}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono truncate">
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
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs hidden sm:inline-block border border-slate-700 cursor-pointer"
                >
                  {rawView ? t('report.formatted', { defaultValue: 'Formatted' }) : t('report.rawMarkdown', { defaultValue: 'Raw Markdown' })}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center space-x-1 cursor-pointer"
                  title={t('report.copyMarkdown', { defaultValue: 'Copy Markdown' })}
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden md:inline">{copied ? t('report.copied', { defaultValue: 'Copied' }) : t('report.copy', { defaultValue: 'Copy' })}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1 cursor-pointer"
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
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 border border-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto font-sans text-slate-200 space-y-4 bg-slate-900/95">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span>{t('report.retrievingRecord', { defaultValue: 'Retrieving immutable advisory record from server...' })}</span>
            </div>
          )}

          {error && !loading && (
            <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/80 space-y-3">
              <div className="flex items-center space-x-2 text-rose-300 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
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
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <div className="flex items-center space-x-2">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('report.reportId', { defaultValue: 'Report ID' })}: <code className="font-mono text-cyan-300">{reportData.report_id}</code></span>
                  {reportData.cached && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px]">
                      {t('report.cachedRecord', { defaultValue: 'Cached Immutable Record' })}
                    </span>
                  )}
                </div>
                {reportData.generated_at && (
                  <div className="flex items-center space-x-1.5 font-mono text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(reportData.generated_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Main Report Body */}
              {rawView ? (
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap overflow-x-auto">
                  {content}
                </pre>
              ) : (
                <div className="p-4 sm:p-6 rounded-2xl bg-slate-950/50 border border-slate-800/80">
                  <MarkdownRenderer content={content} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-center text-[11px] text-slate-500">
          {t('report.footerProvenance', { defaultValue: 'Generated exclusively from persisted metocean evidence & official boundary verification (§103).' })}
        </div>

      </div>
    </div>
  );
}
