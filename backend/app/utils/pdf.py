from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT


def _styles():
    base = getSampleStyleSheet()
    title = ParagraphStyle("title", parent=base["Title"], fontSize=18, spaceAfter=4, textColor=colors.HexColor("#1e3a5f"))
    subtitle = ParagraphStyle("subtitle", parent=base["Normal"], fontSize=11, textColor=colors.HexColor("#6b7280"), spaceAfter=12)
    label = ParagraphStyle("label", parent=base["Normal"], fontSize=9, textColor=colors.HexColor("#9ca3af"), spaceAfter=2)
    value = ParagraphStyle("value", parent=base["Normal"], fontSize=11, spaceAfter=8)
    right = ParagraphStyle("right", parent=base["Normal"], fontSize=10, alignment=TA_RIGHT)
    footer = ParagraphStyle("footer", parent=base["Normal"], fontSize=8, textColor=colors.HexColor("#9ca3af"), alignment=TA_CENTER)
    return title, subtitle, label, value, right, footer


def _header(story, title_text, subtitle_text, ref, fecha, styles):
    title, subtitle, label, value, right, footer = styles
    story.append(Paragraph("CONFIAHOGAR", title))
    story.append(Paragraph(subtitle_text, subtitle))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb")))
    story.append(Spacer(1, 0.3 * cm))
    meta = [
        [Paragraph(f"<b>{title_text}</b>", value), Paragraph(f"Ref: <b>{ref}</b>", right)],
        [Paragraph(fecha, label), ""],
    ]
    t = Table(meta, colWidths=["*", 5 * cm])
    t.setStyle(TableStyle([("ALIGN", (1, 0), (1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(t)
    story.append(Spacer(1, 0.4 * cm))


def generar_recibo_recarga(importe: float, metodo: str, referencia: str, fecha: datetime, nombre_usuario: str) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = _styles()
    title, subtitle, label, value, right, footer = styles
    story = []

    _header(story, "Recibo de recarga de saldo", "Recibo de recarga", referencia, fecha.strftime("%d/%m/%Y %H:%M"), styles)

    rows = [
        [Paragraph("Titular", label), Paragraph(nombre_usuario, value)],
        [Paragraph("Método de pago", label), Paragraph(metodo.replace("_", " ").capitalize(), value)],
        [Paragraph("Importe recargado", label), Paragraph(f"<b>{importe:.2f} €</b>", value)],
        [Paragraph("Estado", label), Paragraph("<font color='#16a34a'>Completado</font>", value)],
    ]
    for row in rows:
        story.append(Table([row], colWidths=[4 * cm, "*"]))

    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb")))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Este recibo es un comprobante digital de la operación. Conserva este documento.", footer))
    story.append(Paragraph("CONFIAHOGAR · confiahogar.es · soporte@confiahogar.es", footer))

    doc.build(story)
    return buf.getvalue()


def generar_factura_cobro(importe: float, comision: float, importe_neto: float, referencia: str,
                          fecha: datetime, nombre_cliente: str, nombre_profesional: str,
                          concepto: str, metodo: str) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = _styles()
    title, subtitle, label, value, right, footer = styles
    story = []

    _header(story, "Factura de servicio", "Factura", referencia, fecha.strftime("%d/%m/%Y %H:%M"), styles)

    info = [
        ["Cliente", nombre_cliente],
        ["Profesional", nombre_profesional],
        ["Concepto", concepto],
        ["Método de cobro", metodo.replace("_", " ").capitalize()],
    ]
    for k, v in info:
        story.append(Table([[Paragraph(k, label), Paragraph(v, value)]], colWidths=[4 * cm, "*"]))

    story.append(Spacer(1, 0.5 * cm))

    desglose = [
        [Paragraph("<b>Concepto</b>", label), Paragraph("<b>Importe</b>", label)],
        ["Importe bruto del servicio", f"{importe:.2f} €"],
        [f"Comisión de plataforma (10%)", f"- {comision:.2f} €"],
        [Paragraph("<b>Importe neto recibido</b>", value), Paragraph(f"<b>{importe_neto:.2f} €</b>", value)],
    ]
    t = Table(desglose, colWidths=["*", 3 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("LINEBELOW", (0, -2), (-1, -2), 0.5, colors.HexColor("#e5e7eb")),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#1e3a5f")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)

    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb")))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Documento emitido electrónicamente. No requiere firma.", footer))
    story.append(Paragraph("CONFIAHOGAR · confiahogar.es · soporte@confiahogar.es", footer))

    doc.build(story)
    return buf.getvalue()


def generar_recibo_efectivo(importe: float, referencia: str, fecha: datetime,
                             nombre_cliente: str, nombre_profesional: str, concepto: str) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = _styles()
    title, subtitle, label, value, right, footer = styles
    story = []

    _header(story, "Recibo de pago en metálico", "Recibo pago en efectivo", referencia, fecha.strftime("%d/%m/%Y %H:%M"), styles)

    rows = [
        ["Cliente", nombre_cliente],
        ["Profesional", nombre_profesional],
        ["Concepto del servicio", concepto],
        ["Importe abonado", f"{importe:.2f} €"],
        ["Forma de pago", "Efectivo / Metálico"],
    ]
    for k, v in rows:
        story.append(Table([[Paragraph(k, label), Paragraph(v, value)]], colWidths=[5 * cm, "*"]))

    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        "<font color='#16a34a'><b>✓ Pago confirmado por ambas partes</b></font>",
        ParagraphStyle("ok", parent=getSampleStyleSheet()["Normal"], fontSize=12, spaceAfter=8)
    ))

    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb")))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Este recibo acredita la recepción del pago en efectivo entre las partes.", footer))
    story.append(Paragraph("CONFIAHOGAR · confiahogar.es · soporte@confiahogar.es", footer))

    doc.build(story)
    return buf.getvalue()
