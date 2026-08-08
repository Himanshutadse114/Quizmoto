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
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

try:
    pdfmetrics.registerFont(TTFont('Roboto-Regular', '/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('Roboto-Bold', '/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Roboto-Light', '/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Light.ttf'))
    FONT_NORMAL = 'Roboto-Regular'
    FONT_BOLD = 'Roboto-Bold'
    FONT_LIGHT = 'Roboto-Light'
except Exception:
    FONT_NORMAL = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'
    FONT_LIGHT = 'Helvetica'

PURPLE = colors.HexColor('#46178f')
BLUE = colors.HexColor('#1368ce')
GREEN = colors.HexColor('#26890c')
RED = colors.HexColor('#e21b3c')
YELLOW = colors.HexColor('#d89e00')
DARK = colors.HexColor('#2D2D2D')
MID = colors.HexColor('#777777')
LIGHT = colors.HexColor('#D9D9D9')
SOFT = colors.HexColor('#F6F5F8')
STRIPE = colors.HexColor('#FAFAFA')
WHITE = colors.white


def txt(v, fallback=''):
    return fallback if v is None else str(v)


def ptxt(v, fallback='—'):
    return escape(txt(v, fallback))


def key(v):
    return txt(v).strip().lower()


def completed(v):
    return key(v) in ('completed', 'passed', 'failed')


def score_num(v):
    if v in (None, ''):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def score_text(v):
    n = score_num(v)
    if n is None:
        return '—'
    return str(int(n)) if n.is_integer() else f'{n:.2f}'.rstrip('0').rstrip('.')


def date_text(v, date_only=False):
    if not v:
        return '—'
    s = txt(v)
    try:
        dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d' if date_only else '%Y-%m-%d %H:%M')
    except Exception:
        return s.split('T')[0] if date_only and 'T' in s else s


def learner_result(reg):
    lesson = key(reg.get('lastLessonStatus'))
    reg_status = key(reg.get('status'))
    if lesson == 'passed': return 'Passed'
    if lesson == 'failed': return 'Failed'
    if lesson == 'completed': return 'Completed'
    if lesson in ('incomplete', 'browsed'): return 'In Progress'
    if lesson in ('not attempted', 'not_attempted') or not lesson:
        return 'In Progress' if reg_status in ('launched', 'active', 'started', 'in_progress') else 'Not Attempted'
    return txt(reg.get('lastLessonStatus'), 'In Progress').replace('_', ' ').title()


def result_color(reg):
    r = learner_result(reg).lower()
    if r in ('passed', 'completed'): return GREEN
    if r == 'failed': return RED
    if r == 'in progress': return YELLOW
    return MID


def meta(data):
    regs = data.get('registrations') or []
    regs = regs if isinstance(regs, list) else []
    learners = [r for r in regs if not r.get('isPreview')]
    previews = [r for r in regs if r.get('isPreview')]
    learners.sort(key=lambda r: score_num(r.get('lastScoreRaw')) if score_num(r.get('lastScoreRaw')) is not None else -1, reverse=True)
    scores = [score_num(r.get('lastScoreRaw')) for r in learners]
    scores = [s for s in scores if s is not None]
    done = [r for r in learners if completed(r.get('lastLessonStatus'))]
    progressing = [r for r in learners if learner_result(r) == 'In Progress']
    untouched = [r for r in learners if learner_result(r) == 'Not Attempted']
    avg = sum(scores) / len(scores) if scores else None
    rate = len(done) / len(learners) * 100 if learners else None
    package = data.get('package') or {}
    return {
        'title': txt(data.get('title'), 'Untitled course'),
        'description': txt(data.get('description')),
        'inviteCode': txt(data.get('inviteCode')),
        'status': txt(data.get('status'), 'unknown'),
        'publishedAt': data.get('publishedAt') or data.get('createdAt'),
        'packageTitle': txt(package.get('title')),
        'standard': txt(package.get('standard'), 'SCORM'),
        'learners': learners,
        'previews': previews,
        'stats': {
            'total': len(learners),
            'completed': len(done),
            'progress': len(progressing),
            'notAttempted': len(untouched),
            'averageScore': round(avg, 2) if avg is not None else None,
            'completionRate': round(rate, 1) if rate is not None else None,
        }
    }


class ScormReport:
    def __init__(self, filename, data):
        self.filename = filename
        self.data = data
        self.meta = meta(data)
        self.styles = self._styles()
        self.elements = []
        self.chart_paths = []

    def _styles(self):
        s = getSampleStyleSheet()
        s.add(ParagraphStyle(name='TitlePremium', fontName=FONT_BOLD, fontSize=34, leading=40, textColor=PURPLE, spaceAfter=10))
        s.add(ParagraphStyle(name='SubtitlePremium', fontName=FONT_LIGHT, fontSize=18, leading=22, textColor=DARK, spaceAfter=24))
        s.add(ParagraphStyle(name='BodyCustom', fontName=FONT_NORMAL, fontSize=9.3, leading=13.2, textColor=DARK, spaceAfter=9))
        s.add(ParagraphStyle(name='BodyMuted', fontName=FONT_NORMAL, fontSize=8.3, leading=11.5, textColor=MID))
        s.add(ParagraphStyle(name='WhiteLabel', fontName=FONT_BOLD, fontSize=9, leading=11, textColor=WHITE))
        s.add(ParagraphStyle(name='SectionNo', fontName=FONT_BOLD, fontSize=10, leading=12, textColor=WHITE, alignment=1))
        s.add(ParagraphStyle(name='SectionTitle', fontName=FONT_BOLD, fontSize=15, leading=18, textColor=DARK))
        s.add(ParagraphStyle(name='SectionKicker', fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=PURPLE, spaceAfter=4))
        s.add(ParagraphStyle(name='CardLabel', fontName=FONT_BOLD, fontSize=7.2, leading=8.5, textColor=MID, alignment=1))
        s.add(ParagraphStyle(name='CardValue', fontName=FONT_BOLD, fontSize=20, leading=22, textColor=DARK, alignment=1))
        s.add(ParagraphStyle(name='AuditName', fontName=FONT_BOLD, fontSize=9, leading=11, textColor=DARK))
        s.add(ParagraphStyle(name='AuditValue', fontName=FONT_NORMAL, fontSize=7.4, leading=9.5, textColor=DARK))
        s.add(ParagraphStyle(name='AuditLabel', fontName=FONT_BOLD, fontSize=6.8, leading=8.5, textColor=MID))
        s.add(ParagraphStyle(name='TOC', fontName=FONT_NORMAL, fontSize=10.5, leading=14, textColor=DARK))
        return s

    def section_header(self, number, title, anchor, kicker):
        number_cell = Paragraph(number, self.styles['SectionNo'])
        title_cell = [
            Paragraph(f'<a name="{anchor}"/><font color="#46178f"><b>{ptxt(kicker)}</b></font>', self.styles['SectionKicker']),
            Paragraph(ptxt(title), self.styles['SectionTitle'])
        ]
        t = Table([[number_cell, title_cell]], colWidths=[0.48 * inch, 6.72 * inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,0), PURPLE),
            ('BACKGROUND', (1,0), (1,0), SOFT),
            ('BOX', (0,0), (-1,-1), 0.6, LIGHT),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (0,0), 5), ('RIGHTPADDING', (0,0), (0,0), 5),
            ('TOPPADDING', (0,0), (-1,-1), 9), ('BOTTOMPADDING', (0,0), (-1,-1), 9),
            ('LEFTPADDING', (1,0), (1,0), 12),
        ]))
        return KeepTogether([t, Spacer(1, 0.18 * inch)])

    def create_cover(self):
        d = Drawing(500, 150)
        d.add(Rect(-50, 50, 600, 100, fillColor=PURPLE, strokeColor=None))
        d.add(String(20, 90, 'QUIZMOTO', fontName=FONT_BOLD, fontSize=24, fillColor=WHITE))
        d.add(String(20, 70, 'ANALYTICS PLATFORM', fontName=FONT_LIGHT, fontSize=10, fillColor=WHITE))
        self.elements += [d, Spacer(1, 1 * inch), Paragraph('Quizmoto SCORM World Report', self.styles['TitlePremium']), Paragraph(f"Analytics for: {ptxt(self.meta['title'])}", self.styles['SubtitlePremium']), Spacer(1, 2.2 * inch)]
        rows = [
            ('REPORT DATE', date_text(datetime.utcnow().isoformat(), True)),
            ('SCORM STANDARD', self.meta['standard']),
            ('TOTAL LEARNERS', self.meta['stats']['total']),
            ('COURSE STATUS', self.meta['status'].upper()),
        ]
        data = [[Paragraph(k, self.styles['WhiteLabel']), Paragraph(ptxt(v), self.styles['BodyCustom'])] for k, v in rows]
        t = Table(data, colWidths=[1.8 * inch, 3.1 * inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,-1), PURPLE), ('BACKGROUND', (1,0), (1,-1), STRIPE),
            ('GRID', (0,0), (-1,-1), 1, WHITE), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 14), ('TOPPADDING', (0,0), (-1,-1), 11), ('BOTTOMPADDING', (0,0), (-1,-1), 11)
        ]))
        self.elements += [t, PageBreak()]

    def create_toc(self):
        self.elements += [self.section_header('00', 'Table of Contents', 'toc', 'REPORT NAVIGATION'), Spacer(1, 0.12 * inch)]
        rows = [
            ['01', 'Executive Learning Summary', '3'],
            ['02', 'High-Level Learning Analytics', '3'],
            ['03', 'Detailed Learner Audit Logs', '4'],
        ]
        data = [['SECTION', 'CONTENT', 'PAGE']] + [[Paragraph(r[0], self.styles['TOC']), Paragraph(f'<link destination="{a}"><b>{r[1]}</b></link>', self.styles['TOC']), Paragraph(r[2], self.styles['TOC'])] for r, a in zip(rows, ['exec_summary','learning_summary','learner_audit'])]
        t = Table(data, colWidths=[1.0 * inch, 5.0 * inch, 1.2 * inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PURPLE), ('TEXTCOLOR', (0,0), (-1,0), WHITE), ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
            ('ALIGN', (0,0), (0,-1), 'CENTER'), ('ALIGN', (-1,0), (-1,-1), 'CENTER'), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, STRIPE]), ('GRID', (0,0), (-1,-1), 0.5, LIGHT), ('BOX', (0,0), (-1,-1), 1.2, PURPLE),
            ('TOPPADDING', (0,0), (-1,-1), 11), ('BOTTOMPADDING', (0,0), (-1,-1), 11), ('LEFTPADDING', (0,0), (-1,-1), 10)
        ]))
        self.elements += [t, PageBreak()]

    def create_executive(self):
        st = self.meta['stats']
        self.elements.append(self.section_header('01', 'Executive Learning Summary', 'exec_summary', 'COURSE SNAPSHOT'))
        summary = f"This learning audit summarizes {st['total']} learner registrations for <b>{ptxt(self.meta['title'])}</b>. It combines completion, scoring, learning-time, and recent-activity signals into a concise management view, followed by learner-level audit detail."
        self.elements.append(Paragraph(summary, self.styles['BodyCustom']))
        context = [
            [Paragraph('COURSE', self.styles['AuditLabel']), Paragraph(ptxt(self.meta['title']), self.styles['AuditValue']), Paragraph('PACKAGE', self.styles['AuditLabel']), Paragraph(ptxt(self.meta['packageTitle'] or '—'), self.styles['AuditValue'])],
            [Paragraph('STANDARD', self.styles['AuditLabel']), Paragraph(ptxt(self.meta['standard']), self.styles['AuditValue']), Paragraph('PUBLISHED', self.styles['AuditLabel']), Paragraph(ptxt(date_text(self.meta['publishedAt'])), self.styles['AuditValue'])],
        ]
        t = Table(context, colWidths=[0.85*inch, 2.75*inch, 0.85*inch, 2.75*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,-1), SOFT), ('BACKGROUND', (2,0), (2,-1), SOFT),
            ('GRID', (0,0), (-1,-1), 0.45, LIGHT), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 7), ('BOTTOMPADDING', (0,0), (-1,-1), 7), ('LEFTPADDING', (0,0), (-1,-1), 8)
        ]))
        self.elements += [t, Spacer(1, 0.25*inch)]

    def kpi_card(self, label, value, accent):
        label_p = Paragraph(label.upper(), self.styles['CardLabel'])
        value_p = Paragraph(ptxt(value), self.styles['CardValue'])
        t = Table([[label_p],[value_p]], colWidths=[1.66*inch], rowHeights=[0.28*inch, 0.48*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), WHITE), ('BOX', (0,0), (-1,-1), 0.7, LIGHT),
            ('LINEABOVE', (0,0), (-1,0), 3, accent), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5)
        ]))
        return t

    def create_analytics(self):
        st = self.meta['stats']
        avg = st['averageScore'] or 0
        rate = st['completionRate'] or 0
        self.elements.append(self.section_header('02', 'High-Level Learning Analytics', 'learning_summary', 'PERFORMANCE & COMPLETION'))
        cards = [[
            self.kpi_card('Learners', st['total'], PURPLE),
            self.kpi_card('Completed', st['completed'], GREEN),
            self.kpi_card('In Progress', st['progress'], YELLOW),
            self.kpi_card('Not Attempted', st['notAttempted'], MID),
        ]]
        kt = Table(cards, colWidths=[1.75*inch]*4)
        kt.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'), ('LEFTPADDING',(0,0),(-1,-1),3), ('RIGHTPADDING',(0,0),(-1,-1),3)]))
        self.elements += [kt, Spacer(1, 0.22*inch)]

        score_display = f'{avg:.1f}%' if st['averageScore'] is not None else '—'
        rate_display = f'{rate:.1f}%' if st['completionRate'] is not None else '—'
        callout = Table([[
            Paragraph('<b>Average Score</b><br/><font size="16" color="#1368ce"><b>%s</b></font>' % score_display, self.styles['BodyCustom']),
            Paragraph('<b>Completion Rate</b><br/><font size="16" color="#26890c"><b>%s</b></font>' % rate_display, self.styles['BodyCustom'])
        ]], colWidths=[3.5*inch,3.5*inch])
        callout.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,-1),SOFT), ('BOX',(0,0),(-1,-1),0.5,LIGHT), ('INNERGRID',(0,0),(-1,-1),0.5,LIGHT),
            ('ALIGN',(0,0),(-1,-1),'CENTER'), ('VALIGN',(0,0),(-1,-1),'MIDDLE'), ('TOPPADDING',(0,0),(-1,-1),10), ('BOTTOMPADDING',(0,0),(-1,-1),8)
        ]))
        self.elements += [callout, Spacer(1,0.16*inch)]

        try:
            labels = ['Average Score', 'Completion Rate']
            values = [avg, rate]
            fig, ax = plt.subplots(figsize=(7, 2.65))
            ax.set_facecolor('#FBFBFB')
            ax.grid(axis='x', linestyle='--', alpha=0.35, color='#CCCCCC')
            bars = ax.barh(labels, values, color=['#1368ce','#26890c'], height=0.48, edgecolor='white', linewidth=2)
            ax.bar_label(bars, fmt='%.1f%%', padding=4, weight='bold', fontsize=10)
            ax.set_title('Course Completion & Performance', pad=12, fontsize=13, fontweight='bold', color='#2D2D2D')
            for side in ('top','right'): ax.spines[side].set_visible(False)
            ax.spines['left'].set_color('#DDDDDD'); ax.spines['bottom'].set_color('#DDDDDD')
            ax.set_xlim(0, max(100, max(values)+10 if values else 100))
            chart_dir = os.environ.get('REPORT_CHART_DIR','/tmp/report_charts')
            os.makedirs(chart_dir, exist_ok=True)
            chart = os.path.join(chart_dir, f'scorm_chart_{os.getpid()}_{id(self)}.png')
            self.chart_paths.append(chart)
            plt.tight_layout(); plt.savefig(chart, dpi=180, transparent=True); plt.close()
            panel = Table([[Image(chart, width=5.7*inch, height=2.15*inch)]], colWidths=[6.9*inch])
            panel.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),WHITE),('BOX',(0,0),(-1,-1),0.6,LIGHT),('ALIGN',(0,0),(-1,-1),'CENTER'),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
            self.elements.append(panel)
        except Exception as err:
            print(f'[scorm-report] chart skipped: {err}', file=sys.stderr)
        self.elements += [Spacer(1,0.2*inch), PageBreak()]

    def create_audit(self):
        self.elements.append(self.section_header('03', 'Detailed Learner Audit Logs', 'learner_audit', 'LEARNER-LEVEL EVIDENCE'))
        self.elements.append(Paragraph('Each card summarizes the latest recorded SCORM state for one learner. Host preview registrations are excluded from the primary metrics above.', self.styles['BodyMuted']))
        self.elements.append(Spacer(1,0.12*inch))
        learners = self.meta['learners']
        if not learners:
            self.elements.append(Paragraph('<i>No learner activity has been recorded for this course.</i>', self.styles['BodyCustom']))
            return

        legend = Table([[
            Paragraph('<font color="#26890c"><b>● Completed / Passed</b></font>', self.styles['AuditValue']),
            Paragraph('<font color="#d89e00"><b>● In Progress</b></font>', self.styles['AuditValue']),
            Paragraph('<font color="#e21b3c"><b>● Failed</b></font>', self.styles['AuditValue']),
            Paragraph('<font color="#777777"><b>● Not Attempted</b></font>', self.styles['AuditValue']),
        ]], colWidths=[1.8*inch]*4)
        legend.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),SOFT),('BOX',(0,0),(-1,-1),0.4,LIGHT),('ALIGN',(0,0),(-1,-1),'CENTER'),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
        self.elements += [legend, Spacer(1,0.16*inch)]

        for i, learner in enumerate(learners, start=1):
            color = result_color(learner)
            result = learner_result(learner)
            last = learner.get('lastCommitAt') or learner.get('updatedAt')
            header = Table([[
                Paragraph(f'<b>{i:02d}. {ptxt(learner.get("learnerName"), "Learner")}</b><br/><font size="7" color="#777777">{ptxt(learner.get("learnerEmail"))}</font>', self.styles['AuditName']),
                Paragraph(f'<font color="{color.hexval()}"><b>{ptxt(result)}</b></font>', self.styles['AuditName']),
                Paragraph(f'<b>{score_text(learner.get("lastScoreRaw"))}</b><br/><font size="6.5" color="#777777">SCORE</font>', self.styles['AuditName'])
            ]], colWidths=[4.35*inch,1.55*inch,1.3*inch])
            header.setStyle(TableStyle([
                ('LINEABOVE',(0,0),(-1,0),3,color), ('BACKGROUND',(0,0),(-1,-1),STRIPE), ('BOX',(0,0),(-1,-1),0.5,LIGHT),
                ('VALIGN',(0,0),(-1,-1),'MIDDLE'), ('ALIGN',(1,0),(-1,-1),'CENTER'), ('LEFTPADDING',(0,0),(-1,-1),9), ('RIGHTPADDING',(0,0),(-1,-1),9), ('TOPPADDING',(0,0),(-1,-1),7), ('BOTTOMPADDING',(0,0),(-1,-1),7)
            ]))
            detail = [
                [Paragraph('REGISTRATION',self.styles['AuditLabel']), Paragraph('LESSON STATUS',self.styles['AuditLabel']), Paragraph('TOTAL TIME',self.styles['AuditLabel']), Paragraph('LAST ACTIVITY',self.styles['AuditLabel'])],
                [Paragraph(ptxt(learner.get('status')),self.styles['AuditValue']), Paragraph(ptxt(learner.get('lastLessonStatus')),self.styles['AuditValue']), Paragraph(ptxt(learner.get('lastTotalTime')),self.styles['AuditValue']), Paragraph(ptxt(date_text(last)),self.styles['AuditValue'])]
            ]
            dt = Table(detail, colWidths=[1.8*inch]*4)
            dt.setStyle(TableStyle([
                ('BACKGROUND',(0,0),(-1,0),SOFT), ('BACKGROUND',(0,1),(-1,1),WHITE), ('BOX',(0,0),(-1,-1),0.5,LIGHT), ('INNERGRID',(0,0),(-1,-1),0.4,LIGHT),
                ('VALIGN',(0,0),(-1,-1),'MIDDLE'), ('TOPPADDING',(0,0),(-1,-1),5), ('BOTTOMPADDING',(0,0),(-1,-1),5), ('LEFTPADDING',(0,0),(-1,-1),7)
            ]))
            self.elements.append(KeepTogether([header, dt, Spacer(1,0.14*inch)]))

        if self.meta['previews']:
            self.elements += [Spacer(1,0.12*inch), Paragraph('<b>Host previews</b> <font color="#777777">(excluded from learner analytics)</font>', self.styles['BodyCustom'])]
            rows = [['Preview','Lesson Status','Score']] + [[txt(r.get('learnerName'),'Preview'), txt(r.get('lastLessonStatus'),'—'), score_text(r.get('lastScoreRaw'))] for r in self.meta['previews']]
            pt = Table(rows, colWidths=[3.2*inch,2.5*inch,1.5*inch])
            pt.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),MID),('TEXTCOLOR',(0,0),(-1,0),WHITE),('FONTNAME',(0,0),(-1,0),FONT_BOLD),('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,STRIPE]),('GRID',(0,0),(-1,-1),0.4,LIGHT),('FONTSIZE',(0,0),(-1,-1),7.5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
            self.elements.append(pt)

    @staticmethod
    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(PURPLE); canvas.setLineWidth(1.2)
        canvas.rect(0.25*inch,0.25*inch,A4[0]-0.5*inch,A4[1]-0.5*inch)
        canvas.setLineWidth(0.6); canvas.rect(0.32*inch,0.32*inch,A4[0]-0.64*inch,A4[1]-0.64*inch)
        canvas.setStrokeColor(LIGHT); canvas.line(0.5*inch,0.75*inch,A4[0]-0.5*inch,0.75*inch)
        canvas.setFillColor(DARK); canvas.setFont(FONT_LIGHT,7.5)
        canvas.drawString(0.5*inch,0.6*inch,'CONFIDENTIAL // SCORM LEARNING AUDIT REPORT')
        canvas.drawRightString(A4[0]-0.5*inch,0.6*inch,f'PAGE {doc.page}')
        canvas.restoreState()

    def build(self):
        doc = SimpleDocTemplate(self.filename,pagesize=A4,rightMargin=0.5*inch,leftMargin=0.5*inch,topMargin=0.9*inch,bottomMargin=0.95*inch,title=f"Quizmoto SCORM World Report - {self.meta['title']}",author='Quizmoto')
        self.create_cover(); self.create_toc(); self.create_executive(); self.create_analytics(); self.create_audit()
        doc.build(self.elements,onFirstPage=self.on_page,onLaterPages=self.on_page)
        for p in self.chart_paths:
            try:
                if os.path.exists(p): os.unlink(p)
            except Exception:
                pass


def xlsx_formats(wb):
    return {
        'title': wb.add_format({'bold':True,'font_size':20,'font_color':'#46178f'}),
        'sub': wb.add_format({'font_size':11,'font_color':'#2D2D2D'}),
        'section': wb.add_format({'bold':True,'font_size':12,'font_color':'#46178f','bottom':1,'bottom_color':'#46178f'}),
        'header': wb.add_format({'bold':True,'font_color':'#FFFFFF','bg_color':'#46178f','border':1,'border_color':'#FFFFFF','align':'center','valign':'vcenter'}),
        'label': wb.add_format({'bold':True,'bg_color':'#F2F2F2','border':1,'border_color':'#D9D9D9'}),
        'value': wb.add_format({'border':1,'border_color':'#D9D9D9'}),
        'stripe': wb.add_format({'bg_color':'#F9F9F9','border':1,'border_color':'#E5E5E5'}),
        'plain': wb.add_format({'border':1,'border_color':'#E5E5E5'}),
        'green': wb.add_format({'font_color':'#26890c','bold':True,'border':1,'border_color':'#E5E5E5'}),
        'red': wb.add_format({'font_color':'#e21b3c','bold':True,'border':1,'border_color':'#E5E5E5'}),
        'yellow': wb.add_format({'font_color':'#d89e00','bold':True,'border':1,'border_color':'#E5E5E5'}),
    }


def generate_excel(data, output):
    m = meta(data); f = xlsxwriter.Workbook(output); fmt = xlsx_formats(f)
    f.set_properties({'title':f"Quizmoto SCORM World Report - {m['title']}",'subject':'SCORM learner analytics','author':'Quizmoto'})
    ws = f.add_worksheet('Overview'); ws.set_column('A:A',24); ws.set_column('B:B',46)
    ws.write('A1','QUIZMOTO',fmt['title']); ws.write('A2','SCORM WORLD ANALYTICS REPORT',fmt['sub']); ws.merge_range('A4:B4',m['title'],fmt['section'])
    rows = [('SCORM Standard',m['standard']),('Package',m['packageTitle']),('Course Status',m['status']),('Invite Code',m['inviteCode']),('Published',date_text(m['publishedAt'])),('Generated',date_text(datetime.utcnow().isoformat())),('Total Learners',m['stats']['total']),('Completed',m['stats']['completed']),('In Progress',m['stats']['progress']),('Not Attempted',m['stats']['notAttempted']),('Completion Rate %',m['stats']['completionRate'] if m['stats']['completionRate'] is not None else ''),('Average Score',m['stats']['averageScore'] if m['stats']['averageScore'] is not None else '')]
    for r,(a,b) in enumerate(rows,4): ws.write(r,0,a,fmt['label']); ws.write(r,1,b,fmt['value'])
    lp = f.add_worksheet('Learner Progress'); headers=['#','Learner','Email','Registration Status','Lesson Status','Course Result','Score','Total Time','Last Activity']
    for c,h in enumerate(headers): lp.write(0,c,h,fmt['header'])
    lp.freeze_panes(1,0); lp.set_column(0,0,6); lp.set_column(1,1,24); lp.set_column(2,2,30); lp.set_column(3,5,18); lp.set_column(6,6,12); lp.set_column(7,7,16); lp.set_column(8,8,22)
    for r,learner in enumerate(m['learners'],1):
        rf=fmt['plain'] if r%2 else fmt['stripe']; vals=[r,txt(learner.get('learnerName'),'Learner'),txt(learner.get('learnerEmail')),txt(learner.get('status')),txt(learner.get('lastLessonStatus'))]
        for c,v in enumerate(vals): lp.write(r,c,v,rf)
        result=learner_result(learner); sf=fmt['green'] if result.lower() in ('passed','completed') else fmt['red'] if result.lower()=='failed' else fmt['yellow'] if result.lower()=='in progress' else rf
        lp.write(r,5,result,sf); sn=score_num(learner.get('lastScoreRaw')); lp.write(r,6,sn if sn is not None else '',rf); lp.write(r,7,txt(learner.get('lastTotalTime')),rf); lp.write(r,8,date_text(learner.get('lastCommitAt') or learner.get('updatedAt')),rf)
    lp.autofilter(0,0,max(1,len(m['learners'])),len(headers)-1)
    da=f.add_worksheet('Detailed Activity'); dh=['Learner','Metric','Recorded Value']
    for c,h in enumerate(dh): da.write(0,c,h,fmt['header'])
    da.set_column('A:A',28); da.set_column('B:B',24); da.set_column('C:C',40); da.freeze_panes(1,0)
    row=1
    for learner in m['learners']:
        details=[('Registration Status',txt(learner.get('status'),'—')),('Lesson Status',txt(learner.get('lastLessonStatus'),'—')),('Course Result',learner_result(learner)),('Score',score_text(learner.get('lastScoreRaw'))),('Total Learning Time',txt(learner.get('lastTotalTime'),'—')),('Last Activity',date_text(learner.get('lastCommitAt') or learner.get('updatedAt'))),('Completed','Yes' if completed(learner.get('lastLessonStatus')) else 'No')]
        for metric,value in details:
            rf=fmt['plain'] if row%2 else fmt['stripe']; da.write(row,0,txt(learner.get('learnerName'),'Learner'),rf); da.write(row,1,metric,rf); da.write(row,2,value,rf); row+=1
    f.close()


def main():
    if len(sys.argv)!=4:
        print('Usage: generate_scorm_report.py <input.json> <output> <pdf|excel>',file=sys.stderr); return 2
    input_path,output_path,kind=sys.argv[1],sys.argv[2],sys.argv[3].lower()
    with open(input_path,'r',encoding='utf-8') as fh: data=json.load(fh)
    if kind=='pdf': ScormReport(output_path,data).build()
    elif kind=='excel': generate_excel(data,output_path)
    else:
        print(f'Unsupported format: {kind}',file=sys.stderr); return 2
    print(output_path); return 0

if __name__=='__main__':
    sys.exit(main())
