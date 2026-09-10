import json
import os
import sys
from datetime import datetime
from xml.sax.saxutils import escape

import xlsxwriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

TEAL = colors.HexColor('#4FC9BF')
TEAL_DARK = colors.HexColor('#16988F')
TEAL_SOFT = colors.HexColor('#EAF9F7')
INK = colors.HexColor('#183334')
MUTED = colors.HexColor('#6E8584')
LINE = colors.HexColor('#D9E9E6')
SOFT = colors.HexColor('#F5FAF9')
WHITE = colors.white
BLACK = colors.HexColor('#0B1717')

try:
    pdfmetrics.registerFont(TTFont('LMSGEN-Regular', '/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('LMSGEN-Bold', '/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Bold.ttf'))
    FONT = 'LMSGEN-Regular'
    FONT_BOLD = 'LMSGEN-Bold'
except Exception:
    FONT = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'


def text(value):
    if value is None:
        return ''
    if isinstance(value, bool):
        return 'Yes' if value else 'No'
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def safe(value):
    return escape(text(value))


def generated_label(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return parsed.strftime('%d %b %Y, %H:%M UTC')
    except Exception:
        return text(value)


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='LmsTitle', fontName=FONT_BOLD, fontSize=20, leading=23,
        textColor=INK, spaceAfter=2 * mm
    ))
    styles.add(ParagraphStyle(
        name='LmsSubtitle', fontName=FONT, fontSize=8.2, leading=11,
        textColor=MUTED, spaceAfter=0
    ))
    styles.add(ParagraphStyle(
        name='LmsKicker', fontName=FONT_BOLD, fontSize=6.5, leading=8,
        textColor=TEAL_DARK, uppercase=True, spaceAfter=1 * mm
    ))
    styles.add(ParagraphStyle(
        name='LmsBody', fontName=FONT, fontSize=7.2, leading=9.2,
        textColor=INK
    ))
    styles.add(ParagraphStyle(
        name='LmsBodyMuted', fontName=FONT, fontSize=6.6, leading=8.5,
        textColor=MUTED
    ))
    styles.add(ParagraphStyle(
        name='LmsMetricValue', fontName=FONT_BOLD, fontSize=15, leading=17,
        textColor=INK
    ))
    styles.add(ParagraphStyle(
        name='LmsMetricLabel', fontName=FONT_BOLD, fontSize=6.2, leading=7.5,
        textColor=MUTED
    ))
    styles.add(ParagraphStyle(
        name='LmsCell', fontName=FONT, fontSize=6.2, leading=7.7,
        textColor=INK
    ))
    styles.add(ParagraphStyle(
        name='LmsHeaderCell', fontName=FONT_BOLD, fontSize=5.8, leading=7,
        textColor=MUTED
    ))
    styles.add(ParagraphStyle(
        name='LmsRight', fontName=FONT, fontSize=6.4, leading=8,
        textColor=MUTED, alignment=TA_RIGHT
    ))
    return styles


def footer(canvas, doc, report):
    canvas.saveState()
    width, _ = landscape(A4)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(12 * mm, 10 * mm, width - 12 * mm, 10 * mm)
    canvas.setFont(FONT, 6.2)
    canvas.setFillColor(MUTED)
    tenant = (report.get('tenant') or {}).get('name') or 'Platform'
    canvas.drawString(12 * mm, 6 * mm, f'LMSGEN · {tenant} · {report.get("title", "Report")}')
    canvas.drawRightString(width - 12 * mm, 6 * mm, f'Page {doc.page}')
    canvas.restoreState()


def metric_card(label, value, styles):
    label_p = Paragraph(safe(label).upper(), styles['LmsMetricLabel'])
    value_p = Paragraph(safe(value), styles['LmsMetricValue'])
    inner = Table([[label_p], [value_p]], colWidths=[46 * mm])
    inner.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), SOFT),
        ('BOX', (0, 0), (-1, -1), 0.55, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 7),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 1),
        ('TOPPADDING', (0, 1), (-1, 1), 1),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 8),
    ]))
    return inner


def build_summary(summary, styles):
    items = summary or []
    if not items:
        return None
    cells = [metric_card(item.get('label', ''), item.get('value', ''), styles) for item in items[:5]]
    widths = [1] * len(cells)
    table = Table([cells], colWidths=[(landscape(A4)[0] - 28 * mm) / len(cells)] * len(cells))
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
    ]))
    return table


