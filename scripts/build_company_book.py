"""Build the LaGecto company book PDF for team and investors."""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image as RLImage,
    KeepTogether,
    ListFlowable,
    ListItem,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = Path.home() / "Desktop"
OUT_PDF = DESKTOP / "LaGecto_Company_Book.pdf"
CACHE = ROOT / "scripts" / ".company-book-cache"
CACHE.mkdir(parents=True, exist_ok=True)

LOGO_APP = Path(
    r"C:\Users\User\.cursor\projects\c-Users-User-Desktop-lagecto-web\assets"
    r"\c__Users_User_AppData_Roaming_Cursor_User_workspaceStorage_4a38e326c8300843ecc40fe01ad586a5_images_adaptive-icon-07189ca7-b6c6-4c3e-8d0a-a361abdf775b.png"
)
LOGO_BRAND = ROOT / "public" / "brand" / "logo.png"
HERO = ROOT / "public" / "visuals" / "public-hero.png"
SHOPS_HERO = ROOT / "public" / "marketplace" / "shops-hero.png"
PLANS_HERO = ROOT / "public" / "visuals" / "plans-hero.jpg"
LOGIN_HERO = ROOT / "public" / "visuals" / "login-hero.png"
IMG_FASHION = ROOT / "public" / "marketplace" / "product-fashion.png"
IMG_GROCERIES = ROOT / "public" / "marketplace" / "product-groceries.png"
IMG_ELECTRONICS = ROOT / "public" / "marketplace" / "product-electronics.png"
IMG_FARMING = ROOT / "public" / "marketplace" / "product-farming.png"
IMG_BEAUTY = ROOT / "public" / "marketplace" / "product-beauty.png"
IMG_HOME = ROOT / "public" / "marketplace" / "product-home.png"
DIARY_BIZ = ROOT / "public" / "diary" / "diary-business.png"
DIARY_GROWTH = ROOT / "public" / "diary" / "diary-growth.png"
DIARY_SUCCESS = ROOT / "public" / "diary" / "diary-success.png"

GREEN = HexColor("#0B6E4F")
GREEN_DEEP = HexColor("#073628")
GREEN_MID = HexColor("#2E8B57")
GOLD = HexColor("#D4AF37")
CREAM = HexColor("#F7F3E3")
IVORY = HexColor("#FFFDF8")
INK = HexColor("#12241C")
MUTED = HexColor("#5A6A62")
RULE = HexColor("#D8D0BC")
ORANGE = HexColor("#E Pan8A1C") if False else HexColor("#E8A317")

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm


def register_fonts() -> None:
    fonts = Path(r"C:\Windows\Fonts")
    pdfmetrics.registerFont(TTFont("Georgia", str(fonts / "georgia.ttf")))
    pdfmetrics.registerFont(TTFont("Georgia-Bold", str(fonts / "georgiab.ttf")))
    pdfmetrics.registerFont(TTFont("Calibri", str(fonts / "calibri.ttf")))
    pdfmetrics.registerFont(TTFont("Calibri-Bold", str(fonts / "calibrib.ttf")))
    pdfmetrics.registerFont(TTFont("Calibri-Italic", str(fonts / "calibrii.ttf")))


def crop_mark(src: Path, dest: Path, pad: int = 24) -> Path:
    im = Image.open(src).convert("RGBA")
    bg = im.convert("RGB")
    w, h = bg.size
    # Treat near-black as background and crop to the mark.
    pixels = bg.load()
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = pixels[x, y]
            if r + g + b > 40:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x <= min_x:
        im.save(dest)
        return dest
    min_x = max(0, min_x - pad)
    min_y = max(0, min_y - pad)
    max_x = min(w, max_x + pad)
    max_y = min(h, max_y + pad)
    im.crop((min_x, min_y, max_x, max_y)).save(dest)
    return dest


def make_logo_tile(src: Path, dest: Path, size: int = 520) -> Path:
    mark = Image.open(src).convert("RGBA")
    tile = Image.new("RGBA", (size, size), (7, 54, 40, 255))
    mark.thumbnail((int(size * 0.78), int(size * 0.78)), Image.Resampling.LANCZOS)
    x = (size - mark.width) // 2
    y = (size - mark.height) // 2
    tile.paste(mark, (x, y), mark)
    radius = 48
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(tile, (0, 0))
    out.putalpha(mask)
    out.save(dest)
    return dest


def fit_image(src: Path, dest: Path, max_w: int = 1600, max_h: int = 900) -> Path:
    im = Image.open(src).convert("RGB")
    im.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, quality=86, optimize=True)
    return dest


def banner(src: Path, dest: Path, w: int = 1600, h: int = 520) -> Path:
    im = Image.open(src).convert("RGB")
    src_ratio = im.width / im.height
    dest_ratio = w / h
    if src_ratio > dest_ratio:
        new_w = int(im.height * dest_ratio)
        left = (im.width - new_w) // 2
        im = im.crop((left, 0, left + new_w, im.height))
    else:
        new_h = int(im.width / dest_ratio)
        top = (im.height - new_h) // 2
        im = im.crop((0, top, im.width, top + new_h))
    im = im.resize((w, h), Image.Resampling.LANCZOS)
    overlay = Image.new("RGB", (w, h), (7, 54, 40))
    im = Image.blend(im, overlay, 0.18)
    im.save(dest, quality=86, optimize=True)
    return dest


