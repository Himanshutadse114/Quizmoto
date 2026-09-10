import json, sys
from datetime import datetime
from xml.sax.saxutils import escape
import xlsxwriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak, SimpleDocTemplate, KeepTogether
from reportlab.graphics.shapes import Drawing, Rect, String

TEAL=colors.HexColor('#4FC9BF'); TD=colors.HexColor('#16988F'); TS=colors.HexColor('#EAF9F7')
INK=colors.HexColor('#183334'); MUT=colors.HexColor('#6E8584'); LINE=colors.HexColor('#D9E9E6')
SOFT=colors.HexColor('#F5FAF9'); WHITE=colors.white; GREEN=colors.HexColor('#2EA66A')
AMBER=colors.HexColor('#E3A323'); RED=colors.HexColor('#D9534F'); BLUE=colors.HexColor('#4B84D1'); GREY=colors.HexColor('#9AAEAC')
try:
    pdfmetrics.registerFont(TTFont('LMSGEN-Regular','/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('LMSGEN-Bold','/app/Roboto/Roboto_Condensed/static/RobotoCondensed-Bold.ttf'))
    FONT='LMSGEN-Regular'; BOLD='LMSGEN-Bold'
except Exception:
    FONT='Helvetica'; BOLD='Helvetica-Bold'

def txt(v):
    if v is None:return ''
    if isinstance(v,bool):return 'Yes' if v else 'No'
    return json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else str(v)
def safe(v):return escape(txt(v).replace('—',' - ').replace('–','-').replace('•','-'))
def num(v):
    try:return float(txt(v).replace('%','').replace(',','').strip())
    except:return None
def generated(v,short=False):
    try:return datetime.fromisoformat(txt(v).replace('Z','+00:00')).strftime('%d %b %Y' if short else '%d %b %Y, %H:%M UTC')
    except:return txt(v)
def rtype(r):return txt(r.get('reportType') or 'overview').lower()
def smap(r):return {txt(x.get('label')).strip().lower():x.get('value') for x in (r.get('summary') or [])}
def pick(m,*keys):
    for k in keys:
        if k in m and m[k] not in (None,''):return m[k]
    return None
def scol(v):
    k=txt(v).lower().replace('_',' ')
    if 'fail' in k or 'error' in k or 'overdue' in k:return RED
    if 'complete' in k or 'pass' in k or 'active' in k or 'published' in k:return GREEN
    if 'progress' in k or 'start' in k or 'pending' in k or 'launch' in k:return AMBER
    if 'not attempted' in k or 'draft' in k or 'inactive' in k:return GREY
    return TD

def stats(r):
    m=smap(r); rows=r.get('rows') or []
    total=num(pick(m,'learners','total learners','assignments','readers')); total=int(total if total is not None else len(rows))
    d={'completed':0,'progress':0,'failed':0,'not':0,'other':0}
    field=next((k for k in ('result','status') if any(k in x for x in rows)),None)
    for row in rows:
        k=txt(row.get(field)).lower() if field else ''
        if 'fail' in k:d['failed']+=1
        elif 'complete' in k or 'pass' in k:d['completed']+=1
        elif 'progress' in k or 'start' in k or 'launch' in k:d['progress']+=1
        elif 'not attempted' in k or not k:d['not']+=1
        else:d['other']+=1
    c=num(pick(m,'completed')); p=num(pick(m,'in progress','in-progress'))
    if c is not None:d['completed']=int(c)
    if p is not None:d['progress']=int(p)
    known=sum(d.values())
    if total>known:d['not']+=total-known
    d['total']=total; return d

def score_stats(r):
    rows=r.get('rows') or []; vals=[]
    for row in rows:
        v=num(row.get('score'))
        if v is not None:vals.append(max(0,min(100,v)))
    b={'80-100':0,'60-79':0,'Below 60':0,'No score':max(0,len(rows)-len(vals))}
    for v in vals:b['80-100' if v>=80 else '60-79' if v>=60 else 'Below 60']+=1
    avg=num(pick(smap(r),'average score','avg. score','avg score'))
    return b, avg if avg is not None else (sum(vals)/len(vals) if vals else None)

def styles():
    s=getSampleStyleSheet()
    for name,kw in {
        'cover':dict(fontName=BOLD,fontSize=27,leading=31,textColor=INK),
        'sub':dict(fontName=FONT,fontSize=10.5,leading=14,textColor=MUT),
        'section':dict(fontName=BOLD,fontSize=16,leading=19,textColor=INK),
        'kick':dict(fontName=BOLD,fontSize=6.5,leading=8,textColor=TD),
        'body':dict(fontName=FONT,fontSize=7.4,leading=9.5,textColor=INK),
        'mut':dict(fontName=FONT,fontSize=6.4,leading=8,textColor=MUT),
        'mv':dict(fontName=BOLD,fontSize=18,leading=20,textColor=INK,alignment=TA_CENTER),
        'ml':dict(fontName=BOLD,fontSize=6.1,leading=7,textColor=MUT,alignment=TA_CENTER),
        'ct':dict(fontName=BOLD,fontSize=9.2,leading=11,textColor=INK),
        'cl':dict(fontName=BOLD,fontSize=5.7,leading=7,textColor=MUT),
        'cv':dict(fontName=BOLD,fontSize=7.2,leading=9,textColor=INK),
        'th':dict(fontName=BOLD,fontSize=5.8,leading=7,textColor=INK),
        'tc':dict(fontName=FONT,fontSize=6.1,leading=7.6,textColor=INK)
    }.items():s.add(ParagraphStyle(name=name,**kw))
    return s

def footer(c,d,r):
    if d.page==1:return
    w,_=landscape(A4); c.saveState(); c.setStrokeColor(LINE); c.line(14*mm,9.5*mm,w-14*mm,9.5*mm)
    c.setFont(FONT,6); c.setFillColor(MUT); tenant=(r.get('tenant') or {}).get('name') or 'Platform'
    title=txt(r.get('title')).replace('—','-')[:62]; c.drawString(14*mm,5.8*mm,f'LMSGEN | {tenant} | {title}')
    c.drawRightString(w-14*mm,5.8*mm,f'Page {d.page}'); c.restoreState()
def banner():
    w=landscape(A4)[0]-28*mm; h=45*mm; d=Drawing(w,h)
    d.add(Rect(0,0,w,h,rx=6,ry=6,fillColor=INK,strokeColor=None)); d.add(Rect(0,0,7*mm,h,fillColor=TEAL,strokeColor=None))
    d.add(Rect(w-52*mm,0,52*mm,h,fillColor=colors.HexColor('#214747'),strokeColor=None)); d.add(Rect(w-52*mm,h-7*mm,52*mm,7*mm,fillColor=TD,strokeColor=None))
    d.add(String(17*mm,27*mm,'LMSGEN',fontName=BOLD,fontSize=25,fillColor=WHITE)); d.add(String(17*mm,19*mm,'LEARNING ANALYTICS & REPORTING',fontName=FONT,fontSize=8,fillColor=colors.HexColor('#CBECE9')))
    d.add(String(w-43*mm,20*mm,'REPORT',fontName=BOLD,fontSize=17,fillColor=WHITE)); d.add(String(w-43*mm,13*mm,'CURRENT PLATFORM',fontName=FONT,fontSize=7,fillColor=colors.HexColor('#CBECE9'))); return d
def section(no,kicker,title,s):
    n=Table([[Paragraph(no,ParagraphStyle('sn',fontName=BOLD,fontSize=10,textColor=WHITE,alignment=TA_CENTER))]],colWidths=[12*mm],rowHeights=[14*mm])
    n.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),TD),('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
    t=Table([[n,[Paragraph(safe(kicker).upper(),s['kick']),Paragraph(safe(title),s['section'])]]],colWidths=[14*mm,landscape(A4)[0]-42*mm])
    t.setStyle(TableStyle([('BACKGROUND',(1,0),(1,0),SOFT),('BOX',(0,0),(-1,-1),.5,LINE),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(1,0),(1,0),10),('TOPPADDING',(1,0),(1,0),7),('BOTTOMPADDING',(1,0),(1,0),7)])); return KeepTogether([t,Spacer(1,4*mm)])
