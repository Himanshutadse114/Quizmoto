import sys
import json

from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.graphics.shapes import Drawing, RoundRect

import generate_scorm_report as base


TRACK = colors.HexColor('#ECEAF0')
PANEL = colors.HexColor('#FBFAFC')


def clamp_percent(value):
    try:
        return max(0.0, min(100.0, float(value or 0)))
    except (TypeError, ValueError):
        return 0.0


def progress_bar(value, accent, width=3.65 * inch, height=0.19 * inch):
    pct = clamp_percent(value)
    drawing = Drawing(width, height)
    track_height = 9
    y = (height - track_height) / 2
    radius = track_height / 2
    drawing.add(RoundRect(0, y, width, track_height, radius, fillColor=TRACK, strokeColor=None))
    if pct > 0:
        progress_width = max(track_height, width * pct / 100.0)
        drawing.add(RoundRect(0, y, progress_width, track_height, radius, fillColor=accent, strokeColor=None))
    return drawing


class CleanScormReport(base.ScormReport):
    """SCORM report with a compact, zero-safe analytics performance panel."""

    def performance_row(self, label, value, accent, available=True):
        display = f'{clamp_percent(value):.1f}%' if available else '—'
        label_cell = Paragraph(
            f'<b>{base.ptxt(label)}</b><br/><font size="6.8" color="#777777">0–100% scale</font>',
            self.styles['BodyCustom']
        )
        value_cell = Paragraph(
            f'<font color="{accent.hexval()}" size="13"><b>{display}</b></font>',
            self.styles['BodyCustom']
        )
        return [label_cell, progress_bar(value if available else 0, accent), value_cell]

    def create_analytics(self):
        st = self.meta['stats']
        avg = st['averageScore'] or 0
        rate = st['completionRate'] or 0

        self.elements.append(
            self.section_header(
                '02',
                'High-Level Learning Analytics',
                'learning_summary',
                'PERFORMANCE & COMPLETION'
            )
        )

        cards = [[
            self.kpi_card('Learners', st['total'], base.PURPLE),
            self.kpi_card('Completed', st['completed'], base.GREEN),
            self.kpi_card('In Progress', st['progress'], base.YELLOW),
            self.kpi_card('Not Attempted', st['notAttempted'], base.MID),
        ]]
        card_table = Table(cards, colWidths=[1.75 * inch] * 4)
        card_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ]))
        self.elements.extend([card_table, Spacer(1, 0.22 * inch)])

        panel_title = Table([[
            Paragraph('<b>Performance Overview</b>', self.styles['SectionTitle']),
            Paragraph(
                '<font color="#777777">Latest recorded learner outcomes</font>',
                self.styles['BodyMuted']
            )
        ]], colWidths=[3.25 * inch, 3.75 * inch])
        panel_title.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), PANEL),
            ('BOX', (0, 0), (-1, -1), 0.5, base.LIGHT),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))

        rows = [
            self.performance_row(
                'Average Score',
                avg,
                base.BLUE,
                st['averageScore'] is not None
            ),
            self.performance_row(
                'Completion Rate',
                rate,
                base.GREEN,
                st['completionRate'] is not None
            ),
        ]
        metrics = Table(rows, colWidths=[1.65 * inch, 4.15 * inch, 1.20 * inch])
        metrics.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), base.WHITE),
            ('BOX', (0, 0), (-1, -1), 0.5, base.LIGHT),
            ('LINEBELOW', (0, 0), (-1, 0), 0.4, base.LIGHT),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))

        note = Table([[
            Paragraph(
                'A zero completion rate is shown as an empty progress track rather than a zero-width chart bar.',
                self.styles['BodyMuted']
            )
        ]], colWidths=[7.0 * inch])
        note.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), PANEL),
            ('BOX', (0, 0), (-1, -1), 0.5, base.LIGHT),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))

        self.elements.extend([
            KeepTogether([panel_title, metrics, note]),
            Spacer(1, 0.20 * inch),
            PageBreak(),
        ])


def main():
    if len(sys.argv) != 4:
        print('Usage: generate_scorm_report_clean.py <input.json> <output> <pdf|excel>', file=sys.stderr)
        return 2

    input_path, output_path, kind = sys.argv[1], sys.argv[2], sys.argv[3].lower()
    with open(input_path, 'r', encoding='utf-8') as handle:
        data = json.load(handle)

    if kind == 'pdf':
        CleanScormReport(output_path, data).build()
    elif kind == 'excel':
        base.generate_excel(data, output_path)
    else:
        print(f'Unsupported format: {kind}', file=sys.stderr)
        return 2

    print(output_path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