def prepare_assets() -> dict[str, Path]:
    logo_src = LOGO_APP if LOGO_APP.exists() else LOGO_BRAND
    cropped = crop_mark(logo_src, CACHE / "logo-crop.png")
    return {
        "logo_tile": make_logo_tile(cropped, CACHE / "logo-tile.png"),
        "logo_raw": cropped,
        "hero": banner(HERO, CACHE / "hero.jpg", 1600, 620),
        "shops": banner(SHOPS_HERO, CACHE / "shops.jpg", 1600, 520),
        "plans": banner(PLANS_HERO, CACHE / "plans.jpg", 1600, 480),
        "login": banner(LOGIN_HERO, CACHE / "login.jpg", 1600, 480),
        "fashion": fit_image(IMG_FASHION, CACHE / "fashion.jpg", 700, 520),
        "groceries": fit_image(IMG_GROCERIES, CACHE / "groceries.jpg", 700, 520),
        "electronics": fit_image(IMG_ELECTRONICS, CACHE / "electronics.jpg", 700, 520),
        "farming": fit_image(IMG_FARMING, CACHE / "farming.jpg", 700, 520),
        "beauty": fit_image(IMG_BEAUTY, CACHE / "beauty.jpg", 700, 520),
        "home": fit_image(IMG_HOME, CACHE / "home.jpg", 700, 520),
        "diary_biz": fit_image(DIARY_BIZ, CACHE / "diary-biz.jpg", 700, 520),
        "diary_growth": fit_image(DIARY_GROWTH, CACHE / "diary-growth.jpg", 700, 520),
        "diary_success": fit_image(DIARY_SUCCESS, CACHE / "diary-success.jpg", 700, 520),
    }


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    s = {}
    s["kicker"] = ParagraphStyle(
        "kicker",
        parent=base["Normal"],
        fontName="Calibri-Bold",
        fontSize=9,
        textColor=GOLD,
        letterSpacing=1.6,
        spaceAfter=6,
    )
    s["h1"] = ParagraphStyle(
        "h1",
        parent=base["Normal"],
        fontName="Georgia-Bold",
        fontSize=22,
        leading=27,
        textColor=GREEN_DEEP,
        spaceBefore=2,
        spaceAfter=10,
    )
    s["h2"] = ParagraphStyle(
        "h2",
        parent=base["Normal"],
        fontName="Georgia-Bold",
        fontSize=14.5,
        leading=19,
        textColor=GREEN,
        spaceBefore=10,
        spaceAfter=6,
    )
    s["body"] = ParagraphStyle(
        "body",
        parent=base["Normal"],
        fontName="Calibri",
        fontSize=10.5,
        leading=15.2,
        textColor=INK,
        alignment=TA_JUSTIFY,
        spaceAfter=8,
    )
    s["body_left"] = ParagraphStyle("body_left", parent=s["body"], alignment=TA_LEFT)
    s["small"] = ParagraphStyle(
        "small",
        parent=base["Normal"],
        fontName="Calibri",
        fontSize=9,
        leading=12.5,
        textColor=MUTED,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    s["caption"] = ParagraphStyle(
        "caption",
        parent=base["Normal"],
        fontName="Calibri-Italic",
        fontSize=8.5,
        leading=11,
        textColor=MUTED,
        alignment=TA_CENTER,
        spaceBefore=3,
        spaceAfter=10,
    )
    s["cover_kicker"] = ParagraphStyle(
        "cover_kicker",
        parent=base["Normal"],
        fontName="Calibri-Bold",
        fontSize=10,
        textColor=GOLD,
        alignment=TA_CENTER,
        leading=14,
    )
    s["cover_title"] = ParagraphStyle(
        "cover_title",
        parent=base["Normal"],
        fontName="Georgia-Bold",
        fontSize=36,
        leading=42,
        textColor=white,
        alignment=TA_CENTER,
    )
    s["cover_sub"] = ParagraphStyle(
        "cover_sub",
        parent=base["Normal"],
        fontName="Calibri",
        fontSize=12.5,
        leading=18,
        textColor=HexColor("#E7E1CF"),
        alignment=TA_CENTER,
    )
    s["center_gold"] = ParagraphStyle(
        "center_gold",
        parent=base["Normal"],
        fontName="Georgia",
        fontSize=12,
        leading=17,
        textColor=GOLD,
        alignment=TA_CENTER,
    )
    s["card_title"] = ParagraphStyle(
        "card_title",
        parent=base["Normal"],
        fontName="Georgia-Bold",
        fontSize=12,
        leading=16,
        textColor=GREEN_DEEP,
        spaceAfter=4,
    )
    s["card_body"] = ParagraphStyle(
        "card_body",
        parent=base["Normal"],
        fontName="Calibri",
        fontSize=9.5,
        leading=13.2,
        textColor=INK,
    )
    s["li"] = ParagraphStyle(
        "li",
        parent=base["Normal"],
        fontName="Calibri",
        fontSize=10.2,
        leading=14.2,
        textColor=INK,
        leftIndent=2,
    )
    s["footer"] = ParagraphStyle(
        "footer",
        parent=base["Normal"],
        fontName="Calibri",
        fontSize=8,
        textColor=MUTED,
    )
    s["table"] = ParagraphStyle(
        "table",
        parent=base["Normal"],
        fontName="Calibri",
        fontSize=9,
        leading=12,
        textColor=INK,
        alignment=TA_LEFT,
    )
    s["table_c"] = ParagraphStyle("table_c", parent=s["table"], alignment=TA_CENTER)
    s["table_h"] = ParagraphStyle(
        "table_h",
        parent=base["Normal"],
        fontName="Calibri-Bold",
        fontSize=9,
        leading=12,
        textColor=white,
        alignment=TA_CENTER,
    )
    return s


def bullets(items: list[str], st: ParagraphStyle) -> ListFlowable:
    return ListFlowable(
        [ListItem(Paragraph(item, st), leftIndent=12, bulletColor=GREEN) for item in items],
        bulletType="bullet",
        start="disc",
        leftIndent=14,
        bulletFontName="Calibri",
        bulletFontSize=8,
        bulletOffsetY=-1,
        spaceBefore=2,
        spaceAfter=8,
    )


def photo(path: Path, width: float, height: float | None = None) -> RLImage:
    img = RLImage(str(path), width=width, height=height or width * 0.42, kind="proportional")
    img.hAlign = "CENTER"
    return img


def gold_line(width: float = 36 * mm) -> Table:
    t = Table([[""]], colWidths=[width], rowHeights=[2])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    t.hAlign = "LEFT"
    return t


def section_title(kicker: str, title: str, s: dict[str, ParagraphStyle]) -> list:
    return [
        Paragraph(kicker.upper(), s["kicker"]),
        Paragraph(title, s["h1"]),
        gold_line(),
        Spacer(1, 8),
    ]


def card_table(cells: list[list], col_widths: list[float]) -> Table:
    t = Table(cells, colWidths=col_widths)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), IVORY),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return t


