// src/components/AIRichText.tsx
import React from 'react';

/**
 * Renderer teks AI tanpa dependensi.
 * Dukung: **tebal**, *miring*, `kode`, judul (#..###), bullet (- • * —), nomor (1. / 1)).
 * Daftar yang terpisah baris kosong tetap digabung dan nomornya melanjutkan.
 * Tidak memakai innerHTML — semua keluaran React node.
 */

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n*]+\*)/g;

// Angka + satuan/rupiah: cegah terpotong ke baris berikutnya
const NUMERIC = /(Rp\s?\d[\d.,]*|\d[\d.,]*\s?(?:cm|mm|meter|m\b|kg|pcs|unit|pintu|%))/g;

const withNowrapNumbers = (text: string, keyPrefix: string): React.ReactNode[] =>
  // Sisa tanda bintang di luar pasangan format dibuang agar tidak tampil mentah
  text.replace(/\*+/g, '').split(NUMERIC).map((part, i) =>
    i % 2 === 1
      ? <span key={`${keyPrefix}-n${i}`} className="whitespace-nowrap tabular-nums">{part}</span>
      : part
  );

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(...withNowrapNumbers(text.slice(last, match.index), `${keyPrefix}-t${i}`));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith('**')) {
      nodes.push(<strong key={key} className="font-semibold text-slate-900">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.92em] text-slate-800">{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={key} className="italic">{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(...withNowrapNumbers(text.slice(last), `${keyPrefix}-end`));
  return nodes;
};

type Block =
  | { type: 'p'; lines: string[] }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; starts: number[]; items: string[] };

const BULLET = /^\s*[-•—*]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

const lastContentBlock = (blocks: Block[]): Block | undefined => {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b.type === 'p' && b.lines.length === 0) continue;
    return b;
  }
  return undefined;
};

const parseBlocks = (raw: string): Block[] => {
  const blocks: Block[] = [];
  const lines = raw.replace(/\r\n/g, '\n').split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      const prev = blocks[blocks.length - 1];
      // Baris kosong hanya memisah paragraf, bukan memutus daftar
      if (prev?.type === 'p' && prev.lines.length) blocks.push({ type: 'p', lines: [] });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: 'h', text: heading[1].trim() });
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      const prev = lastContentBlock(blocks);
      if (prev?.type === 'ul') prev.items.push(bullet[1].trim());
      else blocks.push({ type: 'ul', items: [bullet[1].trim()] });
      continue;
    }

    const numbered = line.match(NUMBERED);
    if (numbered) {
      const start = Number.parseInt(numbered[1], 10) || 1;
      const prev = lastContentBlock(blocks);
      if (prev?.type === 'ol') {
        prev.items.push(numbered[2].trim());
        prev.starts.push(start);
      } else {
        blocks.push({ type: 'ol', starts: [start], items: [numbered[2].trim()] });
      }
      continue;
    }

    const prev = blocks[blocks.length - 1];
    if (prev?.type === 'p') prev.lines.push(line);
    else blocks.push({ type: 'p', lines: [line] });
  }

  return blocks.filter(b => (b.type === 'p' ? b.lines.length > 0 : true));
};

export const AIRichText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const blocks = parseBlocks(text);

  return (
    <div className={`space-y-2.5 text-[13.5px] leading-[1.65] text-slate-700 sm:text-[14px] sm:leading-[1.7] ${className}`}>
      {blocks.map((block, bi) => {
        if (block.type === 'h') {
          return (
            <p key={bi} className="pt-0.5 text-[13.5px] font-semibold leading-snug text-slate-900 sm:text-[14px]">
              {renderInline(block.text, `h${bi}`)}
            </p>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul key={bi} className="space-y-1.5">
              {block.items.map((item, ii) => (
                <li key={ii} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.62em] h-[3px] w-[3px] shrink-0 rounded-full bg-amber-500" />
                  <span className="min-w-0 flex-1">{renderInline(item, `u${bi}-${ii}`)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol key={bi} className="space-y-1.5">
              {block.items.map((item, ii) => (
                <li key={ii} className="flex gap-2">
                  <span className="w-[1.15rem] shrink-0 text-right font-medium tabular-nums text-slate-500">
                    {block.starts[ii] ?? ii + 1}.
                  </span>
                  <span className="min-w-0 flex-1">{renderInline(item, `o${bi}-${ii}`)}</span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={bi} className="break-words">
            {block.lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(line, `p${bi}-${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};

export default AIRichText;
