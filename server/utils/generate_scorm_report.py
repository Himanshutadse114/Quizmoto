import sys
import json
import os
from datetime import datetime
from xml.sax.saxutils import escape

import xlsxwriter
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    Image,
    KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


try:
    pdfmetrics.registerFont(TTFont('Roboto-Regular', '/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('Roboto-Bold', '/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Roboto-Medium', '/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Medium.ttf'))
    pdfmetrics.registerFont(TTFont('Roboto-Light', '/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Light.ttf'))
    FONT_NORMAL = 'Roboto-Regular'
    FONT_BOLD = 'Roboto-Bold'
    FONT_MED = 'Roboto-Medium'
    FONT_LIGHT = 'Roboto-Light'
except Exception:
    FONT_NORMAL = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'
    FONT_MED = 'Helvetica-Bold'
    FONT_LIGHT = 'Helvetica'


# Keep these theme values in lock-step with generate_report.py.
KAHOOT_PURPLE = colors.HexColor('#46178f')
KAHOOT_BLUE = colors.HexColor('#1368ce')
KAHOOT_GREEN = colors.HexColor('#26890c')
KAHOOT_RED = colors.HexColor('#e21b3c')
KAHOOT_YELLOW = colors.HexColor('#d89e00')
DARK_GREY = colors.HexColor('#2D2D2D')
MID_GREY = colors.HexColor('#777777')
LIGHT_GREY = colors.HexColor('#CCCCCC')
ROW_STRIPE = colors.HexColor('#F9F9F9')
WHITE = colors.white


def safe_text(value, fallback=''):
    if value is None:
        return fallback
    return str(value)


def paragraph_text(value, fallback='—'):
    return escape(safe_text(value, fallback))


def status_key(value):
    return safe_text(value).strip().lower()


def is_completed_status(value):
    return status_key(value) in ('completed', 'passed', 'failed')


def numeric_score(value):
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def display_score(value):
    n = numeric_score(value)
    if n is None:
        return '—'
    if n.is_integer():
        return str(int(n))
    return f'{n:.2f}'.rstrip('0').rstrip('.')


def iso_date(value, date_only=False):
    if not value:
        return '—'
    text = safe_text(value)
    try:
        parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
        return parsed.strftime('%Y-%m-%d' if date_only else '%Y-%m-%d %H:%M:%S')
    except Exception:
        if date_only and 'T' in text:
            return text.split('T')[0]
        return text


def learner_result(registration):
    lesson = status_key(registration.get('lastLessonStatus'))
    registration_status = status_key(registration.get('status'))
    if lesson == 'passed':
        return 'Passed'
    if lesson == 'failed':
        return 'Failed'
    if lesson == 'completed':
        return 'Completed'
    if lesson in ('incomplete', 'browsed'):
        return 'In Progress'
    if lesson in ('not attempted', 'not_attempted') or not lesson:
        if registration_status in ('launched', 'active', 'started', 'in_progress'):
            return 'In Progress'
        return 'Not Attempted'
    return safe_text(registration.get('lastLessonStatus'), 'In Progress').replace('_', ' ').title()


def result_color(registration):
    result = learner_result(registration).lower()
    if result in ('passed', 'completed'):
        return KAHOOT_GREEN
    if result == 'failed':
        return KAHOOT_RED
    if result == 'in progress':
        return KAHOOT_YELLOW
    return MID_GREY


def course_meta(data):
    registrations = data.get('registrations') or []
    if not isinstance(registrations, list):
        registrations = []

    learners = [r for r in registrations if not r.get('isPreview')]
    previews = [r for r in registrations if r.get('isPreview')]
    learners.sort(key=lambda r: numeric_score(r.get('lastScoreRaw')) if numeric_score(r.get('lastScoreRaw')) is not None else -1, reverse=True)

    scored = [numeric_score(r.get('lastScoreRaw')) for r in learners]
    scored = [s for s in scored if s is not None]
    completed = [r for r in learners if is_completed_status(r.get('lastLessonStatus'))]
    in_progress = [r for r in learners if learner_result(r) == 'In Progress']
    not_attempted = [r for r in learners if learner_result(r) == 'Not Attempted']

    avg_score = (sum(scored) / len(scored)) if scored else None
    completion_rate = (len(completed) / len(learners) * 100.0) if learners else None

    package = data.get('package') or {}
    return {
        'title': safe_text(data.get('title'), 'Untitled course'),
        'description': safe_text(data.get('description')),
        'inviteCode': safe_text(data.get('inviteCode')),
        'status': safe_text(data.get('status'), 'unknown'),
        'hostId': safe_text(data.get('hostId'), 'Unknown Host'),
        'publishedAt': data.get('publishedAt') or data.get('createdAt'),
        'createdAt': data.get('createdAt'),
        'updatedAt': data.get('updatedAt'),
        'packageTitle': safe_text(package.get('title')),
        'standard': safe_text(package.get('standard'), 'SCORM'),
        'source': safe_text(package.get('source')),
        'learners': learners,
        'previews': previews,
        'stats': {
            'totalLearners': len(learners),
            'completed': len(completed),
            'inProgress': len(in_progress),
            'notAttempted': len(not_attempted),
            'averageScore': round(avg_score, 2) if avg_score is not None else None,
            'completionRate': round(completion_rate, 1) if completion_rate is not None else None,
        },
    }


class ScormKahootReport:
    """SCORM report using the same visual language as the Live Quiz Python report."""

    def __init__(self, filename, data):
        self.filename = filename
        self.data = data
        self.meta = course_meta(data)
        self.styles = self._setup_styles()
        self.elements = []
        self.chart_paths = []

    def _setup_styles(self):
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            name='PremiumTitle', fontName=FONT_BOLD, fontSize=34, textColor=KAHOOT_PURPLE,
            alignment=0, spaceAfter=10, leading=40
        ))
        styles.add(ParagraphStyle(
            name='PremiumSubtitle', fontName=FONT_LIGHT, fontSize=18, textColor=DARK_GREY,
            alignment=0, spaceAfter=30, leading=22, keepWithNext=True
        ))
        styles.add(ParagraphStyle(
            name='SectionHeader', fontName=FONT_BOLD, fontSize=16, textColor=DARK_GREY,
            spaceAfter=20, spaceBefore=30, alignment=0, keepWithNext=True
        ))
        styles.add(ParagraphStyle(
            name='BodyTextCustom', fontName=FONT_NORMAL, fontSize=10, leading=14,
            textColor=DARK_GREY, spaceAfter=12
        ))
        styles.add(ParagraphStyle(
            name='BodyTextWhite', fontName=FONT_BOLD, fontSize=10, leading=14,
            textColor=colors.white, spaceAfter=0, spaceBefore=0
        ))
        styles.add(ParagraphStyle(
            name='TOCItem', fontName=FONT_NORMAL, fontSize=11, leading=16,
            textColor=DARK_GREY, leftIndent=20
        ))
        styles.add(ParagraphStyle(name='ForensicLabel', fontName=FONT_BOLD, fontSize=7, textColor=colors.black, leading=8))
        styles.add(ParagraphStyle(name='ForensicLabelWhite', fontName=FONT_BOLD, fontSize=7, textColor=colors.white, leading=8))
        styles.add(ParagraphStyle(name='ForensicValue', fontName=FONT_NORMAL, fontSize=7, textColor=colors.black, leading=8))
        styles.add(ParagraphStyle(name='ForensicValueWhite', fontName=FONT_NORMAL, fontSize=7, textColor=colors.white, leading=8))
        styles.add(ParagraphStyle(name='ForensicDetail', fontName=FONT_NORMAL, fontSize=6.5, textColor=colors.grey, leading=8, leftIndent=10))
        return styles

    def create_cover_page(self):
        d1 = Drawing(500, 150)
        d1.add(Rect(-50, 50, 600, 100, fillColor=KAHOOT_PURPLE, strokeColor=None))
        d1.add(String(20, 90, 'QUIZMOTO', fontName=FONT_BOLD, fontSize=24, fillColor=WHITE))
        d1.add(String(20, 70, 'ANALYTICS PLATFORM', fontName=FONT_LIGHT, fontSize=10, fillColor=WHITE))
        self.elements.append(d1)
        self.elements.append(Spacer(1, 1 * inch))

        self.elements.append(Paragraph('Quizmoto SCORM World Report', self.styles['PremiumTitle']))
        self.elements.append(Paragraph(
            f"Analytics for: {paragraph_text(self.meta['title'], 'Untitled course')}",
            self.styles['PremiumSubtitle']
        ))
        self.elements.append(Spacer(1, 2.25 * inch))

        cover_data = [
            [Paragraph('REPORT DATE', self.styles['BodyTextWhite']), Paragraph(iso_date(datetime.utcnow().isoformat(), True), self.styles['BodyTextCustom'])],
            [Paragraph('SCORM STANDARD', self.styles['BodyTextWhite']), Paragraph(paragraph_text(self.meta['standard'], 'SCORM'), self.styles['BodyTextCustom'])],
            [Paragraph('TOTAL LEARNERS', self.styles['BodyTextWhite']), Paragraph(str(self.meta['stats']['totalLearners']), self.styles['BodyTextCustom'])],
            [Paragraph('COURSE STATUS', self.styles['BodyTextWhite']), Paragraph(paragraph_text(self.meta['status'].upper(), 'UNKNOWN'), self.styles['BodyTextCustom'])],
        ]
        table = Table(cover_data, colWidths=[1.8 * inch, 3 * inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), KAHOOT_PURPLE),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
            ('BACKGROUND', (1, 0), (1, -1), ROW_STRIPE),
            ('GRID', (0, 0), (-1, -1), 1, colors.white),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 15),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        self.elements.append(table)
        self.elements.append(PageBreak())

    def create_toc(self):
        self.elements.append(Paragraph('Table Of Content', self.styles['SectionHeader']))
        self.elements.append(Spacer(1, 0.4 * inch))
        toc_data = [
            ['Sr No.', 'Content', 'Page No.'],
            [Paragraph('1', self.styles['BodyTextCustom']), Paragraph('<b><link destination="exec_summary">Executive Learning Summary</link></b>', self.styles['TOCItem']), Paragraph('3', self.styles['BodyTextCustom'])],
            [Paragraph('2', self.styles['BodyTextCustom']), Paragraph('<b><link destination="learning_summary">High-Level Learning Analytics</link></b>', self.styles['TOCItem']), Paragraph('3', self.styles['BodyTextCustom'])],
            [Paragraph('3', self.styles['BodyTextCustom']), Paragraph('<b><link destination="learner_audit">Detailed Learner Audit Logs</link></b>', self.styles['TOCItem']), Paragraph('4', self.styles['BodyTextCustom'])],
        ]
        table = Table(toc_data, colWidths=[0.8 * inch, 4.5 * inch, 1.2 * inch])
        table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), KAHOOT_PURPLE),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 0.5, LIGHT_GREY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_STRIPE]),
            ('BOX', (0, 0), (-1, -1), 1.5, KAHOOT_PURPLE),
        ]))
        table.hAlign = 'CENTER'
        self.elements.append(table)
        self.elements.append(PageBreak())

    def create_executive_summary(self):
        stats = self.meta['stats']
        summary = (
            f"This SCORM learning audit report analyzes the progress of {stats['totalLearners']} learners enrolled "
            f"in the '{paragraph_text(self.meta['title'])}' course. The following sections provide high-level learning "
            f"analytics and detailed learner audit logs covering completion state, score, learning time, and latest activity."
        )
        self.elements.append(KeepTogether([
            Paragraph('<a name="exec_summary"/>I. Executive Learning Summary', self.styles['SectionHeader']),
            Paragraph(summary, self.styles['BodyTextCustom']),
            Spacer(1, 0.25 * inch),
        ]))

    def create_learning_summary(self):
        stats = self.meta['stats']
        average_score = stats['averageScore'] or 0
        completion_rate = stats['completionRate'] or 0
        block = [Paragraph('<a name="learning_summary"/>II. High-Level Learning Analytics', self.styles['SectionHeader'])]

        metric_data = [
            ['Metric', 'Value'],
            ['Total Learners', str(stats['totalLearners'])],
            ['Completed', str(stats['completed'])],
            ['In Progress', str(stats['inProgress'])],
            ['Not Attempted', str(stats['notAttempted'])],
        ]
        metric_table = Table(metric_data, colWidths=[2.8 * inch, 2.2 * inch])
        metric_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), KAHOOT_PURPLE),
            ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
            ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
            ('FONTNAME', (0, 1), (-1, -1), FONT_NORMAL),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, LIGHT_GREY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_STRIPE]),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        metric_table.hAlign = 'LEFT'
        block.extend([metric_table, Spacer(1, 0.35 * inch)])

        try:
            labels = ['Average Score', 'Completion Rate']
            values = [average_score, completion_rate]
            colors_list = ['#1368ce', '#26890c']

            fig, ax = plt.subplots(figsize=(7, 3))
            ax.set_facecolor('#FBFBFB')
            ax.grid(axis='x', linestyle='--', alpha=0.4, color='#CCCCCC')
            bars = ax.barh(labels, values, color=colors_list, height=0.5, edgecolor='white', linewidth=2, alpha=0.9)
            y_pos = list(range(len(labels)))
            ax.plot(values, y_pos, color='#2D2D2D', linestyle='--', marker='o', markersize=6, linewidth=1.5, alpha=0.6)
            labels_drawn = ax.bar_label(bars, fmt='%.1f%%', padding=3, weight='bold', fontsize=11)
            for i, label in enumerate(labels_drawn):
                label.set_color(colors_list[i])
            ax.set_title('Course Completion & Performance', pad=15, fontname='sans-serif', fontsize=14, fontweight='bold', color='#2D2D2D')
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_color('#DDDDDD')
            ax.spines['bottom'].set_color('#DDDDDD')
            ax.set_xlim(0, max(100, max(values) + 10 if values else 100))

            chart_dir = os.environ.get('REPORT_CHART_DIR', '/tmp/report_charts')
            try:
                os.makedirs(chart_dir, exist_ok=True)
            except Exception:
                chart_dir = '/tmp'
            chart_path = os.path.join(chart_dir, f'scorm_chart_{os.getpid()}_{id(self)}.png')
            self.chart_paths.append(chart_path)
            plt.tight_layout()
            plt.savefig(chart_path, dpi=200, transparent=True)
            plt.close()

            chart = Image(chart_path, width=5.5 * inch, height=2.4 * inch)
            chart.hAlign = 'CENTER'
            block.extend([chart, Spacer(1, 0.35 * inch)])
        except Exception as chart_err:
            print(f'[scorm-report] chart skipped: {chart_err}', file=sys.stderr)
            block.append(Paragraph(
                f"Average Score: {average_score:.1f}% · Completion Rate: {completion_rate:.1f}%",
                self.styles['BodyTextCustom']
            ))

        self.elements.append(KeepTogether(block))

    def create_learner_audit(self):
        header = [
            Paragraph('<a name="learner_audit"/>III. Detailed Learner Audit Logs', self.styles['SectionHeader']),
            Paragraph('<b>Forensic Learning History: Learner Progress Analysis</b>', self.styles['BodyTextCustom']),
            Spacer(1, 0.2 * inch),
        ]
        learners = self.meta['learners']
        if not learners:
            header.append(Paragraph('<i>No learner activity has been recorded for this course.</i>', self.styles['BodyTextCustom']))
            self.elements.append(KeepTogether(header))
            return

        self.elements.append(KeepTogether(header))

        for learner in learners:
            header_color = result_color(learner)
            name = paragraph_text(learner.get('learnerName'), 'Learner')
            score = display_score(learner.get('lastScoreRaw'))
            result = learner_result(learner)

            column_header = Table([['Learner Target', 'Score', 'Course Result']], colWidths=[3.2 * inch, 2.0 * inch, 2.0 * inch])
            column_header.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), header_color),
                ('TEXTCOLOR', (0, 0), (-1, -1), WHITE),
                ('FONTNAME', (0, 0), (-1, -1), FONT_BOLD),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, WHITE),
            ]))

            learner_info = Table([[
                Paragraph(f'<b>{name}</b>', self.styles['ForensicValue']),
                Paragraph(score, self.styles['ForensicValue']),
                Paragraph(paragraph_text(result), self.styles['ForensicValue']),
            ]], colWidths=[3.2 * inch, 2.0 * inch, 2.0 * inch])
            learner_info.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), ROW_STRIPE),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, LIGHT_GREY),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))

            last_activity = learner.get('lastCommitAt') or learner.get('updatedAt')
            details = [
                [Paragraph('Registration Status', self.styles['ForensicLabel']), Paragraph(paragraph_text(learner.get('status')), self.styles['ForensicValue'])],
                [Paragraph('Lesson Status', self.styles['ForensicLabel']), Paragraph(paragraph_text(learner.get('lastLessonStatus')), self.styles['ForensicValue'])],
                [Paragraph('Learner Email', self.styles['ForensicLabel']), Paragraph(paragraph_text(learner.get('learnerEmail')), self.styles['ForensicValue'])],
                [Paragraph('Total Learning Time', self.styles['ForensicLabel']), Paragraph(paragraph_text(learner.get('lastTotalTime')), self.styles['ForensicValue'])],
                [Paragraph('Last Activity', self.styles['ForensicLabel']), Paragraph(paragraph_text(iso_date(last_activity)), self.styles['ForensicValue'])],
                [Paragraph('Completion', self.styles['ForensicLabel']), Paragraph('Yes' if is_completed_status(learner.get('lastLessonStatus')) else 'No', self.styles['ForensicValue'])],
            ]
            details_table = Table(details, colWidths=[1.8 * inch, 5.4 * inch])
            details_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F1F1F1')),
                ('ROWBACKGROUNDS', (1, 0), (1, -1), [colors.white, ROW_STRIPE]),
                ('GRID', (0, 0), (-1, -1), 0.4, LIGHT_GREY),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))

            self.elements.append(KeepTogether([
                column_header,
                learner_info,
                details_table,
                Spacer(1, 0.22 * inch),
            ]))

        if self.meta['previews']:
            preview_rows = [['Host Preview', 'Lesson Status', 'Score']]
            for preview in self.meta['previews']:
                preview_rows.append([
                    safe_text(preview.get('learnerName'), 'Preview'),
                    safe_text(preview.get('lastLessonStatus'), '—'),
                    display_score(preview.get('lastScoreRaw')),
                ])
            preview_table = Table(preview_rows, colWidths=[3.2 * inch, 2.3 * inch, 1.7 * inch])
            preview_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), MID_GREY),
                ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
                ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
                ('FONTNAME', (0, 1), (-1, -1), FONT_NORMAL),
                ('FONTSIZE', (0, 0), (-1, -1), 7),
                ('GRID', (0, 0), (-1, -1), 0.5, LIGHT_GREY),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_STRIPE]),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))
            self.elements.extend([
                Spacer(1, 0.2 * inch),
                Paragraph('Host previews (excluded from learner analytics)', self.styles['BodyTextCustom']),
                preview_table,
            ])

    def on_page(self, canvas, doc):
        width, height = A4
        canvas.saveState()
        canvas.setStrokeColor(KAHOOT_PURPLE)
        canvas.setLineWidth(1.2)
        canvas.rect(18, 18, width - 36, height - 36)
        canvas.setLineWidth(0.35)
        canvas.rect(23, 23, width - 46, height - 46)

        canvas.setStrokeColor(LIGHT_GREY)
        canvas.line(36, 36, width - 36, 36)
        canvas.setFont(FONT_BOLD, 6.5)
        canvas.setFillColor(DARK_GREY)
        canvas.drawString(40, 25, 'CONFIDENTIAL // SCORM LEARNING AUDIT REPORT')
        canvas.setFont(FONT_NORMAL, 6.5)
        canvas.drawRightString(width - 40, 25, f'PAGE {doc.page}')
        canvas.restoreState()

    def build(self):
        doc = SimpleDocTemplate(
            self.filename,
            pagesize=A4,
            rightMargin=0.5 * inch,
            leftMargin=0.5 * inch,
            topMargin=1 * inch,
            bottomMargin=1 * inch,
            title=f"Quizmoto SCORM World Report - {self.meta['title']}",
            author='Quizmoto',
        )
        self.create_cover_page()
        self.create_toc()
        self.create_executive_summary()
        self.create_learning_summary()
        self.elements.append(PageBreak())
        self.create_learner_audit()
        doc.build(self.elements, onFirstPage=self.on_page, onLaterPages=self.on_page)

        for chart_path in self.chart_paths:
            try:
                if os.path.exists(chart_path):
                    os.unlink(chart_path)
            except Exception:
                pass