def metric(label,value,s,accent):
    t=Table([[Paragraph(safe(label).upper(),s['ml'])],[Paragraph(safe(value if value not in (None,'') else '-'),s['mv'])]],colWidths=[47*mm],rowHeights=[9*mm,16*mm])
    t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),.5,LINE),('LINEABOVE',(0,0),(-1,0),3,accent),('VALIGN',(0,0),(-1,-1),'MIDDLE')])) ; return t
def metrics(r,s):
    items=(r.get('summary') or [])[:5]; accents=[TD,GREEN,AMBER,BLUE,TEAL]
    if not items:return None
    t=Table([[metric(x.get('label'),x.get('value'),s,accents[i]) for i,x in enumerate(items)]],colWidths=[(landscape(A4)[0]-32*mm)/len(items)]*len(items))
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),2),('RIGHTPADDING',(0,0),(-1,-1),2)])); return t
def progress(label,value,colour,s,note):
    v=num(value); v=None if v is None else max(0,min(100,v)); track=75*mm; d=Drawing(track,8*mm)
    d.add(Rect(0,2*mm,track,3.2*mm,rx=2,ry=2,fillColor=LINE,strokeColor=None))
    if v is not None:d.add(Rect(0,2*mm,track*v/100,3.2*mm,rx=2,ry=2,fillColor=colour,strokeColor=None))
    t=Table([[Paragraph(f'<b>{safe(label)}</b><br/><font size="6" color="#6E8584">{safe(note)}</font>',s['body']),Paragraph('<b>%s</b>'%('-' if v is None else f'{v:.1f}%'),s['ct'])],[d,'']],colWidths=[78*mm,20*mm])
    t.setStyle(TableStyle([('SPAN',(0,1),(1,1)),('ALIGN',(1,0),(1,0),'RIGHT'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)])); return t
