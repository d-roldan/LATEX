from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "PDFs"
OUTPUT.mkdir(parents=True, exist_ok=True)

DOCUMENTS = {
    ROOT / "docs" / "MANUAL_DUENO.md": OUTPUT / "MANUAL_DUENO.pdf",
    ROOT / "docs" / "MANUAL_SUPERVISOR.md": OUTPUT / "MANUAL_SUPERVISOR.pdf",
    ROOT / "docs" / "MANUAL_OPERARIO.md": OUTPUT / "MANUAL_OPERARIO.pdf",
}

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 20 * mm
MARGIN_TOP = 22 * mm
MARGIN_BOTTOM = 18 * mm

styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="RARTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#183B2A"),
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="RARH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#245C3D"),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True,
    )
)
styles.add(
    ParagraphStyle(
        name="RARH3",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#2F6F49"),
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )
)
styles.add(
    ParagraphStyle(
        name="RARBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#202720"),
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        name="RARBullet",
        parent=styles["RARBody"],
        leftIndent=12,
        firstLineIndent=-7,
        bulletIndent=3,
    )
)
styles.add(
    ParagraphStyle(
        name="RARCode",
        parent=styles["Code"],
        fontName="Courier",
        fontSize=7.5,
        leading=10,
        backColor=colors.HexColor("#F0F4F1"),
        borderPadding=6,
        spaceBefore=4,
        spaceAfter=6,
    )
)


def inline_markup(text: str) -> str:
    text = text.replace("—", "-").replace("–", "-").replace("‑", "-")
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    return text


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D7E1DA"))
    canvas.line(MARGIN_X, 13 * mm, PAGE_WIDTH - MARGIN_X, 13 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#5D6A61"))
    canvas.drawString(MARGIN_X, 8 * mm, "DISAL INDUSTRIA METALÚRGICA")
    canvas.drawRightString(PAGE_WIDTH - MARGIN_X, 8 * mm, f"Página {doc.page}")
    canvas.restoreState()


class RARDocTemplate(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(
            filename,
            pagesize=A4,
            rightMargin=MARGIN_X,
            leftMargin=MARGIN_X,
            topMargin=MARGIN_TOP,
            bottomMargin=MARGIN_BOTTOM,
            title="DISAL INDUSTRIA METALÚRGICA",
            author="DISAL INDUSTRIA METALÚRGICA",
        )
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
        )
        self.addPageTemplates(PageTemplate(id="DISAL", frames=frame, onPage=footer))


def markdown_story(text: str):
    lines = text.splitlines()
    story = []
    in_code = False
    code_lines = []
    i = 0

    while i < len(lines):
        raw = lines[i]
        line = raw.strip()

        if line.startswith("```"):
            if in_code:
                story.append(Paragraph("<br/>".join(inline_markup(x) for x in code_lines), styles["RARCode"]))
                code_lines = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue

        if in_code:
            code_lines.append(raw)
            i += 1
            continue

        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|?[\s:|-]+\|", lines[i + 1].strip()):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r"[:\-\s]+", c or "-") for c in cells):
                    rows.append([Paragraph(inline_markup(c), styles["RARBody"]) for c in cells])
                i += 1
            column_count = len(rows[0]) if rows else 1
            if column_count == 2:
                column_widths = [42 * mm, 128 * mm]
            elif column_count == 3:
                column_widths = [31 * mm, 62 * mm, 77 * mm]
            else:
                column_widths = [170 * mm / column_count] * column_count
            table = Table(rows, colWidths=column_widths, repeatRows=1, hAlign="LEFT")
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DCE9E0")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#183B2A")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B9C9BE")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 5),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            story.extend([table, Spacer(1, 7)])
            continue

        if not line or line == "---":
            story.append(Spacer(1, 4))
        elif line.startswith("# "):
            story.append(Paragraph(inline_markup(line[2:]), styles["RARTitle"]))
            story.append(Paragraph("Documentación actualizada desde la implementación", ParagraphStyle(
                name="SubtitleInline",
                parent=styles["RARBody"],
                fontSize=8.5,
                textColor=colors.HexColor("#65746A"),
                alignment=TA_CENTER,
                spaceAfter=10,
            )))
        elif line.startswith("## "):
            story.append(Paragraph(inline_markup(line[3:]), styles["RARH2"]))
        elif line.startswith("### "):
            story.append(Paragraph(inline_markup(line[4:]), styles["RARH3"]))
        elif re.match(r"^[-*] ", line):
            story.append(Paragraph(inline_markup(line[2:]), styles["RARBullet"], bulletText="-"))
        elif re.match(r"^\d+\. ", line):
            number, body = line.split(". ", 1)
            story.append(Paragraph(inline_markup(body), styles["RARBullet"], bulletText=f"{number}."))
        else:
            story.append(Paragraph(inline_markup(line), styles["RARBody"]))
        i += 1

    return story


for source, destination in DOCUMENTS.items():
    doc = RARDocTemplate(str(destination))
    doc.build(markdown_story(source.read_text(encoding="utf-8")))
    print(f"generated {destination}")