def workbook_formats(workbook):
    return {
        'title': workbook.add_format({'bold': True, 'font_size': 20, 'font_color': '#46178f'}),
        'subtitle': workbook.add_format({'font_size': 11, 'font_color': '#2D2D2D'}),
        'section': workbook.add_format({'bold': True, 'font_size': 12, 'font_color': '#46178f', 'bottom': 1, 'bottom_color': '#46178f'}),
        'header': workbook.add_format({'bold': True, 'font_color': '#FFFFFF', 'bg_color': '#46178f', 'border': 1, 'border_color': '#FFFFFF', 'align': 'center', 'valign': 'vcenter'}),
        'label': workbook.add_format({'bold': True, 'bg_color': '#F2F2F2', 'border': 1, 'border_color': '#D9D9D9'}),
        'value': workbook.add_format({'border': 1, 'border_color': '#D9D9D9'}),
        'stripe': workbook.add_format({'bg_color': '#F9F9F9', 'border': 1, 'border_color': '#E5E5E5'}),
        'plain': workbook.add_format({'border': 1, 'border_color': '#E5E5E5'}),
        'green': workbook.add_format({'font_color': '#26890c', 'bold': True, 'border': 1, 'border_color': '#E5E5E5'}),
        'red': workbook.add_format({'font_color': '#e21b3c', 'bold': True, 'border': 1, 'border_color': '#E5E5E5'}),
        'yellow': workbook.add_format({'font_color': '#d89e00', 'bold': True, 'border': 1, 'border_color': '#E5E5E5'}),
    }


