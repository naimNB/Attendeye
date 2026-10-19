import io
from xml.sax.saxutils import escape
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from fastapi import HTTPException
from fastapi.responses import Response


def safe_cell(value: object) -> object:
    # Spreadsheet formula injection protection, including leading control/space characters.
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def export(rows: list[dict], format: str, filename: str, title: str) -> Response:
    frame = pd.DataFrame(rows)
    if format == "csv":
        frame = frame.map(safe_cell)
        data = frame.to_csv(index=False).encode("utf-8-sig")
        mime = "text/csv"
    elif format == "pdf":
        buffer = io.BytesIO()
        styles = getSampleStyleSheet()
        content = [Paragraph(escape(title), styles["Title"]), Spacer(1, 12)]
        if rows:
            values = [[Paragraph(escape(str(v)), styles["BodyText"]) for v in frame.columns]]
            values += [[Paragraph(escape(str(v)), styles["BodyText"]) for v in record] for record in frame.itertuples(index=False, name=None)]
            table = Table(values, repeatRows=1, colWidths=[760 / len(frame.columns)] * len(frame.columns))
            table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")),
                                       ("GRID", (0, 0), (-1, -1), .3, colors.lightgrey),
                                       ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                       ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
            content.append(table)
        else:
            content.append(Paragraph("No records available.", styles["Normal"]))
        SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=40, rightMargin=40).build(content)
        data, mime = buffer.getvalue(), "application/pdf"
    else:
        raise HTTPException(422, "format must be csv or pdf")
    return Response(data, media_type=mime, headers={"Content-Disposition": f'attachment; filename="{filename}.{format}"',
                                                   "Cache-Control": "no-store"})
