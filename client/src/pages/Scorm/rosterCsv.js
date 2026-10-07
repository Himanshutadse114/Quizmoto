const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_EXTRACT_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const EMAIL_HEADERS = new Set(['email', 'email address', 'work email', 'learner email', 'employee email']);
const NAME_HEADERS = new Set(['name', 'full name', 'learner name', 'employee name']);
const FIRST_NAME_HEADERS = new Set(['first name', 'firstname', 'given name']);
const LAST_NAME_HEADERS = new Set(['last name', 'lastname', 'surname', 'family name']);

function cleanCell(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function normalizeHeader(value) {
  return cleanCell(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function parseDelimitedRow(line, delimiter) {
  const cells = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(cleanCell(value));
      value = '';
    } else {
      value += character;
    }
  }
  cells.push(cleanCell(value));
  return cells;
}

function delimiterFor(line) {
  if (line.includes('\t')) return '\t';
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function emailFrom(value) {
  const candidate = cleanCell(value).toLowerCase();
  if (EMAIL_PATTERN.test(candidate)) return candidate;
  return candidate.match(EMAIL_EXTRACT_PATTERN)?.[0] || '';
}

export function parseRosterText(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const delimiter = delimiterFor(lines[0]);
  const firstRow = parseDelimitedRow(lines[0], delimiter);
  const headers = firstRow.map(normalizeHeader);
  const emailIndex = headers.findIndex((header) => EMAIL_HEADERS.has(header));
  const nameIndex = headers.findIndex((header) => NAME_HEADERS.has(header));
  const firstNameIndex = headers.findIndex((header) => FIRST_NAME_HEADERS.has(header));
  const lastNameIndex = headers.findIndex((header) => LAST_NAME_HEADERS.has(header));
  const hasHeader = emailIndex >= 0 || nameIndex >= 0 || firstNameIndex >= 0 || lastNameIndex >= 0;
  const learners = new Map();

  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cells = parseDelimitedRow(line, delimiter);
    const indexedEmail = emailIndex >= 0 ? emailFrom(cells[emailIndex]) : '';
    const discoveredEmailIndex = indexedEmail ? emailIndex : cells.findIndex((cell) => emailFrom(cell));
    const email = indexedEmail || (discoveredEmailIndex >= 0 ? emailFrom(cells[discoveredEmailIndex]) : '');
    if (!email) continue;

    let learnerName = '';
    if (nameIndex >= 0) learnerName = cleanCell(cells[nameIndex]);
    else if (firstNameIndex >= 0 || lastNameIndex >= 0) {
      learnerName = [cleanCell(cells[firstNameIndex]), cleanCell(cells[lastNameIndex])].filter(Boolean).join(' ');
    } else {
      learnerName = cells
        .filter((_, index) => index !== discoveredEmailIndex)
        .map(cleanCell)
        .find((cell) => cell && !EMAIL_PATTERN.test(cell)) || '';
      if (!learnerName && cells.length === 1) learnerName = cleanCell(cells[0]).replace(EMAIL_EXTRACT_PATTERN, '').replace(/[<>|,;]+/g, ' ').trim();
    }

    learnerName = learnerName.replace(/\s+/g, ' ').slice(0, 255);
    const current = learners.get(email);
    if (!current || (!current.learnerName && learnerName)) learners.set(email, { email, learnerName });
  }

  return [...learners.values()];
}

export const ROSTER_CSV_TEMPLATE = 'Name,Email\nAsha Patel,asha@company.com\nRahul Singh,rahul@company.com\n';
