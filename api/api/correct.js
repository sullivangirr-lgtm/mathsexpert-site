// api/correct.js — Backend sécurisé Vercel
// La clé API est stockée en variable d'environnement, jamais exposée au client

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { images, mode, niveau, contexte } = req.body;

  if (!images || !images.length) {
    return res.status(400).json({ error: 'Aucune image fournie' });
  }

  // Limite : 5 images max, 4MB chacune
  if (images.length > 5) {
    return res.status(400).json({ error: 'Maximum 5 images' });
  }

  const modeInstr = {
    detaille: `Produis une correction TRÈS DÉTAILLÉE.
Pour chaque exercice, utilise ces balises :
<rappel>...</rappel> pour les rappels de cours
<methode>...</methode> pour la méthode
<resultat>...</resultat> pour le résultat final
<erreur>...</erreur> pour les erreurs fréquentes
Détaille chaque étape avec des paragraphes numérotés.`,
    rapide: `Correction concise : étapes clés + résultat dans <resultat>...</resultat>.`,
    comprendre: `Guide l'élève SANS donner les réponses. Indices dans <methode>...</methode>. Pas de <resultat>.`,
  };

  const prompt = `Tu es un professeur de mathématiques expert. Analyse toutes les photos d'exercices jointes.

NIVEAU : ${niveau || 'Lycée'}
${contexte ? `CONTEXTE : ${contexte}` : ''}

${modeInstr[mode] || modeInstr.detaille}

FORMAT IMPÉRATIF :
- Entoure chaque exercice dans : <exercice titre="Exercice N — Thème">...</exercice>
- TOUTES les expressions mathématiques en LaTeX KaTeX :
  * Inline : \\(expression\\)  ex: \\(f'(x) = 2x+3\\), \\(\\frac{a}{b}\\), \\(\\sqrt{x}\\)
  * Display (équation centrée) : \\[expression\\]
  * Exemples : \\(x^2+3x-1\\), \\(\\lim_{x \\to +\\infty} f(x)\\), \\(\\int_a^b f(x)\\,dx\\), \\(x \\in \\mathbb{R}\\)
  * Dérivée : \\(f'(x)\\), fraction : \\(\\frac{-b \\pm \\sqrt{\\Delta}}{2a}\\)
- NE JAMAIS écrire une formule en texte brut (pas de x^2, pas de f'(x) sans LaTeX)
- Étapes : <p><strong>Étape 1 :</strong> ...</p>

Produis UNIQUEMENT le contenu structuré avec les balises.`;

  const imageContent = images.map(img => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.mediaType || 'image/jpeg',
      data: img.data
    }
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,  // ← clé cachée côté serveur
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [...imageContent, { type: 'text', text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Erreur API' });
    }

    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('');
    return res.status(200).json({ result: raw });

  } catch (err) {
    console.error('Erreur API Claude:', err);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
}