def column_widths(columns, rows, available_width):
    if not columns:
        return []
    weights = []
    for col in columns:
        key = col.get('key')
        label = text(col.get('label'))
        samples = [text(row.get(key, '')) for row in rows[:80]]
        longest = max([len(label)] + [min(55, len(value)) for value in samples] + [5])
        weight = max(7, min(28, longest))
        if key in ('name', 'email', 'course', 'item', 'title', 'admin'):
            weight = max(weight, 14)
        if key in ('status', 'pages', 'readers', 'sessions', 'completed', 'courses', 'flipbooks', 'staff'):
            weight = min(weight, 10)
        weights.append(weight)
    total = float(sum(weights)) or 1.0
    widths = [available_width * (weight / total) for weight in weights]
    minimum = 15 * mm
    widths = [max(minimum, width) for width in widths]
    overflow = sum(widths) - available_width
    if overflow > 0:
        shrinkable = [max(0, width - minimum) for width in widths]
        capacity = sum(shrinkable)
        if capacity > 0:
            widths = [width - overflow * (cap / capacity) for width, cap in zip(widths, shrinkable)]
    return widths


def build_data_table(columns, rows, styles):
    available = landscape(A4)[0] - 28 * mm
    widths = column_widths(columns, rows, available)
    header = [Paragraph(safe(col.get('label', '')).upper(), styles['LmsHeaderCell']) for col in columns]
    data = [header]
    for row in rows:
        data.append([Paragraph(safe(row.get(col.get('key'), '')), styles['LmsCell']) for col in columns])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL_SOFT),
        ('TEXTCOLOR', (0, 0), (-1, 0), MUTED),
        ('LINEBELOW', (0, 0), (-1, 0), 0.7, TEAL),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, SOFT]),
        ('GRID', (0, 0), (-1, -1), 0.25, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return table


def generate_pdf(report, output_path):
    styles = build_styles()
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=13 * mm,
        bottomMargin=15 * mm,
        title=text(report.get('title')),
        author='LMSGEN'
    )
    story = []
    tenant = report.get('tenant') or {}
    scope_label = tenant.get('name') or 'Platform-wide'
    story.append(Paragraph('LMSGEN · REPORTING', styles['LmsKicker']))
    story.append(Paragraph(safe(report.get('title', 'LMSGEN Report')), styles['LmsTitle']))
    story.append(Paragraph(safe(report.get('subtitle', '')), styles['LmsSubtitle']))
    story.append(Spacer(1, 3 * mm))
    meta = Table([
        [
            Paragraph(f'<b>Scope</b><br/>{safe(scope_label)}', styles['LmsBodyMuted']),
            Paragraph(f'<b>Report type</b><br/>{safe(report.get("reportType", "overview").replace("_", " ").title())}', styles['LmsBodyMuted']),
            Paragraph(f'<b>Generated</b><br/>{safe(generated_label(report.get("generatedAt")))}', styles['LmsRight'])
        ]
    ], colWidths=[80 * mm, 70 * mm, 110 * mm])
    meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), WHITE),
        ('BOX', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.extend([meta, Spacer(1, 5 * mm)])

    summary = build_summary(report.get('summary'), styles)
    if summary:
        story.append(KeepTogether([
            Paragraph('SUMMARY', styles['LmsKicker']),
            summary,
        ]))
        story.append(Spacer(1, 5 * mm))

    rows = report.get('rows') or []
    columns = report.get('columns') or []
    story.append(Paragraph('DETAILED EVIDENCE', styles['LmsKicker']))
    if rows and columns:
        story.append(build_data_table(columns, rows, styles))
    else:
        empty = Table([[Paragraph('No matching data is available for this report.', styles['LmsBodyMuted'])]], colWidths=[landscape(A4)[0] - 28 * mm])
        empty.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), SOFT),
            ('BOX', (0, 0), (-1, -1), 0.5, LINE),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        story.append(empty)

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        'Generated from LMSGEN current-platform data. Course, campaign, learner and Flipbook evidence is kept in its original learning context.',
        styles['LmsBodyMuted']
    ))
    doc.build(story, onFirstPage=lambda c, d: footer(c, d, report), onLaterPages=lambda c, d: footer(c, d, report))