def draw_cover(canvas, doc, assets: dict[str, Path]) -> None:
    canvas.saveState()
    canvas.setFillColor(GREEN_DEEP)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(GREEN)
    canvas.rect(0, 0, 8, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(8, 0, 3, PAGE_H, fill=1, stroke=0)

    # Top and bottom gold rules
    canvas.setFillColor(GOLD)
    canvas.rect(28 * mm, PAGE_H - 18 * mm, PAGE_W - 56 * mm, 0.8, fill=1, stroke=0)
    canvas.rect(28 * mm, 22 * mm, PAGE_W - 56 * mm, 0.8, fill=1, stroke=0)

    canvas.setFillColor(GOLD)
    canvas.setFont("Calibri-Bold", 9)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 28 * mm, "CONFIDENTIAL  ·  TEAM AND INVESTOR BOOK  ·  2026")

    logo = str(assets["logo_tile"])
    size = 52 * mm
    canvas.drawImage(logo, (PAGE_W - size) / 2, PAGE_H / 2 + 18 * mm, width=size, height=size, mask="auto")

    canvas.setFillColor(white)
    canvas.setFont("Georgia-Bold", 34)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H / 2 + 4 * mm, "LaGecto")
    canvas.setFillColor(GOLD)
    canvas.setFont("Georgia", 13)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 6 * mm, "Smart Shopping, Khula Nathi Mhlobo")
    canvas.setFillColor(HexColor("#E7E1CF"))
    canvas.setFont("Calibri", 11)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 16 * mm, "The digital marketplace and shop operating system")
    canvas.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 22 * mm, "for businesses and customers in Zimbabwe")

    canvas.setFillColor(GOLD)
    canvas.setFont("Calibri-Bold", 10)
    canvas.drawCentredString(PAGE_W / 2, 48 * mm, "COMPANY BOOK")
    canvas.setFillColor(HexColor("#E7E1CF"))
    canvas.setFont("Calibri", 9.5)
    canvas.drawCentredString(PAGE_W / 2, 40 * mm, "Bulawayo, Zimbabwe  ·  lagecto.co.zw  ·  lagecto@outlook.com")
    canvas.drawCentredString(PAGE_W / 2, 28 * mm, "Founders: Stenford Mr Ceo  ·  Bonguthando B Lova  ·  Mpumelelo Williams  ·  Lawrence Ndebele")
    canvas.restoreState()


