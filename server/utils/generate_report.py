import sys
import json
import os
import xlsxwriter
import matplotlib
matplotlib.use('Agg') # Headless mode for server
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib.enums import TA_CENTER, TA_LEFT

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
except:
    FONT_NORMAL = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'
    FONT_MED = 'Helvetica-Bold'
    FONT_LIGHT = 'Helvetica'

# --- THEME COLORS (ReportLab) ---
KAHOOT_PURPLE = colors.HexColor("#46178f")
KAHOOT_BLUE = colors.HexColor("#1368ce")
KAHOOT_GREEN = colors.HexColor("#26890c")
KAHOOT_RED = colors.HexColor("#e21b3c")
KAHOOT_YELLOW = colors.HexColor("#d89e00")
DARK_GREY = colors.HexColor("#2D2D2D")
LIGHT_GREY = colors.HexColor("#CCCCCC")
ROW_STRIPE = colors.HexColor("#F9F9F9")
WHITE = colors.white

class KahootReport:
    def __init__(self, filename, data):
        self.filename = filename
        self.data = data
        self.styles = self._setup_styles()
        self.elements = []
        
        # Safely parse JSON strings from Sequelize if needed
        self._parse_nested_json()

    def _parse_nested_json(self):
        analytics_data = self.data.get("analytics", {})
        if isinstance(analytics_data, str):
            try:
                self.data["analytics"] = json.loads(analytics_data)
            except:
                self.data["analytics"] = {}
                
        for p in self.data.get("players", []):
            ans = p.get("answers", [])
            if isinstance(ans, str):
                try:
                    p["answers"] = json.loads(ans)
                except:
                    p["answers"] = []

        for q in self.data.get("Quiz", {}).get("questions", []):
            opts = q.get("options", [])
            if isinstance(opts, str):
                try:
                    q["options"] = json.loads(opts)
                except:
                    q["options"] = []

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
        
        # Audit Logs Styles
        styles.add(ParagraphStyle(name='ForensicLabel', fontName=FONT_BOLD, fontSize=7, textColor=colors.black, leading=8))
        styles.add(ParagraphStyle(name='ForensicLabelWhite', fontName=FONT_BOLD, fontSize=7, textColor=colors.white, leading=8))
        styles.add(ParagraphStyle(name='ForensicValue', fontName=FONT_NORMAL, fontSize=7, textColor=colors.black, leading=8))
        styles.add(ParagraphStyle(name='ForensicValueWhite', fontName=FONT_NORMAL, fontSize=7, textColor=colors.white, leading=8))
        styles.add(ParagraphStyle(name='ForensicDetail', fontName=FONT_NORMAL, fontSize=6.5, textColor=colors.grey, leading=8, leftIndent=10))
        styles.add(ParagraphStyle(name='ForensicDetailWhite', fontName=FONT_NORMAL, fontSize=6.5, textColor=colors.white, leading=8, leftIndent=10))
        return styles

    def create_cover_page(self):
        quiz_title = self.data.get("Quiz", {}).get("title", "Unknown Quiz")
        
        d1 = Drawing(500, 150)
        d1.add(Rect(-50, 50, 600, 100, fillColor=KAHOOT_PURPLE, strokeColor=None))
        d1.add(String(20, 90, "QUIZMOTO", fontName=FONT_BOLD, fontSize=24, fillColor=WHITE))
        d1.add(String(20, 70, "ANALYTICS PLATFORM", fontName=FONT_LIGHT, fontSize=10, fillColor=WHITE))
        self.elements.append(d1)
        self.elements.append(Spacer(1, 1*inch))
        
        self.elements.append(Paragraph("Quizmoto Report", self.styles['PremiumTitle']))
        self.elements.append(Paragraph(f"Analytics for: {quiz_title}", self.styles['PremiumSubtitle']))
        
        self.elements.append(Spacer(1, 2.5*inch))
        
        host_id = self.data.get("hostId", "Unknown Host")
        date_str = self.data.get("createdAt", "Unknown Date")
        if isinstance(date_str, str) and "T" in date_str:
            date_str = date_str.split("T")[0]
        else:
            date_str = str(date_str)
            
        c_data = [
            [Paragraph("REPORT DATE", self.styles['BodyTextWhite']), Paragraph(str(date_str), self.styles['BodyTextCustom'])],
            [Paragraph("SESSION HOST", self.styles['BodyTextWhite']), Paragraph(str(host_id), self.styles['BodyTextCustom'])],
            [Paragraph("TOTAL PLAYERS", self.styles['BodyTextWhite']), Paragraph(str(len(self.data.get('players', []))), self.styles['BodyTextCustom'])]
        ]
        t = Table(c_data, colWidths=[1.8*inch, 3*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,-1), KAHOOT_PURPLE),
            ('TEXTCOLOR', (0,0), (0,-1), colors.white),
            ('BACKGROUND', (1,0), (1,-1), ROW_STRIPE),
            ('GRID', (0,0), (-1,-1), 1, colors.white),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 15),
            ('TOPPADDING', (0,0), (-1,-1), 12),
            ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ]))
        self.elements.append(t)
        self.elements.append(PageBreak())

    def create_toc(self):
        self.elements.append(Paragraph("Table Of Content", self.styles['SectionHeader']))
        self.elements.append(Spacer(1, 0.4*inch))
        toc_items = [
            ("1", "Executive Management Summary", "exec_summary", "3"),
            ("2", "High-Level Analytics", "test_summary", "3"),
            ("3", "Detailed Audit Logs", "audit_logs", "4"),
        ]
        
        toc_data = [['Sr No.', 'Content', 'Page No.']]
        for sr, title, link_id, pg_no in toc_items:
            toc_data.append([
                Paragraph(sr, self.styles['BodyTextCustom']),
                Paragraph(f'<b><link destination="{link_id}">{title}</link></b>', self.styles['TOCItem']),
                Paragraph(pg_no, self.styles['BodyTextCustom'])
            ])
            
        t = Table(toc_data, colWidths=[0.8*inch, 4.5*inch, 1.2*inch])
        t.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BACKGROUND', (0,0), (-1,0), KAHOOT_PURPLE),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
            ('BOTTOMPADDING', (0,0), (-1,-1), 12),
            ('TOPPADDING', (0,0), (-1,-1), 12),
            ('GRID', (0,0), (-1,-1), 0.5, LIGHT_GREY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_STRIPE]),
            ('BOX', (0,0), (-1,-1), 1.5, KAHOOT_PURPLE),
        ]))
        t.hAlign = 'CENTER'
        self.elements.append(t)
        self.elements.append(PageBreak())
        
    def create_executive_summary(self):
        players = self.data.get("players", [])
        quiz_title = self.data.get("Quiz", {}).get("title", "Unknown Quiz")
        summary_text = (
            f"This session audit report analyzes the performance of {len(players)} players who participated "
            f"in the '{quiz_title}' interactive session. The following sections provide high-level class analytics "
            f"and detailed forensic logs of individual player behavior, scoring, and question-level responses."
        )
        
        block = [
            Paragraph('<a name="exec_summary"/>I. Executive Summary', self.styles['SectionHeader']),
            Paragraph(summary_text, self.styles['BodyTextCustom']),
            Spacer(1, 0.4*inch)
        ]
        self.elements.append(KeepTogether(block))

    def create_test_summary(self):
        ca = self.data.get("analytics", {}).get("classAnalytics", {})
        if ca:
            block = [
                Paragraph('<a name="test_summary"/>II. High-Level Analytics', self.styles['SectionHeader'])
            ]
            
            # Generate Matplotlib chart (no numpy dependency)
            labels = ['Accuracy', 'Participation']
            values = [ca.get("averageAccuracy", 0) or 0, ca.get("averageParticipation", 0) or 0]
            
            fig, ax = plt.subplots(figsize=(7, 3))
            colors_list = ['#1368ce', '#26890c']
            
            ax.set_facecolor('#FBFBFB')
            ax.grid(axis='x', linestyle='--', alpha=0.4, color='#CCCCCC')
            
            bars = ax.barh(labels, values, color=colors_list, height=0.5, edgecolor='white', linewidth=2, alpha=0.9)
            
            y_pos = list(range(len(labels)))
            ax.plot(values, y_pos, color='#2D2D2D', linestyle='--', marker='o', markersize=6, linewidth=1.5, alpha=0.6)
            
            bars_labeled = ax.bar_label(bars, fmt='%.1f%%', padding=3, weight='bold', fontsize=11)
            for i, label in enumerate(bars_labeled):
                label.set_color(colors_list[i])

            ax.set_title('Class Engagement & Accuracy', pad=15, fontname='sans-serif', fontsize=14, fontweight='bold', color='#2D2D2D')
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_color('#DDDDDD')
            ax.spines['bottom'].set_color('#DDDDDD')
            ax.set_xlim(0, max(100, max(values)+10 if values else 100))
            
            chart_path = "/tmp/kahoot_chart.png"
            plt.tight_layout()
            plt.savefig(chart_path, dpi=200, transparent=True)
            plt.close()
            
            img = Image(chart_path, width=5.5*inch, height=2.4*inch)
            img.hAlign = 'CENTER'
            block.append(img)
            block.append(Spacer(1, 0.4*inch))
            self.elements.append(KeepTogether(block))

    def create_audit_logs(self):
        header_block = [
            Paragraph('<a name="audit_logs"/>III. Detailed Audit Logs', self.styles['SectionHeader']),
            Paragraph("<b>Forensic Mission History: Participant Behavior Analysis</b>", self.styles['BodyTextCustom']),
            Spacer(1, 0.2*inch)
        ]

        questions = self.data.get("Quiz", {}).get("questions", [])
        players = self.data.get("players", [])
        
        if not players:
            header_block.append(Paragraph("<i>No participant data recorded for this session.</i>", self.styles['BodyTextCustom']))
            self.elements.append(KeepTogether(header_block))
            return
            
        self.elements.append(KeepTogether(header_block))
        
        # Sort players by score descending
        players.sort(key=lambda x: x.get("score", 0) or 0, reverse=True)
        
        for idx, user in enumerate(players):
            # --- 1. Dynamic Header Color Logic ---
            header_color = KAHOOT_YELLOW
            percentile = (idx / len(players)) if len(players) > 0 else 0
            if percentile < 0.25:
                header_color = KAHOOT_GREEN
            elif percentile > 0.75:
                header_color = KAHOOT_RED
                
            # --- 2. Target Header Row ---
            h1 = [['Player Target', 'Score', 'Final Rank']]
            t_h1 = Table(h1, colWidths=[3.2*inch, 2.5*inch, 1.5*inch])
            t_h1.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), header_color),
                ('TEXTCOLOR', (0,0), (-1,-1), colors.white),
                ('FONTNAME', (0,0), (-1,-1), FONT_BOLD),
                ('FONTSIZE', (0,0), (-1,-1), 8),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('GRID', (0,0), (-1,-1), 0.5, colors.white),
            ]))

            # --- 3. User Info Row ---
            u_info = [[
                Paragraph(f"<b>Player: {user.get('nickname', 'Unknown')}</b>", self.styles['ForensicValue']),
                f"{user.get('score', 0)} pts",
                f"#{idx+1}"
            ]]
            t_ui = Table(u_info, colWidths=[3.2*inch, 2.5*inch, 1.5*inch])
            t_ui.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#DDDDDD")),
                ('FONTNAME', (0,0), (-1,-1), FONT_NORMAL),
                ('FONTSIZE', (0,0), (-1,-1), 8),
                ('ALIGN', (0,1), (-1,-1), 'CENTER'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('TOPPADDING', (0,0), (-1,-1), 6),
                ('GRID', (0,0), (-1,-1), 0.5, colors.white),
            ]))

            # --- 4. Event Rows ---
            e_h = [['Question', 'Selected Answer', 'Correct Answer', 'Time Taken', 'Result']]
            t_eh = Table(e_h, colWidths=[1.8*inch, 2.0*inch, 1.8*inch, 0.8*inch, 0.8*inch])
            t_eh.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EEEEEE")),
                ('FONTNAME', (0,0), (-1,-1), FONT_BOLD),
                ('FONTSIZE', (0,0), (-1,-1), 7),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('GRID', (0,0), (-1,-1), 0.5, colors.white),
            ]))
            
            self.elements.append(KeepTogether([t_h1, t_ui, t_eh]))

            answers = user.get("answers", [])
            for q_idx, q in enumerate(questions):
                ans = next((a for a in answers if a.get("questionIndex") == q_idx), None)
                opts = q.get("options", [])
                correct_idx = q.get("correctIndex", 0)
                correct_text = opts[correct_idx] if 0 <= correct_idx < len(opts) else "Unknown"
                
                ev_bg = colors.white
                s_lbl, s_val, s_det = 'ForensicLabel', 'ForensicValue', 'ForensicDetail'
                
                if not ans:
                    result_txt = "Missed"
                    sel_ans = "N/A"
                    time_txt = "N/A"
                else:
                    a_idx = ans.get("answerIndex", -1)
                    sel_ans = opts[a_idx] if 0 <= a_idx < len(opts) else f"Option {a_idx+1}"
                    time_txt = f"{ans.get('timeTaken', 0)}s"
                    if ans.get("isCorrect"):
                        ev_bg = KAHOOT_GREEN
                        result_txt = "Correct"
                        s_lbl, s_val, s_det = 'ForensicLabelWhite', 'ForensicValueWhite', 'ForensicDetailWhite'
                    else:
                        ev_bg = KAHOOT_RED
                        result_txt = "Incorrect"
                        s_lbl, s_val, s_det = 'ForensicLabelWhite', 'ForensicValueWhite', 'ForensicDetailWhite'

                q_txt = q.get("questionText", f"Q{q_idx+1}")
                
                # Encode handles weird unicode issues in reportlab occasionally
                q_txt = str(q_txt).encode('latin-1', 'replace').decode('latin-1')
                sel_ans = str(sel_ans).encode('latin-1', 'replace').decode('latin-1')
                correct_text = str(correct_text).encode('latin-1', 'replace').decode('latin-1')

                e_row = [
                    Paragraph(q_txt, self.styles[s_val]),
                    Paragraph(sel_ans, self.styles[s_lbl]),
                    Paragraph(correct_text, self.styles[s_val]),
                    Paragraph(time_txt, self.styles[s_val]),
                    Paragraph(f"<b>{result_txt}</b>", self.styles[s_val])
                ]
                t_ev = Table([e_row], colWidths=[1.8*inch, 2.0*inch, 1.8*inch, 0.8*inch, 0.8*inch])
                t_ev.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), ev_bg),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#EEEEEE")),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                    ('TOPPADDING', (0,0), (-1,-1), 8),
                ]))
                self.elements.append(t_ev)
            
            self.elements.append(Spacer(1, 0.4*inch))

    @staticmethod
    def onPage(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(KAHOOT_PURPLE)
        canvas.setLineWidth(1.2)
        canvas.rect(0.25*inch, 0.25*inch, A4[0]-0.5*inch, A4[1]-0.5*inch)
        canvas.setLineWidth(0.6)
        canvas.rect(0.32*inch, 0.32*inch, A4[0]-0.64*inch, A4[1]-0.64*inch)
        canvas.line(0.5*inch, 0.75*inch, A4[0]-0.5*inch, 0.75*inch)
        canvas.setFont(FONT_LIGHT, 8)
        canvas.drawString(0.5*inch, 0.6*inch, "CONFIDENTIAL // SESSION AUDIT LOG")
        canvas.drawRightString(A4[0]-0.5*inch, 0.6*inch, f"PAGE {doc.page}")
        canvas.restoreState()

    def build(self):
        doc = SimpleDocTemplate(self.filename, pagesize=A4, rightMargin=0.5*inch, leftMargin=0.5*inch, topMargin=1*inch, bottomMargin=1*inch)
        self.create_cover_page()
        self.create_toc()
        self.create_executive_summary()
        self.create_test_summary()
        self.create_audit_logs()
        doc.build(self.elements, onFirstPage=KahootReport.onPage, onLaterPages=KahootReport.onPage)

def generate_pdf(data, output_path):
    report = KahootReport(output_path, data)
    report.build()

def generate_excel(data, output_path):
    workbook = xlsxwriter.Workbook(output_path)
    header_fmt = workbook.add_format({'bold': True, 'bg_color': '#46178f', 'font_color': 'white', 'border': 1})
    bold_fmt = workbook.add_format({'bold': True})
    
    analytics_data = data.get("analytics", {})
    if isinstance(analytics_data, str):
        try:
            analytics_data = json.loads(analytics_data)
        except:
            analytics_data = {}
            
    players = list(data.get("players", []) or [])
    questions = data.get("Quiz", {}).get("questions", []) or []
    
    # Sheet 1: Overview
    ws_overview = workbook.add_worksheet("Overview")
    quiz_title = data.get("Quiz", {}).get("title", "Unknown Quiz")
    ws_overview.write(0, 0, "Quizmoto Official Report", bold_fmt)
    ws_overview.write(1, 0, f"Quiz: {quiz_title}")
    
    ca = analytics_data.get("classAnalytics", {}) if isinstance(analytics_data, dict) else {}
    if ca:
        ws_overview.write(3, 0, "Class Analytics", bold_fmt)
        ws_overview.write(4, 0, "Average Accuracy")
        ws_overview.write(4, 1, f"{ca.get('averageAccuracy', 0)}%")
        ws_overview.write(5, 0, "Average Participation")
        ws_overview.write(5, 1, f"{ca.get('averageParticipation', 0)}%")
        
    # Sheet 2: Leaderboard
    ws_lb = workbook.add_worksheet("Leaderboard")
    headers = ["Rank", "Nickname", "Score"]
    for col, h in enumerate(headers):
        ws_lb.write(0, col, h, header_fmt)
        
    players.sort(key=lambda x: x.get("score", 0) or 0, reverse=True)
    for row, p in enumerate(players, start=1):
        ws_lb.write(row, 0, row)
        ws_lb.write(row, 1, p.get("nickname", ""))
        ws_lb.write(row, 2, p.get("score", 0))
        
    # Sheet 3: Detailed Answers
    ws_det = workbook.add_worksheet("Detailed Answers")
    headers_det = ["Nickname", "Total Score"]
    for i in range(len(questions)):
        headers_det.append(f"Q{i+1}")
        
    for col, h in enumerate(headers_det):
        ws_det.write(0, col, h, header_fmt)
        
    for row, p in enumerate(players, start=1):
        ws_det.write(row, 0, p.get("nickname", ""))
        ws_det.write(row, 1, p.get("score", 0))
        
        answers = p.get("answers", [])
        if isinstance(answers, str):
            try:
                answers = json.loads(answers)
            except:
                answers = []
                
        col_offset = 2
        for q_idx, q in enumerate(questions):
            ans = next((a for a in answers if a.get("questionIndex") == q_idx), None)
            if ans:
                opts = q.get("options", [])
                if isinstance(opts, str):
                    try:
                        opts = json.loads(opts)
                    except:
                        opts = []
                        
                a_idx = ans.get("answerIndex", -1)
                a_text = opts[a_idx] if 0 <= a_idx < len(opts) else f"Option {a_idx+1}"
                is_correct = "Yes" if ans.get("isCorrect") else "No"
                time_taken = ans.get("timeTaken", 0)
                ws_det.write(row, col_offset + q_idx, f"Ans: {a_text} | Correct: {is_correct} | Time: {time_taken}s")
            else:
                ws_det.write(row, col_offset + q_idx, "No Answer")
                
    workbook.close()

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python generate_report.py <input_json> <output_file> <format>", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    out_format = sys.argv[3].lower()

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if out_format == "pdf":
            generate_pdf(data, output_file)
        elif out_format == "excel":
            generate_excel(data, output_file)
        else:
            print(f"Unknown format: {out_format}", file=sys.stderr)
            sys.exit(2)

        if not os.path.exists(output_file):
            print(f"Output file was not created: {output_file}", file=sys.stderr)
            sys.exit(3)
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(f"REPORT_ERROR: {e}", file=sys.stderr)
        sys.exit(1)
