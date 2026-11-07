// Convert legacy plain-text expressions while preserving existing TeX and MathML.
(function () {
  const superMap = {
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁺": "+",
    "⁻": "-",
    ⁿ: "n",
    ˣ: "x",
    ʸ: "y",
    ᶻ: "z",
    ᵗ: "t",
    ᵇ: "b",
    ᵉ: "e",
    ᵃ: "a",
    ʰ: "h",
  };
  const subMap = {
    "₀": "0",
    "₁": "1",
    "₂": "2",
    "₃": "3",
    "₄": "4",
    "₅": "5",
    "₆": "6",
    "₇": "7",
    "₈": "8",
    "₉": "9",
    "₊": "+",
    "₋": "-",
    ₐ: "a",
    ₑ: "e",
    ₓ: "x",
    ᵧ: "y",
    ₙ: "n",
    ₜ: "t",
    ᵤ: "u",
  };
  const supers = new RegExp("[" + Object.keys(superMap).join("") + "]+", "g");
  const subs = new RegExp("[" + Object.keys(subMap).join("") + "]+", "g");
  function expression(s) {
    s = s
      .replace(/\u200b/g, "")
      .replace(/−|–/g, "-")
      .replace(/＋/g, "+")
      .replace(/lim₍([^₎]+)₎/g, "lim_($1)")
      .replace(/₍([^₎]+)₎/g, "_($1)")
      .replace(
        /([⁰¹²³⁴⁵⁶⁷⁸⁹]+)√/g,
        (_, d) => "root(" + [...d].map((c) => superMap[c]).join("") + ")",
      )
      .replace(subs, (d) => "_(" + [...d].map((c) => subMap[c]).join("") + ")")
      .replace(
        supers,
        (d) => "^(" + [...d].map((c) => superMap[c]).join("") + ")",
      )
      .replace(/_\(-\)∞/g, "_(-oo)")
      .replace(/(M_\([^)]*\)M_\([^)]*\))⃗/g, "vec($1)")
      .replace(/([A-Za-zα-ωΑ-Ω])⃗/g, "vec($1)")
      .replace(/Δ([A-Za-z])/g, "(Delta $1)")
      .replace(/′/g, "'")
      .replace(/″/g, "''")
      .replace(/‴/g, "'''")
      .replace(/∣/g, "|")
      .replace(/→/g, "->")
      .replace(/∞/g, "oo")
      .replace(/π/g, "pi ")
      .replace(/θ/g, "theta ")
      .replace(/ξ/g, "xi ")
      .replace(/φ/g, "phi ")
      .replace(/σ/g, "sigma ")
      .replace(/α/g, "alpha ")
      .replace(/β/g, "beta ")
      .replace(/γ/g, "gamma ")
      .replace(/λ/g, "lambda ")
      .replace(/Γ/g, "Gamma ")
      .replace(/Δ/g, "Delta ")
      .replace(/μ/g, "mu ")
      .replace(/κ/g, "kappa ")
      .replace(/ρ/g, "rho ")
      .replace(/∼/g, " sim ").replace(/≈/g, " approx ")
      .replace(/≡/g, " equiv ")
      .replace(/∇/g, "grad ")
      .replace(/＝/g, "=")
      .replace(/＜/g, "<")
      .replace(/＞/g, ">")
      .replace(/÷/g, "/")
      .replace(/с/g, "c")
      .replace(/∂/g, "partial ")
      .replace(/∬/g, "int int ")
      .replace(/∮/g, "oint ")
      .replace(/∫/g, "int ")
      .replace(/∑|Σ/g, "sum ")
      .replace(/∛/g, "root(3)")
      .replace(/√/g, "sqrt")
      .replace(/≤/g, "<=")
      .replace(/≥/g, ">=")
      .replace(/≠/g, "!=")
      .replace(/∈/g, " in ")
      .replace(/∪/g, " uu ")
      .replace(/⊥/g, " _|_ ")
      .replace(/±/g, "+-")
      .replace(/[·⋅×]/g, "*");
    // Differential numerators and denominators must remain a complete unit.
    s = s.replace(
      /partial\s*(?:\^\([^)]*\))?\s*[A-Za-z](?:_\([^)]*\))?\s*\/\s*(?:partial\s*[A-Za-z](?:\^\([^)]*\)|_\([^)]*\))?\s*)+/g,
      (value) => {
        const [a, b] = value.split("/");
        return "(" + a + ")/(" + b.trim() + ")";
      },
    );
    s = s.replace(
      /\b(d(?:\^\([^)]*\))?[A-Za-z])\s*\/\s*(d[A-Za-z](?:\^\([^)]*\))?)/g,
      "($1)/($2)",
    );
    // Fill-in blanks are prose, not repeated subscript operators.
    return s.replace(/_{3,}/g, "quad");
  }

  window.prepareMathLayout = function (root) {
    // Use display-style fractions consistently, including imported Word MathML.
    root.querySelectorAll(".math-content math").forEach(function (math) {
      math.setAttribute("displaystyle", "true");
      math.querySelectorAll("mrow").forEach(function (row) {
        const children = [...row.children];
        if (
          !children.length ||
          !children.every((child) => child.localName === "mtext")
        )
          return;
        const fraction = row.textContent
          .trim()
          .match(/^([+-−]?(?:[0-9]+|[A-Za-zπ]))\s*\/\s*([0-9]+|[A-Za-zπ])$/);
        if (!fraction) return;
        const ns = "http://www.w3.org/1998/Math/MathML";
        const mfrac = document.createElementNS(ns, "mfrac");
        fraction.slice(1).forEach((value) => {
          const part = document.createElementNS(ns, "mrow");
          for (const character of value) {
            const tag = /[0-9]/.test(character)
              ? "mn"
              : /[+−-]/.test(character)
                ? "mo"
                : "mi";
            const token = document.createElementNS(ns, tag);
            token.textContent = character;
            part.append(token);
          }
          mfrac.append(part);
        });
        row.replaceChildren(mfrac);
      });
    });
    root.querySelectorAll(".math-content").forEach(function (element) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentElement.closest("math, mjx-container, .legacy-formula"))
          nodes.push(node);
      }
      nodes.forEach(function (node) {
        // Existing TeX is already authored and must retain its delimiters.
        const parts = node.textContent.split(
          /(\\[(][\s\S]*?\\[)]|\\\[[\s\S]*?\\\])/g,
        );
        const fragment = document.createDocumentFragment();
        parts.forEach(function (part) {
          if (part.charCodeAt(0) === 92) {
            fragment.append(document.createTextNode(part));
            return;
          }
          // Chinese prose and punctuation delimit mathematical expressions.
          part = part.replace(/([A-D])\.\s*/g, "$1．");
          const tokens = part.split(
            /([+\-−(\[]*[⁰¹²³⁴⁵⁶⁷⁸⁹A-Za-z0-9α-ωΑ-Ω∂∫∬∮∑√∛∞∇][A-Za-z0-9α-ωΑ-Ω₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿˣʸᶻᵗᵇᵉᵃʰ₊₋ₐₑₓᵧₙₜᵤ₍₎∂∫∬∮∑√∛∞∇⃗′″‴→+\-−–*/^_=<>≤≥≠∈∪∼≈≡±⊥·⋅×().,|\[\]{} \t]*)/g,
          );
          tokens.forEach(function (token) {
            if (
              /[=^/∂∫∬∮∑√∛∇₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿˣʸᶻᵗᵇᵉᵃʰₐₑₓᵧₙₜᵤ₍→⃗]/.test(token) &&
              /[A-Za-z0-9α-ωΑ-Ω∂∫∬∮∑√∛∇]/.test(token)
            ) {
              const span = document.createElement("span");
              span.className = "legacy-formula";
              span.textContent = "`" + expression(token.trim()) + "`";
              fragment.append(span);
            } else if (/^[0-9]+$/.test(token.trim())) {
              const span = document.createElement("span");
              span.className = "legacy-formula";
              span.textContent = "`" + token.trim() + "`";
              fragment.append(span);
            } else fragment.append(document.createTextNode(token));
          });
        });
        node.replaceWith(fragment);
      });
    });
  };
})();
