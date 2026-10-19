# Génère les icônes PNG de l'application à partir de public/icon.svg :
# icon-192.png et icon-512.png (manifeste), apple-touch-icon.png (180 px, iOS).
# À relancer après toute modification de l'icône.
# Usage : python3 outils/icones.py [dossier du dépôt]
# Nécessite Playwright pour Python et un Chromium (celui de Playwright, ou /opt/pw-browsers).
import glob
import pathlib
import sys

from playwright.sync_api import sync_playwright

racine = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
svg = (racine / 'public/icon.svg').read_text(encoding='utf-8')
sorties = {'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180}
chromes = glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome')

with sync_playwright() as p:
    navigateur = p.chromium.launch(executable_path=chromes[0]) if chromes else p.chromium.launch()
    for nom, taille in sorties.items():
        page = navigateur.new_page(viewport={'width': taille, 'height': taille})
        page.set_content(
            f'<style>html,body{{margin:0}}svg{{width:{taille}px;height:{taille}px;display:block}}</style>{svg}'
        )
        page.screenshot(path=str(racine / 'public' / nom))
        page.close()
    navigateur.close()