def generate_excel(report, output_path):
    workbook = xlsxwriter.Workbook(output_path)
    workbook.set_properties({
        'title': text(report.get('title')),
        'subject': text(report.get('subtitle')),
        'author': 'LMSGEN'
    })
    sheet = workbook.add_worksheet('Report')
    sheet.hide_gridlines(2)
    sheet.freeze_panes(8, 0)
    title_fmt = workbook.add_format({'bold': True, 'font_size': 18, 'font_color': '#183334'})
    kicker_fmt = workbook.add_format({'bold': True, 'font_size': 8, 'font_color': '#16988F'})
    muted_fmt = workbook.add_format({'font_size': 9, 'font_color': '#6E8584'})
    metric_label = workbook.add_format({'bold': True, 'font_size': 8, 'font_color': '#6E8584', 'bg_color': '#F5FAF9', 'border': 1, 'border_color': '#D9E9E6'})
    metric_value = workbook.add_format({'bold': True, 'font_size': 14, 'font_color': '#183334', 'bg_color': '#F5FAF9', 'border': 1, 'border_color': '#D9E9E6'})
    header_fmt = workbook.add_format({'bold': True, 'font_size': 8, 'font_color': '#315957', 'bg_color': '#EAF9F7', 'border': 1, 'border_color': '#D9E9E6', 'text_wrap': True, 'valign': 'vcenter'})
    cell_fmt = workbook.add_format({'font_size': 9, 'font_color': '#183334', 'border': 1, 'border_color': '#E3EFED', 'text_wrap': True, 'valign': 'top'})
    alt_fmt = workbook.add_format({'font_size': 9, 'font_color': '#183334', 'bg_color': '#F8FBFA', 'border': 1, 'border_color': '#E3EFED', 'text_wrap': True, 'valign': 'top'})

    sheet.write('A1', 'LMSGEN · REPORTING', kicker_fmt)
    sheet.write('A2', text(report.get('title')), title_fmt)
    sheet.write('A3', text(report.get('subtitle')), muted_fmt)
    tenant = report.get('tenant') or {}
    sheet.write('A4', f"Scope: {tenant.get('name') or 'Platform-wide'}", muted_fmt)
    sheet.write('D4', f"Generated: {generated_label(report.get('generatedAt'))}", muted_fmt)

    summary = report.get('summary') or []
    for index, item in enumerate(summary[:5]):
        col = index * 2
        sheet.merge_range(5, col, 5, col + 1, text(item.get('label')).upper(), metric_label)
        sheet.merge_range(6, col, 6, col + 1, text(item.get('value')), metric_value)
        sheet.set_column(col, col + 1, 14)

    columns = report.get('columns') or []
    rows = report.get('rows') or []
    header_row = 8
    for col_index, column in enumerate(columns):
        sheet.write(header_row, col_index, text(column.get('label')), header_fmt)
        key = column.get('key')
        values = [text(row.get(key, '')) for row in rows[:250]]
        longest = max([len(text(column.get('label')))] + [min(55, len(value)) for value in values] + [8])
        width = max(10, min(32, longest + 2))
        sheet.set_column(col_index, col_index, width)

    for row_index, row in enumerate(rows, start=header_row + 1):
        fmt = alt_fmt if (row_index - header_row) % 2 == 0 else cell_fmt
        for col_index, column in enumerate(columns):
            sheet.write(row_index, col_index, text(row.get(column.get('key'), '')), fmt)

    if columns:
        sheet.autofilter(header_row, 0, max(header_row, header_row + len(rows)), len(columns) - 1)
    sheet.set_row(header_row, 24)
    sheet.set_landscape()
    sheet.fit_to_pages(1, 0)
    workbook.close()


def main():
    if len(sys.argv) != 4:
        print('Usage: generate_lmsgen_report.py <input.json> <output> <pdf|excel>', file=sys.stderr)
        return 2
    input_path, output_path, kind = sys.argv[1], sys.argv[2], sys.argv[3].lower()
    with open(input_path, 'r', encoding='utf-8') as handle:
        report = json.load(handle)
    if report.get('schemaVersion') != 'lmsgen-report-v2':
        print('Unsupported LMSGEN report schema.', file=sys.stderr)
        return 2
    if kind == 'pdf':
        generate_pdf(report, output_path)
    elif kind == 'excel':
        generate_excel(report, output_path)
    else:
        print(f'Unsupported format: {kind}', file=sys.stderr)
        return 2
    print(output_path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
