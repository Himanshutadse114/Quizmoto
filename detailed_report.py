import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
import matplotlib.pyplot as plt
import numpy as np

# Font Registration
try:
    pdfmetrics.registerFont(TTFont('Roboto-Regular', 'Roboto/Roboto_Condensed/static/RobotoCondensed-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('Roboto-Bold', 'Roboto/Roboto_Condensed/static/RobotoCondensed-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Roboto-Medium', 'Roboto/Roboto_Condensed/static/RobotoCondensed-Medium.ttf'))
    pdfmetrics.registerFont(TTFont('Roboto-Light', 'Roboto/Roboto_Condensed/static/RobotoCondensed-Light.ttf'))
    FONT_NORMAL = 'Roboto-Regular'
    FONT_BOLD = 'Roboto-Bold'
    FONT_MED = 'Roboto-Medium'
    FONT_LIGHT = 'Roboto-Light'
except:
    FONT_NORMAL = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'
    FONT_MED = 'Helvetica-Bold'
    FONT_LIGHT = 'Helvetica'

# --- THEME COLORS (Standard HEX) ---
PRIMARY_ORANGE_HEX = "#FF7A00"
DARK_GREY_HEX = "#2D2D2D"
LIGHT_GREY_HEX = "#CCCCCC"
ROW_STRIPE_HEX = "#F9F9F9"
WHITE_HEX = "#FFFFFF"

# --- THEME COLORS (ReportLab) ---
PRIMARY_ORANGE = colors.HexColor(PRIMARY_ORANGE_HEX)
DARK_GREY = colors.HexColor(DARK_GREY_HEX)
LIGHT_GREY = colors.HexColor(LIGHT_GREY_HEX)
ACCENT_BLUE = colors.HexColor("#0056D2")
WHITE = colors.white
ROW_STRIPE = colors.HexColor(ROW_STRIPE_HEX)

import json

def load_report_data(filename="report_config.json"):
    if os.path.exists(filename):
        with open(filename, 'r') as f:
            data = json.load(f)
            # Map specific title for Detailed
            data['report_title'] = data.get('report_title_detailed', "Detailed Phishing Report")
            return data
    else:
        return {
            "company_name": "N/A", "report_title": "N/A", "test_date": "N/A",
            "conducted_by": "N/A", "total_emails_sent": 0, "total_clicks": 0,
            "data_submitted": 0, "emails_reported": 0, "dept_data": {},
            "executive_summary_text": "", "recommendations_list": [],
            "email_template_img": "", "landing_page_img": "",
            "clicked_users": [], "submitted_users": [], "reported_users": []
        }

REPORT_DATA = load_report_data()

class PhishingReport:
    def __init__(self, filename, data):
        self.filename = filename
        self.data = data
        self.styles = self._setup_styles()
        self.elements = []

    def _setup_styles(self):
        styles = getSampleStyleSheet()
        
        styles.add(ParagraphStyle(
            name='PremiumTitle',
            fontName=FONT_BOLD,
            fontSize=34,
            textColor=PRIMARY_ORANGE,
            alignment=0,
            spaceAfter=10,
            leading=40
        ))

        styles.add(ParagraphStyle(
            name='PremiumSubtitle',
            fontName=FONT_LIGHT,
            fontSize=18,
            textColor=DARK_GREY,
            alignment=0,
            spaceAfter=30,
            leading=22
        ))

        styles.add(ParagraphStyle(
            name='SectionHeader',
            fontName=FONT_BOLD,
            fontSize=16,
            textColor=DARK_GREY,
            spaceAfter=20,
            spaceBefore=30,
            borderPadding=10,
            alignment=0
        ))

        styles.add(ParagraphStyle(
            name='BodyTextCustom',
            fontName=FONT_NORMAL,
            fontSize=10,
            leading=14,
            textColor=DARK_GREY,
            alignment=4,
            spaceAfter=12
        ))

        styles.add(ParagraphStyle(
            name='TOCItem',
            fontName=FONT_NORMAL,
            fontSize=11,
            leading=16,
            textColor=DARK_GREY,
            alignment=0,
            leftIndent=20
        ))
        
        styles.add(ParagraphStyle(
            name='ForensicLabel',
            fontName=FONT_BOLD,
            fontSize=7,
            textColor=colors.black,
            alignment=0,
            leading=8
        ))

        styles.add(ParagraphStyle(
            name='ForensicLabelWhite',
            fontName=FONT_BOLD,
            fontSize=7,
            textColor=colors.white,
            alignment=0,
            leading=8
        ))

        styles.add(ParagraphStyle(
            name='ForensicValue',
            fontName=FONT_NORMAL,
            fontSize=7,
            textColor=colors.black,
            alignment=0,
            leading=8
        ))

        styles.add(ParagraphStyle(
            name='ForensicValueWhite',
            fontName=FONT_NORMAL,
            fontSize=7,
            textColor=colors.white,
            alignment=0,
            leading=8
        ))

        styles.add(ParagraphStyle(
            name='ForensicDetail',
            fontName=FONT_NORMAL,
            fontSize=6.5,
            textColor=colors.grey,
            alignment=0,
            leading=8,
            leftIndent=10
        ))

        styles.add(ParagraphStyle(
            name='ForensicDetailWhite',
            fontName=FONT_NORMAL,
            fontSize=6.5,
            textColor=colors.white,
            alignment=0,
            leading=8,
            leftIndent=10
        ))

        styles.add(ParagraphStyle(
            name='HeatmapText',
            fontName=FONT_BOLD,
            fontSize=11,
            textColor=colors.white,
            alignment=TA_CENTER
        ))

        return styles

    def create_cover_page(self):
        d1 = Drawing(500, 150)
        d1.add(Rect(-50, 50, 600, 100, fillColor=PRIMARY_ORANGE, strokeColor=None))
        d1.add(String(20, 90, "INNVIKTA", fontName=FONT_BOLD, fontSize=24, fillColor=WHITE))
        d1.add(String(20, 70, "SECURITY SOLUTIONS", fontName=FONT_LIGHT, fontSize=10, fillColor=WHITE))
        self.elements.append(d1)
        self.elements.append(Spacer(1, 1*inch))
        
        self.elements.append(Paragraph(self.data['report_title'], self.styles['PremiumTitle']))
        self.elements.append(Paragraph(f"Secure Simulation Analysis for {self.data['company_name']}", self.styles['PremiumSubtitle']))
        
        if self.data.get('campaign_name'):
            self.elements.append(Paragraph(f"<b>CAMPAIGN:</b> {self.data['campaign_name']}", self.styles['BodyTextCustom']))
        
        self.elements.append(Spacer(1, 3.2*inch))
        
        c_data = [
            [Paragraph(f"<b>REPORT DATE:</b> {self.data['test_date']}", self.styles['BodyTextCustom'])],
            [Paragraph(f"<b>ANALYST TEAM:</b> {self.data['conducted_by']}", self.styles['BodyTextCustom'])]
        ]
        t = Table(c_data, colWidths=[4*inch])
        t.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'BOTTOM')]))
        self.elements.append(t)
        self.elements.append(PageBreak())

    def create_toc(self):
        self.elements.append(Paragraph("Table Of Content", self.styles['SectionHeader']))
        self.elements.append(Spacer(1, 0.4*inch))
        toc_items = [
            ("1", "Campaign Overview", "campaign_overview", "3"),
            ("2", "Executive Management Summary", "exec_summary", "4"),
            ("3", "High-Level Simulation Metrics", "test_summary", "5"),
            ("4", "Risk Distribution (Visual)", "sim_outcomes", "5"),
            ("5", "Simulation Templates Used", "sim_templates", "6"),
            ("6", "Departmental Phished Analysis", "dept_phished", "7"),
            ("7", "Departmental Reporting Analysis", "dept_reported", "8"),
            ("8", "Target Phishing Metric Data", "target_metrics", "9"),
            ("9", "Simulation Audit Logs", "audit_logs", "10"),
            ("10", "Strategic Recommendations", "recommendations", "16"),
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
            ('BACKGROUND', (0,0), (-1,0), PRIMARY_ORANGE),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
            ('BOTTOMPADDING', (0,0), (-1,-1), 12),
            ('TOPPADDING', (0,0), (-1,-1), 12),
            ('GRID', (0,0), (-1,-1), 0.5, LIGHT_GREY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_STRIPE]),
            ('BOX', (0,0), (-1,-1), 1.5, PRIMARY_ORANGE),
        ]))
        t.hAlign = 'CENTER'
        self.elements.append(t)
        self.elements.append(PageBreak())

    def create_executive_summary(self):
        self.elements.append(Paragraph('<a name="exec_summary"/>II. Executive Summary', self.styles['SectionHeader']))
        self.elements.append(Paragraph(self.data['executive_summary_text'], self.styles['BodyTextCustom']))
        self.elements.append(Spacer(1, 0.2*inch))

    def create_campaign_overview(self):
        self.elements.append(Paragraph('<a name="campaign_overview"/>I. Campaign Overview', self.styles['SectionHeader']))
        
        overview_data = [['Field', 'Value']]
        for k, v in self.data['campaign_overview'].items():
            overview_data.append([
                Paragraph(f"<b>{k}</b>", self.styles['BodyTextCustom']),
                Paragraph(str(v), self.styles['BodyTextCustom'])
            ])
            
        t = Table(overview_data, colWidths=[2.5*inch, 4.5*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PRIMARY_ORANGE),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
            ('GRID', (0,0), (-1,-1), 0.5, LIGHT_GREY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_STRIPE]),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('LEFTPADDING', (0,0), (-1,-1), 15),
        ]))
        t.hAlign = 'LEFT'
        self.elements.append(t)
        self.elements.append(PageBreak())

    def _generate_high_level_bar_chart(self):
        labels = ['Total Sent', 'Reported', 'Phished', 'Submitted']
        values = [self.data['total_emails_sent'], self.data['emails_reported'], 
                  self.data['total_clicks'], self.data['data_submitted']]
        
        fig, ax = plt.subplots(figsize=(9, 5))
        colors_list = [DARK_GREY_HEX, '#4CAF50', PRIMARY_ORANGE_HEX, '#D32F2F']
        
        ax.set_facecolor('#FBFBFB')
        ax.grid(axis='x', linestyle='--', alpha=0.4, color='#CCCCCC')
        
        bars = ax.barh(labels, values, color=colors_list, height=0.7, 
                        edgecolor='white', linewidth=2, alpha=0.9)
        
        y_pos = np.arange(len(labels))
        ax.plot(values, y_pos, color=DARK_GREY_HEX, linestyle='--', 
                marker='o', markersize=6, linewidth=1.5, alpha=0.6)
        
        # 4. Data Labels
        bars_labeled = ax.bar_label(bars, padding=3, weight='bold', fontsize=11)
        for i, label in enumerate(bars_labeled):
            label.set_color(colors_list[i])

        for i, bar in enumerate(bars):
            if i > 0:
                width = bar.get_width()
                pct = (width / values[0]) * 100
                offset = values[0] * 0.12
                ax.text(width + offset, bar.get_y() + bar.get_height()/2, 
                        f'({pct:.1f}%)', va='center', color='grey', fontsize=9)

        ax.set_title('Campaign Engagement Funnel & Trend Analysis', pad=25, 
                     fontname='sans-serif', fontsize=16, fontweight='bold', color=DARK_GREY_HEX)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#DDDDDD')
        ax.spines['bottom'].set_color('#DDDDDD')
        ax.tick_params(axis='y', length=0, pad=10, labelsize=10)
        
        path = "detailed_high_level_premium.png"
        plt.tight_layout()
        plt.savefig(path, dpi=250, transparent=True)
        plt.close()
        return path

    def _generate_nrs_visual(self):
        # Calculations
        total = self.data['total_emails_sent']
        reported_pct = (self.data['emails_reported'] / total) * 100
        clicked_pct = (self.data['total_clicks'] / total) * 100
        nrs = reported_pct - clicked_pct
        fail_rate = (self.data['data_submitted'] / total) * 100

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 3))
        
        # --- 1. Net Reporter Score Scale ---
        ax1.set_xlim(-100, 100)
        ax1.set_ylim(-1, 1)
        ax1.axhline(0, color='#DDDDDD', linewidth=2, zorder=1)
        ax1.axvspan(-100, 0, color='#FFEBEE', alpha=0.3)
        ax1.axvspan(0, 100, color='#E8F5E9', alpha=0.3)
        
        color = '#D32F2F' if nrs < 0 else '#2E7D32'
        ax1.scatter([nrs], [0], color=color, s=200, marker='D', edgecolors='white', linewidth=2, zorder=5)
        ax1.text(nrs, 0.4, f"NRS: {nrs:.1f}", ha='center', weight='bold', fontsize=14, color=color)
        
        ax1.set_title("Net Reporter Score (NRS)", fontname='sans-serif', fontsize=12, fontweight='bold', pad=20)
        ax1.set_xticks([-100, -50, 0, 50, 100])
        ax1.set_yticks([])
        ax1.spines['top'].set_visible(False)
        ax1.spines['right'].set_visible(False)
        ax1.spines['left'].set_visible(False)
        ax1.spines['bottom'].set_color('#DDDDDD')

        # --- 2. Fail Rate Circle ---
        circle = plt.Circle((0.5, 0.5), 0.4, color='#D32F2F', alpha=0.1, zorder=1)
        ax2.add_artist(circle)
        ax2.text(0.5, 0.55, f"{fail_rate:.1f}%", ha='center', va='center', fontsize=26, weight='bold', color='#D32F2F')
        ax2.text(0.5, 0.35, "FAIL RATE", ha='center', va='center', fontsize=10, weight='bold', color='#888888')
        
        ax2.set_title("Simulation Failure Index", fontname='sans-serif', fontsize=12, fontweight='bold', pad=20)
        ax2.set_xlim(0, 1)
        ax2.set_ylim(0, 1)
        ax2.axis('off')

        path = "detailed_kpi_intelligence.png"
        plt.tight_layout()
        plt.savefig(path, dpi=200, transparent=True)
        plt.close()
        return path

    def create_test_summary(self):
        self.elements.append(Paragraph('<a name="test_summary"/>III. High-Level Simulation Metrics', self.styles['SectionHeader']))
        
        # Main Bar Chart (Funnel) first
        chart_path = self._generate_high_level_bar_chart()
        img = Image(chart_path, width=7.2*inch, height=3.2*inch)
        img.hAlign = 'CENTER'
        self.elements.append(img)
        self.elements.append(Spacer(1, 0.1*inch))

        # NRS Visual below funnel
        kpi_path = self._generate_nrs_visual()
        self.elements.append(Image(kpi_path, width=7.2*inch, height=2.1*inch))
        self.elements.append(Spacer(1, 0.2*inch))

        self.elements.append(Paragraph(
            self.data.get('high_level_analysis_text', ""),
            self.styles['BodyTextCustom']
        ))
        self.elements.append(Spacer(1, 0.4*inch))

    def _generate_detailed_risk_visual(self):
        labels = ['Submitted', 'Clicked (Only)', 'Reported', 'Ignored']
        counts = [
            self.data['data_submitted'],
            self.data['total_clicks'] - self.data['data_submitted'],
            self.data['emails_reported'],
            self.data['total_emails_sent'] - self.data['emails_reported'] - self.data['total_clicks']
        ]
        fig = plt.figure(figsize=(12, 5))
        ax1 = fig.add_subplot(1, 2, 1)
        explode = (0.15, 0.1, 0.05, 0)
        colors_list = ['#D32F2F', PRIMARY_ORANGE_HEX, DARK_GREY_HEX, '#F0F0F0']
        ax1.pie(counts, labels=labels, autopct='%1.1f%%', startangle=140, explode=explode, shadow=True, colors=colors_list, wedgeprops={'edgecolor': 'white', 'linewidth': 1})
        ax1.set_title('Outcome Distribution', pad=20, fontname='sans-serif', fontsize=14, fontweight='bold')
        ax2 = fig.add_subplot(1, 2, 2)
        ax2.axis('off')
        click_rate = (self.data['total_clicks'] / self.data['total_emails_sent']) * 100
        report_rate = (self.data['emails_reported'] / self.data['total_emails_sent']) * 100
        submit_rate = (self.data['data_submitted'] / self.data['total_emails_sent']) * 100
        matrix_data = [["Metric", "Value", "Benchmark"], ["Click Rate", f"{click_rate:.1f}%", "< 5.0%"], ["Report Rate", f"{report_rate:.1f}%", "> 20.0%"], ["Data Submission", f"{submit_rate:.1f}%", "< 1.5%"], ["Resilience Score", f"{100-click_rate:.1f}/100", "Critical"], ["Vigilance Level", "Medium", "High"]]
        table = ax2.table(cellText=matrix_data, loc='center', cellLoc='center', edges='closed')
        table.auto_set_font_size(False)
        table.set_fontsize(10)
        table.scale(1, 2.2)
        for (row, col), cell in table.get_celld().items():
            if row == 0:
                cell.set_text_props(weight='bold', color='white')
                cell.set_facecolor(PRIMARY_ORANGE_HEX)
            elif row % 2 == 0:
                cell.set_facecolor('#F9F9F9')
            cell.set_edgecolor('#DDDDDD')
            cell.set_linewidth(0.5)
        path = "detailed_risk_composite.png"
        plt.tight_layout(rect=[0, 0, 1, 1])
        plt.savefig(path, dpi=200, transparent=True)
        plt.close()
        return path

    def _generate_departmental_analytics(self, chart_type="phished"):
        depts = list(self.data['dept_data'].keys())
        if chart_type == "phished":
            counts = [self.data['dept_data'][d]['clicks'] for d in depts]
            title = "Phished Users by Department"
            ylabel = "Click Count"
            color = PRIMARY_ORANGE_HEX
            shadow_color = "#A85300"
            analysis_text = self.data.get('dept_phished_analysis_text', "")
            anchor = "dept_phished"
            header = "VI. Departmental Phished Analysis"
        else:
            counts = [self.data['dept_data'][d]['reported'] for d in depts]
            title = "Reported Users by Department"
            ylabel = "Report Count"
            color = DARK_GREY_HEX
            shadow_color = "#000000"
            analysis_text = self.data.get('dept_reported_analysis_text', "")
            anchor = "dept_reported"
            header = "VII. Departmental Reporting Analysis"

        fig, ax = plt.subplots(figsize=(8, 5))
        x = np.arange(len(depts))
        width = 0.5
        
        # Semi-3D Shadow
        ax.bar(x + 0.03, counts, width, color=shadow_color, alpha=0.3)
        bars = ax.bar(x, counts, width, color=color, edgecolor='white', linewidth=1, alpha=0.9)
        
        # Trend Line
        ax.plot(x, counts, color=DARK_GREY_HEX, linestyle='--', marker='o', 
                markersize=4, linewidth=1.2, alpha=0.5)
        
        # Average line
        avg_val = np.mean(counts)
        ax.axhline(avg_val, color='#D32F2F', linestyle=':', alpha=0.5)
        
        ax.bar_label(bars, padding=3, fontname='sans-serif', fontsize=9, fontweight='bold', color=DARK_GREY_HEX)
        ax.set_title(title, pad=20, fontname='sans-serif', fontsize=14, fontweight='bold', color=DARK_GREY_HEX)
        ax.set_ylabel(ylabel, fontname='sans-serif')
        ax.set_xticks(x)
        ax.set_xticklabels(depts, rotation=15, ha='right', fontsize=9)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.set_facecolor('#FAFAFA')
        
        path = f"detailed_dept_{chart_type}_3d.png"
        plt.tight_layout()
        plt.savefig(path, dpi=250, transparent=True)
        plt.close()
        return [Paragraph(f'<a name="{anchor}"/>{header}', self.styles['SectionHeader']), Image(path, width=7.2*inch, height=4*inch), Spacer(1, 0.2*inch), Paragraph(analysis_text, self.styles['BodyTextCustom'])]

    def _draw_metric_card(self, label, value, bg_color):
        d = Drawing(140, 100)
        d.add(Rect(0, 0, 130, 85, fillColor=bg_color, strokeColor=None, rx=5, ry=5))
        d.add(String(65, 45, str(value), fontName=FONT_BOLD, fontSize=24, fillColor=WHITE, textAnchor="middle"))
        d.add(String(65, 20, str(label).upper(), fontName=FONT_LIGHT, fontSize=9, fillColor=WHITE, textAnchor="middle"))
        return d

    def create_metrics_visualization(self, mode="pie"):
        if mode == "pie":
            elements = [
                Paragraph('<a name="sim_outcomes"/>IV. Risk Distribution (Visual)', self.styles['SectionHeader']),
                Paragraph("The chart below illustrates the final disposition of all simulation emails sent.", self.styles['BodyTextCustom'])
            ]
            img_path = self._generate_detailed_risk_visual()
            img = Image(img_path, width=7.2*inch, height=3*inch)
            img.hAlign = 'CENTER'
            elements.append(img)
            elements.append(Spacer(1, 0.2*inch))
            elements.append(Paragraph(
                self.data.get('risk_distribution_analysis_text', ""),
                self.styles['BodyTextCustom']
            ))
            cards = [[
                self._draw_metric_card("Phished", self.data['total_clicks'], PRIMARY_ORANGE),
                self._draw_metric_card("Reported", self.data['emails_reported'], DARK_GREY),
                self._draw_metric_card("Submitted", self.data['data_submitted'], colors.HexColor("#D32F2F"))
            ]]
            t = Table(cards, colWidths=[2.1*inch, 2.1*inch, 2.1*inch])
            t.setStyle(TableStyle([
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
            ]))
            elements.append(t)
            
            elements.append(Spacer(1, 0.2*inch))
            elements.append(Paragraph(
                "<b>Metric Significance:</b> The core engagement figures above provide an immediate pulse on the organizational "
                "vulnerability landscape. While 'Phished' counts indicate the total surface area of initial compromise, the "
                "'Submitted' metric highlights the critical failure point where actual data exposure occurred. Strengthening "
                "the 'Reported' volume remains the primary objective for fostering a mature, proactive security culture.",
                self.styles['BodyTextCustom']
            ))
            self.elements.append(KeepTogether(elements))
            self.elements.append(PageBreak())
        else:
            self.elements.append(KeepTogether(self._generate_departmental_analytics(chart_type="phished")))
            self.elements.append(PageBreak())
            self.elements.append(KeepTogether(self._generate_departmental_analytics(chart_type="reported")))
            self.elements.append(PageBreak())

    def create_simulation_templates(self):
        e1 = [
            Paragraph('<a name="sim_templates"/>V. Simulation Templates Used', self.styles['SectionHeader']),
            Paragraph(f"<b>Phishing Email:</b> {self.data['campaign_overview'].get('Template', 'N/A')}", self.styles['BodyTextCustom'])
        ]
        if os.path.exists(self.data['email_template_img']):
            img = Image(self.data['email_template_img'])
            aspect = img.imageHeight / float(img.imageWidth)
            img.drawWidth = 5.5*inch; img.drawHeight = 5.5*inch * aspect; img.hAlign = 'CENTER'
            e1.append(img)
        self.elements.append(KeepTogether(e1))
        self.elements.append(Spacer(1, 0.4*inch))
        e2 = [Paragraph(f"<b>Landing Page:</b> {self.data['campaign_overview'].get('Landing page', 'N/A')}", self.styles['BodyTextCustom'])]
        if os.path.exists(self.data['landing_page_img']):
            img2 = Image(self.data['landing_page_img'])
            aspect2 = img2.imageHeight / float(img2.imageWidth)
            img2.drawWidth = 5.5*inch; img2.drawHeight = 5.5*inch * aspect2; img2.hAlign = 'CENTER'
            e2.append(img2)
        self.elements.append(KeepTogether(e2))
        self.elements.append(PageBreak())

    def create_recommendations(self):
        self.elements.append(Paragraph('<a name="recommendations"/>X. Strategic Recommendations', self.styles['SectionHeader']))
        for rec in self.data['recommendations_list']:
            self.elements.append(Paragraph(f"<font color='#FF7A00'>■</font> {rec}", self.styles['BodyTextCustom']))
        self.elements.append(PageBreak())

    def create_target_metric_table(self):
        self.elements.append(Paragraph('<a name="target_metrics"/>VII. Target Phishing Metric Data', self.styles['SectionHeader']))
        
        # Table Header with Icons (Simplified)
        header = [
            'Participant Name', 'Email Address', 'Dept',
            'Sent', 'Open', 'Click', 'Submit', 'Report'
        ]
        
        table_data = [header]
        
        for user in self.data.get('detailed_audit_logs', []):
            # Deriving counts from events
            evs = [e['type'].lower() for e in user.get('events', [])]
            row = [
                user['name'],
                user['email'],
                user['department'],
                "1", # Delivery count for this campaign
                "1" if any('open' in x for x in evs) else "0",
                "1" if any('click' in x for x in evs) else "0",
                "1" if any('submit' in x or 'extended' in x or 'compromise' in x for x in evs) else "0",
                "1" if any('report' in x for x in evs) else "0"
            ]
            table_data.append(row)

        t = Table(table_data, colWidths=[1.5*inch, 1.8*inch, 1*inch, 0.5*inch, 0.5*inch, 0.5*inch, 0.6*inch, 0.6*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#444444")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (2, -1), 'LEFT'),
            ('ALIGN', (3, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        self.elements.append(t)
        self.elements.append(PageBreak())

    def create_audit_logs(self):
        self.elements.append(Paragraph('<a name="audit_logs"/>IX. Simulation Audit Logs', self.styles['SectionHeader']))
        self.elements.append(Paragraph("<b>Forensic Mission History: Participant Behavior Analysis</b>", self.styles['BodyTextCustom']))
        self.elements.append(Spacer(1, 0.2*inch))

        # --- 0. NEW Heatmap Summary Bar (4 Columns) ---
        opened_count = self.data.get('total_emails_opened', 450)
        clicked_count = self.data['total_clicks']
        submitted_count = self.data['data_submitted']
        reported_count = self.data['emails_reported']
        
        heatmap_data = [[
            Paragraph(f"OPENED: {opened_count}", self.styles['HeatmapText']),
            Paragraph(f"CLICKED: {clicked_count}", self.styles['HeatmapText']),
            Paragraph(f"SUBMITTED: {submitted_count}", self.styles['HeatmapText']),
            Paragraph(f"REPORTED: {reported_count}", self.styles['HeatmapText'])
        ]]
        
        t_heat = Table(heatmap_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        t_heat.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,0), colors.HexColor("#FBC02D")), # Yellow
            ('BACKGROUND', (1,0), (1,0), colors.HexColor("#FF7A00")), # Orange
            ('BACKGROUND', (2,0), (2,0), colors.HexColor("#D32F2F")), # Red
            ('BACKGROUND', (3,0), (3,0), colors.HexColor("#2E7D32")), # Green
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('GRID', (0,0), (-1,-1), 1, colors.white),
        ]))
        self.elements.append(t_heat)
        self.elements.append(Spacer(1, 0.4*inch))

        for user in self.data.get('detailed_audit_logs', []):
            user_block = []
            
            # --- 1. Dynamic Header Color Logic ---
            worst = user.get('worst_action', '').lower()
            header_color = colors.HexColor("#888888") # Default Grey
            if 'submitted' in worst or 'extended' in worst or 'compromise' in worst:
                header_color = colors.HexColor("#D32F2F") # Red
            elif 'click' in worst:
                header_color = colors.HexColor("#FF7A00") # Orange
            elif 'open' in worst:
                header_color = colors.HexColor("#FBC02D") # Yellow
            elif 'report' in worst:
                header_color = colors.HexColor("#2E7D32") # Green
            
            # --- 2. Target Header Row ---
            h1 = [['Target', 'Group', 'Department']]
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
            user_block.append(t_h1)

            # --- 2. User Info Row ---
            u_info = [[
                Paragraph(f"<b>👤 {user['name']}</b> <font color='grey'>({user['email']})</font>", self.styles['ForensicValue']),
                user['group'],
                user['department']
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
            user_block.append(t_ui)

            # --- 3. Sub-Header Row ---
            s_h = [['Template', 'Sent', 'Worst Action', 'Status']]
            t_sh = Table(s_h, colWidths=[2.7*inch, 2*inch, 1.5*inch, 1*inch])
            t_sh.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EEEEEE")),
                ('FONTNAME', (0,0), (-1,-1), FONT_MED),
                ('FONTSIZE', (0,0), (-1,-1), 7),
                ('TEXTCOLOR', (0,0), (-1,-1), colors.grey),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('GRID', (0,0), (-1,-1), 0.5, colors.white),
            ]))
            user_block.append(t_sh)

            # --- 4. Main Meta Row ---
            m_info = [[user['template'], user['sent_time'], user['worst_action'], user['status']]]
            t_mi = Table(m_info, colWidths=[2.7*inch, 2*inch, 1.5*inch, 1*inch])
            color_status = colors.red if user['status'] == 'Failed' else colors.green
            t_mi.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.white),
                ('FONTNAME', (0,0), (-1,-1), FONT_NORMAL),
                ('FONTSIZE', (0,0), (-1,-1), 7),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('TEXTCOLOR', (3,0), (3,0), color_status),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#DDDDDD")),
            ]))
            user_block.append(t_mi)

            # --- 5. Event Rows (The "Forensic" part) ---
            e_h = [['Action Date', 'Action Type / Details', 'Filters', 'Human Fingerprints / Geodata', 'Status']]
            t_eh = Table(e_h, colWidths=[1.4*inch, 2.2*inch, 0.8*inch, 1.8*inch, 1*inch])
            t_eh.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EEEEEE")),
                ('FONTNAME', (0,0), (-1,-1), FONT_BOLD),
                ('FONTSIZE', (0,0), (-1,-1), 7),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('GRID', (0,0), (-1,-1), 0.5, colors.white),
            ]))
            user_block.append(t_eh)

            for ev in user.get('events', []):
                ev_type = ev['type'].lower()
                ev_bg = colors.white
                s_lbl, s_val, s_det = 'ForensicLabel', 'ForensicValue', 'ForensicDetail'
                
                if 'submitted' in ev_type or 'credential' in ev_type or 'compromise' in ev_type:
                    ev_bg = colors.HexColor("#D32F2F") # Red
                    s_lbl, s_val, s_det = 'ForensicLabelWhite', 'ForensicValueWhite', 'ForensicDetailWhite'
                elif 'click' in ev_type:
                    ev_bg = colors.HexColor("#FF7A00") # Orange
                    s_lbl, s_val, s_det = 'ForensicLabelWhite', 'ForensicValueWhite', 'ForensicDetailWhite'
                elif 'open' in ev_type:
                    ev_bg = colors.HexColor("#FBC02D") # Yellow
                    s_lbl, s_val, s_det = 'ForensicLabelWhite', 'ForensicValueWhite', 'ForensicDetailWhite'
                elif 'report' in ev_type:
                    ev_bg = colors.HexColor("#2E7D32") # Green
                    s_lbl, s_val, s_det = 'ForensicLabelWhite', 'ForensicValueWhite', 'ForensicDetailWhite'

                e_row = [
                    Paragraph(ev['date'], self.styles[s_val]),
                    [
                        Paragraph(ev['type'], self.styles[s_lbl]),
                        Paragraph(f"<b>User Agent:</b> {ev['user_agent']}", self.styles[s_det])
                    ],
                    Paragraph("Ø", self.styles[s_val]),
                    [
                        Paragraph(f"🌐 {ev['ip']}", self.styles[s_lbl]),
                        Paragraph(ev['location'], self.styles[s_det])
                    ],
                    Paragraph(f"<b>{ev['status']}</b>", self.styles[s_val])
                ]
                t_ev = Table([e_row], colWidths=[1.4*inch, 2.2*inch, 0.8*inch, 1.8*inch, 1*inch])
                t_ev.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), ev_bg),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#EEEEEE")),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                    ('TOPPADDING', (0,0), (-1,-1), 8),
                ]))
                user_block.append(t_ev)
            
            self.elements.append(KeepTogether(user_block))
            self.elements.append(Spacer(1, 0.4*inch))

    def _log_table_style(self, header_bg):
        return TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, LIGHT_GREY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_STRIPE]),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ])

    @staticmethod
    def onPage(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(PRIMARY_ORANGE)
        canvas.setLineWidth(1.2)
        canvas.rect(0.25*inch, 0.25*inch, A4[0]-0.5*inch, A4[1]-0.5*inch)
        canvas.setLineWidth(0.6)
        canvas.rect(0.32*inch, 0.32*inch, A4[0]-0.64*inch, A4[1]-0.64*inch)
        canvas.line(0.5*inch, 0.75*inch, A4[0]-0.5*inch, 0.75*inch)
        canvas.setFont(FONT_LIGHT, 8)
        canvas.drawString(0.5*inch, 0.6*inch, "CONFIDENTIAL // DETAILED AUDIT LOG")
        canvas.drawRightString(A4[0]-0.5*inch, 0.6*inch, f"PAGE {doc.page}")
        canvas.restoreState()

    def build(self):
        doc = SimpleDocTemplate(self.filename, pagesize=A4, rightMargin=0.5*inch, leftMargin=0.5*inch, topMargin=1*inch, bottomMargin=1*inch)
        self.create_cover_page()
        self.create_toc()
        self.create_campaign_overview()
        self.create_executive_summary()
        self.create_test_summary()
        self.create_metrics_visualization(mode="pie")
        self.create_simulation_templates()
        self.create_metrics_visualization(mode="2d")
        self.create_target_metric_table()
        self.create_audit_logs()
        self.create_recommendations()
        doc.build(self.elements, onFirstPage=PhishingReport.onPage, onLaterPages=PhishingReport.onPage)

if __name__ == "__main__":
    PhishingReport("detailed_report.pdf", REPORT_DATA).build()
    print("Detailed Report Redesigned Successfully.")
