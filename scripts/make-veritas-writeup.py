"""Render the reviewed Markdown write-up as a single-page PDF."""
from pathlib import Path
import html,re
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parent.parent
out=ROOT/'output/pdf/Handsay-Veritas-writeup.pdf';out.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('Segoe','C:/Windows/Fonts/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('SegoeBold','C:/Windows/Fonts/segoeuib.ttf'))
pdfmetrics.registerFontFamily('Segoe',normal='Segoe',bold='SegoeBold',italic='Segoe',boldItalic='SegoeBold')
styles={
 'title':ParagraphStyle('title',fontName='SegoeBold',fontSize=21,leading=25,textColor=HexColor('#172331'),spaceAfter=9),
 'body':ParagraphStyle('body',fontName='Segoe',fontSize=10.1,leading=13.1,textColor=HexColor('#263442'),spaceAfter=7),
 'head':ParagraphStyle('head',fontName='SegoeBold',fontSize=11.3,leading=14,spaceBefore=7,spaceAfter=4,textColor=HexColor('#172331')),
 'small':ParagraphStyle('small',fontName='Segoe',fontSize=8.5,leading=11,textColor=HexColor('#5f6874'),spaceAfter=5),
}
def marked(value):
 value=value.replace('\u2011','-').replace('\u2013','-').replace('\u2014','-')
 value=re.sub(r'\*\*(.*?)\*\*',r'<b>\1</b>',html.escape(value))
 return re.sub(r'\[([^\]]+)\]\((https://[^)]+)\)',r'<link href="\2" color="#0b57d0">\1</link>',value)
story=[]
source=(ROOT/'docs/VERITAS_WRITEUP.md').read_text(encoding='utf-8')
for block in source.split('\n\n'):
 text=' '.join(block.splitlines()).strip()
 if not text:continue
 if text.startswith('# '):story.append(Paragraph(marked(text[2:]),styles['title']))
 elif text.startswith('## '):story.append(Paragraph(marked(text[3:]),styles['head']))
 elif text.startswith('**Track:'):story.append(Paragraph(marked(text).replace('<b>This project','<br/><b>This project'),styles['small']))
 else:story.append(Paragraph(marked(text),styles['small' if text.startswith('**This project') else 'body']))
SimpleDocTemplate(str(out),pagesize=A4,rightMargin=43,leftMargin=43,topMargin=35,bottomMargin=33,title='Handsay - Veritas project write-up',author='SeHyun Lee').build(story)
pdf=PdfReader(out);assert len(pdf.pages)==1,f'Expected one page, got {len(pdf.pages)}'
text=' '.join(pdf.pages[0].extract_text().split())
for expected in ['SeHyun Lee','254 software tests','Live signing accuracy remains unverified','not medical advice','Codex']:assert expected in text,expected
links=[a.get_object().get('/A',{}).get('/URI') for a in pdf.pages[0].get('/Annots',[])];assert len([l for l in links if l])>=5
print(f'{out}: one page; {len(text.split())} extracted words; key claims preserved')