def performance(r,s):
    m=smap(r); comp=pick(m,'completion','completion rate','course completion'); avg=pick(m,'average score','avg. score','avg score')
    if comp is None:
        st=stats(r); comp=100*st['completed']/st['total'] if st['total'] else None
    inner=[progress('Completion rate',comp,GREEN,s,'Share of assigned learners in a completed state'),Spacer(1,2*mm),progress('Average score',avg,BLUE,s,'Mean score where LMSGEN received a score')]
    t=Table([[Paragraph('Performance indicators',s['ct'])],[Paragraph('A quick view of completion and scoring outcomes.',s['mut'])],[inner]],colWidths=[115*mm])
    t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),.5,LINE),('LINEABOVE',(0,0),(-1,0),3,GREEN),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)])); return t
def status_panel(r,s):
    st=stats(r); parts=[('Completed',st['completed'],GREEN),('In progress',st['progress'],AMBER),('Failed',st['failed'],RED),('Not attempted',st['not'],GREY),('Other',st['other'],TD)]; parts=[x for x in parts if x[1]>0] or [('No activity',1,LINE)]; total=sum(x[1] for x in parts)
    d=Drawing(100*mm,20*mm); x=0
    for _,n,c in parts:
        w=100*mm*n/total; d.add(Rect(x,13*mm,max(1,w),5*mm,fillColor=c,strokeColor=None)); x+=w
    d.add(String(0,2*mm,f'{st["total"]} learner / assignment records',fontName=FONT,fontSize=7,fillColor=MUT))
    leg=[]
    for label,n,c in parts:
        box=Table([['']],colWidths=[4*mm],rowHeights=[4*mm]); box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),c)])); leg.append([box,Paragraph(f'<b>{safe(label)}</b>  {n}',s['mut'])])
    pairs=[]
    for i in range(0,len(leg),2):pairs.append(leg[i]+(leg[i+1] if i+1<len(leg) else ['','']))
    lt=Table(pairs,colWidths=[6*mm,40*mm,6*mm,40*mm]); lt.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),1)]))
    t=Table([[Paragraph('Learner status mix',s['ct'])],[Paragraph('Latest learning state across this report.',s['mut'])],[d],[lt]],colWidths=[105*mm])
    t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),.5,LINE),('LINEABOVE',(0,0),(-1,0),3,TD),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)])); return t
