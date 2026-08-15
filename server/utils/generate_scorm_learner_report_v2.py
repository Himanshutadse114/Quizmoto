#!/usr/bin/env python3
"""Quizmoto SCORM individual learner report V2.

Keeps the existing branded learner-report layouts, but replaces the cover's raw
name/email lines with a structured, labelled learner identity table. This file
is intentionally a thin compatibility layer over the existing clean report
engine so course-result and question-evidence rendering remain unchanged.
"""

import sys
import json
from datetime import datetime

from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.graphics.shapes import Drawing, Rect, String

import generate_scorm_learner_report_clean as legacy

base = legacy.base
PANEL = legacy.PANEL
SOFT_PURPLE = legacy.SOFT_PURPLE


class LearnerReportV2(legacy.LearnerReport):
    def create_cover(self):
        drawing = Drawing(500, 150)
        drawing.add(Rect(-50, 50, 600, 100, fillColor=base.PURPLE, strokeColor=None))
        drawing.add(String(20, 90, 'QUIZMOTO', fontName=base.FONT_BOLD, fontSize=24, fillColor=base.WHITE))
        drawing.add(String(20, 70, 'SCORM AI · INDIVIDUAL LEARNER REPORT', fontName=base.FONT_LIGHT, fontSize=10, fillColor=base.WHITE))

        identity_rows = [
            [
                Paragraph('LEARNER NAME', self.styles['AuditLabel']),
                Paragraph(base.ptxt(self.data.get('learnerName'), 'Learner'), self.styles['AuditName'])
            ],
            [
                Paragraph('EMAIL ADDRESS', self.styles['AuditLabel']),
                Paragraph(base.ptxt(self.data.get('learnerEmail'), 'No learner email'), self.styles['AuditValue'])
            ]
        ]
        identity = Table(identity_rows, colWidths=[1.55 * inch, 5.3 * inch])
        identity.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), SOFT_PURPLE),
            ('BACKGROUND', (1, 0), (1, -1), PANEL),
            ('GRID', (0, 0), (-1, -1), 0.6, base.LIGHT),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))

        self.elements.extend([
            drawing,
            Spacer(1, 0.48 * inch),
            Paragraph('Individual Learner Report', self.styles['LearnerTitle']),
            Paragraph('Learner identity and recorded SCORM learning evidence', self.styles['BodyMuted']),
            Spacer(1, 0.15 * inch),
            identity,
            Spacer(1, 0.36 * inch),
        ])

        rows = [
            ('REPORT DATE', base.date_text(self.data.get('generatedAt') or datetime.utcnow().isoformat(), True)),
            ('TOTAL COURSES', self.summary.get('courseCount', 0)),
            ('COMPLETED', self.summary.get('completedCount', 0)),
            ('ANSWER ACCURACY', legacy.number_text(self.summary.get('answerAccuracy'), '%')),
        ]
        data = [[Paragraph(k, self.styles['WhiteLabel']), Paragraph(base.ptxt(v), self.styles['BodyCustom'])] for k, v in rows]
        table = Table(data, colWidths=[1.8 * inch, 3.2 * inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), base.PURPLE),
            ('BACKGROUND', (1, 0), (1, -1), base.STRIPE),
            ('GRID', (0, 0), (-1, -1), 1, base.WHITE),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 11),
        ]))
        self.elements.extend([table, PageBreak()])


def generate_excel_v2(data, output_path):
    """Reuse the branded workbook, with explicit learner-name/email labels."""
    original = legacy.generate_excel

    # The legacy workbook already uses a two-column labelled overview. We keep
    # its sheets/formatting intact; PDF cover was the only unlabelled identity
    # presentation. The Node fallback also uses explicit labels.
    return original(data, output_path)


def main():
    if len(sys.argv) != 4:
        print('Usage: generate_scorm_learner_report_v2.py <input.json> <output> <pdf|excel>', file=sys.stderr)
        return 2

    input_path, output_path, kind = sys.argv[1], sys.argv[2], sys.argv[3].lower()
    with open(input_path, 'r', encoding='utf-8') as handle:
        data = json.load(handle)

    if kind == 'pdf':
        LearnerReportV2(output_path, data).build()
    elif kind == 'excel':
        generate_excel_v2(data, output_path)
    else:
        print(f'Unsupported format: {kind}', file=sys.stderr)
        return 2

    print(output_path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
