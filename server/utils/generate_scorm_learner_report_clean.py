import sys
import json
from datetime import datetime

import xlsxwriter
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, String

import generate_scorm_report as base


PANEL = colors.HexColor('#FBFAFC')
SOFT_PURPLE = colors.HexColor('#F4EFFB')


def safe(value, fallback='—'):
    if value is None or value == '':
        return fallback
    return str(value)


def number_text(value, suffix=''):
    if value is None or value == '':
        return '—'
    try:
        n = float(value)
        value_text = str(int(n)) if n.is_integer() else f'{n:.1f}'.rstrip('0').rstrip('.')
        return f'{value_text}{suffix}'
    except (TypeError, ValueError):
        return f'{value}{suffix}'


def learner_result_color(result):
    key = str(result or '').strip().lower()
    if key in ('passed', 'completed'):
        return base.GREEN
    if key == 'failed':
        return base.RED
    if key == 'in progress':
        return base.YELLOW
    return base.MID


class LearnerReport:
    def __init__(self, filename, data):
        self.filename = filename
        self.data = data or {}
        self.summary = self.data.get('summary') or {}
        self.attempts = self.data.get('attempts') or []
        self.elements = []
        self.styles = self._styles()

    def _styles(self):
        s = base.getSampleStyleSheet() if hasattr(base, 'getSampleStyleSheet') else None
        if s is None:
            from reportlab.lib.styles import getSampleStyleSheet
            s = getSampleStyleSheet()
        from reportlab.lib.styles import ParagraphStyle
        s.add(ParagraphStyle(name='LearnerTitle', fontName=base.FONT_BOLD, fontSize=32, leading=37, textColor=base.PURPLE, spaceAfter=8))
        s.add(ParagraphStyle(name='LearnerSubtitle', fontName=base.FONT_LIGHT, fontSize=16, leading=21, textColor=base.DARK, spaceAfter=18))
        s.add(ParagraphStyle(name='BodyCustom', fontName=base.FONT_NORMAL, fontSize=9.2, leading=13, textColor=base.DARK, spaceAfter=7))
        s.add(ParagraphStyle(name='BodyMuted', fontName=base.FONT_NORMAL, fontSize=8.1, leading=11.2, textColor=base.MID))
        s.add(ParagraphStyle(name='WhiteLabel', fontName=base.FONT_BOLD, fontSize=8.5, leading=10, textColor=base.WHITE))
        s.add(ParagraphStyle(name='SectionNo', fontName=base.FONT_BOLD, fontSize=10, leading=12, textColor=base.WHITE, alignment=1))
        s.add(ParagraphStyle(name='SectionTitle', fontName=base.FONT_BOLD, fontSize=15, leading=18, textColor=base.DARK))
        s.add(ParagraphStyle(name='SectionKicker', fontName=base.FONT_BOLD, fontSize=7.4, leading=9, textColor=base.PURPLE, spaceAfter=4))
        s.add(ParagraphStyle(name='CardLabel', fontName=base.FONT_BOLD, fontSize=7, leading=8.4, textColor=base.MID, alignment=1))
        s.add(ParagraphStyle(name='CardValue', fontName=base.FONT_BOLD, fontSize=18, leading=21, textColor=base.DARK, alignment=1))
        s.add(ParagraphStyle(name='AuditName', fontName=base.FONT_BOLD, fontSize=9, leading=11, textColor=base.DARK))
        s.add(ParagraphStyle(name='AuditValue', fontName=base.FONT_NORMAL, fontSize=7.5, leading=9.8, textColor=base.DARK))
        s.add(ParagraphStyle(name='AuditLabel', fontName=base.FONT_BOLD, fontSize=6.8, leading=8.3, textColor=base.MID))
        s.add(ParagraphStyle(name='Question', fontName=base.FONT_BOLD, fontSize=8.6, leading=11.4, textColor=base.DARK))
        s.add(ParagraphStyle(name='Answer', fontName=base.FONT_NORMAL, fontSize=7.6, leading=10.4, textColor=base.DARK))
        return s

    def section_header(self, number, title, kicker):
        number_cell = Paragraph(number, self.styles['SectionNo'])
        title_cell = [
            Paragraph(f'<font color="#46178f"><b>{base.ptxt(kicker)}</b></font>', self.styles['SectionKicker']),
            Paragraph(base.ptxt(title), self.styles['SectionTitle'])
        ]
        table = Table([[number_cell, title_cell]], colWidths=[0.48 * inch, 6.72 * inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), base.PURPLE),
            ('BACKGROUND', (1, 0), (1, 0), base.SOFT),
            ('BOX', (0, 0), (-1, -1), 0.6, base.LIGHT),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (0, 0), 5),
            ('RIGHTPADDING', (0, 0), (0, 0), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
            ('LEFTPADDING', (1, 0), (1, 0), 12),
        ]))
        return KeepTogether([table, Spacer(1, 0.16 * inch)])

    def kpi_card(self, label, value, accent):
        label_p = Paragraph(label.upper(), self.styles['CardLabel'])
        value_p = Paragraph(base.ptxt(value), self.styles['CardValue'])
        table = Table([[label_p], [value_p]], colWidths=[1.68 * inch], rowHeights=[0.27 * inch, 0.46 * inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), base.WHITE),
            ('BOX', (0, 0), (-1, -1), 0.7, base.LIGHT),
            ('LINEABOVE', (0, 0), (-1, 0), 3, accent),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        return table

    def create_cover(self):
        drawing = Drawing(500, 150)
        drawing.add(Rect(-50, 50, 600, 100, fillColor=base.PURPLE, strokeColor=None))
        drawing.add(String(20, 90, 'QUIZMOTO', fontName=base.FONT_BOLD, fontSize=24, fillColor=base.WHITE))
        drawing.add(String(20, 70, 'SCORM AI · INDIVIDUAL LEARNER REPORT', fontName=base.FONT_LIGHT, fontSize=10, fillColor=base.WHITE))
        self.elements.extend([
            drawing,
            Spacer(1, 0.85 * inch),
            Paragraph('Individual Learner Report', self.styles['LearnerTitle']),
            Paragraph(base.ptxt(self.data.get('learnerName'), 'Learner'), self.styles['LearnerSubtitle']),
            Paragraph(base.ptxt(self.data.get('learnerEmail'), 'No learner email'), self.styles['BodyCustom']),
            Spacer(1, 1.65 * inch),
        ])
        rows = [
            ('REPORT DATE', base.date_text(self.data.get('generatedAt') or datetime.utcnow().isoformat(), True)),
            ('TOTAL COURSES', self.summary.get('courseCount', 0)),
            ('COMPLETED', self.summary.get('completedCount', 0)),
            ('ANSWER ACCURACY', number_text(self.summary.get('answerAccuracy'), '%')),
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

    def create_summary(self):
        self.elements.append(self.section_header('01', 'Learner Performance Summary', 'INDIVIDUAL LEARNING SNAPSHOT'))
        name = base.ptxt(self.data.get('learnerName'), 'Learner')
        email = base.ptxt(self.data.get('learnerEmail'), '—')
        self.elements.append(Paragraph(
            f'This report consolidates the recorded SCORM AI learning activity for <b>{name}</b> ({email}) across the courses available to this SCORM AI account.',
            self.styles['BodyCustom']
        ))
        cards = [[
            self.kpi_card('Courses', self.summary.get('courseCount', 0), base.PURPLE),
            self.kpi_card('Completed', self.summary.get('completedCount', 0), base.GREEN),
            self.kpi_card('Avg Score', number_text(self.summary.get('averageScore')), base.BLUE),
            self.kpi_card('Accuracy', number_text(self.summary.get('answerAccuracy'), '%'), base.YELLOW),
        ]]
        table = Table(cards, colWidths=[1.75 * inch] * 4)
        table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ]))
        self.elements.extend([table, Spacer(1, 0.2 * inch)])

        question_rows = [
            ['Questions captured', self.summary.get('questionsCaptured', 0)],
            ['Graded questions', self.summary.get('gradedQuestions', 0)],
            ['Correct answers', self.summary.get('correctAnswers', 0)],
            ['Answer accuracy', number_text(self.summary.get('answerAccuracy'), '%')],
        ]
        detail = [[Paragraph(base.ptxt(k), self.styles['AuditLabel']), Paragraph(base.ptxt(v), self.styles['AuditValue'])] for k, v in question_rows]
        detail_table = Table(detail, colWidths=[2.1 * inch, 4.9 * inch])
        detail_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), base.SOFT),
            ('BACKGROUND', (1, 0), (1, -1), base.WHITE),
            ('GRID', (0, 0), (-1, -1), 0.5, base.LIGHT),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ]))
        self.elements.extend([detail_table, PageBreak()])

    def create_courses(self):
        self.elements.append(self.section_header('02', 'Course Results', 'COURSE-BY-COURSE OUTCOMES'))
        if not self.attempts:
            self.elements.append(Paragraph('<i>No course activity was found for this learner.</i>', self.styles['BodyCustom']))
            return

        for index, attempt in enumerate(self.attempts, start=1):
            result = safe(attempt.get('result'), 'Not Attempted')
            color = learner_result_color(result)
            title = base.ptxt(attempt.get('courseTitle'), 'Untitled course')
            header = Table([[
                Paragraph(f'<b>{index:02d}. {title}</b><br/><font size="7" color="#777777">{base.ptxt(attempt.get("scormStandard"), "SCORM")}</font>', self.styles['AuditName']),
                Paragraph(f'<font color="{color.hexval()}"><b>{base.ptxt(result)}</b></font>', self.styles['AuditName']),
                Paragraph(f'<b>{base.ptxt(number_text(attempt.get("score")))}</b><br/><font size="6.5" color="#777777">SCORE</font>', self.styles['AuditName'])
            ]], colWidths=[4.35 * inch, 1.55 * inch, 1.3 * inch])
            header.setStyle(TableStyle([
                ('LINEABOVE', (0, 0), (-1, 0), 3, color),
                ('BACKGROUND', (0, 0), (-1, -1), base.STRIPE),
                ('BOX', (0, 0), (-1, -1), 0.5, base.LIGHT),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('LEFTPADDING', (0, 0), (-1, -1), 9),
                ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                ('TOPPADDING', (0, 0), (-1, -1), 7),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ]))
            answer_summary = attempt.get('answerSummary') or {}
            detail = [
                [Paragraph('PROGRESS', self.styles['AuditLabel']), Paragraph('TOTAL TIME', self.styles['AuditLabel']), Paragraph('QUESTIONS', self.styles['AuditLabel']), Paragraph('LAST ACTIVITY', self.styles['AuditLabel'])],
                [
                    Paragraph(base.ptxt(number_text(attempt.get('progressPercent'), '%')), self.styles['AuditValue']),
                    Paragraph(base.ptxt(attempt.get('totalTime')), self.styles['AuditValue']),
                    Paragraph(base.ptxt(answer_summary.get('captured', 0)), self.styles['AuditValue']),
                    Paragraph(base.ptxt(base.date_text(attempt.get('lastActivity'))), self.styles['AuditValue'])
                ]
            ]
            dt = Table(detail, colWidths=[1.8 * inch] * 4)
            dt.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), base.SOFT),
                ('BACKGROUND', (0, 1), (-1, 1), base.WHITE),
                ('BOX', (0, 0), (-1, -1), 0.5, base.LIGHT),
                ('INNERGRID', (0, 0), (-1, -1), 0.4, base.LIGHT),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ]))
            self.elements.append(KeepTogether([header, dt, Spacer(1, 0.16 * inch)]))
        self.elements.append(PageBreak())

    def create_answers(self):
        self.elements.append(self.section_header('03', 'Question & Answer Evidence', 'KNOWLEDGE-CHECK DETAIL'))
        self.elements.append(Paragraph(
            'This section records the learner response captured by the SCORM runtime, the expected answer, and the recorded result. Historical attempts created before answer-level tracking may only contain score and completion data.',
            self.styles['BodyMuted']
        ))
        self.elements.append(Spacer(1, 0.12 * inch))

        found = False
        for attempt in self.attempts:
            interactions = attempt.get('interactions') or []
            if not interactions:
                continue
            found = True
            course_title = base.ptxt(attempt.get('courseTitle'), 'Untitled course')
            self.elements.extend([
                Paragraph(f'<b>{course_title}</b>', self.styles['SectionTitle']),
                Spacer(1, 0.08 * inch)
            ])
            for index, item in enumerate(interactions, start=1):
                result = safe(item.get('result'), 'Recorded')
                color = base.GREEN if result.lower() == 'correct' else base.RED if result.lower() == 'incorrect' else base.MID
                question = Paragraph(f'<b>{index}. {base.ptxt(item.get("question"), f"Question {index}")}</b>', self.styles['Question'])
                status = Paragraph(f'<font color="{color.hexval()}"><b>{base.ptxt(result)}</b></font>', self.styles['Answer'])
                answer_rows = [
                    [Paragraph('LEARNER ANSWER', self.styles['AuditLabel']), Paragraph(base.ptxt(item.get('selectedAnswer')), self.styles['Answer'])],
                    [Paragraph('CORRECT ANSWER', self.styles['AuditLabel']), Paragraph(base.ptxt(item.get('correctAnswer')), self.styles['Answer'])],
                ]
                if item.get('explanation'):
                    answer_rows.append([Paragraph('EXPLANATION', self.styles['AuditLabel']), Paragraph(base.ptxt(item.get('explanation')), self.styles['Answer'])])
                details = Table(answer_rows, colWidths=[1.35 * inch, 5.85 * inch])
                details.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), base.SOFT),
                    ('BACKGROUND', (1, 0), (1, -1), base.WHITE),
                    ('GRID', (0, 0), (-1, -1), 0.4, base.LIGHT),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                qhead = Table([[question, status]], colWidths=[6.05 * inch, 1.15 * inch])
                qhead.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), PANEL),
                    ('LINEABOVE', (0, 0), (-1, 0), 2.5, color),
                    ('BOX', (0, 0), (-1, -1), 0.5, base.LIGHT),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 7),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
                ]))
                self.elements.append(KeepTogether([qhead, details, Spacer(1, 0.12 * inch)]))
            self.elements.append(Spacer(1, 0.1 * inch))

        if not found:
            self.elements.append(Paragraph(
                '<i>No question-level evidence is available for this learner yet. This can occur for historical attempts completed before answer tracking was enabled.</i>',
                self.styles['BodyCustom']
            ))

    @staticmethod
    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(base.PURPLE)
        canvas.setLineWidth(1.2)
        canvas.rect(0.25 * inch, 0.25 * inch, A4[0] - 0.5 * inch, A4[1] - 0.5 * inch)
        canvas.setLineWidth(0.6)
        canvas.rect(0.32 * inch, 0.32 * inch, A4[0] - 0.64 * inch, A4[1] - 0.64 * inch)
        canvas.setStrokeColor(base.LIGHT)
        canvas.line(0.5 * inch, 0.75 * inch, A4[0] - 0.5 * inch, 0.75 * inch)
        canvas.setFillColor(base.DARK)
        canvas.setFont(base.FONT_LIGHT, 7.5)
        canvas.drawString(0.5 * inch, 0.6 * inch, 'CONFIDENTIAL · SCORM AI INDIVIDUAL LEARNER REPORT')
        canvas.drawRightString(A4[0] - 0.5 * inch, 0.6 * inch, f'PAGE {doc.page}')
        canvas.restoreState()

    def build(self):
        title = safe(self.data.get('learnerName'), 'Learner')
        doc = SimpleDocTemplate(
            self.filename,
            pagesize=A4,
            rightMargin=0.5 * inch,
            leftMargin=0.5 * inch,
            topMargin=0.9 * inch,
            bottomMargin=0.95 * inch,
            title=f'SCORM AI Individual Learner Report - {title}',
            author='Quizmoto'
        )
        self.create_cover()
        self.create_summary()
        self.create_courses()
        self.create_answers()
        doc.build(self.elements, onFirstPage=self.on_page, onLaterPages=self.on_page)