def score_panel(r,s):
    b,_=score_stats(r); mx=max(list(b.values())+[1]); rows=[[Paragraph('Score distribution',s['ct'])],[Paragraph('Learner score bands from captured score data.',s['mut'])]]; cmap={'80-100':GREEN,'60-79':TD,'Below 60':RED,'No score':GREY}
    for label,n in b.items():
        d=Drawing(90*mm,7*mm); d.add(Rect(0,2*mm,74*mm,3*mm,fillColor=LINE,strokeColor=None));
        if n:d.add(Rect(0,2*mm,74*mm*n/mx,3*mm,fillColor=cmap[label],strokeColor=None))
        d.add(String(78*mm,1.5*mm,str(n),fontName=BOLD,fontSize=7,fillColor=INK)); bar=Table([[Paragraph(label,s['mut']),d]],colWidths=[28*mm,92*mm]); bar.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)])); rows.append([bar])
    t=Table(rows,colWidths=[130*mm]); t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),.5,LINE),('LINEABOVE',(0,0),(-1,0),3,BLUE),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)])); return t

def learner_card(row,i,s):
    name=row.get('learner') or row.get('name') or 'Learner'; email=row.get('email') or ''; result=row.get('result') or row.get('status') or 'Not attempted'; c=scol(result)
    head=Table([[Paragraph(f'<b>{i:02d}. {safe(name)}</b><br/><font size="6" color="#6E8584">{safe(email)}</font>',s['ct']),Paragraph(f'<font color="{c.hexval()}"><b>{safe(result)}</b></font>',s['cv'])]],colWidths=[91*mm,35*mm])
    head.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),SOFT),('LINEABOVE',(0,0),(-1,0),3,c),('BOX',(0,0),(-1,-1),.45,LINE),('ALIGN',(1,0),(1,0),'RIGHT'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    vals=[('PROGRESS',row.get('progress') or '-'),('SCORE',row.get('score') if row.get('score') not in (None,'') else '-'),('LEARNING TIME',row.get('learningTime') or row.get('activeTime') or '-'),('QUESTIONS',row.get('questions') if row.get('questions') not in (None,'') else '-'),('CORRECT',row.get('correct') if row.get('correct') not in (None,'') else '-'),('LAST ACTIVITY',row.get('lastActivity') or row.get('lastActivityAt') or '-')]
    cells=[[Paragraph(a,s['cl']),Paragraph(safe(b),s['cv'])] for a,b in vals]
    detail=Table([[cells[0],cells[1],cells[2]],[cells[3],cells[4],cells[5]]],colWidths=[42*mm]*3)
    detail.setStyle(TableStyle([('BOX',(0,0),(-1,-1),.4,LINE),('INNERGRID',(0,0),(-1,-1),.3,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
    outer=Table([[head],[detail]],colWidths=[126*mm]); outer.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)])); return outer

def table_detail(r,s):
    cols=r.get('columns') or []; rows=r.get('rows') or []; avail=landscape(A4)[0]-28*mm
    if not cols or not rows:return Table([[Paragraph(safe(r.get('emptyMessage') or 'No matching data is available for this report.'),s['body'])]],colWidths=[240*mm],rowHeights=[26*mm],style=[('BACKGROUND',(0,0),(-1,-1),SOFT),('BOX',(0,0),(-1,-1),.5,LINE),('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE')])
    weights=[]
    for c in cols:
        k=c.get('key'); vals=[txt(x.get(k)) for x in rows[:60]]; w=max([len(txt(c.get('label'))),8]+[min(45,len(v)) for v in vals]);
        if k in ('result','status','progress','score','questions','correct','pages','readers','sessions'):w=min(w,10)
        if k in ('learner','name','email','course','title','item'):w=max(w,15)
        weights.append(max(7,min(25,w)))
    total=sum(weights); widths=[avail*w/total for w in weights]
    data=[[Paragraph(safe(c.get('label')).upper(),s['th']) for c in cols]]+[[Paragraph(safe(row.get(c.get('key'))),s['tc']) for c in cols] for row in rows]
    t=Table(data,colWidths=widths,repeatRows=1); cmds=[('BACKGROUND',(0,0),(-1,0),TS),('LINEBELOW',(0,0),(-1,0),1,TD),('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,SOFT]),('GRID',(0,0),(-1,-1),.25,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]
    for ci,c in enumerate(cols):
        if c.get('key') in ('result','status'):
            for ri,row in enumerate(rows,1):cmds += [('TEXTCOLOR',(ci,ri),(ci,ri),scol(row.get(c.get('key')))),('FONTNAME',(ci,ri),(ci,ri),BOLD)]
    t.setStyle(TableStyle(cmds)); return t

def generate_pdf(r,out):
    s=styles(); doc=SimpleDocTemplate(out,pagesize=landscape(A4),leftMargin=14*mm,rightMargin=14*mm,topMargin=13*mm,bottomMargin=15*mm,title=txt(r.get('title')),author='LMSGEN')
    tenant=(r.get('tenant') or {}).get('name') or 'Platform-wide'; story=[banner(),Spacer(1,12*mm),Paragraph(safe(r.get('title') or 'LMSGEN Report'),s['cover']),Paragraph(safe(r.get('subtitle') or 'Learning analytics and evidence'),s['sub']),Spacer(1,12*mm)]
    meta=[]
    for label,value in [('REPORT TYPE',rtype(r).replace('_',' ').title()),('SCOPE',tenant),('GENERATED',generated(r.get('generatedAt'),True))]:
        t=Table([[Paragraph(label,s['kick'])],[Paragraph(safe(value),s['ct'])]],colWidths=[78*mm]); t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),SOFT),('BOX',(0,0),(-1,-1),.5,LINE),('LINEABOVE',(0,0),(-1,0),2.4,TEAL),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)])); meta.append(t)
    mt=Table([meta],colWidths=[(landscape(A4)[0]-32*mm)/3]*3); mt.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),2),('RIGHTPADDING',(0,0),(-1,-1),2)])); story += [mt,Spacer(1,10*mm)]
    if metrics(r,s):story += [Paragraph('REPORT SNAPSHOT',s['kick']),metrics(r,s)]
    story += [Spacer(1,10*mm),Paragraph('Designed for management review, audit evidence and learning-performance analysis.',s['mut']),PageBreak(),section('01','EXECUTIVE DASHBOARD','Learning Performance Summary',s)]
    if metrics(r,s):story += [metrics(r,s),Spacer(1,5*mm)]
    p=Table([[performance(r,s),status_panel(r,s)]],colWidths=[125*mm,115*mm]); p.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3)])); story += [p,Spacer(1,5*mm)]
    story += [PageBreak(),section('02','LEARNER-LEVEL EVIDENCE' if rtype(r)=='course' else 'DETAILED EVIDENCE','Detailed Learner Audit' if rtype(r)=='course' else 'Report Detail',s)]
    rows=r.get('rows') or []
    if rtype(r)=='course' and rows:
        for i in range(0,len(rows),2):
            pair=Table([[learner_card(rows[i],i+1,s),learner_card(rows[i+1],i+2,s) if i+1<len(rows) else '']],colWidths=[128*mm,128*mm]); pair.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),2),('RIGHTPADDING',(0,0),(-1,-1),2),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2)])); story += [pair,Spacer(1,2*mm)]
    else:story.append(table_detail(r,s))
    story += [Spacer(1,4*mm),Paragraph('Generated from LMSGEN current-platform data. The report reflects evidence available at the generation time.',s['mut'])]
    doc.build(story,onFirstPage=lambda c,d:footer(c,d,r),onLaterPages=lambda c,d:footer(c,d,r))

