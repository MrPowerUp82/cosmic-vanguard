"""
Processador de Quadrinhos (HQs) do Cosmic Vanguard
Converte arquivos PDF em páginas de alta qualidade (WebP) e miniaturas para o leitor integrado.
"""
import os
import sys
import re
from PIL import Image

try:
    import pymupdf
except ImportError:
    import fitz as pymupdf

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HQS_DIR = os.path.join(BASE_DIR, 'hqs')

def process_issue(pdf_filename, issue_id, dpi=130, quality=82):
    pdf_path = os.path.join(HQS_DIR, pdf_filename)
    if not os.path.exists(pdf_path):
        print(f"Erro: PDF não encontrado em {pdf_path}")
        return None

    issue_dir = os.path.join(HQS_DIR, issue_id)
    thumb_dir = os.path.join(issue_dir, 'thumbs')
    os.makedirs(issue_dir, exist_ok=True)
    os.makedirs(thumb_dir, exist_ok=True)

    print(f"Processando {pdf_filename} -> {issue_dir}...")
    doc = pymupdf.open(pdf_path)
    count = len(doc)

    for i, page in enumerate(doc):
        num = f"{i + 1:02d}"
        page_file = os.path.join(issue_dir, f"page_{num}.webp")
        thumb_file = os.path.join(thumb_dir, f"thumb_{num}.webp")

        pix = page.get_pixmap(dpi=dpi)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        img.save(page_file, "WEBP", quality=quality)

        thumb = img.copy()
        thumb.thumbnail((140, 200))
        thumb.save(thumb_file, "WEBP", quality=75)

        print(f"  Página {num}/{count:02d}: {pix.width}x{pix.height}")

    print(f"Concluído! {count} páginas geradas.")
    return count

if __name__ == '__main__':
    process_issue('Cosmic Vanguard 1 - A Fronteira Foi Encontrada.pdf', 'issue-1')