def write_status_cell(sheet, row, col, value, formats):
    key = safe_text(value).lower()
    fmt = formats['plain']
    if key in ('passed', 'completed'):
        fmt = formats['green']
    elif key == 'failed':
        fmt = formats['red']
    elif key == 'in progress':
        fmt = formats['yellow']
    sheet.write(row, col, value, fmt)


def generate_excel(data, output_path):
    meta = course_meta(data)
    workbook = xlsxwriter.Workbook(output_path)
    workbook.set_properties({
        'title': f"Quizmoto SCORM World Report - {meta['title']}",
        'subject': 'SCORM learner analytics',
        'author': 'Quizmoto',
        'company': 'Quizmoto',
    })
    formats = workbook_formats(workbook)

    overview = workbook.add_worksheet('Overview')
    overview.set_column('A:A', 24)
    overview.set_column('B:B', 46)
    overview.write('A1', 'QUIZMOTO', formats['title'])
    overview.write('A2', 'SCORM WORLD ANALYTICS REPORT', formats['subtitle'])
    overview.merge_range('A4:B4', meta['title'], formats['section'])
    overview_rows = [
        ('SCORM Standard', meta['standard']),
        ('Package', meta['packageTitle']),
        ('Course Status', meta['status']),
        ('Invite Code', meta['inviteCode']),
        ('Published', iso_date(meta['publishedAt'])),
        ('Generated', iso_date(datetime.utcnow().isoformat())),
        ('Total Learners', meta['stats']['totalLearners']),
        ('Completed', meta['stats']['completed']),
        ('In Progress', meta['stats']['inProgress']),
        ('Not Attempted', meta['stats']['notAttempted']),
        ('Completion Rate %', meta['stats']['completionRate'] if meta['stats']['completionRate'] is not None else ''),
        ('Average Score', meta['stats']['averageScore'] if meta['stats']['averageScore'] is not None else ''),
    ]
    for idx, (label, value) in enumerate(overview_rows, start=5):
        overview.write(idx - 1, 0, label, formats['label'])
        overview.write(idx - 1, 1, value, formats['value'])

    progress = workbook.add_worksheet('Learner Progress')
    headers = ['#', 'Learner', 'Email', 'Registration Status', 'Lesson Status', 'Course Result', 'Score', 'Total Time', 'Last Activity']
    for col, header in enumerate(headers):
        progress.write(0, col, header, formats['header'])
    progress.freeze_panes(1, 0)
    progress.autofilter(0, 0, max(1, len(meta['learners'])), len(headers) - 1)
    widths = [6, 24, 30, 20, 18, 18, 12, 16, 22]
    for col, width in enumerate(widths):
        progress.set_column(col, col, width)

    for row_idx, learner in enumerate(meta['learners'], start=1):
        row_fmt = formats['plain'] if row_idx % 2 else formats['stripe']
        values = [
            row_idx,
            safe_text(learner.get('learnerName'), 'Learner'),
            safe_text(learner.get('learnerEmail')),
            safe_text(learner.get('status')),
            safe_text(learner.get('lastLessonStatus')),
        ]
        for col, value in enumerate(values):
            progress.write(row_idx, col, value, row_fmt)
        write_status_cell(progress, row_idx, 5, learner_result(learner), formats)
        score = numeric_score(learner.get('lastScoreRaw'))
        progress.write(row_idx, 6, score if score is not None else '', row_fmt)
        progress.write(row_idx, 7, safe_text(learner.get('lastTotalTime')), row_fmt)
        progress.write(row_idx, 8, iso_date(learner.get('lastCommitAt') or learner.get('updatedAt')), row_fmt)

    activity = workbook.add_worksheet('Detailed Activity')
    activity_headers = ['Learner', 'Metric', 'Recorded Value']
    for col, header in enumerate(activity_headers):
        activity.write(0, col, header, formats['header'])
    activity.set_column('A:A', 28)
    activity.set_column('B:B', 24)
    activity.set_column('C:C', 40)
    activity.freeze_panes(1, 0)

    row_idx = 1
    for learner in meta['learners']:
        learner_name = safe_text(learner.get('learnerName'), 'Learner')
        details = [
            ('Registration Status', safe_text(learner.get('status'), '—')),
            ('Lesson Status', safe_text(learner.get('lastLessonStatus'), '—')),
            ('Course Result', learner_result(learner)),
            ('Score', display_score(learner.get('lastScoreRaw'))),
            ('Total Learning Time', safe_text(learner.get('lastTotalTime'), '—')),
            ('Last Activity', iso_date(learner.get('lastCommitAt') or learner.get('updatedAt'))),
            ('Completed', 'Yes' if is_completed_status(learner.get('lastLessonStatus')) else 'No'),
        ]
        for metric, value in details:
            row_fmt = formats['plain'] if row_idx % 2 else formats['stripe']
            activity.write(row_idx, 0, learner_name, row_fmt)
            activity.write(row_idx, 1, metric, row_fmt)
            activity.write(row_idx, 2, value, row_fmt)
            row_idx += 1

    workbook.close()


def main():
    if len(sys.argv) != 4:
        print('Usage: generate_scorm_report.py <input.json> <output> <pdf|excel>', file=sys.stderr)
        return 2

    input_path, output_path, format_name = sys.argv[1], sys.argv[2], sys.argv[3].lower()
    with open(input_path, 'r', encoding='utf-8') as handle:
        data = json.load(handle)

    if format_name == 'pdf':
        ScormKahootReport(output_path, data).build()
    elif format_name == 'excel':
        generate_excel(data, output_path)
    else:
        print(f'Unsupported format: {format_name}', file=sys.stderr)
        return 2

    print(output_path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
