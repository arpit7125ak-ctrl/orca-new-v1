const fs = require('fs');

function animateCards(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let idx = 1;
  // We'll replace instances of typical card classes with animated ones.
  content = content.replace(/className="(bg-\[var\(--bg-surface\)\].*?)"/g, (match, classes) => {
    if (classes.includes('card-enter')) return match; // already applied
    const delayClass = `card-enter-${idx > 4 ? 4 : idx}`;
    idx++;
    return `className="${classes} card-enter ${delayClass} interactive-card"`;
  });
  fs.writeFileSync(filePath, content);
}

['src/components/DecisionResultsPage.jsx', 'src/components/HomeAskOrca.jsx', 'src/components/PointGrid.jsx'].forEach(animateCards);
console.log('Animated cards applied.');