def draw_interior(canvas, doc, assets: dict[str, Path]) -> None:
    canvas.saveState()
    canvas.setFillColor(CREAM)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(GREEN_DEEP)
    canvas.rect(0, PAGE_H - 14 * mm, PAGE_W, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, PAGE_H - 14.8 * mm, PAGE_W, 1.2, fill=1, stroke=0)

    logo = str(assets["logo_raw"])
    canvas.drawImage(logo, 16 * mm, PAGE_H - 13.2 * mm, width=9 * mm, height=9 * mm, mask="auto")
    canvas.setFillColor(GOLD)
    canvas.setFont("Calibri-Bold", 8.5)
    canvas.drawString(28 * mm, PAGE_H - 10.2 * mm, "LAGECTO COMPANY BOOK")
    canvas.setFillColor(HexColor("#E7E1CF"))
    canvas.setFont("Calibri", 8)
    canvas.drawRightString(PAGE_W - 16 * mm, PAGE_H - 10.2 * mm, "Confidential  ·  Team and investors")

    canvas.setFillColor(GREEN_DEEP)
    canvas.rect(0, 0, PAGE_W, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, 12 * mm, PAGE_W, 0.8, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#E7E1CF"))
    canvas.setFont("Calibri", 8)
    canvas.drawString(16 * mm, 5 * mm, "lagecto.co.zw  ·  +263 71 503 4314")
    canvas.drawRightString(PAGE_W - 16 * mm, 5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_story(s: dict[str, ParagraphStyle], assets: dict[str, Path]) -> list:
    story: list = [NextPageTemplate("interior"), PageBreak()]
    usable = PAGE_W - 2 * MARGIN

    def img_row(paths: list[Path], labels: list[str], height: float = 42 * mm) -> Table:
        cells = []
        caps = []
        w = (usable - 8) / len(paths)
        for p, label in zip(paths, labels):
            pic = RLImage(str(p), width=w - 2, height=height)
            cells.append(pic)
            caps.append(Paragraph(label, s["caption"]))
        t = Table([cells, caps], colWidths=[w] * len(paths))
        t.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        return t

    # 1. Who this is for
    story += section_title("Audience", "Who this book is for", s)
    story.append(
        Paragraph(
            "This company book is written for the people who will build, fund, and grow LaGecto. It is a single source of truth for the product, the problem, the plan, and the people.",
            s["body"],
        )
    )
    def who_cell(title: str, body: str) -> list:
        return [Paragraph(title, s["card_title"]), Paragraph(body, s["card_body"])]

    who_data = [
        [
            who_cell("The founding team", "Partners who need a shared picture of mission, product, and the next 36 months so daily work stays aligned."),
            who_cell("Investors and partners", "People considering capital, distribution, or strategic support. It explains the market, the model, the launch offer, and the growth path."),
        ],
        [
            who_cell("Shop owners and operators", "Informal traders, salons, grocers, technicians, and growing SMEs who need a shop operating system that works on a phone."),
            who_cell("Customers of LaGecto", "People in Bulawayo and across Zimbabwe who want to find local shops, order on WhatsApp, keep receipts, and support nearby businesses."),
        ],
    ]
    # Fix: who_cell returns list of flowables; Table cells can contain lists of flowables
    wt = Table(who_data, colWidths=[usable / 2 - 2, usable / 2 - 2])
    wt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), IVORY),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(wt)
    story.append(Spacer(1, 8))
    story.append(photo(assets["hero"], usable, 58 * mm))
    story.append(Paragraph("Local commerce, made digital. LaGecto sits between the street shop and the customer’s phone.", s["caption"]))

    story.append(Paragraph("How to use this book", s["h2"]))
    story.append(
        Paragraph(
            "Read it as a briefing, not a brochure. The first half states the problem, the product, and who it serves. The second half states how the company is organised, how it will earn, and what success looks like at six months, one year, and three years. Figures in the plan are targets, not audited results.",
            s["body"],
        )
    )
    story.append(Paragraph("Contents", s["h2"]))
    contents = [
        ["01  Who this is for", "09  Packages, launch offer, and revenue"],
        ["02  Executive summary", "10  Mission, vision, values, and company goal"],
        ["03  Problems we are solving", "11  Founders and partners"],
        ["04  Why businesses need LaGecto", "12  Six-month plan"],
        ["05  Why customers need LaGecto", "13  One-year plan"],
        ["06  What LaGecto includes", "14  Three-year plan"],
        ["07  How LaGecto works", "15  Contact and close"],
        ["08  Categories we serve", ""],
    ]
    c_data = [[Paragraph(a, s["li"]), Paragraph(b, s["li"])] for a, b in contents]
    ctoc = Table(c_data, colWidths=[usable / 2 - 2, usable / 2 - 2])
    ctoc.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(ctoc)

    # 2. Executive summary
    story.append(PageBreak())
    story += section_title("Overview", "Executive summary", s)
    story.append(
        Paragraph(
            "LaGecto is a digital marketplace and shop operating system built in Bulawayo, Zimbabwe. It connects customers with local businesses and gives those businesses the tools that larger companies take for granted: a public storefront, point of sale, inventory, orders, receipts, expenses, payroll, and a clear view of profit and loss.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "The tagline <i>Smart Shopping, Khula Nathi Mhlobo</i> is the promise. Customers shop smarter. Businesses grow with us. Payment stays between the customer and the shop through WhatsApp checkout, which matches how Zimbabweans already buy. LaGecto records the order, the receipt, and the relationship. It does not take the till.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "At launch, every shop will run free for the first two months so owners and customers can learn the product with no fee in the way. After that, shops keep a Free plan and can move to paid packages named Thabi, Kristen, and Sandra when they want a verified badge and a longer commercial relationship with LaGecto.",
            s["body"],
        )
    )
    story.append(Paragraph("What makes LaGecto different", s["h2"]))
    story.append(
        bullets(
            [
                "One product for two sides of the same market: the shop that sells, and the customer who buys.",
                "A full shop operating system, not only a listing page. POS, stock, staff, money, and storefront live together.",
                "WhatsApp checkout, because that is the rail people already trust.",
                "Shop IDs such as name@lgxxxx, so a business signs in as a business, not as a personal email.",
                "Built for phones first. Most users will never sit at a desk.",
                "Priced for Zimbabwean SMEs, not for imported enterprise software.",
            ],
            s["li"],
        )
    )
    story.append(img_row([assets["fashion"], assets["groceries"], assets["electronics"]], ["Fashion and retail", "Groceries and food", "Electronics and services"]))

    # 3. Problem
    story.append(PageBreak())
    story += section_title("The market gap", "Problems we are solving", s)
    story.append(photo(assets["shops"], usable, 50 * mm))
    story.append(Paragraph("Zimbabwe’s commerce is already digital in pockets — WhatsApp, EcoCash, a notebook by the till. It is not yet a system.", s["caption"]))
    story.append(
        Paragraph(
            "LaGecto starts where most local businesses actually work: a stall, a salon, a counter, a workshop, and a phone. The gaps below are not theoretical. They are the daily friction that keeps shops small and customers guessing.",
            s["body"],
        )
    )
    problems = [
        ("Shops are invisible online", "A strong local business can still be hard to find. There is no single, trusted place to browse nearby shops by category, see what is in stock, and start an order."),
        ("Tools are scattered or too expensive", "POS, stock books, receipt books, payroll notes, and WhatsApp chats live in different places. Imported software is priced and designed for another country."),
        ("Sales disappear into chat", "Orders start in WhatsApp and die in the scroll. There is no clean order record, no receipt the customer can keep, and no stock count that matches what left the shelf."),
        ("Customers cannot compare with confidence", "People ask friends for a number. They cannot read hours, reviews, or a catalogue in one place, then message the shop with the basket already written."),
        ("Money is tracked too late", "Expenses, payroll, and sales are often added up at month-end, if at all. Owners cannot see profit while the period is still open."),
        ("Trust is personal, not portable", "A good shop is trusted by people who already know it. New customers have no reviews, no verification mark, and no digital trail."),
    ]
    p_cells = []
    row = []
    for title, body in problems:
        row.append([Paragraph(title, s["card_title"]), Paragraph(body, s["card_body"])])
        if len(row) == 2:
            p_cells.append(row)
            row = []
    pt = Table(p_cells, colWidths=[usable / 2 - 2, usable / 2 - 2])
    pt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), IVORY),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(pt)

    # 4. Solution
    story.append(Spacer(1, 10))
    story.append(Paragraph("The LaGecto answer", s["h2"]))
    story.append(
        Paragraph(
            "LaGecto puts the shop on a public storefront and puts a working back office behind it. A customer discovers the shop, builds a cart, and checks out on WhatsApp with a named order. The shop records walk-in sales on POS, keeps stock honest, prints or shares a receipt, and sees the current financial period without mixing it with last month. Admins keep the marketplace clean: shops, verification, support, and security.",
            s["body"],
        )
    )

    # 5. Why businesses
    story.append(PageBreak())
    story += section_title("Supply side", "Why businesses need LaGecto", s)
    story.append(
        Paragraph(
            "A shop on LaGecto is not renting a poster. It is running the business. That is why owners stay after the novelty of a listing wears off. The product pays for itself in time saved, stock protected, and customers who can find the shop again.",
            s["body"],
        )
    )
    story.append(
        bullets(
            [
                "A live storefront with products, services, hours, WhatsApp, and socials, without paying a developer for a website.",
                "Point of sale for walk-in trade, with receipts the customer can keep as image or PDF.",
                "Inventory that moves when a sale is made or deleted, so the shelf and the system match.",
                "Orders from the marketplace land next to till sales, not in a separate inbox.",
                "Quotations for custom work, then conversion into a sale.",
                "Expenses, payroll, and profit and loss against a current period, with archives that stay read-only.",
                "Staff logins, promotions, reviews, and a Smart Diary for the owner’s own planning.",
                "A Shop ID to sign in as the business. The shop is an organisation, not a personal Gmail.",
            ],
            s["li"],
        )
    )
    story.append(img_row([assets["diary_biz"], assets["home"], assets["beauty"]], ["Operate the shop", "Home and trade", "Beauty and services"]))
    story.append(
        Paragraph(
            "For two months after launch, shops use these tools at no charge. The goal is habit: owners should complete real sales, real expenses, and real WhatsApp orders before they are asked to pay. A product that is only demonstrated is not a product. A product that is used in the till is a company.",
            s["body"],
        )
    )

    # 6. Why customers
    story.append(PageBreak())
    story += section_title("Demand side", "Why customers need LaGecto", s)
    story.append(photo(assets["login"], usable, 48 * mm))
    story.append(Paragraph("Customers already shop with their phones. LaGecto gives that habit a catalogue, an order, and a receipt.", s["caption"]))
    story.append(
        Paragraph(
            "Customers do not need another social feed. They need to find a butcher, a salon, a phone repair, or a grocer, see what is offered, and talk to the shop without losing the details. LaGecto is built around that journey.",
            s["body"],
        )
    )
    story.append(
        bullets(
            [
                "Browse shops and products by category without creating an account first.",
                "Save shops, compare, and search locally rather than asking five group chats.",
                "Cart and WhatsApp checkout with the customer’s name on the order, even as a guest.",
                "Payment arranged directly with the shop. LaGecto does not hold the customer’s money.",
                "Order tracking and digital receipts for signed-in customers.",
                "Reviews with a name, so the next customer is not guessing.",
                "Notifications, loyalty, and Smart Diary for personal planning.",
                "A Help Centre and a way to report a shop if something is wrong.",
            ],
            s["li"],
        )
    )
    story.append(
        Paragraph(
            "When customers can find shops, shops have a reason to keep their catalogues honest. When shops keep catalogues honest, customers come back. That loop is the marketplace. LaGecto is the loop, not only the storefront and not only the till.",
            s["body"],
        )
    )

    # 7. Features
    story.append(PageBreak())
    story += section_title("Product", "What LaGecto includes", s)
    story.append(
        Paragraph(
            "The web application is a full companion to the LaGecto mobile product. It is one company, three roles: customer, shop owner, and platform admin. Below is the working surface, not a wish list.",
            s["body"],
        )
    )

    story.append(Paragraph("For customers", s["h2"]))
    story.append(
        bullets(
            [
                "Marketplace home, shops directory, category browse, search, and news.",
                "Product and shop cards, promotions, and live ads.",
                "Cart, guest or signed-in WhatsApp checkout, orders, and receipts.",
                "Saved shops, reviews, notifications, profile, and username.",
                "Loyalty, badges, Founding Users campaign, and Smart Diary.",
                "Stebo companion for guided help. Chat with shops where enabled.",
            ],
            s["li"],
        )
    )
    story.append(Paragraph("For shop owners", s["h2"]))
    story.append(
        bullets(
            [
                "Self-serve shop creation with an immediate Shop ID, or a request flow if public creation is turned off.",
                "Dashboard, products and services, inventory adjustments, and advanced stock tools.",
                "Point of sale, sale edit and delete with stock returned, and clear-all for a fresh period.",
                "Orders, quotations, customers, employees, payroll, expenses, and profit and loss.",
                "Financial current period, start a new period, and read-only archives.",
                "Receipts with templates, print, image, PDF, and WhatsApp share.",
                "Public storefront: branding, cover, gallery, video, blogs, hours, mission and vision, socials.",
                "Promotions, reviews, verification, subscription, staff, Smart Diary Pro, and Stebo Business.",
                "Help, support tickets, and in-app notifications.",
            ],
            s["li"],
        )
    )
    story.append(Paragraph("For LaGecto administrators", s["h2"]))
    story.append(
        bullets(
            [
                "Users, roles, shop assignment, and account unlock after failed logins.",
                "Shops, packages, verification, and a switch for self-serve shop creation.",
                "Platform POS, LaGecto expenses, reports, news CMS, ads, campaigns, and loyalty.",
                "Support hub, shop reports, security logs, languages, company profile, and Stebo knowledge.",
            ],
            s["li"],
        )
    )
    story.append(Paragraph("Trust, access, and safety", s["h2"]))
    story.append(
        bullets(
            [
                "Role-based routes for customer, shop owner, and admin.",
                "Unique usernames with a 14-day change limit.",
                "Lock after five failed logins, with admin unlock.",
                "Image uploads capped at 1 MB. Shop owners sign in with Shop ID, not email.",
                "Row-level security in the database and audited security events.",
            ],
            s["li"],
        )
    )

    # 8. How it works
    story.append(PageBreak())
    story += section_title("Journey", "How LaGecto works", s)
    steps = [
        ("1", "Discover", "Anyone can browse shops and products. No account is required to look."),
        ("2", "Basket", "The customer adds items and checks out. A name is required so the shop knows who is ordering."),
        ("3", "WhatsApp", "LaGecto opens WhatsApp with the order written out. Payment is arranged with the shop."),
        ("4", "Fulfil", "The shop sees the order beside till sales, updates stock, and issues a receipt."),
        ("5", "Keep records", "Sales, expenses, and payroll sit in the current financial period. History is archived, not mixed."),
        ("6", "Grow", "Reviews, loyalty, promotions, and a verified badge turn a first order into a returning customer."),
    ]
    step_rows = []
    line = []
    for num, title, body in steps:
        line.append([Paragraph(f"<font color='#D4AF37'><b>Step {num}</b></font>  {title}", s["card_title"]), Paragraph(body, s["card_body"])])
        if len(line) == 2:
            step_rows.append(line)
            line = []
    stt = Table(step_rows, colWidths=[usable / 2 - 2, usable / 2 - 2])
    stt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), IVORY),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(stt)
    story.append(Spacer(1, 8))
    story.append(img_row([assets["farming"], assets["electronics"], assets["groceries"]], ["Farming and trade", "Phones and repairs", "Daily groceries"]))

    story.append(Paragraph("Categories we serve", s["h2"]))
    story.append(
        Paragraph(
            "LaGecto is built for products and services. Shops register under categories that match real local trade, including food, grocery, restaurant, bakery, butchery, fashion, beauty, salon, spa, health, pharmacy, electronics, phones, computers, software, design, photography, printing, home, furniture, hardware, construction, plumbing, electrical, farming, automotive, transport, education, events, catering, cleaning, repairs, real estate, hospitality, legal, accounting, consulting, and more.",
            s["body"],
        )
    )

    # 9. Packages
    story.append(PageBreak())
    story += section_title("Commercial model", "Packages, launch offer, and how we earn", s)
    story.append(photo(assets["plans"], usable, 46 * mm))
    story.append(Paragraph("Paid packages add a verified badge and a longer commercial relationship. Tools stay usable so shops do not go dark.", s["caption"]))
    story.append(Paragraph("Launch offer: two months free", s["h2"]))
    story.append(
        Paragraph(
            "For the first two months after LaGecto launches, shops use the product at no charge. The purpose is adoption. Owners should complete real work in POS, inventory, expenses, and WhatsApp orders. Customers should complete real checkouts. When the free window ends, shops remain on an unpaid Free plan. Paid packages are an upgrade, not a lock on the till.",
            s["body"],
        )
    )

    hdr = [
        Paragraph("Package", s["table_h"]),
        Paragraph("Positioning", s["table_h"]),
        Paragraph("1 month", s["table_h"]),
        Paragraph("6 months", s["table_h"]),
        Paragraph("1 year", s["table_h"]),
    ]
    pack_rows = [hdr]
    packs = [
        ("Free", "Start selling. Launch window includes every shop tool.", "USD 0", "USD 0", "USD 0"),
        ("Thabi", "Verified essential shop and a stronger public presence.", "USD 4.50", "USD 21", "USD 38"),
        ("Kristen", "Branding, blogs, staff, diary, expenses, payroll, receipts.", "USD 6.50", "USD 30", "USD 55"),
        ("Sandra", "Full shop OS: analytics, advanced POS and inventory.", "USD 8", "USD 37.50", "USD 67"),
    ]
    for row in packs:
        pack_rows.append([Paragraph(c, s["table_c"] if i else s["table"]) for i, c in enumerate(row)])
    pack_table = Table(pack_rows, colWidths=[22 * mm, 78 * mm, 22 * mm, 24 * mm, 22 * mm])
    pack_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN_DEEP),
                ("BACKGROUND", (0, 1), (-1, 1), HexColor("#EAF4EE")),
                ("BACKGROUND", (0, 2), (-1, -1), IVORY),
                ("TEXTCOLOR", (0, 0), (-1, 0), white),
                ("FONTNAME", (0, 0), (-1, 0), "Calibri-Bold"),
                ("ALIGN", (2, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.3, RULE),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(pack_table)
    story.append(Paragraph("Prices are listed in United States dollars as published on LaGecto Plans. Three-month and nine-month terms are also available.", s["caption"]))

    story.append(Paragraph("Revenue logic", s["h2"]))
    story.append(
        bullets(
            [
                "Shop subscriptions after the launch window: Thabi, Kristen, and Sandra, sold in 1, 3, 6, 9, and 12 month terms.",
                "LaGecto does not take a cut of shop GMV. Marketplace orders are arranged on WhatsApp. Shop company sales are not LaGecto revenue.",
                "Optional future lines: promoted placements, verification services, training, and payment facilitation when rails are ready — never before the core loop is used daily.",
                "Platform operating costs are tracked separately in LaGecto expenses, so investor reporting is not mixed with shop tills.",
            ],
            s["li"],
        )
    )
    story.append(
        Paragraph(
            "This is a usage business. The two-month free launch is an investment in density: enough shops in enough categories that a customer in Bulawayo opens LaGecto instead of another chat. Density is what makes a marketplace worth paying for.",
            s["body"],
        )
    )

    # 10. Mission vision values
    story.append(PageBreak())
    story += section_title("Identity", "Mission, vision, core values, and company goal", s)
    mv = [
        [
            [
                Paragraph("Mission", s["card_title"]),
                Paragraph(
                    "To help Zimbabwean businesses grow by putting a complete shop and a trusted marketplace in every owner’s and every customer’s pocket.",
                    s["card_body"],
                ),
            ],
            [
                Paragraph("Vision", s["card_title"]),
                Paragraph(
                    "A Zimbabwe where local shops are as easy to find, run, and trust as any global store, without giving up the WhatsApp relationship that already works.",
                    s["card_body"],
                ),
            ],
        ]
    ]
    mvt = Table(mv, colWidths=[usable / 2 - 2, usable / 2 - 2])
    mvt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), IVORY),
                ("BOX", (0, 0), (-1, -1), 0.4, GOLD),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.append(mvt)
    story.append(Spacer(1, 10))
    story.append(Paragraph("Core values", s["h2"]))
    values = [
        ("Khula nathi", "Grow with us. We succeed when shops sell more honestly and customers buy with less friction."),
        ("Respect the till", "We do not confuse LaGecto’s books with a shop’s books. Shop sales are the shop’s."),
        ("Phone first", "If it is clumsy on a small screen, it is not finished."),
        ("Clarity over noise", "Orders, receipts, and periods must be understandable at a glance."),
        ("Trust in the open", "Reviews, verification, and support exist so strangers can trade safely."),
        ("Build in public, keep secrets that matter", "The product is explained. Customer data and shop money are not a marketing prop."),
    ]
    v_rows = []
    line = []
    for title, body in values:
        line.append([Paragraph(title, s["card_title"]), Paragraph(body, s["card_body"])])
        if len(line) == 2:
            v_rows.append(line)
            line = []
    vt = Table(v_rows, colWidths=[usable / 2 - 2, usable / 2 - 2])
    vt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), IVORY),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(vt)
    story.append(Paragraph("Company goal", s["h2"]))
    story.append(
        Paragraph(
            "Make LaGecto the default way a local business in Zimbabwe is found online and run on a phone. In practical terms: a dense Bulawayo marketplace first, then the rest of the country, with shops that keep using the operating system after the launch offer ends.",
            s["body"],
        )
    )
    story.append(img_row([assets["diary_growth"], assets["diary_success"]], ["Growth is a daily practice", "Success is a shop that stays"], height=48 * mm))

    # 11. Founders
    story.append(PageBreak())
    story += section_title("People", "Founders and partners", s)
    story.append(
        Paragraph(
            "LaGecto is founded and held by four partners. Stenford leads the company in public as Mr Ceo. The others share ownership, direction, and accountability for the product, the market, and the books.",
            s["body"],
        )
    )
    founders = [
        ("Stenford Mr Ceo", "Founder and Chief Executive Officer", "Sets product direction, public face of LaGecto, and the standard for how shops and customers are treated. Accountable for launch, the two-month free window, and converting usage into a durable company."),
        ("Bonguthando B Lova", "Co-founder and Partner", "Partner in building and owning LaGecto. Shares responsibility for growth, relationships, and making sure the company stays useful to real shops, not only impressive on a slide."),
        ("Mpumelelo Williams", "Co-founder and Partner", "Partner in operations and delivery. Helps turn the product into a service businesses can rely on: onboarding, support quality, and the discipline of day-to-day execution."),
        ("Lawrence Ndebele", "Co-founder and Partner", "Partner in stewardship of the company. Helps hold strategy, partnerships, and long-range goals so LaGecto remains a Zimbabwean company with room to grow."),
    ]
    f_rows = []
    line = []
    for name, role, bio in founders:
        line.append(
            [
                Paragraph(name, s["card_title"]),
                Paragraph(f"<font color='#0B6E4F'>{role}</font>", s["small"]),
                Paragraph(bio, s["card_body"]),
            ]
        )
        if len(line) == 2:
            f_rows.append(line)
            line = []
    ft = Table(f_rows, colWidths=[usable / 2 - 2, usable / 2 - 2], rowHeights=None)
    ft.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), IVORY),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.append(ft)
    story.append(Spacer(1, 10))
    story.append(
        Paragraph(
            "Governance note for investors: shop GMV is not company revenue. Role changes, package assignment, and security unlocks are admin-controlled. The four partners are the human layer above that system. They decide pace, capital, and which cities come next.",
            s["body"],
        )
    )

    def plan_table(headers: list[str], rows: list[list[str]]) -> Table:
        data = [[Paragraph(h, s["table_h"]) for h in headers]]
        for r in rows:
            data.append([Paragraph(c, s["table"]) for c in r])
        widths = [32 * mm, (usable - 32 * mm) / (len(headers) - 1)] * (len(headers) - 1)
        # simpler equal-ish
        col_w = [28 * mm] + [(usable - 28 * mm) / (len(headers) - 1)] * (len(headers) - 1)
        t = Table(data, colWidths=col_w, repeatRows=1)
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), GREEN_DEEP),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.3, RULE),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BACKGROUND", (0, 1), (0, -1), HexColor("#EAF4EE")),
        ]
        for i in range(1, len(data)):
            if i % 2 == 0:
                style_cmds.append(("BACKGROUND", (1, i), (-1, i), IVORY))
        t.setStyle(TableStyle(style_cmds))
        return t

    # 12. Six months
    story.append(PageBreak())
    story += section_title("Horizon 1", "Business plan and goals: first six months", s)
    story.append(
        Paragraph(
            "The first half-year is launch, habit, and density in Bulawayo. Capital and sweat go into shops that actually sell on the platform and customers who come back. The two-month free window sits at the front of this period.",
            s["body"],
        )
    )
    story.append(
        plan_table(
            ["Focus", "Goal"],
            [
                ["Launch", "Take web and mobile into public use. Register-a-shop live. Help Centre and WhatsApp support staffed."],
                ["Free window", "All shops free for two months from launch. Measure weekly active shops, POS tickets, and WhatsApp checkouts, not sign-ups alone."],
                ["Supply", "Onboard 150 to 300 shops across food, fashion, beauty, phones, home, and services. Prioritise owners who will use POS this week."],
                ["Demand", "Reach 2,000 to 5,000 customer accounts and guest checkouts combined. Marketplace must feel populated in core categories."],
                ["Product", "Keep checkout, receipts, inventory, expenses, and shop creation stable on phones. Fix what blocks a real sale the same day."],
                ["Trust", "Verification queue working. Shop reports and support tickets answered. Founding Users campaign visible."],
                ["Team", "Founders own onboarding, support rotation, and content. One shared weekly number: shops that sold."],
                ["Money", "Track platform costs in LaGecto expenses. Do not book shop GMV as company income. Prepare paid-plan messaging for day 61."],
            ],
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            "Six-month success looks like this: a customer in Bulawayo can open LaGecto, find a grocer, a salon, and a phone shop, place an order, and the owner can tell you what sold today without opening a notebook.",
            s["body"],
        )
    )

    # 13. One year
    story.append(PageBreak())
    story += section_title("Horizon 2", "Business plan and goals: first year", s)
    story.append(
        Paragraph(
            "After the free window, the company must prove that shops stay and that some of them pay. Year one is conversion, a second city, and an operating rhythm that does not depend on a single founder answering every ticket.",
            s["body"],
        )
    )
    story.append(
        plan_table(
            ["Focus", "Goal"],
            [
                ["Conversion", "Move a meaningful share of active shops onto Thabi, Kristen, or Sandra while Free remains available. Judge health by paid shops that still sell, not invoices issued."],
                ["Supply", "800 to 1,500 shops. Quality over empty shells. Suspend shops that spam or impersonate."],
                ["Demand", "Repeat customers and reviews. Loyalty and Founding Users should mean something in the second half of the year."],
                ["Geography", "Hold Bulawayo as the dense home market. Open a serious Harare beach-head if density and support can travel."],
                ["Product", "Harden analytics, advanced inventory, staff tools, and storefront sharing. Payments partnerships only if they reduce friction without taking the till by surprise."],
                ["Brand", "LaGecto is the name people use for finding a local shop. Public news, honest support, and formal company materials."],
                ["Team", "Support and onboarding roles around the four partners. Document how a shop is created, verified, and helped."],
                ["Finance", "Subscription revenue covers a rising share of platform costs. Books remain split: company expenses versus shop activity."],
            ],
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            "Year-one success is a marketplace that still works on a Monday morning without a launch event, and a paid package that a salon owner renews because the till and the storefront are now how the business runs.",
            s["body"],
        )
    )

    # 14. Three years
    story.append(PageBreak())
    story += section_title("Horizon 3", "Business plan and goals: three years", s)
    story.append(
        Paragraph(
            "Three years is national relevance. LaGecto should be the shop operating system SMEs recommend to each other, with a marketplace dense enough that customers start there. Expansion beyond Zimbabwe is a decision, not a slogan, and only after the home market is proud of the product.",
            s["body"],
        )
    )
    story.append(
        plan_table(
            ["Focus", "Goal"],
            [
                ["Market", "Coverage across major Zimbabwean cities with local category depth, not a thin national map of empty shops."],
                ["Product", "Stebo and analytics as real advantage. Optional payment facilitation if regulation and trust allow. Shop OS complete enough that owners stop keeping a second set of books."],
                ["Customers", "LaGecto as a daily habit for finding nearby products and services, with receipts and reviews as the default trail."],
                ["Revenue", "Subscriptions as the core. Add-ons (visibility, training, verification) only where they help shops earn. Never tax GMV in a way that punishes the smallest trader."],
                ["People", "A company, not a project: support, onboarding, moderation, and engineering around the founding partners."],
                ["Capital", "If outside capital is taken, it buys density and reliability, not vanity features. Partners remain responsible for the culture of the till."],
                ["Region", "Study SADC expansion only with a working Zimbabwe playbook and partners who understand local rails."],
                ["Legacy", "Khula Nathi Mhlobo is visible in outcomes: shops that grew, customers who were not cheated, and a company whose books can be explained."],
            ],
        )
    )
    story.append(Spacer(1, 10))
    story.append(img_row([assets["hero"], assets["shops"]], ["The city we serve", "The shops we start with"], height=50 * mm))

    # 15. Close
    story.append(PageBreak())
    story += section_title("Close", "The ask, the promise, and how to reach us", s)
    story.append(Paragraph("What we are asking of this book’s readers", s["h2"]))
    story.append(
        bullets(
            [
                "Team: treat this as the brief. Ship the loop. Support shops as if they are already paying.",
                "Investors: judge us on shops that sell, customers who return, and clean books. Shop GMV is not our turnover.",
                "Partners: bring distribution, training, or rails that make the loop faster. Do not ask us to become a bank on day one.",
            ],
            s["li"],
        )
    )
    story.append(Paragraph("What we promise", s["h2"]))
    story.append(
        Paragraph(
            "We will launch with a two-month free window so Zimbabwe can use LaGecto before it is asked to pay. We will keep shop money as shop money. We will build for the phone. We will tell the truth about what is live and what is still a goal.",
            s["body"],
        )
    )

    contact = [
        [
            [
                Paragraph("Company", s["card_title"]),
                Paragraph("LaGecto", s["card_body"]),
                Paragraph("Bulawayo, Zimbabwe", s["card_body"]),
                Paragraph("Smart Shopping, Khula Nathi Mhlobo", s["card_body"]),
            ],
            [
                Paragraph("Contact", s["card_title"]),
                Paragraph("lagecto.co.zw", s["card_body"]),
                Paragraph("lagecto@outlook.com", s["card_body"]),
                Paragraph("+263 71 503 4314", s["card_body"]),
            ],
        ]
    ]
    ct = Table(contact, colWidths=[usable / 2 - 2, usable / 2 - 2])
    ct.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), GREEN_DEEP),
                ("TEXTCOLOR", (0, 0), (-1, -1), white),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )
    # Need white text in contact cards
    contact_title = ParagraphStyle("ct", parent=s["card_title"], textColor=GOLD)
    contact_body = ParagraphStyle("cb", parent=s["card_body"], textColor=HexColor("#F7F3E3"))
    contact = [
        [
            [Paragraph("Company", contact_title), Paragraph("LaGecto", contact_body), Paragraph("Bulawayo, Zimbabwe", contact_body), Paragraph("Smart Shopping, Khula Nathi Mhlobo", contact_body)],
            [Paragraph("Contact", contact_title), Paragraph("lagecto.co.zw", contact_body), Paragraph("lagecto@outlook.com", contact_body), Paragraph("+263 71 503 4314", contact_body)],
        ]
    ]
    ct = Table(contact, colWidths=[usable / 2 - 2, usable / 2 - 2])
    ct.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), GREEN_DEEP),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )
    story.append(ct)
    story.append(Spacer(1, 14))
    story.append(Paragraph("Prepared for the LaGecto team and for investors. Not for public redistribution without the partners’ consent.", s["small"]))
    story.append(Paragraph("Founders and partners: Stenford Mr Ceo, Bonguthando B Lova, Mpumelelo Williams, Lawrence Ndebele.", s["small"]))
    story.append(Spacer(1, 16))
    end_logo = RLImage(str(assets["logo_tile"]), width=28 * mm, height=28 * mm)
    end_logo.hAlign = "CENTER"
    story.append(end_logo)
    story.append(Paragraph("Smart Shopping, Khula Nathi Mhlobo", s["caption"]))
    return story


def main() -> None:
    register_fonts()
    assets = prepare_assets()
    s = styles()
    DESKTOP.mkdir(parents=True, exist_ok=True)

    doc = BaseDocTemplate(
        str(OUT_PDF),
        pagesize=A4,
        title="LaGecto Company Book",
        author="LaGecto",
        subject="Team and investor company book",
        creator="LaGecto",
    )
    cover_frame = Frame(0, 0, PAGE_W, PAGE_H, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    interior_frame = Frame(MARGIN, 16 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 34 * mm, id="normal")
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=lambda c, d: draw_cover(c, d, assets)),
            PageTemplate(id="interior", frames=[interior_frame], onPage=lambda c, d: draw_interior(c, d, assets)),
        ]
    )
    # Cover is empty flow; drawing is onPage. Then interior story.
    doc.build([Spacer(1, 1)] + build_story(s, assets))
    print(f"Wrote {OUT_PDF} ({OUT_PDF.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
