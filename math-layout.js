// Convert legacy plain-text expressions while preserving existing TeX and MathML.
(function () {
  function expression(text) {
    return text
      .replace(/−|–/g, '-')
      .replace(/lim₍([^₎]+)₎/g, 'lim_($1)')
      .replace(/→/g, '->')
      .replace(/Δx/g, '(Delta x)').replace(/Δ/g, 'Delta ')
      .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, function (digits) {
        return '^(' + [...digits].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join('') + ')';
      })
      .replace(/([₀₁₂₃₄₅₆₇₈₉]+)/g, function (digits) {
        return '_(' + [...digits].map(c => '₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).join('') + ')';
      })
      .replace(/∞/g, 'oo').replace(/π/g, 'pi')
      .replace(/∫/g, 'int ').replace(/∑/g, 'sum ')
      .replace(/√/g, 'sqrt').replace(/≤/g, '<=').replace(/≥/g, '>=')
      .replace(/≠/g, '!=').replace(/·/g, '*');
  }

  window.prepareMathLayout = function (root) {
    root.querySelectorAll('.math-content').forEach(function (element) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentElement.closest('math, mjx-container, .legacy-formula')) nodes.push(node);
      }
      nodes.forEach(function (node) {
        // Existing TeX is already authored and must retain its delimiters.
        const parts = node.textContent.split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g);
        const fragment = document.createDocumentFragment();
        parts.forEach(function (part) {
          if (part.startsWith('\\(') || part.startsWith('\\[')) {
            fragment.append(document.createTextNode(part));
            return;
          }
          // Chinese prose and punctuation delimit mathematical expressions.
          const tokens = part.split(/([A-Za-z0-9α-ωΑ-Ω∫∑√∞πΔ][A-Za-z0-9α-ωΑ-Ω₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹₍₎∫∑√∞πΔ′″→+\-−–*/^_=<>≤≥≠().,|\[\]{} \t]*)/g);
          tokens.forEach(function (token) {
            if (/[=^/∫∑√₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹₍→]/.test(token) && /[A-Za-z0-9∫∑√]/.test(token)) {
              const span = document.createElement('span');
              span.className = 'legacy-formula';
              span.textContent = '`' + expression(token.trim()) + '`';
              fragment.append(span);
            } else fragment.append(document.createTextNode(token));
          });
        });
        node.replaceWith(fragment);
      });
    });
  };
})();