def excel_formats(workbook):
    return {
        'title': workbook.add_format({'bold': True, 'font_size': 20, 'font_color': '#46178f'}),
        'sub': workbook.add_format({'font_size': 11, 'font_color': '#2D2D2D'}),
        'section': workbook.add_format({'bold': True, 'font_size': 12, 'font_color': '#46178f', 'bottom': 1, 'bottom_color': '#46178f'}),
        'header': workbook.add_format({'bold': True, 'font_color': '#FFFFFF', 'bg_color': '#46178f', 'border': 1, 'border_color': '#FFFFFF', 'align': 'center', 'valign': 'vcenter'}),
        'label': workbook.add_format({'bold': True, 'bg_color': '#F2F2F2', 'border': 1, 'border_color': '#D9D9D9'}),
        'value': workbook.add_format({'border': 1, 'border_color': '#D9D9D9'}),
        'stripe': workbook.add_format({'bg_color': '#F9F9F9', 'border': 1, 'border_color': '#E5E5E5', 'text_wrap': True, 'valign': 'top'}),
        'plain': workbook.add_format({'border': 1, 'border_color': '#E5E5E5', 'text_wrap': True, 'valign': 'top'}),
        'green': workbook.add_format({'font_color': '#26890c', 'bold': True, 'border': 1, 'border_color': '#E5E5E5'}),
        'red': workbook.add_format({'font_color': '#e21b3c', 'bold': True, 'border': 1, 'border_color': '#E5E5E5'}),
        'yellow': workbook.add_format({'font_color': '#d89e00', 'bold': True, 'border': 1, 'border_color': '#E5E5E5'}),
    }