def generate_excel(r,out):
    wb=xlsxwriter.Workbook(out); wb.set_properties({'title':txt(r.get('title')),'author':'LMSGEN'}); dash=wb.add_worksheet('Dashboard'); data=wb.add_worksheet('Detailed Data'); dash.hide_gridlines(2); data.hide_gridlines(2)
    brand=wb.add_format({'bold':True,'font_size':22,'font_color':'#FFFFFF','bg_color':'#183334'}); sub=wb.add_format({'font_size':9,'font_color':'#6E8584'}); title=wb.add_format({'bold':True,'font_size':18,'font_color':'#183334'}); sec=wb.add_format({'bold':True,'font_color':'#16988F','bottom':2,'bottom_color':'#4FC9BF'}); ml=wb.add_format({'bold':True,'font_size':8,'font_color':'#6E8584','border':1,'border_color':'#D9E9E6','align':'center'}); mv=wb.add_format({'bold':True,'font_size':15,'font_color':'#183334','border':1,'border_color':'#D9E9E6','align':'center'}); th=wb.add_format({'bold':True,'font_size':8,'font_color':'#284B4B','bg_color':'#EAF9F7','border':1,'border_color':'#D9E9E6','text_wrap':True}); cell=wb.add_format({'font_size':9,'font_color':'#183334','border':1,'border_color':'#E3EFED','text_wrap':True,'valign':'top'}); alt=wb.add_format({'font_size':9,'font_color':'#183334','bg_color':'#F8FBFA','border':1,'border_color':'#E3EFED','text_wrap':True,'valign':'top'})
    dash.set_column('A:A',3); dash.set_column('B:K',13); dash.merge_range('B1:K2','LMSGEN',brand); dash.merge_range('B4:K4',txt(r.get('title')),title); dash.merge_range('B5:K5',txt(r.get('subtitle')),sub); dash.merge_range('B7:K7','PERFORMANCE SNAPSHOT',sec)
    for i,x in enumerate((r.get('summary') or [])[:5]):c=1+i*2; dash.merge_range(8,c,8,c+1,txt(x.get('label')).upper(),ml); dash.merge_range(9,c,9,c+1,txt(x.get('value')),mv)
    st=stats(r); rr=30; dash.write(rr,13,'Status'); dash.write(rr,14,'Count'); vals=[('Completed',st['completed']),('In progress',st['progress']),('Failed',st['failed']),('Not attempted',st['not'])]
    for i,(a,b) in enumerate(vals,1):dash.write(rr+i,13,a); dash.write(rr+i,14,b)
    if sum(b for _,b in vals):
        ch=wb.add_chart({'type':'doughnut'}); ch.add_series({'categories':['Dashboard',rr+1,13,rr+4,13],'values':['Dashboard',rr+1,14,rr+4,14],'points':[{'fill':{'color':'#2EA66A'}},{'fill':{'color':'#E3A323'}},{'fill':{'color':'#D9534F'}},{'fill':{'color':'#9AAEAC'}}]}); ch.set_title({'name':'Learner status mix'}); ch.set_hole_size(58); ch.set_legend({'position':'bottom'}); ch.set_chartarea({'border':{'none':True}}); dash.insert_chart('B12',ch,{'x_scale':1.2,'y_scale':1.1})
    b,_=score_stats(r); dash.write(rr,16,'Score band'); dash.write(rr,17,'Learners')
    for i,(a,v) in enumerate(b.items(),1):dash.write(rr+i,16,a); dash.write(rr+i,17,v)
    if sum(b.values()):
        ch=wb.add_chart({'type':'column'}); ch.add_series({'categories':['Dashboard',rr+1,16,rr+4,16],'values':['Dashboard',rr+1,17,rr+4,17],'fill':{'color':'#4FC9BF'},'border':{'none':True}}); ch.set_title({'name':'Score distribution'}); ch.set_legend({'none':True}); ch.set_chartarea({'border':{'none':True}}); dash.insert_chart('G12',ch,{'x_scale':1.2,'y_scale':1.1})
    dash.set_column(13,18,None,None,{'hidden':True}); dash.set_landscape(); dash.fit_to_pages(1,1)
    cols=r.get('columns') or []; rows=r.get('rows') or []; data.freeze_panes(5,0); data.merge_range(0,0,0,max(0,len(cols)-1),txt(r.get('title')),title); data.merge_range(1,0,1,max(0,len(cols)-1),txt(r.get('subtitle')),sub); data.write(3,0,'DETAILED EVIDENCE',sec)
    for ci,c in enumerate(cols):data.write(4,ci,txt(c.get('label')),th); k=c.get('key'); vals=[txt(x.get(k)) for x in rows[:200]]; data.set_column(ci,ci,max(10,min(34,max([len(txt(c.get('label'))),8]+[min(55,len(v)) for v in vals])+2)))
    for ri,row in enumerate(rows,5):
        f=alt if ri%2==0 else cell
        for ci,c in enumerate(cols):data.write(ri,ci,txt(row.get(c.get('key'))),f)
    if cols:data.autofilter(4,0,max(4,4+len(rows)),len(cols)-1)
    data.set_landscape(); data.fit_to_pages(1,0); wb.close()

def main():
    if len(sys.argv)!=4:return 2
    inp,out,kind=sys.argv[1],sys.argv[2],sys.argv[3].lower(); r=json.load(open(inp,'r',encoding='utf-8'))
    if r.get('schemaVersion')!='lmsgen-report-v2':return 2
    if kind=='pdf':generate_pdf(r,out)
    elif kind=='excel':generate_excel(r,out)
    else:return 2
    print(out); return 0
if __name__=='__main__':sys.exit(main())