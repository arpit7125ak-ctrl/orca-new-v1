const fs = require('fs');
['src/components/DecisionResultsPage.jsx', 'src/components/PointGrid.jsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\\\`/g, '\`');
  content = content.replace(/\\\$/g, '$');
  fs.writeFileSync(file, content);
});
console.log('Fixed escaped backticks.');
