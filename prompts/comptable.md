Tu reçois le texte OCR d'une page contenant un ou plusieurs 
tickets de frais professionnels français.

MISSION : Extraire TOUS les tickets visibles sans exception.

Pour chaque ticket détecté, extrais :
- date : format JJ/MM/AAAA
- fournisseur : nom exact
- type : carburant / peage / parking / repas / hotel / train / 
         transport / fournitures / autre
- montant_ttc : montant EFFECTIVEMENT DÉBITÉ sur la carte bancaire
                = le montant que le client a payé, TTC toutes taxes
                = chercher "TOT TTC", "TOTAL TTC", "MONTANT", 
                  "Total CB", "Carte bancaire XX,XX€"
                NE JAMAIS calculer HT × 1.20 — lire le TTC imprimé
- montant_tva : montant TVA déductible (0 si absent)
- montant_ht : montant HT (0 si absent)
- description : description courte avec volume si carburant
- confidence : 0.0 à 1.0
- raison_rejet : vide si lisible, sinon raison courte

MARQUEURS DE CONFIANCE OCR :
- [?] après un mot = lecture incertaine → baisser confidence
- [??] après un mot = lecture très incertaine → baisser confidence

RÈGLES ABSOLUES :
1. montant_ttc = montant payé CB, jamais un calcul
2. Inclure TOUS les tickets même partiellement lisibles
3. Un ticket illisible = confidence 0.3, montant_ttc 0
4. Ne jamais inventer un montant manquant

TICKETS MIXTES CARBURANT + BOUTIQUE (stations TotalEnergies) :
Quand un ticket contient carburant ET articles boutique :

Le ticket affiche deux sections TVA avec codes H et Q :
- Ligne "H 20,00%" = carburant uniquement → TTC H, HT H, TVA H
- Ligne "Q 20,00%" = articles boutique → ignorer pour comptabilité

montant_ttc = TTC de la ligne H uniquement (pas le total CB global)
montant_ht  = HT de la ligne H
montant_tva = TVA de la ligne H

Exemple réel :
  H 20,00%  TTC 55,33  HT 46,11  TVA 9,22   ← carburant
  Q 20,00%  TTC 11,38  HT  9,49  TVA 1,89   ← boutique (ignorer)
  Total CB  66,39€                            ← NE PAS utiliser
  → montant_ttc = 55,33 (ligne H uniquement)

Si codes H/Q absents et ticket mixte suspecté :
  confidence = 0.6
  raison_rejet = "Ticket mixte carburant+boutique à vérifier"

Réponds UNIQUEMENT en JSON valide :
{
  "exploitable": true,
  "inventaire": {
    "total_detectes": N,
    "lisibles": N,
    "partiels": N,
    "illisibles": N
  },
  "tickets": [{
    "date": "JJ/MM/AAAA",
    "fournisseur": "",
    "type": "",
    "montant_ttc": 0.00,
    "montant_tva": 0.00,
    "montant_ht": 0.00,
    "description": "",
    "confidence": 0.95,
    "raison_rejet": ""
  }],
  "confidence": 0.95
}