def generate_excel(data, output_path):
    workbook = xlsxwriter.Workbook(output_path)
    fmt = excel_formats(workbook)
    learner_name = safe(data.get('learnerName'), 'Learner')
    learner_email = safe(data.get('learnerEmail'), '')
    summary = data.get('summary') or {}
    attempts = data.get('attempts') or []

    workbook.set_properties({
        'title': f'SCORM AI Individual Learner Report - {learner_name}',
        'subject': 'SCORM AI individual learner analytics',
        'author': 'Quizmoto'
    })

    overview = workbook.add_worksheet('Learner Overview')
    overview.set_column('A:A', 25)
    overview.set_column('B:B', 52)
    overview.write('A1', 'QUIZMOTO', fmt['title'])
    overview.write('A2', 'SCORM AI · INDIVIDUAL LEARNER REPORT', fmt['sub'])
    overview.merge_range('A4:B4', learner_name, fmt['section'])
    rows = [
        ('Learner email', learner_email),
        ('Generated', base.date_text(data.get('generatedAt') or datetime.utcnow().isoformat())),
        ('Courses', summary.get('courseCount', 0)),
        ('Completed', summary.get('completedCount', 0)),
        ('Average score', summary.get('averageScore') if summary.get('averageScore') is not None else ''),
        ('Questions captured', summary.get('questionsCaptured', 0)),
        ('Graded questions', summary.get('gradedQuestions', 0)),
        ('Correct answers', summary.get('correctAnswers', 0)),
        ('Answer accuracy %', summary.get('answerAccuracy') if summary.get('answerAccuracy') is not None else ''),
    ]
    for row_index, (label, value) in enumerate(rows, 4):
        overview.write(row_index, 0, label, fmt['label'])
        overview.write(row_index, 1, value, fmt['value'])

    courses = workbook.add_worksheet('Course Results')
    headers = ['Course', 'SCORM Standard', 'Result', 'Registration Status', 'Lesson Status', 'Score', 'Progress %', 'Total Time', 'Last Activity', 'Questions Captured', 'Correct', 'Accuracy %']
    for col, header in enumerate(headers):
        courses.write(0, col, header, fmt['header'])
    widths = [34, 16, 16, 18, 18, 10, 12, 16, 23, 18, 10, 12]
    for col, width in enumerate(widths):
        courses.set_column(col, col, width)
    courses.freeze_panes(1, 0)
    for row_index, attempt in enumerate(attempts, 1):
        row_fmt = fmt['plain'] if row_index % 2 else fmt['stripe']
        answer_summary = attempt.get('answerSummary') or {}
        values = [
            safe(attempt.get('courseTitle'), ''),
            safe(attempt.get('scormStandard'), ''),
            safe(attempt.get('result'), ''),
            safe(attempt.get('status'), ''),
            safe(attempt.get('lessonStatus'), ''),
            attempt.get('score') if attempt.get('score') is not None else '',
            attempt.get('progressPercent') if attempt.get('progressPercent') is not None else '',
            safe(attempt.get('totalTime'), ''),
            base.date_text(attempt.get('lastActivity')),
            answer_summary.get('captured', 0),
            answer_summary.get('correct', 0),
            answer_summary.get('accuracy') if answer_summary.get('accuracy') is not None else '',
        ]
        for col, value in enumerate(values):
            cell_fmt = row_fmt
            if col == 2:
                result = str(attempt.get('result') or '').lower()
                cell_fmt = fmt['green'] if result in ('passed', 'completed') else fmt['red'] if result == 'failed' else fmt['yellow'] if result == 'in progress' else row_fmt
            courses.write(row_index, col, value, cell_fmt)
    courses.autofilter(0, 0, max(1, len(attempts)), len(headers) - 1)

    answers = workbook.add_worksheet('Question Answers')
    answer_headers = ['Course', 'Question #', 'Question', 'Learner Answer', 'Correct Answer', 'Result', 'Explanation']
    for col, header in enumerate(answer_headers):
        answers.write(0, col, header, fmt['header'])
    answer_widths = [30, 10, 55, 35, 35, 14, 55]
    for col, width in enumerate(answer_widths):
        answers.set_column(col, col, width)
    answers.freeze_panes(1, 0)
    answer_row = 1
    for attempt in attempts:
        for index, item in enumerate(attempt.get('interactions') or [], 1):
            row_fmt = fmt['plain'] if answer_row % 2 else fmt['stripe']
            result = safe(item.get('result'), '')
            result_fmt = fmt['green'] if result.lower() == 'correct' else fmt['red'] if result.lower() == 'incorrect' else row_fmt
            values = [
                safe(attempt.get('courseTitle'), ''),
                index,
                safe(item.get('question'), ''),
                safe(item.get('selectedAnswer'), ''),
                safe(item.get('correctAnswer'), ''),
                result,
                safe(item.get('explanation'), ''),
            ]
            for col, value in enumerate(values):
                answers.write(answer_row, col, value, result_fmt if col == 5 else row_fmt)
            answer_row += 1
    if answer_row == 1:
        answers.merge_range('A2:G2', 'No question-level evidence is available for this learner yet.', fmt['value'])
    answers.autofilter(0, 0, max(1, answer_row - 1), len(answer_headers) - 1)

    workbook.close()


def main():
    if len(sys.argv) != 4:
        print('Usage: generate_scorm_learner_report_clean.py <input.json> <output> <pdf|excel>', file=sys.stderr)
        return 2

    input_path, output_path, kind = sys.argv[1], sys.argv[2], sys.argv[3].lower()
    with open(input_path, 'r', encoding='utf-8') as handle:
        data = json.load(handle)

    if kind == 'pdf':
        LearnerReport(output_path, data).build()
    elif kind == 'excel':
        generate_excel(data, output_path)
    else:
        print(f'Unsupported format: {kind}', file=sys.stderr)
        return 2

    print(output_path)
    return 0


if __name__ == '__main__':
    sys.exit(main())