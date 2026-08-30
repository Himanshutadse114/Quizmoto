function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function parseCsvRows(text) {
    const source = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (quoted) {
            if (ch === '"' && source[i + 1] === '"') {
                field += '"';
                i += 1;
            } else if (ch === '"') {
                quoted = false;
            } else {
                field += ch;
            }
            continue;
        }

        if (ch === '"') quoted = true;
        else if (ch === ',') {
            row.push(field.trim());
            field = '';
        } else if (ch === '\n') {
            row.push(field.trim());
            field = '';
            if (row.some((item) => item !== '')) rows.push(row);
            row = [];
        } else if (ch !== '\r') {
            field += ch;
        }
    }

    row.push(field.trim());
    if (row.some((item) => item !== '')) rows.push(row);
    return rows;
}

function normalizedHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCampaignCsv(text) {
    const rows = parseCsvRows(text);
    if (!rows.length) throw fail('The CSV file is empty.', 'SCORM_CAMPAIGN_CSV_EMPTY', 400);

    const headers = rows[0].map(normalizedHeader);
    const emailIndex = headers.findIndex((value) => ['email', 'emailaddress', 'learneremail', 'useremail'].includes(value));
    const nameIndex = headers.findIndex((value) => ['name', 'fullname', 'learnername', 'displayname'].includes(value));
    const firstNameIndex = headers.findIndex((value) => ['firstname', 'givenname'].includes(value));
    const lastNameIndex = headers.findIndex((value) => ['lastname', 'surname', 'familyname'].includes(value));

    if (emailIndex < 0) {
        throw fail(
            'CSV must contain an Email column. Optional columns: Name, First Name, Last Name.',
            'SCORM_CAMPAIGN_CSV_EMAIL_COLUMN_REQUIRED',
            400
        );
    }

    const learners = [];
    const invalidRows = [];
    const seen = new Set();

    rows.slice(1).forEach((columns, index) => {
        const email = normalizeEmail(columns[emailIndex]);
        if (!email) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            invalidRows.push({ row: index + 2, email, reason: 'Invalid email address' });
            return;
        }
        if (seen.has(email)) return;
        seen.add(email);

        let learnerName = nameIndex >= 0 ? String(columns[nameIndex] || '').trim() : '';
        if (!learnerName) {
            learnerName = [
                firstNameIndex >= 0 ? String(columns[firstNameIndex] || '').trim() : '',
                lastNameIndex >= 0 ? String(columns[lastNameIndex] || '').trim() : ''
            ].filter(Boolean).join(' ');
        }

        learners.push({
            email,
            learnerName: learnerName.slice(0, 180) || email.split('@')[0]
        });
    });

    if (!learners.length) {
        throw fail(
            'The CSV does not contain any valid learner email addresses.',
            'SCORM_CAMPAIGN_CSV_NO_VALID_LEARNERS',
            400
        );
    }

    return {
        learners,
        invalidRows,
        totalRows: Math.max(0, rows.length - 1)
    };
}

module.exports = {
    parseCampaignCsv,
    parseCsvRows
};
