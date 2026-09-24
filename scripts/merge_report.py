#!/usr/bin/env python3
"""Merge cover + body into the final report PDF."""
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89

def normalize(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 0.1 or abs(h - A4_H) > 0.1:
        page.scale_to(A4_W, A4_H)
    return page

writer = PdfWriter()
writer.add_page(normalize(PdfReader('/home/z/my-project/scripts/report_cover.pdf').pages[0]))
for p in PdfReader('/home/z/my-project/download/quilt-playtest/quilt-playtest-report.pdf').pages:
    writer.add_page(normalize(p))
writer.add_metadata({
    '/Title': 'Quilt Play-Test Report: Finding the Real Value of a Reactive Cellular Runtime',
    '/Author': 'Z.ai', '/Creator': 'Z.ai',
    '/Subject': 'Extensive play-test and iteration of SuperInstance/quilt v0.3.0',
})
out = '/home/z/my-project/download/quilt-playtest/quilt-playtest-report.pdf'
with open(out, 'wb') as f:
    writer.write(f)
print('merged:', out, '| pages:', len(writer.pages))
