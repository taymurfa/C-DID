"""Build formatted PDF for OKR export. Uses reportlab Platypus."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from io import BytesIO


def _safe_str(val):
    if val is None:
        return ''
    if hasattr(val, 'isoformat'):
        return str(val.isoformat())[:19]
    return str(val)[:500]


def build_okr_pdf(db, objectives, out_stream):
    """Write a formatted PDF to out_stream. objectives is list of raw MongoDB objective docs."""
    doc = SimpleDocTemplate(
        out_stream,
        pagesize=A4,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name='OKRTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=12,
    )
    obj_style = ParagraphStyle(
        name='ObjectiveHeading',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=14,
        spaceAfter=6,
    )
    normal = styles['Normal']
    flowables = [Paragraph('OKR Export', title_style), Spacer(1, 0.2 * inch)]

    for obj_doc in objectives:
        title = _safe_str(obj_doc.get('title') or 'Untitled')
        level = _safe_str(obj_doc.get('level'))
        status = _safe_str(obj_doc.get('status'))
        desc = _safe_str(obj_doc.get('description'))
        flowables.append(Paragraph(f'<b>{title}</b>', obj_style))
        flowables.append(Paragraph(f'Level: {level} | Status: {status}', normal))
        if desc:
            flowables.append(Paragraph(desc.replace('\n', '<br/>'), normal))
        flowables.append(Spacer(1, 0.1 * inch))

        oid = obj_doc.get('_id')
        if oid:
            krs = list(db.key_results.find({'objectiveId': oid}))
            if krs:
                flowables.append(Paragraph('<b>Key Results</b>', styles['Heading3']))
                data = [['Title', 'Target', 'Current', 'Score']]
                for kr in krs:
                    score = kr.get('score')
                    score_str = f'{int((score or 0) * 100)}%' if score is not None else '—'
                    data.append([
                        _safe_str(kr.get('title'))[:60],
                        _safe_str(kr.get('target'))[:30],
                        _safe_str(kr.get('currentValue'))[:30],
                        score_str,
                    ])
                t = Table(data, colWidths=[220, 100, 100, 50])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ]))
                flowables.append(t)
                flowables.append(Spacer(1, 0.15 * inch))

    doc.build(flowables)
